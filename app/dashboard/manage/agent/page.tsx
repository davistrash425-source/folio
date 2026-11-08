import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { requireUser } from "@/lib/auth";
import { listAgentChat } from "@/lib/db";
import { agentSpendThisMonth } from "@/lib/agents/limits";
import { agentsAllowed } from "@/lib/plans";
import { Card, Loading, PageHeader } from "../section";
import { AgentChat } from "./agent-chat";

export const metadata = { title: "Agent — Folio" };

export default function AgentPage() {
  return (
    <>
      <PageHeader title="Agent" subtitle="Ask your assistant anything about your work. It can only suggest: nothing is done until you approve it." />
      <Suspense fallback={<Loading />}>
        <Agent />
      </Suspense>
    </>
  );
}

const dollars = (micros: number) => (micros / 1_000_000).toFixed(2);

async function Agent() {
  const user = await requireUser();
  if (!agentsAllowed(user)) notFound();
  const [messages, spend] = await Promise.all([listAgentChat(user.id, 50), agentSpendThisMonth(user.id)]);
  return (
    <Card>
      <p className="text-sm text-ink-soft">
        This month: ${dollars(spend.usedMicros)} of ${dollars(spend.limitMicros)} used.{" "}
        <Link href="/dashboard/manage/approvals" className="underline underline-offset-4">
          Approvals
        </Link>
      </p>
      <AgentChat initial={messages.map((m) => ({ id: m.id, role: m.role, text: m.text }))} />
    </Card>
  );
}
