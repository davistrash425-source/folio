// Accounts and one-time links, stored in Postgres (lib/pg.ts). The rest of
// the app only talks to the functions exported here.
//
// Each account is one row: its whole User object in a jsonb column, plus the
// email and site address as their own columns so they can be looked up and
// kept unique. Changes go through updateUser, which locks the row while it
// reads, edits and saves it, so two requests can't overwrite each other.
import { randomUUID } from "crypto";
import { revalidateTag } from "next/cache";
import { presetDesign, type SiteDesign } from "./design";
import { database, type Query } from "./pg";
import type { CopyrightNotice } from "./reports";
import type { TemplateId } from "./templates";

export { DATA_DIR } from "./pg";

export type SocialLinks = {
  instagram?: string;
  twitter?: string;
  facebook?: string;
  website?: string;
};

export type Photo = {
  id: string;
  // The uploaded original inside the user's upload folder. New uploads are
  // named "<id>.orig.<ext>" and kept private; the site serves the variants.
  file: string;
  createdAt: string;
  description?: string; // shown as a caption on the site
  location?: string; // free text, e.g. "Lisbon, Portugal"
  alt?: string; // for screen readers; falls back to the description
  // Set for photos processed by lib/images.ts. Older photos without them
  // fall back to the original file.
  width?: number;
  height?: number;
  variants?: number[]; // widths of the "<base>-<width>.webp" copies
  copyright?: string; // the notice written into the web copies (lib/images.ts)
  // Set while the photo is taken down by Folio (app/actions/admin.ts): it's
  // off the site and its web copies are deleted, but the private original is
  // kept so it can be put back.
  removed?: { at: string; reportId?: string; note?: string };
};

export type Album = {
  id: string;
  slug: string;
  title: string;
  description?: string;
  coverPhotoId?: string; // defaults to the album's first photo
  photoIds: string[]; // in display order
};

// A private page for one client's photos, opened with a link and a password
// (lib/galleries.ts). It is separate from the portfolio site.
export type ClientGallery = {
  id: string;
  slug: string; // random, in the link: name.folio.cam/g/<slug>
  title: string;
  passwordHash: string;
  photoIds: string[]; // from the photo library, in display order
  createdAt: string;
};

export type Inquiry = {
  id: string;
  name: string;
  email: string;
  date: string; // the date the client asked about, free text
  message: string;
  createdAt: string;
  read: boolean;
  photoId?: string; // asked about from a photo's "Inquire" button
};

export type User = {
  id: string;
  email: string;
  passwordHash: string;
  subdomain: string;
  createdAt: string;
  template: TemplateId; // the theme accounts started with; see design
  profile: {
    name: string;
    bio: string;
    contactEmail: string;
    // Whether visitors see contactEmail. Missing means hidden: it starts as
    // the login email, which shouldn't go public unless the photographer says so.
    showEmail?: boolean;
    phone: string;
    location: string;
    social: SocialLinks;
    // The footer's copyright line, also written into uploaded photos.
    // Missing or empty means "© <name>" (lib/site-data.ts).
    copyrightLine?: string;
  };
  photos: Photo[];
  // Optional so accounts created before these fields existed still load.
  published?: boolean; // missing means published
  // When they agreed to the Terms and Privacy Policy at sign-up. Missing on
  // accounts made before the checkbox existed.
  termsAcceptedAt?: string;
  // Pro only (lib/plans.ts). Missing means none.
  galleries?: ClientGallery[];
  // Missing means "free" (lib/plans.ts).
  plan?: "free" | "pro";
  emailVerified?: boolean;
  // Missing means the site asks AI companies' crawlers not to collect it for
  // training (app/robots.ts); the photographer can allow them.
  allowAiTraining?: boolean;
  albums?: Album[];
  inquiries?: Inquiry[];
  // How the site looks (lib/design.ts). `design` is what visitors see;
  // `draftDesign` is what the photographer is editing until they publish.
  // Missing on older accounts, which fall back to the preset for `template`.
  design?: SiteDesign;
  draftDesign?: SiteDesign;
  designHistory?: SiteDesign[]; // earlier saved drafts, newest last, for undo
  designHistoryAt?: number; // when an autosave last added to designHistory (ms)
  // Login cookies issued before this time (ms) no longer work. Set by a
  // password reset and by "sign out everywhere".
  sessionsValidFrom?: number;
  // Set by Folio's admins (app/actions/admin.ts). A suspended site is hidden
  // and can't take uploads. An account on legal hold keeps everything (its
  // photos and the account can't be deleted), as evidence the law may
  // require Folio to preserve. Strikes are upheld copyright notices, counted
  // for the repeat-infringer policy.
  suspended?: { at: string; reason: string };
  legalHold?: { at: string; note: string };
  strikes?: { at: string; reportId: string }[];
  // Folio staff's private notes about the account (app/actions/admin.ts).
  // Never shown to the photographer or included in their export.
  adminNotes?: { id: string; at: string; by: string; text: string }[];
  // An admin's extra site: the admin's account id. It has no password and a
  // made-up email; the admin reaches it by switching sites (app/actions/sites.ts).
  managedBy?: string;
  // Set when the account was created (or later linked) via "Continue with
  // Google". Google users have an empty passwordHash and confirm by address.
  googleId?: string;
  // When we emailed a reminder that the site is still a draft (once only).
  draftReminderAt?: string;
};

