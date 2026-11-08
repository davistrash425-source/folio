// The agents that can run from the task queue, by name (the `agent` column of
// agent_tasks). The manager and the booking wording agent.
import { bookingWordingAgent } from "./booking";
import { managerAgent } from "./main";
import type { AgentDefinition } from "./runner";

const agents: Record<string, AgentDefinition> = {
  agent_01_main: managerAgent(),
  agent_07_booking: bookingWordingAgent,
};

export function agentFor(name: string): AgentDefinition | null {
  return Object.hasOwn(agents, name) ? agents[name] : null;
}
