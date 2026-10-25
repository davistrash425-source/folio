import { Suspense } from "react";
import { requireUser } from "@/lib/auth";
import { photoSource } from "@/lib/uploads";
import Link from "next/link";
import { draftDesign, publishedDesign } from "@/lib/public-site";
import { contactHref } from "@/lib/site-data";
import { isLive, siteUrl } from "@/lib/site";
import type { User } from "@/lib/db";
import { Inbox } from "../../panels";
import { Loading, PageHeader } from "../section";

export const metadata = { title: "Messages — Folio" };

export default function MessagesPage() {
  return (
    <>
      <PageHeader title="Messages" subtitle="Inquiries sent through the contact form on your site." />
      <Suspense fallback={<Loading />}>
        <Messages />
      </Suspense>
    </>
  );
}

async function Messages() {
  const user = await requireUser();
  const inquiries = user.inquiries ?? [];
  const asked = new Set(inquiries.map((q) => q.photoId));
  const photos = Object.fromEntries(
    user.photos
      .filter((p) => asked.has(p.id) && !p.removed)
      .map((p) => {
        const source = photoSource(user.id, p);
        return [p.id, { src: source.srcSet?.split(",")[0].trim().split(" ")[0] ?? source.src, label: p.description ?? "" }];
      }),
  );
  if (inquiries.length === 0) return <EmptyInbox user={user} />;
  return (
    <div className="bg-card border border-rule">
      <Inbox inquiries={inquiries} photos={photos} />
    </div>
  );
}

// Nothing yet: say where messages come from, link to the form visitors use,
// and show what one will look like.
function EmptyInbox({ user }: { user: User }) {
  const live = isLive(user);
  const design = live ? publishedDesign(user) : draftDesign(user);
  const form = contactHref({ design, preview: false });
  const url = siteUrl(user.subdomain).replace(/\/$/, "");
  return (
    <div className="max-w-xl space-y-5 bg-card border border-rule p-6">
      <div className="space-y-2">
        <h2 className="font-display text-2xl">No messages yet</h2>
        <p className="text-sm text-ink-soft">
          When a visitor fills in the contact form on your site, their message lands here, and we email you a copy.
          {!form && " Your design has no contact section right now, so add one in Web design to let people write to you."}
        </p>
        {form && live && (
          <p className="text-sm">
            <a href={`${url}${form}`} target="_blank" rel="noopener noreferrer" className="underline underline-offset-4 hover:text-accent">
              See your contact form ↗
            </a>
          </p>
        )}
        {form && !live && (
          <p className="text-sm text-ink-soft">
            Your site isn’t live yet, so nobody can write to you. <Link href="/dashboard/manage/publish" className="underline">Go live</Link> to turn the form on.
          </p>
        )}
      </div>
      <div aria-hidden="true" className="border border-dashed border-rule p-4 text-sm">
        <p className="label mb-2 text-ink-faint">What a message looks like</p>
        <p className="flex items-baseline gap-3">
          <span className="h-2 w-2 shrink-0 rounded-full bg-accent" />
          <span className="flex-1 truncate font-semibold">
            Maya <span className="font-normal text-ink-soft">— Hi! Are you free for a wedding in June? We love your coast photos…</span>
          </span>
          <span className="shrink-0 text-xs text-ink-soft">Jun 3</span>
        </p>
        <p className="mt-2 pl-5 text-xs text-ink-soft">Example only. Open a message to read it, reply by email, or delete it.</p>
      </div>
    </div>
  );
}