// One-time links for password resets and email verification. Only a hash of
// the token is stored, so a leaked database can't be used to log in.
export type Token = {
  hash: string;
  userId: string;
  kind: "reset" | "verify";
  expiresAt: string;
};

type TokenRow = { hash: string; user_id: string; kind: Token["kind"]; expires_at: Date | string };
const toToken = (r: TokenRow): Token => ({
  hash: r.hash,
  userId: r.user_id,
  kind: r.kind,
  expiresAt: new Date(r.expires_at).toISOString(),
});

async function findUser(where: "id" | "email" | "subdomain", value: string) {
  const db = await database();
  const { rows } = await db.query<{ data: User }>(`select data from users where ${where} = $1`, [value]);
  return rows[0]?.data ?? null;
}

export async function findUserById(id: string) {
  return findUser("id", id);
}

export async function findUserByEmail(email: string) {
  return findUser("email", email.toLowerCase());
}

export async function findUserBySubdomain(subdomain: string) {
  return findUser("subdomain", subdomain.toLowerCase());
}

// Saves the user's row from the object, inside a transaction.
const save = (query: Query, user: User) =>
  query("update users set email = $2, subdomain = $3, data = $4 where id = $1", [
    user.id,
    user.email,
    user.subdomain,
    JSON.stringify(user),
  ]);

export async function createUser(input: {
  email: string;
  passwordHash: string;
  subdomain: string;
  name: string;
  published: boolean;
  googleId?: string;
  emailVerified?: boolean;
  // The person ticked "I agree to the Terms and Privacy Policy".
  termsAcceptedAt?: boolean;
}) {
  const email = input.email.toLowerCase();
  const subdomain = input.subdomain.toLowerCase();
  const user: User = {
    id: randomUUID(),
    email,
    passwordHash: input.passwordHash,
    subdomain,
    createdAt: new Date().toISOString(),
    template: "minimal",
    profile: {
      name: input.name,
      bio: "",
      contactEmail: email,
      phone: "",
      location: "",
      social: {},
    },
    photos: [],
    published: input.published,
    design: presetDesign(),
    emailVerified: input.emailVerified ?? false,
    albums: [],
    inquiries: [],
    ...(input.googleId ? { googleId: input.googleId } : {}),
    ...(input.termsAcceptedAt ? { termsAcceptedAt: new Date().toISOString() } : {}),
  };
  const db = await database();
  try {
    await db.query("insert into users (id, email, subdomain, data) values ($1, $2, $3, $4)", [
      user.id,
      email,
      subdomain,
      JSON.stringify(user),
    ]);
  } catch (err) {
    // The unique columns decide, so two sign-ups at once can't both win.
    const message = (err as Error).message;
    if (message.includes("users_email_key")) throw new Error("EMAIL_TAKEN");
    if (message.includes("users_subdomain_key")) throw new Error("SUBDOMAIN_TAKEN");
    throw err;
  }
  // An address someone visited before it was claimed may be cached as missing.
  siteChanged(subdomain);
  return user;
}

