/* eslint-disable @next/next/no-img-element -- user uploads are served by our own route */
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import {
  placeLegalHold,
  releaseLegalHold,
  restorePhotos,
  suspendSite,
  takeDownPhotos,
  unsuspendSite,
} from "@/app/actions/admin";
import { Card, Loading, PageHeader } from "@/app/dashboard/manage/section";
import { Button, Field, Input, SecondaryButton, inputClass } from "@/app/ui/form";
import { STRIKE_LIMIT, requireAdmin } from "@/lib/admin";
import { adminActionsFor, findUserBySubdomain, reportsForSite } from "@/lib/db";
import { REASON_LABELS } from "@/lib/reports";
import { isLive, isPublished, siteUrl } from "@/lib/site";
import { photoSource } from "@/lib/uploads";

export default function AdminSitePage({ params, searchParams }: PageProps<"/admin/sites/[subdomain]">) {
  return (
    <Suspense fallback={<Loading />}>
      <SiteView params={params} searchParams={searchParams} />
    </Suspense>
  );
}

const when = (iso: string) => `${new Date(iso).toUTCString().slice(5, 22)} UTC`;

function Notify({ checked = true }: { checked?: boolean }) {
  return (
    <label className="flex items-center gap-2 text-sm">
      <input type="checkbox" name="notify" value="yes" defaultChecked={checked} />
      Email the photographer
    </label>
  );
}

