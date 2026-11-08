// The agents that can run from the task queue, by name (the `agent` column of
// agent_tasks). The manager, the booking wording agent, the message reader and the reply writer.
import { bookingWordingAgent } from "./booking";
import { managerAgent } from "./main";
import { scheduleRiskWriter } from "./morning";
import { messageReader } from "./message-in";
import { replyWriter } from "./message-out";
import type { AgentDefinition } from "./runner";

const agents: Record<string, AgentDefinition> = {
  agent_01_main: managerAgent(),
  agent_02_message_in: messageReader,
  agent_02_morning: scheduleRiskWriter,
  agent_03_message_out: replyWriter,
  agent_07_booking: bookingWordingAgent,
};

export function agentFor(name: string): AgentDefinition | null {
  return Object.hasOwn(agents, name) ? agents[name] : null;
}