// Tells the cached public site (lib/public-site.ts) to rebuild. `expire: 0`
// means nobody is served the old version while it rebuilds.
function siteChanged(subdomain: string) {
  revalidateTag(`site:${subdomain.toLowerCase()}`, { expire: 0 });
}

// Reads the user, lets `fn` change it, and saves it, with the row locked
// throughout. If `fn` throws, nothing is saved.
// Pass `{ publicChange: false }` for changes visitors can't see (like the
// design draft), so they don't throw away the public site's cache.
export async function updateUser(id: string, fn: (user: User) => void, opts: { publicChange?: boolean } = {}) {
  const db = await database();
  const user = await db.transaction(async (query) => {
    const { rows } = await query<{ data: User }>("select data from users where id = $1 for update", [id]);
    const user = rows[0]?.data;
    if (!user) throw new Error("USER_NOT_FOUND");
    fn(user);
    await save(query, user);
    return user;
  });
  if (opts.publicChange !== false) siteChanged(user.subdomain);
  return user;
}

export async function deleteUser(id: string) {
  const db = await database();
  const subdomain = await db.transaction(async (query) => {
    const { rows } = await query<{ subdomain: string; manager: string | null }>(
      "delete from users where id = $1 returning subdomain, data->>'managedBy' as manager",
      [id],
    );
    await query("delete from tokens where user_id = $1", [id]);
    // Remember the address, so it stays unavailable for a while
    // (subdomainOnHold). An admin's extra site leaves it free for that admin.
    if (rows[0]) {
      await query("insert into storage_cleanup (user_id) values ($1) on conflict do nothing", [id]);
      await query(
        "insert into released_subdomains (subdomain, user_id) values ($1, $2) on conflict (subdomain) do update set released_at = now(), user_id = $2",
        [rows[0].subdomain, rows[0].manager],
      );
    }
    return rows[0]?.subdomain;
  });
  if (subdomain) siteChanged(subdomain);
}

// Deleted accounts whose files haven't been removed from storage yet.
export async function pendingStorageCleanups(limit = 100) {
  const db = await database();
  const { rows } = await db.query<{ user_id: string }>(
    "select user_id from storage_cleanup order by queued_at limit $1",
    [limit],
  );
  return rows.map((r) => r.user_id);
}

export async function finishStorageCleanup(userId: string) {
  const db = await database();
  await db.query("delete from storage_cleanup where user_id = $1", [userId]);
}

// Verified accounts whose site is still a draft `days` days after sign-up and
// who haven't been reminded yet.
export async function accountsToRemindAboutDraft(days: number, limit: number) {
  const db = await database();
  const { rows } = await db.query<{ id: string }>(
    `select id from users
     where data->>'published' = 'false' and data->>'emailVerified' = 'true'
       and data->'suspended' is null and data->>'managedBy' is null
       and data->>'draftReminderAt' is null
       and (data->>'createdAt')::timestamptz < now() - ($1 || ' days')::interval
     order by id limit $2`,
    [String(days), limit],
  );
  return rows.map((r) => r.id);
}

