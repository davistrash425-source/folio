import { redirect } from "next/navigation";
import { Suspense } from "react";
import { Loading } from "@/app/dashboard/manage/section";
import { requireAdmin } from "@/lib/admin";

// Where the "Look up a site" box sends you: on to that site's admin page.
export default function FindSitePage({ searchParams }: PageProps<"/admin/sites">) {
  return (
    <Suspense fallback={<Loading />}>
      <FindSite searchParams={searchParams} />
    </Suspense>
  );
}

async function FindSite({ searchParams }: { searchParams: PageProps<"/admin/sites">["searchParams"] }) {
  await requireAdmin();
  const { name } = await searchParams;
  const subdomain = typeof name === "string" ? name.trim().toLowerCase().replace(/\..*$/, "") : "";
  return redirect(subdomain ? `/admin/sites/${encodeURIComponent(subdomain)}` : "/admin");
}
