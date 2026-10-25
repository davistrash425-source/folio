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
  // An admin's extra site: the admin's account id. It has no password and a
  // made-up email; the admin reaches it by switching sites (app/actions/sites.ts).
  managedBy?: string;
  // Set when the account was created (or later linked) via "Continue with
  // Google". Google users have an empty passwordHash and confirm by address.
  googleId?: string;
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
      await query(
        "insert into released_subdomains (subdomain, user_id) values ($1, $2) on conflict (subdomain) do update set released_at = now(), user_id = $2",
        [rows[0].subdomain, rows[0].manager],
      );
    }
    return rows[0]?.subdomain;
  });
  if (subdomain) siteChanged(subdomain);
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
