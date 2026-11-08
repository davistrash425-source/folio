// Runs one agent: calls Claude, carries out the tools it asks for, and repeats
// until it finishes. The only file that talks to the Anthropic API.
//
// The loop is ours rather than a hosted service or the SDK's runner, so these
// checks sit in one place before every model call: has the task been stopped,
// has this run used its tokens, can this account still spend. Every call is
// logged in agent_runs. Tools decide what an agent can do at all; none of them
// can send anything, because acting needs an approval (lib/agents/approvals.ts).
import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import { isAgentTaskStopped, recordAgentRun } from "../db";
import { spendingBlock } from "./limits";
import { costMicros, HAIKU } from "./models";

export type ToolContext = { userId: string; taskId: string };

export type AgentTool = {
  name: string;
  description: string;
  schema: z.ZodObject;
  run(context: ToolContext, input: unknown): Promise<string>;
};

export function agentTool<S extends z.ZodObject>(definition: {
  name: string;
  description: string;
  schema: S;
  run: (context: ToolContext, input: z.output<S>) => Promise<string>;
}): AgentTool {
  return { ...definition, run: (context, input) => definition.run(context, definition.schema.parse(input)) };
}

export type AgentDefinition = {
  name: string;
  model: string;
  effort: "low" | "medium" | "high";
  // Fixed text only. Anything that changes per request goes in the messages,
  // so this stays the same and the prompt cache can reuse it.
  system: string;
  tools: AgentTool[];
  // When set, the final answer must match this and comes back as `data`.
  output?: z.ZodObject;
  maxTurns?: number;
  maxRunTokens?: number;
  maxOutputTokens?: number;
};

export type RunStatus = "done" | "stopped" | "over_limit" | "refused" | "failed";

export type RunOutcome = {
  status: RunStatus;
  text: string;
  data?: unknown;
  // For "over_limit" and "failed": what went wrong, in words safe to log.
  reason?: string;
  // A failure worth trying again later (a rate limit, Anthropic being down).
  retryable?: boolean;
};

export type RunStep = { type: "text"; text: string } | { type: "tool"; name: string };

const DEFAULT_MAX_TURNS = 8;
const DEFAULT_RUN_TOKENS = 60_000;
const DEFAULT_OUTPUT_TOKENS = 4096;
const CALL_TIMEOUT_MS = 30_000;

type Message = Anthropic.Beta.BetaMessage;
type MessageParam = Anthropic.Beta.BetaMessageParam;

type JsonSchema = Record<string, unknown>;

// Strict tools and structured output answer 400 to these keywords. They move
// into the field's description for the model; zod still enforces them here
// when the tool input or final answer comes back.
const UNSUPPORTED = new Set(["minLength", "maxLength", "minimum", "maximum", "exclusiveMinimum", "exclusiveMaximum", "multipleOf", "maxItems"]);

function forApi(schema: JsonSchema): JsonSchema {
  const out: JsonSchema = {};
  const limits: string[] = [];
  for (const [key, value] of Object.entries(schema)) {
    if (key === "$schema") continue;
    if (UNSUPPORTED.has(key) || (key === "minItems" && Number(value) > 1)) {
      limits.push(`${key}: ${value}`);
    } else if (key === "properties" || key === "$defs") {
      // These hold field names, which may be spelled like keywords.
      out[key] = Object.fromEntries(Object.entries(value as JsonSchema).map(([name, field]) => [name, forApi(field as JsonSchema)]));
    } else if (key === "items") {
      out[key] = forApi(value as JsonSchema);
    } else if (key === "anyOf" || key === "allOf") {
      out[key] = (value as JsonSchema[]).map(forApi);
    } else {
      out[key] = value;
    }
  }
  if (limits.length) out.description = [out.description, `(${limits.join(", ")})`].filter(Boolean).join(" ");
  return out;
}

const toolDefinition = (tool: AgentTool) => ({
  name: tool.name,
  description: tool.description,
  input_schema: forApi(z.toJSONSchema(tool.schema)) as Anthropic.Beta.BetaTool.InputSchema,
  // A tool with no fields has nothing to be strict about.
  ...(Object.keys(tool.schema.shape).length ? { strict: true } : {}),
});

function callModel(client: Anthropic, agent: AgentDefinition, messages: MessageParam[]): Promise<Message> {
  return client.beta.messages.create({
    model: agent.model,
    max_tokens: agent.maxOutputTokens ?? DEFAULT_OUTPUT_TOKENS,
    system: agent.system,
    messages,
    cache_control: { type: "ephemeral" },
    // agent_02_message_in must hold no tools, so an empty list sends none.
    ...(agent.tools.length ? { tools: agent.tools.map(toolDefinition) } : {}),
    output_config: {
      effort: agent.effort,
      ...(agent.output ? { format: { type: "json_schema", schema: forApi(z.toJSONSchema(agent.output)) } } : {}),
    },
    // If Sonnet or Opus declines, Anthropic retries on a model that can answer.
    // Haiku has no such fallback, and its refusals simply come back as refused.
    ...(agent.model === HAIKU ? {} : { betas: ["server-side-fallback-2026-07-01"], fallbacks: "default" }),
  } as Anthropic.Beta.MessageCreateParamsNonStreaming);
}