// Moves an account to a new address. As at sign-up, the unique column decides
// who gets an address. The old one is held (subdomainOnHold) so nobody else
// can take it and pass as this photographer, though they can move back to it.
// Reports about the site follow it to the new address.
export async function changeSubdomain(id: string, subdomain: string) {
  const next = subdomain.toLowerCase();
  const db = await database();
  let previous: string;
  try {
    previous = await db.transaction(async (query) => {
      const { rows } = await query<{ data: User }>("select data from users where id = $1 for update", [id]);
      const user = rows[0]?.data;
      if (!user) throw new Error("USER_NOT_FOUND");
      const old = user.subdomain;
      if (old === next) return old;
      user.subdomain = next;
      await save(query, user);
      await query("delete from released_subdomains where subdomain = $1", [next]);
      await query(
        `insert into released_subdomains (subdomain, user_id) values ($1, $2)
         on conflict (subdomain) do update set released_at = now(), user_id = $2`,
        [old, id],
      );
      await query("update reports set subdomain = $2 where subdomain = $1", [old, next]);
      return old;
    });
  } catch (err) {
    if ((err as Error).message.includes("users_subdomain_key")) throw new Error("SUBDOMAIN_TAKEN");
    throw err;
  }
  siteChanged(previous);
  siteChanged(next);
}

// An admin's extra sites (User.managedBy), by address.
export async function managedSites(adminId: string) {
  const db = await database();
  const { rows } = await db.query<{ data: User }>(
    "select data from users where data->>'managedBy' = $1 order by subdomain",
    [adminId],
  );
  return rows.map((r) => r.data);
}

// Every account's id, for maintenance that goes through all of them.
export async function allUserIds() {
  const db = await database();
  const { rows } = await db.query<{ id: string }>("select id from users order by id");
  return rows.map((r) => r.id);
}

// Photos whose web copies were made before they carried the copyright
// details (lib/images.ts). Taken-down photos have no web copies to fix.
export async function photosWithoutRights() {
  const db = await database();
  const { rows } = await db.query<{ count: number }>(
    `select count(*)::int as count from users, jsonb_array_elements(data->'photos') as photo
     where photo->>'copyright' is null and photo->'removed' is null
       and jsonb_array_length(coalesce(photo->'variants', '[]'::jsonb)) > 0`,
  );
  return rows[0]?.count ?? 0;
}

// Whether the address was given up in the last `months`, by a closed account
// or one that moved. It isn't held from `forUserId` if that account moved away
// from it.
export async function subdomainOnHold(subdomain: string, months: number, forUserId?: string) {
  const db = await database();
  const { rows } = await db.query(
    `select 1 from released_subdomains where subdomain = $1 and released_at > now() - make_interval(months => $2)
     and (user_id is null or user_id is distinct from $3)`,
    [subdomain.toLowerCase(), months, forUserId ?? null],
  );
  return rows.length > 0;
}

export async function addToken(token: Token) {
  const db = await database();
  await db.transaction(async (query) => {
    // Drop expired tokens and older ones of the same kind for this user.
    await query("delete from tokens where expires_at <= now() or (user_id = $1 and kind = $2)", [
      token.userId,
      token.kind,
    ]);
    await query("insert into tokens (hash, user_id, kind, expires_at) values ($1, $2, $3, $4)", [
      token.hash,
      token.userId,
      token.kind,
      token.expiresAt,
    ]);
  });
}

// Removes the token and returns it if it exists and hasn't expired.
export async function takeToken(hash: string, kind: Token["kind"]) {
  const db = await database();
  const { rows } = await db.query<TokenRow>("delete from tokens where hash = $1 and kind = $2 returning *", [
    hash,
    kind,
  ]);
  const token = rows[0] ? toToken(rows[0]) : null;
  return token && Date.parse(token.expiresAt) > Date.now() ? token : null;
}

// A visitor's report about a site (copyright, harmful content…), kept so
// nothing is lost if the email about it fails. Copyright notices also keep
// their parts separately in `notice`.
export type Report = {
  subdomain: string;
  reason: string;
  details: string;
  reporterEmail: string;
  notice?: CopyrightNotice;
};

export async function addReport(report: Report) {
  const db = await database();
  const id = randomUUID();
  await db.query(
    "insert into reports (id, subdomain, reason, details, reporter_email, notice) values ($1, $2, $3, $4, $5, $6)",
    [
      id,
      report.subdomain,
      report.reason,
      report.details,
      report.reporterEmail,
      report.notice ? JSON.stringify(report.notice) : null,
    ],
  );
  return id;
}

