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
    phone: string;
    location: string;
    social: SocialLinks;
  };
  photos: Photo[];
  // Optional so accounts created before these fields existed still load.
  published?: boolean; // missing means published
  emailVerified?: boolean;
  albums?: Album[];
  inquiries?: Inquiry[];
  // How the site looks (lib/design.ts). `design` is what visitors see;
  // `draftDesign` is what the photographer is editing until they publish.
  // Missing on older accounts, which fall back to the preset for `template`.
  design?: SiteDesign;
  draftDesign?: SiteDesign;
  designHistory?: SiteDesign[]; // earlier saved drafts, newest last, for undo
  // Login cookies issued before this time (ms) no longer work. Set by a
  // password reset and by "sign out everywhere".
  sessionsValidFrom?: number;
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
    emailVerified: false,
    albums: [],
    inquiries: [],
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
export async function updateUser(id: string, fn: (user: User) => void) {
  const db = await database();
  const user = await db.transaction(async (query) => {
    const { rows } = await query<{ data: User }>("select data from users where id = $1 for update", [id]);
    const user = rows[0]?.data;
    if (!user) throw new Error("USER_NOT_FOUND");
    fn(user);
    await save(query, user);
    return user;
  });
  siteChanged(user.subdomain);
  return user;
}

export async function deleteUser(id: string) {
  const db = await database();
  const subdomain = await db.transaction(async (query) => {
    const { rows } = await query<{ subdomain: string }>("delete from users where id = $1 returning subdomain", [id]);
    await query("delete from tokens where user_id = $1", [id]);
    return rows[0]?.subdomain;
  });
  if (subdomain) siteChanged(subdomain);
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
