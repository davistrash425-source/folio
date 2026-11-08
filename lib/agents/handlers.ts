// Agents whose task input is only ids. The background worker (worker.ts) asks
// the handler to build the user turn in code, so what a stranger wrote is read
// from the database at the last moment and is never copied into a task.
import type { AgentTask } from "../db";
import { MORNING_NAME, prepareMorning, saveMorning, saveMorningWithoutRisks } from "./morning";
import { prepareReading, READER_NAME, saveReading, type Turn } from "./message-in";
import type { RunOutcome } from "./runner";

export type TaskHandler = {
  // The first user turn, or null when the task's subject is gone (the task then
  // fails with "not_found").
  prepare(task: AgentTask): Promise<Turn | null>;
  // Runs only for an outcome that is "done". Throwing fails the task.
  done(task: AgentTask, outcome: RunOutcome): Promise<void>;
  // Optional. Runs when the model part ended without an answer (refused, over
  // its limit, or failed for good), for work that must still be delivered.
  failed?(task: AgentTask, outcome: RunOutcome): Promise<void>;
};

export const taskHandlers: Record<string, TaskHandler> = {
  [READER_NAME]: { prepare: prepareReading, done: saveReading },
  [MORNING_NAME]: { prepare: prepareMorning, done: saveMorning, failed: saveMorningWithoutRisks },
};

export function handlerFor(agent: string): TaskHandler | null {
  return Object.hasOwn(taskHandlers, agent) ? taskHandlers[agent] : null;
}