// A report as the admin pages show it: open until an admin closes it.
export type SavedReport = Report & {
  id: string;
  status: "open" | "closed";
  note: string; // what the admin did about it
  createdAt: string;
  closedAt?: string;
};

type ReportRow = {
  id: string;
  subdomain: string;
  reason: string;
  details: string;
  reporter_email: string;
  notice: CopyrightNotice | null;
  status: string;
  note: string | null;
  created_at: Date | string;
  closed_at: Date | string | null;
};
const toReport = (r: ReportRow): SavedReport => ({
  id: r.id,
  subdomain: r.subdomain,
  reason: r.reason,
  details: r.details,
  reporterEmail: r.reporter_email,
  ...(r.notice ? { notice: r.notice } : {}),
  status: r.status === "closed" ? "closed" : "open",
  note: r.note ?? "",
  createdAt: new Date(r.created_at).toISOString(),
  ...(r.closed_at ? { closedAt: new Date(r.closed_at).toISOString() } : {}),
});

// Open reports first, then the most recently closed; newest first in each.
export async function listReports(limit = 200) {
  const db = await database();
  const { rows } = await db.query<ReportRow>(
    "select * from reports order by status = 'closed', coalesce(closed_at, created_at) desc limit $1",
    [limit],
  );
  return rows.map(toReport);
}

export async function findReport(id: string) {
  const db = await database();
  const { rows } = await db.query<ReportRow>("select * from reports where id = $1", [id]);
  return rows[0] ? toReport(rows[0]) : null;
}

export async function reportsForSite(subdomain: string) {
  const db = await database();
  const { rows } = await db.query<ReportRow>("select * from reports where subdomain = $1 order by created_at desc", [
    subdomain.toLowerCase(),
  ]);
  return rows.map(toReport);
}

export async function setReportStatus(id: string, status: SavedReport["status"], note: string) {
  const db = await database();
  await db.query(
    "update reports set status = $2, note = $3, closed_at = case when $2 = 'closed' then now() end where id = $1",
    [id, status, note],
  );
}

// Everything an admin does to an account, kept as a record that notices
// were acted on and the repeat-infringer policy was applied.
export type AdminAction = {
  at: string;
  adminEmail: string;
  userId: string;
  subdomain: string;
  reportId?: string;
  action: string; // e.g. "remove-photos"
  detail: string; // in words, for people reading the log
};

export async function logAdminAction(entry: Omit<AdminAction, "at">) {
  const db = await database();
  await db.query(
    "insert into admin_actions (id, admin_email, user_id, subdomain, report_id, action, detail) values ($1, $2, $3, $4, $5, $6, $7)",
    [randomUUID(), entry.adminEmail, entry.userId, entry.subdomain, entry.reportId ?? null, entry.action, entry.detail],
  );
}

// Newest first. Keyed by the account's id, so the log outlives a change of
// site address.
export async function adminActionsFor(userId: string) {
  const db = await database();
  const { rows } = await db.query<{
    at: Date | string;
    admin_email: string;
    user_id: string;
    subdomain: string;
    report_id: string | null;
    action: string;
    detail: string;
  }>("select * from admin_actions where user_id = $1 order by at desc", [userId]);
  return rows.map(
    (r): AdminAction => ({
      at: new Date(r.at).toISOString(),
      adminEmail: r.admin_email,
      userId: r.user_id,
      subdomain: r.subdomain,
      ...(r.report_id ? { reportId: r.report_id } : {}),
      action: r.action,
      detail: r.detail,
    }),
  );
}

// ── Admin oversight (app/admin) ─────────────────────────────────────────
// Read-only summaries over every account, computed in SQL from the users
// table so the admin pages never load whole accounts.

