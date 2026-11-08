// A stand-in for the Anthropic API, for tests of anything that runs an agent.
import type { TestContext } from "node:test";
import { SONNET } from "../lib/agents/models.ts";

export type ApiRequest = {
  model: string;
  tools?: unknown[];
  system: string;
  messages: { role: string; content: unknown }[];
  betas?: string[];
  fallbacks?: unknown;
};

export const usage = { input_tokens: 100, output_tokens: 20, cache_read_input_tokens: 0, cache_creation_input_tokens: 0 };

export const reply = (content: unknown[], stop_reason: string, model = SONNET, u = usage) => ({
  id: "msg_1",
  type: "message",
  role: "assistant",
  model,
  content,
  stop_reason,
  usage: u,
});

export const say = (text: string) => reply([{ type: "text", text }], "end_turn");

export const callTool = (name: string, input: unknown, id = "tool_1") => reply([{ type: "tool_use", id, name, input }], "tool_use");

// Answers with these replies in turn and records what it was asked. A number
// in the list makes that call fail with that HTTP status. Runs need
// process.env.ANTHROPIC_API_KEY set to something.
export function fakeApi(t: TestContext, replies: unknown[], onCall?: () => Promise<void>) {
  const bodies: ApiRequest[] = [];
  t.mock.method(globalThis, "fetch", async (_url: unknown, init: { body: string }) => {
    bodies.push(JSON.parse(init.body));
    await onCall?.();
    const next = replies.shift();
    const headers = { "content-type": "application/json" };
    if (typeof next === "number") {
      return new Response(JSON.stringify({ type: "error", error: { type: "api_error", message: "no" } }), { status: next, headers });
    }
    return new Response(JSON.stringify(next), { status: 200, headers });
  });
  return bodies;
}
