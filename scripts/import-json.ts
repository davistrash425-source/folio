// Copies accounts and links from the old JSON database (data/db.json) into
// Postgres. Run once with the dev server stopped:  npm run import-json
// Set DATABASE_URL to import into a real server instead of the local one.
// Accounts already in the database are left alone, so it's safe to re-run.
import { existsSync, promises as fs } from "fs";
import path from "path";
import { DATA_DIR, database } from "../lib/pg.ts";

type OldDb = {
  users: { id: string; email: string; subdomain: string }[];
  tokens?: { hash: string; userId: string; kind: string; expiresAt: string }[];
};

const file = path.join(DATA_DIR, "db.json");
if (!existsSync(file)) {
  console.log(`Nothing to import: ${file} doesn't exist.`);
  process.exit(0);
}
const old = JSON.parse(await fs.readFile(file, "utf8")) as OldDb;
const db = await database();

let users = 0;
let tokens = 0;
await db.transaction(async (query) => {
  for (const user of old.users) {
    const { rows } = await query(
      `insert into users (id, email, subdomain, data) values ($1, $2, $3, $4)
       on conflict do nothing returning id`,
      [user.id, user.email.toLowerCase(), user.subdomain.toLowerCase(), JSON.stringify(user)],
    );
    if (rows.length) users++;
    else console.log(`Skipped ${user.email}: already in the database (or its email/address is taken).`);
  }
  for (const token of old.tokens ?? []) {
    if (Date.parse(token.expiresAt) <= Date.now()) continue;
    const { rows } = await query(
      `insert into tokens (hash, user_id, kind, expires_at) values ($1, $2, $3, $4)
       on conflict do nothing returning hash`,
      [token.hash, token.userId, token.kind, token.expiresAt],
    );
    tokens += rows.length;
  }
});

console.log(`Imported ${users} of ${old.users.length} accounts and ${tokens} unexpired links.`);
console.log(`${file} is unchanged; delete it once you've checked the app.`);
process.exit(0);