// Mirror isLive (lib/site.ts) and the other flags, as SQL over the jsonb.
const SQL_PUBLISHED = "coalesce((data->>'published')::boolean, true)";
const SQL_VERIFIED = "coalesce((data->>'emailVerified')::boolean, false)";
const SQL_SUSPENDED = "((data->'suspended') is not null)";
const SQL_LIVE = `(${SQL_PUBLISHED} and ${SQL_VERIFIED} and not ${SQL_SUSPENDED})`;
const SQL_STRIKES = "(jsonb_array_length(coalesce(data->'strikes', '[]'::jsonb)) > 0)";
const SQL_HOLD = "((data->'legalHold') is not null)";
const SQL_CREATED = "(data->>'createdAt')::timestamptz";
// An admin's extra sites aren't counted as separate photographers.
const SQL_OWN = "((data->>'managedBy') is null)";

export type AdminOverview = {
  accounts: number;
  live: number;
  draft: number; // taken offline by the photographer, not suspended
  suspended: number;
  unverified: number;
  withStrikes: number;
  onHold: number;
  photos: number;
  signups7: number;
  signups30: number;
  openReports: number;
  openCopyright: number;
  oldestOpenReports: { id: string; subdomain: string; reason: string; createdAt: string }[];
  staleUnverified: { subdomain: string; email: string; createdAt: string }[];
  suspendedSites: { subdomain: string; reason: string; at: string }[];
};

// Accounts still unconfirmed after this long are listed as needing attention.
export const UNVERIFIED_ATTENTION_DAYS = 3;

export async function adminOverview(): Promise<AdminOverview> {
  const db = await database();
  const counts = (
    await db.query<{
      accounts: number;
      live: number;
      draft: number;
      suspended: number;
      unverified: number;
      withStrikes: number;
      onHold: number;
      photos: number;
      signups7: number;
      signups30: number;
    }>(
      `select count(*)::int as accounts,
         (count(*) filter (where ${SQL_LIVE}))::int as live,
         (count(*) filter (where not ${SQL_PUBLISHED} and not ${SQL_SUSPENDED}))::int as draft,
         (count(*) filter (where ${SQL_SUSPENDED}))::int as suspended,
         (count(*) filter (where not ${SQL_VERIFIED}))::int as unverified,
         (count(*) filter (where ${SQL_STRIKES}))::int as "withStrikes",
         (count(*) filter (where ${SQL_HOLD}))::int as "onHold",
         coalesce(sum(jsonb_array_length(coalesce(data->'photos', '[]'::jsonb))), 0)::int as photos,
         (count(*) filter (where ${SQL_CREATED} > now() - interval '7 days'))::int as signups7,
         (count(*) filter (where ${SQL_CREATED} > now() - interval '30 days'))::int as signups30
       from users where ${SQL_OWN}`,
    )
  ).rows[0];
  const reports = (
    await db.query<{ open: number; copyright: number }>(
      `select (count(*) filter (where status = 'open'))::int as open,
              (count(*) filter (where status = 'open' and reason = 'copyright'))::int as copyright
       from reports`,
    )
  ).rows[0];
  const oldest = await db.query<{ id: string; subdomain: string; reason: string; created_at: Date | string }>(
    "select id, subdomain, reason, created_at from reports where status = 'open' order by created_at asc limit 10",
  );
  const stale = await db.query<{ subdomain: string; email: string; created: string }>(
    `select subdomain, email, data->>'createdAt' as created from users
     where ${SQL_OWN} and not ${SQL_VERIFIED} and ${SQL_CREATED} < now() - make_interval(days => $1)
     order by ${SQL_CREATED} asc limit 10`,
    [UNVERIFIED_ATTENTION_DAYS],
  );
  const suspended = await db.query<{ subdomain: string; reason: string; at: string }>(
    `select subdomain, data->'suspended'->>'reason' as reason, data->'suspended'->>'at' as at from users
     where ${SQL_SUSPENDED} order by data->'suspended'->>'at' desc limit 10`,
  );
  return {
    accounts: counts.accounts,
    live: counts.live,
    draft: counts.draft,
    suspended: counts.suspended,
    unverified: counts.unverified,
    withStrikes: counts.withStrikes,
    onHold: counts.onHold,
    photos: counts.photos,
    signups7: counts.signups7,
    signups30: counts.signups30,
    openReports: reports?.open ?? 0,
    openCopyright: reports?.copyright ?? 0,
    oldestOpenReports: oldest.rows.map((r) => ({
      id: r.id,
      subdomain: r.subdomain,
      reason: r.reason,
      createdAt: new Date(r.created_at).toISOString(),
    })),
    staleUnverified: stale.rows.map((r) => ({ subdomain: r.subdomain, email: r.email, createdAt: r.created })),
    suspendedSites: suspended.rows.map((r) => ({ subdomain: r.subdomain, reason: r.reason, at: r.at })),
  };
}

