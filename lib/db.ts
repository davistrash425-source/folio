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
  // Storage used: the original plus every web copy, in bytes. Photos from
  // before this was recorded have none and count as 0 (lib/plans.ts).
  bytes?: number;
  // Set while the photo is taken down by Folio (app/actions/admin.ts): it's
  // off the site and its web copies are deleted, but the private original is
  // kept so it can be put back.
  removed?: { at: string; reportId?: string; note?: string };
  // The photographer chose to keep it off their public site (lib/site-photos.ts).
  // It can still be used in client galleries.
  hiddenFromSite?: boolean;
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
  expiresAt?: string; // last day the link works, "YYYY-MM-DD" (UTC); none = never
  favouriteIds?: string[]; // photos the client hearted
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
  // Who last set `plan`. Missing or "billing" means the payment webhook
  // (lib/billing-webhook.ts) may change it; "manual" means a Folio admin set it
  // (a free account for a friend, say), and payments never override that.
  planSource?: "billing" | "manual";
  // The Polar subscription behind a paid plan (lib/billing.ts). Only the
  // webhook writes it; missing means the account never subscribed.
  billing?: {
    subscriptionId: string;
    status: string; // Polar's: active, past_due, canceled, revoked, ...
    interval: "month" | "year";
    currentPeriodEnd?: string; // ISO date
    cancelAtPeriodEnd?: boolean;
    lastEventId?: string; // a redelivered webhook with this id is ignored
    updatedAt?: string; // Polar's modified_at; older events are ignored
    // Every subscription that still grants Pro, so deleting the account ends
    // them all. Missing on accounts whose single subscription predates this.
    activeSubscriptionIds?: string[];
    // Subscriptions whose payment was refunded in full. They ended Pro right
    // away (lib/billing-webhook.ts) and never grant it again, even if a late
    // event still calls them active.
    refundedSubscriptionIds?: string[];
  };
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
  // Direct uploads started but not finished yet, so their bytes count toward
  // the storage limit (app/api/photos/start). Each lasts as long as its
  // upload address; finishing the upload removes it.
  pendingUploads?: { file: string; bytes: number; expires: number }[];
  // Folio AGENTS switched on for this account by a Folio admin (agentsAllowed
  // in lib/plans.ts). Missing means off.
  agents?: { enabled: boolean; at: string; by: string };
  // What the agents may use in replies: rates, tone and rules. Written by the photographer on the Your business page.
  business?: { rates: string; tone: string; rules: string; updatedAt: string };
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

// Throws "LEGAL_HOLD" if the account is on hold. The hold is checked in the
// same statement that deletes, so one placed after the caller's check still
// stops it.
export async function deleteUser(id: string) {
  await deleteUsers([id]);
}

