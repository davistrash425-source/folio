// The only code that carries out what an agent proposes. Nothing here runs
// unless lib/agents/approvals.ts has a used-up approval to hand it, and only
// that file imports this one (tests/agent-approvals.test.ts checks that).
//
// Each kind of action has a schema, so what was proposed, stored and approved
// is what runs. Sending, posting and booking join this list in later phases.
import { z } from "zod";
import { addAgentChatMessage, type User } from "../db";

type Executor = {
  schema: z.ZodType;
  // What it will do, in plain words, built only from the validated action. This
  // is what the photographer approves; the agent's own summary is just a label.
  describe(action: unknown): string;
  // What to tell the photographer it did. Throwing counts as "it failed".
  run(user: User, action: unknown): Promise<string>;
};

function executor<S extends z.ZodType>(
  schema: S,
  describe: (action: z.output<S>) => string,
  run: (user: User, action: z.output<S>) => Promise<string>,
): Executor {
  return { schema, describe: (action) => describe(schema.parse(action)), run: (user, action) => run(user, schema.parse(action)) };
}

const executors: Record<string, Executor> = {
  // Writes a note into the photographer's own agent chat. It reaches nobody
  // else, so the whole approval path can be used before anything can send.
  save_note: executor(
    z.object({ text: z.string().min(1).max(2000) }).strict(),
    (action) => `Save this note in your agent chat: ${action.text}`,
    async (user, action) => {
      await addAgentChatMessage({ userId: user.id, role: "assistant", text: `Saved note: ${action.text}` });
      return "Note saved.";
    },
  ),
};

export function executorFor(kind: string): Executor | null {
  return Object.hasOwn(executors, kind) ? executors[kind] : null;
}
