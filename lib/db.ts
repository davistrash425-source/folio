// A tiny JSON-file database so the app runs locally with zero setup.
// Swap this module for a real database (Postgres, SQLite, etc.) later —
// the rest of the app only talks to the functions exported here.
import { promises as fs } from "fs";
import path from "path";
import { randomUUID } from "crypto";
import type { TemplateId } from "./templates";

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
  alt?: string;
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
  photoIds: string[];
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
  template: TemplateId;
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
};

// One-time links for password resets and email verification. Only a hash of
// the token is stored, so a leaked database can't be used to log in.
export type Token = {
  hash: string;
  userId: string;
  kind: "reset" | "verify";
  expiresAt: string;
};

type Data = { users: User[]; tokens?: Token[] };

export const DATA_DIR = path.join(process.cwd(), "data");
const DB_FILE = path.join(DATA_DIR, "db.json");

async function read(): Promise<Data> {
  try {
    return JSON.parse(await fs.readFile(DB_FILE, "utf8")) as Data;
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") return { users: [] };
    throw err;
  }
}

// Serialize writes so concurrent requests don't clobber each other.
let queue: Promise<unknown> = Promise.resolve();
function mutate<T>(fn: (data: Data) => T | Promise<T>): Promise<T> {
  const run = queue.then(async () => {
    const data = await read();
    const result = await fn(data);
    await fs.mkdir(DATA_DIR, { recursive: true });
    await fs.writeFile(DB_FILE, JSON.stringify(data, null, 2));
    return result;
  });
  queue = run.catch(() => {});
  return run;
}

export async function findUserById(id: string) {
  return (await read()).users.find((u) => u.id === id) ?? null;
}

export async function findUserByEmail(email: string) {
  const e = email.toLowerCase();
  return (await read()).users.find((u) => u.email === e) ?? null;
}

export async function findUserBySubdomain(subdomain: string) {
  const s = subdomain.toLowerCase();
  return (await read()).users.find((u) => u.subdomain === s) ?? null;
}

export async function createUser(input: {
  email: string;
  passwordHash: string;
  subdomain: string;
  name: string;
  published: boolean;
}) {
  return mutate((data) => {
    const email = input.email.toLowerCase();
    const subdomain = input.subdomain.toLowerCase();
    if (data.users.some((u) => u.email === email)) {
      throw new Error("EMAIL_TAKEN");
    }
    if (data.users.some((u) => u.subdomain === subdomain)) {
      throw new Error("SUBDOMAIN_TAKEN");
    }
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
      emailVerified: false,
      albums: [],
      inquiries: [],
    };
    data.users.push(user);
    return user;
  });
}

export async function updateUser(id: string, fn: (user: User) => void) {
  return mutate((data) => {
    const user = data.users.find((u) => u.id === id);
    if (!user) throw new Error("USER_NOT_FOUND");
    fn(user);
    return user;
  });
}

export async function deleteUser(id: string) {
  return mutate((data) => {
    data.users = data.users.filter((u) => u.id !== id);
    data.tokens = (data.tokens ?? []).filter((t) => t.userId !== id);
  });
}

export async function addToken(token: Token) {
  return mutate((data) => {
    const now = Date.now();
    // Drop expired tokens and older ones of the same kind for this user.
    data.tokens = (data.tokens ?? []).filter(
      (t) => Date.parse(t.expiresAt) > now && !(t.userId === token.userId && t.kind === token.kind),
    );
    data.tokens.push(token);
  });
}

// Removes the token and returns it if it exists and hasn't expired.
export async function takeToken(hash: string, kind: Token["kind"]) {
  return mutate((data) => {
    const token = (data.tokens ?? []).find((t) => t.hash === hash && t.kind === kind);
    if (!token) return null;
    data.tokens = data.tokens!.filter((t) => t !== token);
    return Date.parse(token.expiresAt) > Date.now() ? token : null;
  });
}
