import Link from "next/link";
import { Suspense, type ReactNode } from "react";
import { requireUser } from "@/lib/auth";
import { sameDesign } from "@/lib/design";
import { qualityChecks } from "@/lib/readiness";
import { draftDesign, publishedDesign } from "@/lib/public-site";
import { isLive, isPublished, siteUrl, SUPPORT_EMAIL } from "@/lib/site";
import { PublishToggle } from "../../panels";
import { Card, Loading, PageHeader } from "../section";

export const metadata = { title: "Go live — Folio" };

export default function PublishPage() {
  return (
    <>
      <PageHeader title="Go live" subtitle="Check your site is ready, then put it online for visitors to see." />
      <Suspense fallback={<Loading />}>
        <Publish />
      </Suspense>
    </>
  );
}

async function Publish() {
  const user = await requireUser();
  const published = isPublished(user);
  const url = siteUrl(user.subdomain);
  const photos = user.photos.filter((p) => !p.removed).length;
  const designPublished = sameDesign(draftDesign(user), publishedDesign(user));

  return (
    <>
      <Card title="Before you go live">
        <ul className="divide-y divide-rule border-y border-rule">
          <Check done={photos > 0} label={photos > 0 ? `${photos} ${photos === 1 ? "photo" : "photos"} uploaded` : "Upload some photos"}>
            {photos === 0 && <StepLink href="/dashboard/manage/upload">Upload photos</StepLink>}
          </Check>
          <Check done={designPublished} label={designPublished ? "Design changes published" : "Your design has changes that aren’t published"}>
            {!designPublished && <StepLink href="/dashboard/manage/design">Review and publish</StepLink>}
          </Check>
          <Check done={Boolean(user.emailVerified)} label={user.emailVerified ? "Email confirmed" : "Confirm your email address"}>
            {!user.emailVerified && <span className="text-ink-soft">Open the link we emailed you</span>}
          </Check>
        </ul>
      </Card>

      <Card title="Worth doing" subtitle="Optional. None of these stop you going live.">
        <ul className="divide-y divide-rule border-y border-rule">
          {qualityChecks(user).map((c) => (
            <Check key={c.id} done={c.done} label={c.label}>
              {!c.done && <StepLink href={c.href}>{c.fix}</StepLink>}
            </Check>
          ))}
        </ul>
      </Card>

      <Card title="Your site">
        <p className="text-sm">
          <a href={url} target="_blank" rel="noopener noreferrer" className="underline-offset-4 hover:underline">
            {url.replace(/^https?:\/\//, "")} ↗
          </a>
        </p>
        {user.suspended ? (
          <p className="text-sm text-accent">
            Folio has suspended your site, so visitors can’t see it. If you think this is a mistake, write to {SUPPORT_EMAIL}.
          </p>
        ) : (
          <div className="flex flex-wrap items-center gap-4">
            <p className="flex-1 text-sm text-ink-soft">
              {isLive(user)
                ? "Your site is live. Anyone with the address can see it."
                : published
                  ? "Your site will go live as soon as you confirm your email."
                  : "Your site is offline. Visitors can’t see it."}
            </p>
            <PublishToggle published={published} />
          </div>
        )}
      </Card>
    </>
  );
}

function Check({ done, label, children }: { done: boolean; label: string; children?: ReactNode }) {
  return (
    <li className="flex flex-wrap items-center gap-x-4 gap-y-1 py-3 text-sm">
      <span aria-hidden="true" className={`label w-5 ${done ? "text-ink" : "text-accent"}`}>
        {done ? "✓" : "—"}
      </span>
      <span className={`flex-1 ${done ? "text-ink-soft" : "text-ink"}`}>
        <span className="sr-only">{done ? "Done: " : "To do: "}</span>
        {label}
      </span>
      {children}
    </li>
  );
}

function StepLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Link href={href} className="underline underline-offset-4 hover:text-accent">
      {children} →
    </Link>
  );
}
