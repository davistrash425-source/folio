import { Suspense } from "react";
import { requireUser } from "@/lib/auth";
import { draftDesign, publishedDesign } from "@/lib/public-site";
import { agentsAllowed } from "@/lib/plans";
import { photoSource } from "@/lib/uploads";
import { DesignEditor } from "../../design-editor";
import { Loading } from "../section";

export const metadata = { title: "Web design — Folio" };

export default function DesignPage() {
  return (
    <>
      <h1 className="sr-only">Web design</h1>
      <Suspense fallback={<Loading />}>
        <Editor />
      </Suspense>
    </>
  );
}

async function Editor() {
  const user = await requireUser();
  return (
    <DesignEditor
      draft={draftDesign(user)}
      published={publishedDesign(user)}
      isPro={user.plan === "pro"}
      agentsOn={agentsAllowed(user)}
      canUndo={(user.designHistory?.length ?? 0) > 0}
      photos={user.photos.filter((p) => !p.removed).map((p) => {
        const src = photoSource(user.id, p);
        return { id: p.id, src: src.src, srcSet: src.srcSet, description: p.description ?? "", location: p.location ?? "" };
      })}
      albums={(user.albums ?? []).map((a) => ({ id: a.id, slug: a.slug, title: a.title, photoCount: a.photoIds.length }))}
      profile={{ name: user.profile.name, location: user.profile.location, bio: user.profile.bio }}
      fullProfile={user.profile}
    />
  );
}
