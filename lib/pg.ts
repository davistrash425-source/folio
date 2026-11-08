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
  create index if not exists admin_actions_at on admin_actions (at desc);
  create table if not exists released_subdomains (
    subdomain text primary key,
    released_at timestamptz not null default now()
  );
  -- The account that moved away from the address (null for closed accounts),
  -- which may move back to it.
  alter table released_subdomains add column if not exists user_id text;
  -- Real mail addresses (lib/mailboxes.ts): name@MAIL_DOMAIN. A row is never
  -- deleted, so a used name is never given to anyone else: a new owner would
  -- receive the old owner's mail. user_id is null once the account is deleted.
  create table if not exists mailboxes (
    local_part text primary key,
    user_id text,
    created_at timestamptz not null default now(),
    retired_at timestamptz
  );
  create index if not exists mailboxes_user on mailboxes (user_id);
  -- Accounts whose files still have to be deleted from storage. A row is added
  -- when the account is deleted and removed once the files are gone; the daily
  -- job (app/api/cron/daily) retries the ones left over.
  create table if not exists storage_cleanup (
    user_id text primary key,
    queued_at timestamptz not null default now()
  );
  -- Folio's AI agents (lib/db.ts). Additive only: preview deployments share
  -- production's database and run this on connect.
  create table if not exists agent_tasks (
    id text primary key,
    user_id text not null,
    agent text not null,
    status text not null default 'queued', -- queued | running | done | failed | stopped
    input jsonb not null,
    result jsonb,
    error text,
    attempts int not null default 0,
    parent_task_id text,
    created_at timestamptz not null default now(),
    claimed_at timestamptz,
    finished_at timestamptz
  );
  create index if not exists agent_tasks_user on agent_tasks (user_id, created_at desc);
  create index if not exists agent_tasks_queue on agent_tasks (status, created_at);
  create table if not exists approvals (
    id text primary key,
    user_id text not null,
    task_id text,
    kind text not null,
    summary text not null,
    action jsonb not null,
    action_hash text not null,
    status text not null default 'pending', -- pending | approved | rejected | used
    created_at timestamptz not null default now(),
    decided_at timestamptz,
    decided_by text,
    used_at timestamptz
  );
  create index if not exists approvals_user on approvals (user_id, status, created_at desc);
  alter table approvals add column if not exists outcome text; -- done | failed, once it has run
  -- A retried task can't queue the same proposal twice.
  create unique index if not exists approvals_one_pending on approvals (task_id, action_hash) where status = 'pending';
  create table if not exists agent_runs (
    id text primary key,
    user_id text not null,
    task_id text,
    agent text not null,
    model text not null,
    input_tokens int not null default 0,
    output_tokens int not null default 0,
    cache_read_tokens int not null default 0,
    cache_write_tokens int not null default 0,
    cost_micros bigint not null default 0,
    stop_reason text,
    created_at timestamptz not null default now()
  );
  create index if not exists agent_runs_user on agent_runs (user_id, created_at);
  create table if not exists agent_chat (
    id text primary key,
    user_id text not null,
    role text not null, -- user | assistant
    text text not null,
    task_id text,
    created_at timestamptz not null default now()
  );
  create index if not exists agent_chat_user on agent_chat (user_id, created_at);
  -- Shoots, holds and requests for dates (lib/db.ts). Additive only.
  create table if not exists bookings (
    id text primary key,
    user_id text not null,
    kind text not null default 'booking', -- booking | hold
    status text not null default 'requested', -- requested | confirmed | moved | cancelled
    client_name text not null default '',
    client_email text not null default '',
    title text not null default '',
    notes text not null default '',
    starts_at timestamptz not null,
    ends_at timestamptz not null,
    all_day boolean not null default false,
    source text not null default 'manual', -- site | manual | agent
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
  );
  create index if not exists bookings_user_start on bookings (user_id, starts_at);
  -- Incoming and outgoing messages for accounts with the agents on (lib/db.ts).
  -- Additive only.
  create table if not exists messages (
    id text primary key,
    user_id text not null,
    channel text not null, -- site_form | email
    direction text not null, -- in | out
    thread_key text not null,
    provider_id text,
    from_name text not null default '',
    from_address text not null default '',
    to_address text not null default '',
    subject text not null default '',
    body text not null default '',
    asked_date text not null default '',
    sender_check text, -- pass | fail | unknown, from the email's DMARC result
    rfc_message_id text, -- the sender's Message-ID header; written by a stranger, used only for reply threading
    photo_id text,
    read boolean not null default false,
    label text, -- URGENT | REPLY SOON | LIKELY SCAM
    kind text, -- booking_request | pricing | reschedule | licensing_press | scam | other
    summary text,
    suggested_action text,
    processed_at timestamptz,
    replied_at timestamptz,
    created_at timestamptz not null default now()
  );
  create index if not exists messages_user_created on messages (user_id, created_at desc);
  create index if not exists messages_user_thread on messages (user_id, thread_key, created_at);
  create unique index if not exists messages_provider on messages (channel, provider_id) where provider_id is not null;
`;

async function connectPostgres(url: string): Promise<Database> {
  const { Pool } = await import("pg");
  const pool = new Pool({ connectionString: url, max: 5 });
  // An idle connection that errors (say, Neon restarts) would otherwise crash
  // the process: an unhandled "error" on an EventEmitter is fatal.
  pool.on("error", (err) => console.error("Postgres pool error", err));
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
