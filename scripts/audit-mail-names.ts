// Read-only audit to run before real mail addresses go live: lists accounts
// whose site address is a reserved mail name (postmaster, support, ...), which
// can't be given a mailbox. Writes nothing.
//
//   node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON --import ./tests/setup.ts scripts/audit-mail-names.ts
//
// (tests/setup.ts supplies the stand-ins for next/cache, which lib/db.ts imports.)
// Reads whatever the environment points at: FOLIO_DATA_DIR locally, or
// DATABASE_URL for a real deployment (use FOLIO_KEEP_DATA_DIR=1 so the data
// folder isn't swapped for a temporary one).
import { isReservedLocalPart } from "../lib/mailboxes.ts";
import { database } from "../lib/pg.ts";

// Without these it would quietly audit tests/setup.ts's empty temporary folder.
if (!process.env.DATABASE_URL && !process.env.FOLIO_KEEP_DATA_DIR) {
  console.error("Set DATABASE_URL (production) or FOLIO_KEEP_DATA_DIR=1 (local data), or this audits an empty database.");
  process.exit(1);
}
const db = await database();
const { rows } = await db.query<{ id: string; subdomain: string; email: string }>(
  "select id, subdomain, email from users order by subdomain",
);
const flagged = rows.filter((r) => isReservedLocalPart(r.subdomain));
for (const r of flagged) console.log(`${r.subdomain}\t${r.email}\t${r.id}`);
console.log(flagged.length ? `${flagged.length} of ${rows.length} accounts use a reserved mail name.` : `None of ${rows.length} accounts use a reserved mail name.`);
process.exit(0);
