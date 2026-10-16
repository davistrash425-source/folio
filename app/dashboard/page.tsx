import Link from "next/link";
import { Suspense } from "react";
import { logout } from "@/app/actions/auth";
import { requireUser } from "@/lib/auth";
import { isPublished, siteUrl } from "@/lib/site";
import { TEMPLATES } from "@/lib/templates";
import { photoSource } from "@/lib/uploads";
import { PhotoGrid, PhotoUploader, ProfileForm, TemplatePicker } from "./editor";
import { AccountSettings, AlbumManager, Inbox, PublishToggle, VerifyEmailBanner } from "./panels";

export default function DashboardPage({ searchParams }: PageProps<"/dashboard">) {
  return (
    <div className="flex flex-1 flex-col bg-zinc-50">
      <Suspense fallback={<p className="p-10 text-sm text-zinc-500">Loading your dashboard…</p>}>
        <Dashboard searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

async function Dashboard({ searchParams }: { searchParams: PageProps<"/dashboard">["searchParams"] }) {
  const user = await requireUser();
  const { verified } = await searchParams;
  const url = siteUrl(user.subdomain);
  const published = isPublished(user);
  const photos = user.photos.map((p) => photoSource(user.id, p));
  const inquiries = user.inquiries ?? [];
  const unread = inquiries.filter((i) => !i.read).length;

  const checklist = [
    ["Create your account", true],
    ["Upload photos", photos.length > 0],
    ["Pick a style", true],
    ["Add your bio", user.profile.bio.length > 0],
    ["Publish", published],
  ] as const;

  return (
    <>
      <header className="border-b border-zinc-200 bg-white">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-4 px-6 py-4">
          <Link href="/" className="font-semibold tracking-tight">Folio</Link>
          <div className="flex flex-wrap items-center gap-3 text-sm">
            <Link href="/dashboard/preview" target="_blank" className="rounded-full px-3 py-2 text-zinc-600 hover:bg-zinc-100">
              Preview
            </Link>
            {published && (
              <a
                href={url}
                target="_blank"
                rel="noopener noreferrer"
                className="rounded-full bg-black px-4 py-2 font-medium text-white hover:bg-zinc-800"
              >
                View live site ↗
              </a>
            )}
            <form action={logout}>
              <button className="rounded-full px-3 py-2 text-zinc-600 hover:bg-zinc-100">Log out</button>
            </form>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-5xl space-y-8 px-6 py-10">
        {verified === "1" && (
          <p className="rounded-2xl bg-green-50 px-6 py-4 text-sm text-green-800 ring-1 ring-green-200">Thanks — your email is confirmed.</p>
        )}
        {verified === "expired" && !user.emailVerified && (
          <p className="rounded-2xl bg-red-50 px-6 py-4 text-sm text-red-800 ring-1 ring-red-200">That confirmation link has expired or was already used. Send a new one below.</p>
        )}
        {!user.emailVerified && <VerifyEmailBanner email={user.email} />}

        <section className="rounded-2xl bg-white p-6 ring-1 ring-zinc-200">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-sm text-zinc-500">{published ? "Your site is live at" : "Your site is a draft. When published, it will be at"}</p>
              {published ? (
                <a href={url} target="_blank" rel="noopener noreferrer" className="text-lg font-medium underline underline-offset-4">
                  {url.replace(/^https?:\/\//, "")}
                </a>
              ) : (
                <p className="text-lg font-medium">{url.replace(/^https?:\/\//, "")}</p>
              )}
            </div>
            <PublishToggle published={published} />
          </div>
          <ul className="mt-4 flex flex-wrap gap-x-6 gap-y-2 text-sm">
            {checklist.map(([label, done]) => (
              <li key={label} className={done ? "text-green-700" : "text-zinc-500"}>
                {done ? "✓" : "○"} {label}
              </li>
            ))}
          </ul>
        </section>

        <Section
          id="inquiries"
          title={unread ? `Messages (${unread} new)` : "Messages"}
          subtitle="Inquiries sent through the contact form on your site."
        >
          <Inbox inquiries={inquiries} />
        </Section>

        <Section title="Photos" subtitle="The first photo is your cover image. Add a description to each photo for screen readers and search engines.">
          <PhotoUploader />
          <PhotoGrid photos={photos.map((p) => ({ id: p.id, src: p.src, srcSet: p.srcSet, alt: p.alt }))} />
        </Section>

        <Section title="Albums" subtitle="Group photos into pages like Weddings or Portraits. Your home page still shows everything.">
          <AlbumManager
            albums={(user.albums ?? []).map((a) => ({ ...a, url: `${url}/${a.slug}` }))}
            photos={photos.map((p) => ({ id: p.id, src: p.src }))}
          />
        </Section>

        <Section title="Style" subtitle="Choose how your site looks. You can switch any time.">
          <TemplatePicker templates={[...TEMPLATES]} current={user.template} />
        </Section>

        <Section title="About you" subtitle="Shown on your site.">
          <ProfileForm profile={user.profile} />
        </Section>

        <Section title="Account" subtitle={`Signed in as ${user.email}.`}>
          <AccountSettings />
        </Section>
      </main>
    </>
  );
}

function Section({ id, title, subtitle, children }: { id?: string; title: string; subtitle: string; children: React.ReactNode }) {
  return (
    <section id={id} className="scroll-mt-6 rounded-2xl bg-white p-6 ring-1 ring-zinc-200">
      <h2 className="text-lg font-semibold">{title}</h2>
      <p className="mb-5 text-sm text-zinc-500">{subtitle}</p>
      <div className="space-y-5">{children}</div>
    </section>
  );
}
