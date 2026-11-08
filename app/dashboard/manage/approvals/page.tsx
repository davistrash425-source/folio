import { notFound } from "next/navigation";
import { Suspense } from "react";
import { describeApproval } from "@/lib/agents/approvals";
import { requireUser } from "@/lib/auth";
import { listApprovals } from "@/lib/db";
import { agentsAllowed } from "@/lib/plans";
import { Card, Loading, PageHeader } from "../section";
import { ApprovalCard } from "./approval-card";

export const metadata = { title: "Approvals — Folio" };

export default function ApprovalsPage() {
  return (
    <>
      <PageHeader title="Approvals" subtitle="Your agents can only suggest. Nothing happens until you approve it here." />
      <Suspense fallback={<Loading />}>
        <Approvals />
      </Suspense>
    </>
  );
}

// What the Edit box starts with: a note's text, or an email's body.
function editableTextOf(action: unknown) {
  const a = (action ?? {}) as { text?: unknown; body?: unknown };
  return String(a.text ?? a.body ?? "");
}

const OUTCOME = { done: "approved and done", failed: "approved, but it failed" };

async function Approvals() {
  const user = await requireUser();
  if (!agentsAllowed(user)) notFound();
  const [pending, all] = await Promise.all([listApprovals(user.id, "pending"), listApprovals(user.id, undefined, 100)]);
  const decided = all.filter((a) => a.status !== "pending").slice(0, 20);
  return (
    <>
      <Card title="Waiting for you">
        {pending.length === 0 && <p className="text-sm text-ink-soft">Nothing is waiting for you.</p>}
        {pending.map((a) => (
          <ApprovalCard key={a.id} id={a.id} kind={a.kind} summary={a.summary} detail={describeApproval(a)} editableText={editableTextOf(a.action)} createdAt={a.createdAt} />
        ))}
      </Card>
      <Card title="Decided">
        {decided.length === 0 && <p className="text-sm text-ink-soft">Nothing yet.</p>}
        <ul className="space-y-3">
          {decided.map((a) => (
            <li key={a.id} className="border border-rule px-4 py-3 text-sm">
              <p className="font-medium">{a.summary}</p>
              <p className="whitespace-pre-wrap text-ink-soft">{describeApproval(a)}</p>
              <p className="label mt-1 text-ink-faint">{a.status === "used" ? (a.outcome ? OUTCOME[a.outcome] : "approved") : a.status}</p>
            </li>
          ))}
        </ul>
      </Card>
    </>
  );
}
