import { currentUser, impersonationBlock } from "@/lib/auth";
import { addAgentChatMessage, claimAgentTask, createAgentTask, finishAgentTask, listAgentChat } from "@/lib/db";
import { agentsAllowed } from "@/lib/plans";
import { rateLimit } from "@/lib/rate-limit";
import { agentFor } from "@/lib/agents/registry";
import { runAgent, type RunOutcome } from "@/lib/agents/runner";

// The model can take a while, and tools run between turns.
export const maxDuration = 120;

const CHAT_MESSAGES_PER_HOUR = 30;
const MAX_TEXT = 4000;
const HISTORY = 20;
// No new model call after this; a slow last call still fits in maxDuration.
const RUN_DEADLINE_MS = 25_000;

const FRIENDLY_ERROR = "Something went wrong on our side. Please try again in a moment.";

function failureMessage(outcome: RunOutcome) {
  if (outcome.status === "refused") return "I can't help with that one.";
  if (outcome.status === "over_limit") {
    return outcome.reason === "monthly_limit"
      ? "The monthly limit for your agents is reached, so they're paused until next month."
      : "That took more steps than I'm allowed in one go. Try asking for something smaller.";
  }
  return FRIENDLY_ERROR;
}

// POST { text }. Answers with newline-delimited JSON, one event per line:
// {type:"start",taskId}, {type:"tool",name} as tools run, then {type:"reply",
// text,taskId} or {type:"error",message}. It reports step by step, not word
// by word, on purpose. Message text is never logged.
export async function POST(req: Request) {
  // This check first: an impersonation cookie expiring between the two can
  // then only leave the admin's own account, never the target's.
  if (await impersonationBlock()) return Response.json({ error: "Not available while viewing this account as an admin." }, { status: 403 });
  const user = await currentUser();
  if (!user) return Response.json({ error: "Sign in again." }, { status: 401 });
  if (!agentsAllowed(user)) return Response.json({ error: "Not found." }, { status: 404 });
  if (!(await rateLimit(`agent-chat:${user.id}`, CHAT_MESSAGES_PER_HOUR, 60 * 60 * 1000))) {
    return Response.json({ error: "You've sent a lot of messages in the last hour. Wait a while and try again." }, { status: 429 });
  }
  const body = await req.json().catch(() => null);
  const text = typeof body?.text === "string" ? body.text.replace(/\r\n/g, "\n").trim() : "";
  if (text.length < 1 || text.length > MAX_TEXT) {
    return Response.json({ error: `Write between 1 and ${MAX_TEXT} characters.` }, { status: 400 });
  }

  // Read before this message is saved, so a reply landing from another tab
  // can't leave the history ending on an assistant turn.
  const past = (await listAgentChat(user.id, HISTORY - 1)).filter((m) => m.text.trim());
  await addAgentChatMessage({ userId: user.id, role: "user", text });
  // Each message carries its own date, never `system` and never only the newest
  // one: replayed turns stay byte-for-byte the same, so the prompt cache works.
  const dated = (at: string, words: string) => `(Sent ${at.slice(0, 10)})\n\n${words}`;
  const history = [
    ...past.map((m) => ({ role: m.role, content: m.role === "user" ? dated(m.createdAt, m.text) : m.text })),
    { role: "user" as const, content: dated(new Date().toISOString(), text) },
  ];
  while (history[0].role !== "user") history.shift();

  const task = await createAgentTask({ userId: user.id, agent: "agent_01_main", input: { prompt: text, chat: true } });
  if (!(await claimAgentTask(user.id, task.id))) return Response.json({ error: FRIENDLY_ERROR }, { status: 500 });

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const send = (event: object) => {
        try {
          controller.enqueue(encoder.encode(JSON.stringify(event) + "\n"));
        } catch {
          // The browser went away; the run still finishes and is saved.
        }
      };
      send({ type: "start", taskId: task.id });
      let finished = false;
      try {
        const agent = agentFor("agent_01_main")!;
        const outcome = await runAgent(agent, { userId: user.id, taskId: task.id }, history, (step) => {
          if (step.type === "tool") send({ type: "tool", name: step.name });
        }, Date.now() + RUN_DEADLINE_MS);
        if (outcome.status === "done") {
          // False if Stop was pressed during the last call: then nothing is saved.
          const kept = await finishAgentTask(user.id, task.id, { status: "done", result: { text: outcome.text } });
          finished = true;
          if (kept) {
            await addAgentChatMessage({ userId: user.id, role: "assistant", text: outcome.text, taskId: task.id });
            send({ type: "reply", text: outcome.text, taskId: task.id });
          } else {
            send({ type: "error", message: "Stopped." });
          }
        } else if (outcome.status === "stopped") {
          finished = true;
          send({ type: "error", message: "Stopped." });
        } else {
          await finishAgentTask(user.id, task.id, { status: "failed", error: outcome.reason ?? outcome.status });
          finished = true;
          send({ type: "error", message: failureMessage(outcome) });
        }
      } catch (err) {
        // The name only: an error's message can quote the photographer's words.
        console.error("Agent chat failed", (err as Error).name);
        send({ type: "error", message: FRIENDLY_ERROR });
      } finally {
        if (!finished) await finishAgentTask(user.id, task.id, { status: "failed", error: "unexpected" }).catch(() => {});
        try {
          controller.close();
        } catch {}
      }
    },
  });
  return new Response(stream, { headers: { "Content-Type": "application/x-ndjson; charset=utf-8", "Cache-Control": "no-store" } });
}
