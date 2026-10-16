import { Suspense } from "react";
import { requireUser } from "@/lib/auth";
import { SideNav, SideNavView } from "../nav";
import { VerifyEmailBanner } from "../panels";

export default function ManageLayout({ children }: LayoutProps<"/dashboard/manage">) {
  return (
    <div className="mx-auto grid w-full max-w-7xl flex-1 grid-cols-1 content-start gap-6 px-6 py-6 md:grid-cols-[12rem_minmax(0,1fr)] md:gap-14 md:py-12">
      <aside className="min-w-0">
        <Suspense fallback={<SideNavView unread={0} pathname="" />}>
          <SideNavWithCounts />
        </Suspense>
      </aside>
      <div className="min-w-0 space-y-10">
        <Suspense fallback={null}>
          <AccountNotices />
        </Suspense>
        {children}
      </div>
    </div>
  );
}

async function SideNavWithCounts() {
  const user = await requireUser();
  return <SideNav unread={(user.inquiries ?? []).filter((i) => !i.read).length} />;
}

async function AccountNotices() {
  const user = await requireUser();
  return user.emailVerified ? null : <VerifyEmailBanner email={user.email} />;
}
