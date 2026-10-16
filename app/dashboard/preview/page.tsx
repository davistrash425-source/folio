import { Suspense } from "react";
import { requireUser } from "@/lib/auth";
import { visibleAlbums, sameDesign } from "@/lib/design";
import { draftDesign, publishedDesign } from "@/lib/public-site";
import { isPublished, siteUrl } from "@/lib/site";
import { PreviewWorkspace } from "./workspace";

export const metadata = { title: "Preview website — Folio" };

export default function PreviewPage() {
  return (
    <Suspense fallback={<p className="p-10 text-sm text-zinc-500">Loading preview…</p>}>
      <Preview />
    </Suspense>
  );
}

async function Preview() {
  const user = await requireUser();
  const draft = draftDesign(user);
  const pages = [
    ...draft.pages.map((p) => ({ path: p.slug, title: p.slug ? p.title : `${p.title} (home)` })),
    ...visibleAlbums(draft, user.albums ?? [])
      .filter((a) => !draft.pages.some((p) => p.slug === a.slug))
      .map((a) => ({ path: a.slug, title: `Album: ${a.title}` })),
  ];
  return (
    <PreviewWorkspace
      pages={pages}
      liveUrl={isPublished(user) ? siteUrl(user.subdomain) : null}
      hasUnpublishedDesign={!sameDesign(draft, publishedDesign(user))}
    />
  );
}
