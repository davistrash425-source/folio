import Link from "next/link";
import { Suspense } from "react";
import { requireUser } from "@/lib/auth";
import { agentSpendThisMonth } from "@/lib/agents/limits";
import { listAgentChat, listApprovals, unreadMessageCount } from "@/lib/db";
import { agentsAllowed, agentsEnrolled } from "@/lib/plans";
import { isPublished, SUPPORT_EMAIL } from "@/lib/site";
import { SideNav, SideNavView, DesignTabs, DesignTabsView } from "../nav";
import { AgentChat } from "../agent-chat";
import { AgentPanel } from "../agent-panel";
import { VerifyEmailBanner } from "../panels";

export default function ManageLayout({ children }: LayoutProps<"/dashboard/manage">) {
  return (
    <div className="flex w-full flex-1 flex-col md:flex-row">
      <aside className="min-w-0 border-b border-rule md:w-48 md:shrink-0 md:border-b-0 md:border-r">
        <div className="px-6 py-2 md:sticky md:top-[var(--dash-bar,4rem)] md:px-0 md:py-8">
          <Suspense fallback={<SideNavView unread={0} pathname="" />}>
            <SideNavWithCounts />
          </Suspense>
        </div>
      </aside>
      <div className="min-w-0 flex-1 px-6 py-6 md:px-10 md:py-8">
        {/* Pages that need the whole width (the design editor) put data-wide on their root. */}
        <div className="mx-auto max-w-5xl space-y-8 has-[[data-wide]]:max-w-none">
          <Suspense fallback={null}>
            <AccountNotices />
          </Suspense>
          <Suspense fallback={<DesignTabsView pathname="" />}>
            <DesignTabs />
          </Suspense>
          {children}
        </div>
      </div>
      <Suspense fallback={null}>
        <AgentDock />
      </Suspense>
    </div>
  );
}

async function SideNavWithCounts() {
  const user = await requireUser();
  // Only asked for when the agents are on, so other accounts see no change.
  const agents = agentsAllowed(user) ? { pending: (await listApprovals(user.id, "pending")).length } : undefined;
  const unread = agentsEnrolled(user) ? await unreadMessageCount(user.id) : (user.inquiries ?? []).filter((i) => !i.read).length;
  return <SideNav unread={unread} agents={agents} />;
}

const dollars = (micros: number) => (micros / 1_000_000).toFixed(2);

// The Agent tab on the right edge. Only for accounts with Folio AGENTS on.
async function AgentDock() {
  const user = await requireUser();
  if (!agentsAllowed(user)) return null;
  const [messages, spend] = await Promise.all([listAgentChat(user.id, 50), agentSpendThisMonth(user.id)]);
  return (
    <AgentPanel
      header={
        <>
          <p className="mt-1 text-xs text-ink-soft">It can only suggest: nothing is done until you approve it.</p>
          <p className="mt-2 text-xs text-ink-soft">
            This month: ${dollars(spend.usedMicros)} of ${dollars(spend.limitMicros)} used.{" "}
            <Link href="/dashboard/manage/approvals" className="underline underline-offset-4">
              Approvals
            </Link>
          </p>
        </>
      }
    >
      <AgentChat initial={messages.map((m) => ({ id: m.id, role: m.role, text: m.text }))} />
    </AgentPanel>
  );
}

async function AccountNotices() {
  const user = await requireUser();
  const takenDown = user.photos.filter((p) => p.removed).length;
  return (
    <>
      {user.suspended && (
        <p className="border-l-2 border-accent bg-card px-5 py-3 text-sm">
          <span className="font-medium text-accent">Your site is suspended</span> because {user.suspended.reason}. Visitors
          can’t see it, and you can’t upload photos. You can still download your data from Account. If you think this is
          a mistake, write to {SUPPORT_EMAIL}.
        </p>
      )}
      {takenDown > 0 && (
        <p className="border-l-2 border-accent bg-card px-5 py-3 text-sm">
          Folio took down {takenDown === 1 ? "1 of your photos" : `${takenDown} of your photos`} after a complaint. We
          emailed you about it.{" "}
          <Link href="/dashboard/manage/photos" className="underline">
            See your photos
          </Link>
        </p>
      )}
      {!user.emailVerified && <VerifyEmailBanner email={user.email} hidingSite={isPublished(user) && !user.suspended} />}
    </>
  );
}