export const ACCOUNT_FILTERS = {
  live: SQL_LIVE,
  draft: `(not ${SQL_PUBLISHED} and not ${SQL_SUSPENDED})`,
  suspended: SQL_SUSPENDED,
  unverified: `(not ${SQL_VERIFIED})`,
  strikes: SQL_STRIKES,
  hold: SQL_HOLD,
  admin: "(lower(email) = any($ADMINS::text[]))",
} as const;
export type AccountFilter = keyof typeof ACCOUNT_FILTERS;
export const isAccountFilter = (value: unknown): value is AccountFilter =>
  typeof value === "string" && Object.hasOwn(ACCOUNT_FILTERS, value);

export const ADMIN_PAGE_SIZE = 50;

export type AccountRow = {
  id: string;
  email: string;
  subdomain: string;
  name: string;
  createdAt: string;
  photos: number;
  live: boolean;
  published: boolean;
  verified: boolean;
  suspended: boolean;
  strikes: number;
  hold: boolean;
  extraSite: boolean;
};

type AccountSqlRow = {
  id: string;
  email: string;
  subdomain: string;
  name: string | null;
  created: string;
  photos: number;
  live: boolean;
  published: boolean;
  verified: boolean;
  suspended: boolean;
  strikes: number;
  hold: boolean;
  extra: boolean;
};

// Only the fields the admin tables show, never the whole jsonb document.
const ACCOUNT_COLUMNS = `id, email, subdomain, data->'profile'->>'name' as name, data->>'createdAt' as created,
  jsonb_array_length(coalesce(data->'photos', '[]'::jsonb))::int as photos,
  ${SQL_LIVE} as live, ${SQL_PUBLISHED} as published, ${SQL_VERIFIED} as verified, ${SQL_SUSPENDED} as suspended,
  jsonb_array_length(coalesce(data->'strikes', '[]'::jsonb))::int as strikes, ${SQL_HOLD} as hold,
  not ${SQL_OWN} as extra`;

const toAccountRow = (r: AccountSqlRow): AccountRow => ({
  id: r.id,
  email: r.email,
  subdomain: r.subdomain,
  name: r.name ?? "",
  createdAt: r.created,
  photos: r.photos,
  live: r.live,
  published: r.published,
  verified: r.verified,
  suspended: r.suspended,
  strikes: r.strikes,
  hold: r.hold,
  extraSite: r.extra,
});

// Escapes the characters that mean something to LIKE.
const likePattern = (text: string) => `%${text.replace(/[\\%_]/g, "\\$&")}%`;

// Accounts, newest first. `q` matches name, email or address; `filter` is one
// of ACCOUNT_FILTERS; `admins` are the full admins' emails (for "admin").
export async function listAccounts(opts: { q?: string; filter?: AccountFilter; page?: number; admins?: string[] }) {
  const db = await database();
  const where: string[] = [];
  const params: unknown[] = [];
  const q = (opts.q ?? "").trim().slice(0, 100);
  if (q) {
    params.push(likePattern(q));
    const n = params.length;
    where.push(`(email ilike $${n} or subdomain ilike $${n} or data->'profile'->>'name' ilike $${n})`);
  }
  if (opts.filter) {
    let clause: string = ACCOUNT_FILTERS[opts.filter];
    if (clause.includes("$ADMINS")) {
      params.push(opts.admins ?? []);
      clause = clause.replace("$ADMINS", `$${params.length}`);
    }
    where.push(clause);
  }
  const condition = where.length ? `where ${where.join(" and ")}` : "";
  const total = (await db.query<{ count: number }>(`select count(*)::int as count from users ${condition}`, params)).rows[0]?.count ?? 0;
  const pages = Math.max(1, Math.ceil(total / ADMIN_PAGE_SIZE));
  const page = Math.min(Math.max(1, Math.floor(opts.page ?? 1) || 1), pages);
  const { rows } = await db.query<AccountSqlRow>(
    `select ${ACCOUNT_COLUMNS} from users ${condition}
     order by ${SQL_CREATED} desc, id
     limit ${ADMIN_PAGE_SIZE} offset ${(page - 1) * ADMIN_PAGE_SIZE}`,
    params,
  );
  return { total, page, pages, rows: rows.map(toAccountRow) };
}

