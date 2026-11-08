// Runs queued agent tasks in the background (called by /api/cron/agents).
// One task failing never stops the others. Message text is never logged, and
// errors are reduced to their name, because a message may quote a client.
import { z } from "zod";
import { claimNextAgentTask, finishAgentTask, findUserById, recoverStuckAgentTasks, requeueAgentTask, type AgentTask } from "../db";
import { agentsAllowed } from "../plans";
import { handlerFor } from "./handlers";
import { agentFor } from "./registry";
import { runAgent, type AgentDefinition, type RunOutcome } from "./runner";

const STUCK_AFTER_MS = 10 * 60_000;
// A task may start a model call for this long. With the loop's own limit and a
// slow last call, the whole job still ends inside the route's maxDuration.
const TASK_DEADLINE_MS = 60_000;
const MAX_ATTEMPTS = 3;
const taskInput = z.object({ prompt: z.string() });

export type WorkerCounts = { recovered: number; done: number; failed: number; requeued: number; stopped: number };

// For work that must still reach the photographer when the model part ends
// without an answer (the morning summary). Its own failure changes nothing.
async function deliverAnyway(handler: ReturnType<typeof handlerFor>, task: AgentTask, outcome: RunOutcome) {
  try {
    await handler?.failed?.(task, outcome);
  } catch (err) {
    console.error("Agent fallback failed", task.agent, (err as Error).name);
  }
}

async function runTask(task: AgentTask, agents: (name: string) => AgentDefinition | null, counts: WorkerCounts) {
  const fail = async (error: string) => {
    await finishAgentTask(task.userId, task.id, { status: "failed", error });
    counts.failed++;
  };
  const user = await findUserById(task.userId);
  if (!user || !agentsAllowed(user)) return fail("not_allowed");
  // A chat task is run live by the request that made it. If the worker gets
  // one, that request died midway and was recovered: it must not run again
  // (the reply would go nowhere), so it fails without calling the model.
  if ((task.input as { chat?: unknown } | null)?.chat === true) return fail("interrupted");
  const agent = agents(task.agent);
  if (!agent) return fail("unknown_agent");
  // Some agents are given ids only and build their own first turn (handlers.ts).
  const handler = handlerFor(task.agent);
  let turn;
  if (handler) {
    turn = await handler.prepare(task);
    if (!turn) return fail("not_found");
  } else {
    const parsed = taskInput.safeParse(task.input);
    if (!parsed.success) return fail("bad_input");
    turn = [{ role: "user" as const, content: parsed.data.prompt }];
  }

  const outcome = await runAgent(agent, { userId: task.userId, taskId: task.id }, turn, undefined, Date.now() + TASK_DEADLINE_MS);
  switch (outcome.status) {
    case "done":
      // Saves what the agent found (a reading, say) before the task is closed.
      if (handler) await handler.done(task, outcome);
      // Does nothing if the task was stopped meanwhile; it stays stopped.
      if (await finishAgentTask(task.userId, task.id, { status: "done", result: { text: outcome.text, data: outcome.data } })) counts.done++;
      else counts.stopped++;
      return;
    case "stopped":
      counts.stopped++;
      return;
    case "refused":
      await deliverAnyway(handler, task, outcome);
      return fail("refused");
    case "over_limit":
      await deliverAnyway(handler, task, outcome);
      return fail(outcome.reason ?? "over_limit");
    case "failed":
      if (outcome.retryable && task.attempts < MAX_ATTEMPTS) {
        await requeueAgentTask(task.userId, task.id, new Date(Date.now() + 2 ** task.attempts * 60_000));
        counts.requeued++;
        return;
      }
      await deliverAnyway(handler, task, outcome);
      return fail(outcome.reason ?? "failed");
  }
}

export async function runQueuedTasks({
  maxTasks = 10,
  maxMillis = 30_000,
  agents = agentFor,
}: { maxTasks?: number; maxMillis?: number; agents?: (name: string) => AgentDefinition | null } = {}): Promise<WorkerCounts> {
  const counts: WorkerCounts = { recovered: 0, done: 0, failed: 0, requeued: 0, stopped: 0 };
  counts.recovered = await recoverStuckAgentTasks(new Date(Date.now() - STUCK_AFTER_MS), MAX_ATTEMPTS);
  const deadline = Date.now() + maxMillis;
  for (let n = 0; n < maxTasks && Date.now() < deadline; n++) {
    const task = await claimNextAgentTask();
    if (!task) break;
    try {
      await runTask(task, agents, counts);
    } catch (err) {
      console.error("Agent task crashed", task.agent, (err as Error).name);
      await finishAgentTask(task.userId, task.id, { status: "failed", error: (err as Error).name }).catch(() => {});
      counts.failed++;
    }
  }
  return counts;
}
