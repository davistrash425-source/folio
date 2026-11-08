// Tries the message reader on real models and prints which setup is cheapest
// while still right. THIS SPENDS REAL MONEY on the Anthropic API. Run it only
// by hand; tests and CI never do.
//
//   ANTHROPIC_API_KEY=... npm run model-test -- --spend=1 [--runs=3]
//
// --spend is the most it may cost in dollars (above 0, at most 5); it stops as
// soon as it passes that. It uses a throwaway data folder (tests/setup.ts makes
// a fresh temporary one), never data/ and never a production database.
import { readFileSync } from "fs";
import { SETUPS, estimateDollars, formatReport, parseModelTestArgs, runModelTest, type HostileMessage, type ModelTestFixture } from "../lib/agents/model-test.ts";

const args = parseModelTestArgs(process.argv.slice(2), process.env);
if (!args.ok) {
  console.error(args.error);
  process.exit(1);
}
if (process.env.DATABASE_URL || process.env.FOLIO_KEEP_DATA_DIR) {
  console.error("Refusing to run against a real database. Unset DATABASE_URL and FOLIO_KEEP_DATA_DIR.");
  process.exit(1);
}

const load = <T>(name: string) => JSON.parse(readFileSync(new URL(`../tests/fixtures/agents/${name}`, import.meta.url), "utf8")) as T;
const fixture = load<ModelTestFixture>("messages.json");
const hostile = load<HostileMessage[]>("hostile.json");

const items = fixture.messages.length + hostile.length;
const estimate = estimateDollars(SETUPS, items, args.runs);
console.log(`Setups: ${SETUPS.map((s) => s.name).join(", ")}`);
console.log(`${fixture.messages.length} example messages + ${hostile.length} hostile messages, ${args.runs} runs each = ${items * args.runs} calls per setup.`);
console.log(`Rough estimate: $${estimate.toFixed(2)}. Hard limit: $${args.spend.toFixed(2)}.`);
if (estimate > args.spend) console.log("Note: the estimate is above your limit, so the run may stop before it finishes.");

const result = await runModelTest({
  setups: SETUPS,
  messages: fixture.messages,
  hostile,
  runs: args.runs,
  maxDollars: args.spend,
  today: fixture.today,
  busy: [fixture.expectedScheduleRisk.date],
});
console.log("\n" + formatReport(result));

// Open database connections would otherwise keep the process alive.
process.exit(0);
