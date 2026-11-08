// Runs queued agent tasks in the background (called by /api/cron/agents).
// One task failing never stops the others. Message text is never logged, and
// errors are reduced to their name, because a message may quote a client.
import { z } from "zod";
import { claimNextAgentTask, finishAgentTask, findUserById, recoverStuckAgentTasks, requeueAgentTask, type AgentTask } from "../db";
import { agentsAllowed } from "../plans";
import { agentFor } from "./registry";
import { runAgent, type AgentDefinition } from "./runner";

const STUCK_AFTER_MS = 10 * 60_000;
// A task may start a model call for this long. With the loop's own limit and a
// slow last call, the whole job still ends inside the route's maxDuration.
const TASK_DEADLINE_MS = 60_000;
const MAX_ATTEMPTS = 3;
const taskInput = z.object({ prompt: z.string() });

export type WorkerCounts = { recovered: number; done: number; failed: number; requeued: number; stopped: number };

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
  const parsed = taskInput.safeParse(task.input);
  if (!parsed.success) return fail("bad_input");

  const outcome = await runAgent(agent, { userId: task.userId, taskId: task.id }, [{ role: "user", content: parsed.data.prompt }], undefined, Date.now() + TASK_DEADLINE_MS);
  switch (outcome.status) {
    case "done":
      // Does nothing if the task was stopped meanwhile; it stays stopped.
      if (await finishAgentTask(task.userId, task.id, { status: "done", result: { text: outcome.text, data: outcome.data } })) counts.done++;
      else counts.stopped++;
      return;
    case "stopped":
      counts.stopped++;
      return;
    case "refused":
      return fail("refused");
    case "over_limit":
      return fail(outcome.reason ?? "over_limit");
    case "failed":
      if (outcome.retryable && task.attempts < MAX_ATTEMPTS) {
        await requeueAgentTask(task.userId, task.id, new Date(Date.now() + 2 ** task.attempts * 60_000));
        counts.requeued++;
        return;
      }
      return fail(outcome.reason ?? "failed");
  }
}

export async function runQueuedTasks({
  maxTasks = 5,
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