// Deletes the accounts together (an admin's account and its extra sites): if
// any is on legal hold, this throws LEGAL_HOLD and none is deleted.
export async function deleteUsers(ids: string[]) {
  const db = await database();
  const subdomains = await db.transaction(async (query) => {
    const deleted: string[] = [];
    for (const id of ids) {
      const { rows } = await query<{ subdomain: string; manager: string | null }>(
        "delete from users where id = $1 and (data->'legalHold') is null returning subdomain, data->>'managedBy' as manager",
        [id],
      );
      if (!rows[0] && (await query("select 1 from users where id = $1", [id])).rows.length) throw new Error("LEGAL_HOLD");
      await query("delete from tokens where user_id = $1", [id]);
      // Remember the address, so it stays unavailable for a while
      // (subdomainOnHold). An admin's extra site leaves it free for that admin.
      if (rows[0]) {
        // The agents' records go with the account (a legal hold, which skips
        // this block, keeps them).
        for (const table of ["agent_tasks", "approvals", "agent_runs", "agent_chat"]) {
          await query(`delete from ${table} where user_id = $1`, [id]);
        }
        await query("insert into storage_cleanup (user_id) values ($1) on conflict do nothing", [id]);
        await query(
          "insert into released_subdomains (subdomain, user_id) values ($1, $2) on conflict (subdomain) do update set released_at = now(), user_id = $2",
          [rows[0].subdomain, rows[0].manager],
        );
        deleted.push(rows[0].subdomain);
      }
    }
    return deleted;
  });
  for (const subdomain of subdomains) siteChanged(subdomain);
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

// Whether the user has an unexpired link of this kind still waiting, so a
// second request keeps the first link rather than replacing it.
export async function hasPendingToken(userId: string, kind: Token["kind"]) {
  const db = await database();
  const { rows } = await db.query("select 1 from tokens where user_id = $1 and kind = $2 and expires_at > now()", [
    userId,
    kind,
  ]);
  return rows.length > 0;
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

// ---- Agents ----
// Every function below that concerns one account takes its id and puts
// `user_id = $n` in the SQL, so a row id from another account finds nothing.

const iso = (d: Date | string) => new Date(d).toISOString();
const isoOrNull = (d: Date | string | null) => (d ? iso(d) : null);

export type AgentTask = {
  id: string;
  userId: string;
  agent: string;
  status: "queued" | "running" | "done" | "failed" | "stopped";
  input: unknown;
  result: unknown | null;
  error: string | null;
  attempts: number;
  parentTaskId: string | null;
  createdAt: string;
  claimedAt: string | null;
  finishedAt: string | null;
};

type AgentTaskRow = {
  id: string;
  user_id: string;
  agent: string;
  status: AgentTask["status"];
  input: unknown;
  result: unknown | null;
  error: string | null;
  attempts: number;
  parent_task_id: string | null;
  created_at: Date | string;
  claimed_at: Date | string | null;
  finished_at: Date | string | null;
};
const toAgentTask = (r: AgentTaskRow): AgentTask => ({
  id: r.id,
  userId: r.user_id,
  agent: r.agent,
  status: r.status,
  input: r.input,
  result: r.result ?? null,
  error: r.error,
  attempts: r.attempts,
  parentTaskId: r.parent_task_id,
  createdAt: iso(r.created_at),
  claimedAt: isoOrNull(r.claimed_at),
  finishedAt: isoOrNull(r.finished_at),
});

export async function createAgentTask(input: { userId: string; agent: string; input: unknown; parentTaskId?: string }) {
  const db = await database();
  const { rows } = await db.query<AgentTaskRow>(
    "insert into agent_tasks (id, user_id, agent, input, parent_task_id) values ($1, $2, $3, $4, $5) returning *",
    [randomUUID(), input.userId, input.agent, JSON.stringify(input.input), input.parentTaskId ?? null],
  );
  return toAgentTask(rows[0]);
}

export async function findAgentTask(userId: string, id: string) {
  const db = await database();
  const { rows } = await db.query<AgentTaskRow>("select * from agent_tasks where id = $1 and user_id = $2", [id, userId]);
  return rows[0] ? toAgentTask(rows[0]) : null;
}

export async function listAgentTasks(userId: string, limit = 50) {
  const db = await database();
  const { rows } = await db.query<AgentTaskRow>(
    "select * from agent_tasks where user_id = $1 order by created_at desc, id limit $2",
    [userId, limit],
  );
  return rows.map(toAgentTask);
}

// Only a queued or running task changes, so a stopped task stays stopped even
// if the agent finishes after the stop. Returns whether anything changed.
export async function finishAgentTask(
  userId: string,
  id: string,
  outcome: { status: "done" | "failed"; result?: unknown; error?: string },
) {
  const db = await database();
  const { rows } = await db.query(
    `update agent_tasks set status = $3, result = $4, error = $5, finished_at = now()
     where id = $1 and user_id = $2 and status in ('queued', 'running') returning id`,
    [id, userId, outcome.status, outcome.result === undefined ? null : JSON.stringify(outcome.result), outcome.error ?? null],
  );
  return rows.length > 0;
}

// How many tasks this one has queued for other agents (the manager's cap).
export async function countChildAgentTasks(userId: string, parentTaskId: string) {
  const db = await database();
  const { rows } = await db.query<{ n: string | number }>(
    "select count(*) as n from agent_tasks where user_id = $1 and parent_task_id = $2",
    [userId, parentTaskId],
  );
  return Number(rows[0].n);
}

export async function stopAgentTask(userId: string, id: string) {
  const db = await database();
  const { rows } = await db.query(
    `update agent_tasks set status = 'stopped', finished_at = now()
     where id = $1 and user_id = $2 and status in ('queued', 'running') returning id`,
    [id, userId],
  );
  return rows.length > 0;
}

// The one agent-task function deliberately not scoped to one account: the
// background worker serves every account's queue, so it takes the oldest ready
// task of anyone. It then acts only through the task's own user_id. A queued
// task is ready when claimed_at is null or has passed (see requeueAgentTask).
// `skip locked` means two workers never take the same row.
export async function claimNextAgentTask() {
  const db = await database();
  const { rows } = await db.query<AgentTaskRow>(
    `update agent_tasks set status = 'running', claimed_at = now(), attempts = attempts + 1
     where id = (
       select id from agent_tasks
       where status = 'queued' and (claimed_at is null or claimed_at <= now())
       order by created_at, id limit 1 for update skip locked
     ) returning *`,
  );
  return rows[0] ? toAgentTask(rows[0]) : null;
}

// Takes one named queued task for a caller that runs it right away (chat).
// The guarded update means chat and the worker can't both take a task.
export async function claimAgentTask(userId: string, id: string) {
  const db = await database();
  const { rows } = await db.query(
    `update agent_tasks set status = 'running', claimed_at = now(), attempts = attempts + 1
     where id = $1 and user_id = $2 and status = 'queued' returning id`,
    [id, userId],
  );
  return rows.length > 0;
}

// Running back to queued, to try again later. A queued task isn't claimable
// until claimed_at has passed, so the column doubles as "not before".
export async function requeueAgentTask(userId: string, id: string, notBefore: Date) {
  const db = await database();
  const { rows } = await db.query(
    `update agent_tasks set status = 'queued', claimed_at = $3
     where id = $1 and user_id = $2 and status = 'running' returning id`,
    [id, userId, notBefore],
  );
  return rows.length > 0;
}

// Running tasks claimed before `olderThan` were abandoned (the function was
// killed): back to the queue, or failed as 'stuck' after maxAttempts tries.
export async function recoverStuckAgentTasks(olderThan: Date, maxAttempts: number) {
  const db = await database();
  const { rows } = await db.query(
    `update agent_tasks set
       status = case when attempts < $2 then 'queued' else 'failed' end,
       error = case when attempts < $2 then error else 'stuck' end,
       finished_at = case when attempts < $2 then null else now() end
     where status = 'running' and claimed_at < $1 returning id`,
    [olderThan, maxAttempts],
  );
  return rows.length;
}

// A cheap read, made before every model call so a stop takes effect quickly.
export async function isAgentTaskStopped(userId: string, id: string) {
  const db = await database();
  const { rows } = await db.query("select 1 from agent_tasks where id = $1 and user_id = $2 and status = 'stopped'", [
    id,
    userId,
  ]);
  return rows.length > 0;
}

export type Approval = {
  id: string;
  userId: string;
  taskId: string | null;
  kind: string;
  summary: string;
  action: unknown;
  actionHash: string;
  status: "pending" | "approved" | "rejected" | "used";
  createdAt: string;
  decidedAt: string | null;
  decidedBy: string | null;
  usedAt: string | null;
  outcome: "done" | "failed" | null;
};

type ApprovalRow = {
  id: string;
  user_id: string;
  task_id: string | null;
  kind: string;
  summary: string;
  action: unknown;
  action_hash: string;
  status: Approval["status"];
  created_at: Date | string;
  decided_at: Date | string | null;
  decided_by: string | null;
  used_at: Date | string | null;
  outcome: Approval["outcome"];
};
const toApproval = (r: ApprovalRow): Approval => ({
  id: r.id,
  userId: r.user_id,
  taskId: r.task_id,
  kind: r.kind,
  summary: r.summary,
  action: r.action,
  actionHash: r.action_hash,
  status: r.status,
  createdAt: iso(r.created_at),
  decidedAt: isoOrNull(r.decided_at),
  decidedBy: r.decided_by,
  usedAt: isoOrNull(r.used_at),
  outcome: r.outcome ?? null,
});

export async function createApproval(input: {
  userId: string;
  taskId?: string;
  kind: string;
  summary: string;
  action: unknown;
  actionHash: string;
}) {
  const db = await database();
  const { rows } = await db.query<ApprovalRow>(
    `insert into approvals (id, user_id, task_id, kind, summary, action, action_hash)
     values ($1, $2, $3, $4, $5, $6, $7)
     on conflict (task_id, action_hash) where status = 'pending' do nothing returning *`,
    [
      randomUUID(),
      input.userId,
      input.taskId ?? null,
      input.kind,
      input.summary,
      JSON.stringify(input.action),
      input.actionHash,
    ],
  );
  if (rows[0]) return toApproval(rows[0]);
  // The same task already proposed this (it was retried): that request stands.
  const existing = await db.query<ApprovalRow>(
    "select * from approvals where user_id = $1 and task_id = $2 and action_hash = $3 and status = 'pending'",
    [input.userId, input.taskId ?? null, input.actionHash],
  );
  return toApproval(existing.rows[0]);
}

export async function findApproval(userId: string, id: string) {
  const db = await database();
  const { rows } = await db.query<ApprovalRow>("select * from approvals where id = $1 and user_id = $2", [id, userId]);
  return rows[0] ? toApproval(rows[0]) : null;
}

export async function listApprovals(userId: string, status?: Approval["status"], limit = 50) {
  const db = await database();
  const { rows } = await db.query<ApprovalRow>(
    `select * from approvals where user_id = $1 and ($2::text is null or status = $2)
     order by created_at desc, id limit $3`,
    [userId, status ?? null, limit],
  );
  return rows.map(toApproval);
}

// The only two ways an approval changes state; only lib/agents/approvals.ts
// calls them (tests/agent-approvals.test.ts checks that). Each is one update
// guarded by the status it expects, so two requests at once can't both win.
export async function decideApproval(userId: string, id: string, decision: "approved" | "rejected", decidedBy: string) {
  const db = await database();
  const { rows } = await db.query<ApprovalRow>(
    `update approvals set status = $3, decided_at = now(), decided_by = $4
     where id = $1 and user_id = $2 and status = 'pending' returning *`,
    [id, userId, decision, decidedBy],
  );
  return rows[0] ? toApproval(rows[0]) : null;
}

export async function consumeApproval(userId: string, id: string) {
  const db = await database();
  const { rows } = await db.query<ApprovalRow>(
    `update approvals set status = 'used', used_at = now()
     where id = $1 and user_id = $2 and status = 'approved' returning *`,
    [id, userId],
  );
  return rows[0] ? toApproval(rows[0]) : null;
}

export async function setApprovalOutcome(userId: string, id: string, outcome: "done" | "failed") {
  const db = await database();
  await db.query("update approvals set outcome = $3 where id = $1 and user_id = $2", [id, userId, outcome]);
}

// A run still going when its account is deleted can write after the deletion.
// The daily job removes those leftovers, so nothing outlives the account.
export async function deleteOrphanedAgentRows() {
  const db = await database();
  let removed = 0;
  for (const table of ["agent_tasks", "approvals", "agent_runs", "agent_chat"]) {
    const { rows } = await db.query(`delete from ${table} t where not exists (select 1 from users u where u.id = t.user_id) returning 1`);
    removed += rows.length;
  }
  return removed;
}

export type AgentRun = {
  id: string;
  userId: string;
  taskId: string | null;
  agent: string;
  model: string;
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens: number;
  cacheWriteTokens: number;
  costMicros: number;
  stopReason: string | null;
  createdAt: string;
};

type AgentRunRow = {
  id: string;
  user_id: string;
  task_id: string | null;
  agent: string;
  model: string;
  input_tokens: number;
  output_tokens: number;
  cache_read_tokens: number;
  cache_write_tokens: number;
  cost_micros: number | string; // bigint arrives as a string from pg
  stop_reason: string | null;
  created_at: Date | string;
};
const toAgentRun = (r: AgentRunRow): AgentRun => ({
  id: r.id,
  userId: r.user_id,
  taskId: r.task_id,
  agent: r.agent,
  model: r.model,
  inputTokens: r.input_tokens,
  outputTokens: r.output_tokens,
  cacheReadTokens: r.cache_read_tokens,
  cacheWriteTokens: r.cache_write_tokens,
  costMicros: Number(r.cost_micros),
  stopReason: r.stop_reason,
  createdAt: iso(r.created_at),
});

export async function recordAgentRun(input: {
  userId: string;
  taskId?: string;
  agent: string;
  model: string;
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens: number;
  cacheWriteTokens: number;
  costMicros: number;
  stopReason: string | null;
}) {
  const db = await database();
  const { rows } = await db.query<AgentRunRow>(
    `insert into agent_runs (id, user_id, task_id, agent, model, input_tokens, output_tokens,
       cache_read_tokens, cache_write_tokens, cost_micros, stop_reason)
     values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11) returning *`,
    [
      randomUUID(),
      input.userId,
      input.taskId ?? null,
      input.agent,
      input.model,
      input.inputTokens,
      input.outputTokens,
      input.cacheReadTokens,
      input.cacheWriteTokens,
      input.costMicros,
      input.stopReason,
    ],
  );
  return toAgentRun(rows[0]);
}

// What this account's agents have cost since `since`, in millionths of a dollar.
export async function agentCostSince(userId: string, since: Date) {
  const db = await database();
  const { rows } = await db.query<{ total: string | number | null }>(
    "select sum(cost_micros) as total from agent_runs where user_id = $1 and created_at >= $2",
    [userId, since.toISOString()],
  );
  return Number(rows[0]?.total ?? 0);
}

export type AgentChatMessage = {
  id: string;
  userId: string;
  role: "user" | "assistant";
  text: string;
  taskId: string | null;
  createdAt: string;
};

type AgentChatRow = {
  id: string;
  user_id: string;
  role: AgentChatMessage["role"];
  text: string;
  task_id: string | null;
  created_at: Date | string;
};
const toAgentChat = (r: AgentChatRow): AgentChatMessage => ({
  id: r.id,
  userId: r.user_id,
  role: r.role,
  text: r.text,
  taskId: r.task_id,
  createdAt: iso(r.created_at),
});

export async function addAgentChatMessage(input: {
  userId: string;
  role: AgentChatMessage["role"];
  text: string;
  taskId?: string;
}) {
  const db = await database();
  const { rows } = await db.query<AgentChatRow>(
    "insert into agent_chat (id, user_id, role, text, task_id) values ($1, $2, $3, $4, $5) returning *",
    [randomUUID(), input.userId, input.role, input.text, input.taskId ?? null],
  );
  return toAgentChat(rows[0]);
}

// The newest `limit` messages, oldest first.
export async function listAgentChat(userId: string, limit = 100) {
  const db = await database();
  const { rows } = await db.query<AgentChatRow>(
    `select * from (select * from agent_chat where user_id = $1 order by created_at desc, id desc limit $2) newest
     order by created_at, id`,
    [userId, limit],
  );
  return rows.map(toAgentChat);
}
