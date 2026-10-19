// The Postgres connection. In production it's a real server (Neon) reached
// through DATABASE_URL. Without DATABASE_URL — in development and tests — it's
// PGlite, the same Postgres running inside Node and saved to a folder, so the
// app runs with nothing to install. Both speak the same SQL, so lib/db.ts
// doesn't know which one it has.
import path from "path";

export type Rows<T> = { rows: T[] };
export type Query = <T = Record<string, unknown>>(text: string, params?: unknown[]) => Promise<Rows<T>>;

type Database = {
  query: Query;
  exec(sql: string): Promise<unknown>; // several statements, no parameters
  // Runs `fn` in a transaction: everything it does is saved together, or
  // (if it throws) not at all.
  transaction<T>(fn: (query: Query) => Promise<T>): Promise<T>;
};

// FOLIO_DATA_DIR points tests (and anything else) at a separate folder so
// they never touch your real accounts and photos.
export const DATA_DIR = path.resolve(process.env.FOLIO_DATA_DIR ?? "data");

const SCHEMA = `
  create table if not exists users (
    id text primary key,
    email text not null unique,
    subdomain text not null unique,
    data jsonb not null
  );
  create table if not exists tokens (
    hash text primary key,
    user_id text not null,
    kind text not null,
    expires_at timestamptz not null
  );
  create index if not exists tokens_user_kind on tokens (user_id, kind);
  create table if not exists reports (
    id text primary key,
    subdomain text not null,
    reason text not null,
    details text not null,
    reporter_email text not null,
    created_at timestamptz not null default now()
  );
  -- Columns added after launch. "if not exists" lets older databases catch up.
  alter table reports add column if not exists notice jsonb; -- copyright notices (lib/reports.ts)
  alter table reports add column if not exists status text not null default 'open';
  alter table reports add column if not exists note text;
  alter table reports add column if not exists closed_at timestamptz;
  create table if not exists admin_actions (
    id text primary key,
    at timestamptz not null default now(),
    admin_email text not null,
    user_id text not null,
    subdomain text not null,
    report_id text,
    action text not null,
    detail text not null
  );
  create index if not exists admin_actions_user on admin_actions (user_id, at);
  create table if not exists released_subdomains (
    subdomain text primary key,
    released_at timestamptz not null default now()
  );
`;

async function connectPostgres(url: string): Promise<Database> {
  const { Pool } = await import("pg");
  const pool = new Pool({ connectionString: url, max: 5 });
  // pg types rows loosely; the caller says what shape it selected.
  const query = ((text: string, params?: unknown[]) => pool.query(text, params)) as Query;
  return {
    query,
    exec: (sql) => pool.query(sql),
    async transaction(fn) {
      const client = await pool.connect();
      try {
        await client.query("begin");
        const result = await fn(((text: string, params?: unknown[]) => client.query(text, params)) as Query);
        await client.query("commit");
        return result;
      } catch (err) {
        await client.query("rollback").catch(() => {});
        throw err;
      } finally {
        client.release();
      }
    },
  };
}

async function connectPglite(dir: string): Promise<Database> {
  const { PGlite } = await import("@electric-sql/pglite");
  const db = await PGlite.create(dir);
  const query: Query = (text, params) => db.query(text, params);
  return {
    query,
    exec: (sql) => db.exec(sql),
    // PGlite has one connection and runs one transaction at a time.
    transaction: (fn) => db.transaction((tx) => fn((text, params) => tx.query(text, params))),
  };
}

async function connect(): Promise<Database> {
  const url = process.env.DATABASE_URL;
  if (!url && process.env.NODE_ENV === "production") {
    throw new Error("DATABASE_URL must be set in production");
  }
  const db = url ? await connectPostgres(url) : await connectPglite(path.join(DATA_DIR, "pg"));
  await db.exec(SCHEMA);
  return db;
}

// One connection per server process. Kept on globalThis so the dev server's
// hot reloading doesn't open a second PGlite on the same folder.
const shared = globalThis as typeof globalThis & { folioDb?: Promise<Database> };

export function database() {
  shared.folioDb ??= connect().catch((err) => {
    shared.folioDb = undefined; // try again on the next request
    throw err;
  });
  return shared.folioDb;
}
