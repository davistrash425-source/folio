// Spending limits, checked before every model call (lib/agents/runner.ts).
// Each account gets a monthly budget (calendar month, UTC) counted from the
// agent_runs log. Reaching it stops runs; 80% and 100% send an alert to Sentry.
import { agentCostSince, findUserById } from "../db";
import { agentsAllowed } from "../plans";

const DEFAULT_LIMIT_MICROS = 15_000_000; // $15; a micro is a millionth of a dollar

// Read at call time (not at load) so tests and a redeploy's new value apply.
export function monthlyLimitMicros(): number {
  const dollars = Number(process.env.AGENTS_MONTHLY_LIMIT_USD);
  if (!Number.isFinite(dollars) || dollars <= 0) return DEFAULT_LIMIT_MICROS;
  return Math.round(dollars * 1_000_000);
}

export function monthStart(now: Date = new Date()): Date {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
}

export async function agentSpendThisMonth(userId: string): Promise<{ usedMicros: number; limitMicros: number }> {
  return { usedMicros: await agentCostSince(userId, monthStart()), limitMicros: monthlyLimitMicros() };
}

// The last alert level (80 or 100) sent per account and month. Per process, so
// a restart or a second server instance can alert again: at-most-once per
// process is good enough for a heads-up.
const alerted = new Map<string, 80 | 100>();

async function alertSpend(userId: string, level: 80 | 100, usedMicros: number, limitMicros: number) {
  try {
    const key = `${userId}:${monthStart().toISOString()}`;
    const last = alerted.get(key) ?? 0;
    if (last >= level) return;
    alerted.set(key, level);
    const Sentry = await import("@sentry/nextjs");
    // Only the account id, the level and the amounts: no text, no email.
    Sentry.captureMessage(`Folio AGENTS spending reached ${level}% of the monthly limit`, {
      level: level === 100 ? "error" : "warning",
      tags: { agentSpendLevel: String(level) },
      extra: { accountId: userId, level, usedMicros, limitMicros },
    });
  } catch {
    // Reporting must never break a run.
  }
}

// Why this account can't spend any more right now, or null if it can.
export async function spendingBlock(userId: string): Promise<string | null> {
  const user = await findUserById(userId);
  if (!user || !agentsAllowed(user)) return "not_allowed";
  const limit = monthlyLimitMicros();
  const used = await agentCostSince(userId, monthStart());
  if (used >= limit) {
    await alertSpend(userId, 100, used, limit);
    return "monthly_limit";
  }
  if (used >= limit * 0.8) await alertSpend(userId, 80, used, limit);
  return null;
}
