// The agents that can run from the task queue, by name (the `agent` column of
// agent_tasks). Phase 1 has the manager only.
import { managerAgent } from "./main";
import type { AgentDefinition } from "./runner";

const agents: Record<string, AgentDefinition> = { agent_01_main: managerAgent() };

export function agentFor(name: string): AgentDefinition | null {
  return Object.hasOwn(agents, name) ? agents[name] : null;
}