const textOf = (message: Message) =>
  message.content
    .filter((block): block is Anthropic.Beta.BetaTextBlock => block.type === "text")
    .map((block) => block.text)
    .join("");

async function runTools(agent: AgentDefinition, context: ToolContext, message: Message, onStep?: (step: RunStep) => void) {
  const calls = message.content.filter((block): block is Anthropic.Beta.BetaToolUseBlock => block.type === "tool_use");
  // Returned together in one message, in the order they were asked for.
  return Promise.all(
    calls.map(async (call): Promise<Anthropic.Beta.BetaToolResultBlockParam> => {
      const tool = agent.tools.find((t) => t.name === call.name);
      if (!tool) return { type: "tool_result", tool_use_id: call.id, is_error: true, content: "No such tool." };
      onStep?.({ type: "tool", name: call.name });
      try {
        return { type: "tool_result", tool_use_id: call.id, content: await tool.run(context, call.input) };
      } catch (err) {
        if (err instanceof z.ZodError) {
          return { type: "tool_result", tool_use_id: call.id, is_error: true, content: "The input didn't match this tool's schema." };
        }
        // The name only: an error's message can quote a client's words.
        console.error("Agent tool failed", agent.name, call.name, (err as Error).name);
        return { type: "tool_result", tool_use_id: call.id, is_error: true, content: "That tool failed." };
      }
    }),
  );
}

function finish(agent: AgentDefinition, message: Message): RunOutcome {
  const text = textOf(message);
  // The model occasionally ends with nothing to say. A blank turn saved to the
  // chat history would break every later request, so it counts as a failure.
  if (!agent.output) return text.trim() ? { status: "done", text } : { status: "failed", text: "", reason: "empty_reply" };
  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch {
    return { status: "failed", text: "", reason: "output_not_json" };
  }
  const parsed = agent.output.safeParse(json);
  return parsed.success ? { status: "done", text, data: parsed.data } : { status: "failed", text: "", reason: "output_schema" };
}

export async function runAgent(
  agent: AgentDefinition,
  context: ToolContext,
  initial: MessageParam[],
  onStep?: (step: RunStep) => void,
  // No new model call starts after this time (ms), so the function isn't killed mid-run.
  deadline?: number,
): Promise<RunOutcome> {
  if (!process.env.ANTHROPIC_API_KEY) return { status: "failed", text: "", reason: "ANTHROPIC_API_KEY is not set" };
  // Made per run: it costs nothing and tests can fake `fetch` for each one.
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY, timeout: CALL_TIMEOUT_MS });
  const messages = [...initial];
  const maxTokens = agent.maxRunTokens ?? DEFAULT_RUN_TOKENS;
  let used = 0;

  for (let turn = 0; turn < (agent.maxTurns ?? DEFAULT_MAX_TURNS); turn++) {
    if (await isAgentTaskStopped(context.userId, context.taskId)) return { status: "stopped", text: "" };
    if (used >= maxTokens) return { status: "over_limit", text: "", reason: "run_token_cap" };
    if (deadline !== undefined && Date.now() >= deadline) return { status: "over_limit", text: "", reason: "out_of_time" };
    const blocked = await spendingBlock(context.userId);
    if (blocked) return { status: "over_limit", text: "", reason: blocked };

    let message: Message;
    try {
      message = await callModel(client, agent, messages);
    } catch (err) {
      if (err instanceof Anthropic.APIError) {
        const retryable = err.status === undefined || err.status === 408 || err.status === 429 || err.status >= 500;
        return { status: "failed", text: "", reason: `api_${err.status ?? "connection"}`, retryable };
      }
      throw err;
    }

    const usage = {
      inputTokens: message.usage.input_tokens,
      outputTokens: message.usage.output_tokens,
      cacheReadTokens: message.usage.cache_read_input_tokens ?? 0,
      cacheWriteTokens: message.usage.cache_creation_input_tokens ?? 0,
    };
    used += usage.inputTokens + usage.outputTokens + usage.cacheReadTokens + usage.cacheWriteTokens;
    await recordAgentRun({
      userId: context.userId,
      taskId: context.taskId,
      agent: agent.name,
      model: message.model,
      ...usage,
      costMicros: costMicros(message.model, usage),
      stopReason: message.stop_reason,
    });

    // Checked first: a refusal or a cut-off can leave a half-written tool call.
    if (message.stop_reason === "refusal") return { status: "refused", text: "" };
    if (message.stop_reason === "max_tokens") return { status: "failed", text: "", reason: "output_cut_off" };

    // The whole response goes back, unedited, so thinking blocks stay valid.
    messages.push({ role: "assistant", content: message.content });
    if (message.stop_reason === "pause_turn") continue;

    const text = textOf(message);
    if (text && !agent.output) onStep?.({ type: "text", text });
    if (message.stop_reason !== "tool_use") return finish(agent, message);
    // A stop pressed during that call also stops the tools it asked for.
    if (await isAgentTaskStopped(context.userId, context.taskId)) return { status: "stopped", text: "" };
    messages.push({ role: "user", content: await runTools(agent, context, message, onStep) });
  }
  return { status: "over_limit", text: "", reason: "max_turns" };
}