async function SiteView({ params, searchParams }: PageProps<"/admin/sites/[subdomain]">) {
  await requireAdmin();
  const { subdomain } = await params;
  const { done, report: chosenReport } = await searchParams;
  const user = await findUserBySubdomain(decodeURIComponent(subdomain));
  if (!user) notFound();
  const [reports, log] = await Promise.all([reportsForSite(user.subdomain), adminActionsFor(user.id)]);
  const strikes = user.strikes?.length ?? 0;
  const preselected =
    typeof chosenReport === "string" && reports.some((r) => r.id === chosenReport)
      ? chosenReport
      : (reports.find((r) => r.status === "open")?.id ?? "");
  const status = user.suspended
    ? `Suspended because ${user.suspended.reason}`
    : isLive(user)
      ? "Live"
      : isPublished(user)
        ? "Not live yet"
        : "Offline (the photographer's choice)";

  return (
    <>
      <PageHeader title={user.subdomain} subtitle={`${user.profile.name} · ${user.email} · joined ${when(user.createdAt)}`} />
      {typeof done === "string" && <p className="border-l-2 border-ink bg-card px-5 py-3 text-sm">{done}</p>}

      <Card title="Status">
        <ul className="space-y-1 text-sm">
          <li>
            Site: {status} ·{" "}
            <a href={siteUrl(user.subdomain)} target="_blank" rel="noopener noreferrer" className="underline">
              open ↗
            </a>
          </li>
          <li>Email confirmed: {user.emailVerified ? "yes" : "no"}</li>
          <li className={strikes >= STRIKE_LIMIT ? "font-medium text-accent" : ""}>
            Copyright strikes: {strikes} of {STRIKE_LIMIT}
            {strikes >= STRIKE_LIMIT && " — at the limit: suspend the site under the repeat-infringer policy"}
          </li>
          <li>Legal hold: {user.legalHold ? `yes, since ${when(user.legalHold.at)}${user.legalHold.note ? ` (${user.legalHold.note})` : ""}` : "no"}</li>
        </ul>
      </Card>

      <Card title="Photos" subtitle="Tick photos, then take them down or put them back.">
        {user.photos.length === 0 ? (
          <p className="text-sm text-ink-soft">No photos.</p>
        ) : (
          <form className="space-y-5">
            <input type="hidden" name="userId" value={user.id} />
            <ul className="grid grid-cols-3 gap-3 sm:grid-cols-5 lg:grid-cols-6">
              {user.photos.map((photo) => {
                const src = photoSource(user.id, photo);
                return (
                  <li key={photo.id}>
                    <label className="block cursor-pointer">
                      {photo.removed ? (
                        <span className="label flex aspect-square w-full items-center justify-center bg-ink/5 text-accent">
                          Taken down
                        </span>
                      ) : (
                        <img src={src.src} srcSet={src.srcSet} sizes="160px" alt="" className="aspect-square w-full bg-ink/5 object-cover" />
                      )}
                      <span className="mt-1 flex items-start gap-1.5 text-xs">
                        <input type="checkbox" name="photo" value={photo.id} className="mt-0.5" />
                        <span className="truncate">{photo.description || photo.id.slice(0, 8)}</span>
                      </span>
                    </label>
                  </li>
                );
              })}
            </ul>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Because of report">
                <select name="reportId" defaultValue={preselected} className={inputClass}>
                  <option value="">No report (say why in the note)</option>
                  {reports.map((r) => (
                    <option key={r.id} value={r.id}>
                      {REASON_LABELS[r.reason] ?? r.reason} · {when(r.createdAt)} · {r.status}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Note" hint="Without a report, it finishes the email's sentence “…because …”.">
                <Input name="note" placeholder="they show violence" />
              </Field>
            </div>
            <div className="space-y-2">
              <Notify />
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" name="disputed" value="yes" />
                Putting back after a valid counter-notice (removes the strike)
              </label>
            </div>
            <div className="flex flex-wrap gap-3">
              <Button type="submit" formAction={takeDownPhotos}>
                Take down ticked photos
              </Button>
              <SecondaryButton type="submit" formAction={restorePhotos}>
                Put back ticked photos
              </SecondaryButton>
            </div>
          </form>
        )}
      </Card>

      <Card title="Suspension" subtitle="Hides the whole site and stops uploads. The photographer can still sign in and export.">
        {user.suspended ? (
          <form action={unsuspendSite} className="space-y-3">
            <input type="hidden" name="userId" value={user.id} />
            <Notify />
            <Button type="submit">Lift the suspension</Button>
          </form>
        ) : (
          <form action={suspendSite} className="max-w-xl space-y-3">
            <input type="hidden" name="userId" value={user.id} />
            <Field label="Reason" hint="Finishes the email's sentence “We've taken your site offline because …”.">
              <Input name="reason" placeholder="it received three valid copyright notices" />
            </Field>
            <Notify />
            <Button type="submit" className="bg-accent hover:bg-ink">
              Suspend the site
            </Button>
          </form>
        )}
      </Card>

      <Card
        title="Legal hold"
        subtitle="For a child-safety case or a legal request: nothing in the account can be deleted. The photographer isn't told."
      >
        {user.legalHold ? (
          <form action={releaseLegalHold}>
            <input type="hidden" name="userId" value={user.id} />
            <SecondaryButton type="submit">Release the hold</SecondaryButton>
          </form>
        ) : (
          <form action={placeLegalHold} className="flex max-w-xl flex-wrap items-end gap-3">
            <input type="hidden" name="userId" value={user.id} />
            <div className="min-w-60 flex-1">
              <Field label="Note (for the log)">
                <Input name="note" placeholder="e.g. NCMEC report 12345" />
              </Field>
            </div>
            <SecondaryButton type="submit">Place a hold</SecondaryButton>
          </form>
        )}
      </Card>

      <Card title="Reports about this site">
        {reports.length === 0 ? (
          <p className="text-sm text-ink-soft">None.</p>
        ) : (
          <ul className="space-y-1 text-sm">
            {reports.map((r) => (
              <li key={r.id}>
                <Link href={`/admin/reports/${r.id}`} className="underline">
                  {REASON_LABELS[r.reason] ?? r.reason}
                </Link>{" "}
                · {when(r.createdAt)} · {r.status}
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card title="Log">
        {log.length === 0 ? (
          <p className="text-sm text-ink-soft">Nothing yet.</p>
        ) : (
          <ul className="space-y-1 text-sm">
            {log.map((entry, i) => (
              <li key={i}>
                <span className="text-ink-soft">{when(entry.at)} · {entry.adminEmail}:</span> {entry.detail}
              </li>
            ))}
          </ul>
        )}
      </Card>
    </>
  );
}