// Every account in one list, newest first, for the plain "all accounts" page.
export async function listAllAccounts() {
  const db = await database();
  const { rows } = await db.query<AccountSqlRow>(`select ${ACCOUNT_COLUMNS} from users order by ${SQL_CREATED} desc, id`);
  return rows.map(toAccountRow);
}

// The whole admin log, newest first, with optional filters. Paginated.
export async function listAdminLog(opts: { admin?: string; action?: string; subdomain?: string; page?: number }) {
  const db = await database();
  const where: string[] = [];
  const params: unknown[] = [];
  if (opts.admin) {
    params.push(opts.admin.trim().toLowerCase());
    where.push(`lower(admin_email) = $${params.length}`);
  }
  if (opts.action) {
    params.push(opts.action);
    where.push(`action = $${params.length}`);
  }
  if (opts.subdomain) {
    params.push(opts.subdomain.trim().toLowerCase());
    where.push(`lower(subdomain) = $${params.length}`);
  }
  const condition = where.length ? `where ${where.join(" and ")}` : "";
  const total = (await db.query<{ count: number }>(`select count(*)::int as count from admin_actions ${condition}`, params)).rows[0]?.count ?? 0;
  const pages = Math.max(1, Math.ceil(total / ADMIN_PAGE_SIZE));
  const page = Math.min(Math.max(1, Math.floor(opts.page ?? 1) || 1), pages);
  const { rows } = await db.query<{
    at: Date | string;
    admin_email: string;
    user_id: string;
    subdomain: string;
    report_id: string | null;
    action: string;
    detail: string;
  }>(
    `select * from admin_actions ${condition} order by at desc, id limit ${ADMIN_PAGE_SIZE} offset ${(page - 1) * ADMIN_PAGE_SIZE}`,
    params,
  );
  return {
    total,
    page,
    pages,
    rows: rows.map(
      (r): AdminAction => ({
        at: new Date(r.at).toISOString(),
        adminEmail: r.admin_email,
        userId: r.user_id,
        subdomain: r.subdomain,
        ...(r.report_id ? { reportId: r.report_id } : {}),
        action: r.action,
        detail: r.detail,
      }),
    ),
  };
}

// What the log's filters offer: everyone who has logged something, and every
// kind of action.
export async function adminLogChoices() {
  const db = await database();
  const admins = await db.query<{ v: string }>("select distinct admin_email as v from admin_actions order by 1");
  const actions = await db.query<{ v: string }>("select distinct action as v from admin_actions order by 1");
  return { admins: admins.rows.map((r) => r.v), actions: actions.rows.map((r) => r.v) };
}

// Records that staff opened an account's admin page, at most once an hour per
// person and account so browsing around doesn't flood the log.
export async function logAdminView(entry: { adminEmail: string; userId: string; subdomain: string }) {
  const db = await database();
  await db.query(
    `insert into admin_actions (id, admin_email, user_id, subdomain, action, detail)
     select $1, $2, $3, $4, 'viewed', 'Opened the account page.'
     where not exists (
       select 1 from admin_actions
       where action = 'viewed' and admin_email = $2 and user_id = $3 and at > now() - interval '1 hour'
     )`,
    [randomUUID(), entry.adminEmail, entry.userId, entry.subdomain],
  );
}
