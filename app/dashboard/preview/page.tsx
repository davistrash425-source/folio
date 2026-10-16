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
  const albums = visibleAlbums(draft, user.albums ?? []).map((a) => ({ slug: a.slug, title: a.title }));
  return (
    <PreviewWorkspace
      albums={albums}
      liveUrl={isPublished(user) ? siteUrl(user.subdomain) : null}
      hasUnpublishedDesign={!sameDesign(draft, publishedDesign(user))}
    />
  );
}
