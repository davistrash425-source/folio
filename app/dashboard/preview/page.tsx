import { Suspense } from "react";
import { requireUser } from "@/lib/auth";
import { sameDesign } from "@/lib/design";
import { draftDesign, publishedDesign } from "@/lib/public-site";
import { isPublished, siteUrl } from "@/lib/site";
import { PreviewWorkspace } from "./workspace";

export const metadata = { title: "Preview website — Folio" };

export default function PreviewPage() {
  return (
    <Suspense fallback={<p className="p-10 text-sm text-ink-soft">Loading preview…</p>}>
      <Preview />
    </Suspense>
  );
}

async function Preview() {
  const user = await requireUser();
  return (
    <PreviewWorkspace
      liveUrl={isPublished(user) ? siteUrl(user.subdomain) : null}
      hasUnpublishedDesign={!sameDesign(draftDesign(user), publishedDesign(user))}
    />
  );
}
