"use client";

import { useActionState, useState, useTransition } from "react";
import { deleteAccount, resendVerification, signOutEverywhereElse, type FormState } from "@/app/actions/auth";
import { changeAddress, deleteInquiry, saveAiTraining, setInquiryRead, setPublished } from "@/app/actions/site";
import { createSite } from "@/app/actions/sites";
import { Button, Field, Input, Message, buttonClass, secondaryButtonClass } from "@/app/ui/form";
import { ConfirmButton } from "@/app/ui/confirm";
import type { Inquiry } from "@/lib/db";

export function PublishToggle({ published }: { published: boolean }) {
  const [pending, startTransition] = useTransition();
  if (published) {
    return (
      <ConfirmButton
        label="Take offline"
        confirmLabel="Take offline"
        message="Take your site offline?"
        onConfirm={() => startTransition(() => setPublished(false))}
        className={`${secondaryButtonClass} h-8 px-3`}
        confirmClassName={`${secondaryButtonClass} h-8 px-3`}
      />
    );
  }
  return (
    <button
      type="button"
      disabled={pending}
      onClick={() => startTransition(() => setPublished(true))}
      className={`${buttonClass} h-8 px-3`}
    >
      {pending ? "Saving…" : "Put site online"}
    </button>
  );
}

// hidingSite: the site is set to be online, and the unconfirmed email is the
// only thing keeping it from visitors.
export function VerifyEmailBanner({ email, hidingSite }: { email: string; hidingSite?: boolean }) {
  const [state, setState] = useState<FormState>({});
  const [pending, startTransition] = useTransition();
  return (
    <div className="flex flex-wrap items-center gap-3 border-l-2 border-accent bg-card px-5 py-3 text-sm">
      <span className="flex-1">
        {hidingSite && <strong className="font-medium text-accent">Visitors can’t see your site yet. </strong>}
        Confirm your email address ({email}) to put your site online. Open the link we emailed you; it also lets you
        reset your password if you ever forget it.
      </span>
      {state.ok || state.error ? (
        <Message ok={state.ok} error={state.error} />
      ) : (
        <button
          type="button"
          disabled={pending}
          onClick={() => startTransition(async () => setState(await resendVerification()))}
          className={`${secondaryButtonClass} h-8 px-3`}
        >
          {pending ? "Sending…" : "Resend email"}
        </button>
      )}
    </div>
  );
}

// photos: the photos inquiries asked about, by id.
export function Inbox({ inquiries, photos = {} }: { inquiries: Inquiry[]; photos?: Record<string, { src: string; label: string }> }) {
  const [pending, startTransition] = useTransition();
  const [openId, setOpenId] = useState<string | null>(null);

  if (inquiries.length === 0) {
    return <p className="text-sm text-ink-soft">No messages yet. Visitors can contact you with the form at the bottom of your site.</p>;
  }

  return (
    <ul className={`divide-y divide-rule border border-rule ${pending ? "opacity-70" : ""}`}>
      {inquiries.map((q) => {
        const open = openId === q.id;
        return (
          <li key={q.id} className="p-4">
            <button
              type="button"
              aria-expanded={open}
              onClick={() => {
                setOpenId(open ? null : q.id);
                if (!q.read) startTransition(() => setInquiryRead(q.id, true));
              }}
              className="flex w-full items-baseline gap-3 text-left"
            >
              {!q.read && <span className="h-2 w-2 shrink-0 rounded-full bg-accent" aria-label="Unread" />}
              <span className={`flex-1 truncate ${q.read ? "" : "font-semibold"}`}>
                {q.name} <span className="font-normal text-ink-soft">— {q.message.slice(0, 80)}</span>
              </span>
              <time className="shrink-0 text-xs text-ink-soft" dateTime={q.createdAt}>
                {new Date(q.createdAt).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
              </time>
            </button>
            {open && (
              <div className="mt-3 space-y-3 pl-5 text-sm">
                <p className="text-ink-soft">
                  <a href={`mailto:${q.email}`} className="underline">{q.email}</a>
                  {q.date && <> · Date: {q.date}</>}
                </p>
                {q.photoId && photos[q.photoId] && (
                  <p className="flex items-center gap-3 text-ink-soft">
                    {/* eslint-disable-next-line @next/next/no-img-element -- user uploads are served by our own route */}
                    <img src={photos[q.photoId].src} alt="" className="h-12 w-12 object-cover" />
                    About this photo{photos[q.photoId].label && `: ${photos[q.photoId].label}`}
                  </p>
                )}
                <p className="whitespace-pre-line">{q.message}</p>
                <div className="flex gap-2">
                  <a
                    href={`mailto:${q.email}?subject=${encodeURIComponent("Re: your inquiry")}`}
                    className="bg-ink px-4 py-1.5 font-medium text-paper"
                  >
                    Reply
                  </a>
                  <button
                    type="button"
                    onClick={() => startTransition(() => setInquiryRead(q.id, false))}
                    className="px-3 py-1.5 hover:bg-ink/5"
                  >
                    Mark unread
                  </button>
                  <ConfirmButton
                    label="Delete"
                    message="Delete this message?"
                    onConfirm={() => startTransition(() => deleteInquiry(q.id))}
                    className="px-3 py-1.5 text-accent hover:bg-accent-soft"
                    confirmClassName="bg-accent px-3 py-1.5 text-sm text-paper hover:bg-ink"
                  />
                </div>
              </div>
            )}
          </li>
        );
      })}
    </ul>
  );
}

// Whether the site asks AI companies' crawlers to stay away (app/robots.ts).
export function AiTrainingForm({ blocked }: { blocked: boolean }) {
  const [state, action, pending] = useActionState(saveAiTraining, {});
  return (
    <form action={action} className="space-y-3">
      <label className="flex items-start gap-2 text-sm">
        <input type="checkbox" name="blockAi" value="yes" defaultChecked={blocked} className="mt-1" />
        <span>
          Ask AI companies not to collect my site to train their AI <span className="text-ink-soft">(recommended)</span>
        </span>
      </label>
      <p className="text-sm text-ink-soft">
        Your site tells the AI crawlers we know about (from OpenAI, Google, Anthropic, Apple, Meta, Common Crawl and
        others) to stay away. Search engines can still list your site. Crawlers that ignore these rules can’t be stopped
        this way.
      </p>
      <div className="flex items-center gap-3">
        <Button type="submit" disabled={pending}>{pending ? "Saving…" : "Save"}</Button>
        <Message error={state.error} ok={state.ok} />
      </div>
    </form>
  );
}

// A site address box: the name, then `domain` (e.g. "folio.cam") after it.
function AddressInput({ defaultValue, domain }: { defaultValue: string; domain: string }) {
  return (
    <label className="block text-sm">
      <span className="label text-ink-soft">Address</span>
      <span className="mt-1 flex max-w-md items-center border border-rule bg-card focus-within:border-ink">
        <input
          name="subdomain"
          required
          defaultValue={defaultValue}
          maxLength={30}
          autoCapitalize="none"
          spellCheck={false}
          className="min-w-0 flex-1 bg-transparent py-2 pl-3 text-sm outline-none"
        />
        <span className="pr-3 text-ink-faint">.{domain}</span>
      </span>
    </label>
  );
}

export function AddressForm({ subdomain, domain }: { subdomain: string; domain: string }) {
  const [state, action, pending] = useActionState(changeAddress, {});
  return (
    <form action={action} className="space-y-3">
      <AddressInput defaultValue={subdomain} domain={domain} />
      <p className="text-sm text-ink-soft">
        Your site moves to the new address straight away, and the old one stops working, so update any links you’ve
        shared. Nobody else can take your old address for a year, and you can move back to it.
      </p>
      <div className="flex items-center gap-3">
        <Button type="submit" disabled={pending}>{pending ? "Saving…" : "Change address"}</Button>
        <Message error={state.error} ok={state.ok} />
      </div>
    </form>
  );
}

// Starts one of an admin's extra sites (app/actions/sites.ts).
export function NewSiteForm({ domain }: { domain: string }) {
  const [state, action, pending] = useActionState(createSite, {});
  return (
    <form action={action} className="space-y-4">
      <Field label="Site name" hint="Shown at the top of the site. You can change it later.">
        <Input name="name" required maxLength={80} defaultValue={state.fields?.name} />
      </Field>
      <AddressInput defaultValue={state.fields?.subdomain ?? ""} domain={domain} />
      <p className="text-sm text-ink-soft">
        The new site starts with no photos and the standard design. Messages from its contact form go to your email.
      </p>
      <div className="flex items-center gap-3">
        <Button type="submit" disabled={pending}>{pending ? "Creating…" : "Create site"}</Button>
        <Message error={state.error} />
      </div>
    </form>
  );
}

// `extraSite` is the address of an admin's extra site, which has no password
// or login of its own: it's deleted by typing that address. `extraSites` is
// how many extra sites an admin's account has (deleted along with it). A
// Google-only account (no password) is also deleted by typing its address.
export function AccountSettings({
  extraSite,
  extraSites = 0,
  hasPassword = true,
  address,
}: {
  extraSite?: string;
  extraSites?: number;
  hasPassword?: boolean;
  address?: string;
}) {
  const [state, action, pending] = useActionState(deleteAccount, {});
  const [confirming, setConfirming] = useState(false);
  const confirmByAddress = Boolean(extraSite) || !hasPassword;
  const confirmAddress = extraSite ?? address ?? "";

  return (
    <div className="space-y-6">
      <div>
        <h3 className="font-medium">Download your data</h3>
        <p className="mb-3 text-sm text-ink-soft">A .zip with your original photos and everything you’ve entered.</p>
        <a href="/api/export" className="inline-flex h-10 items-center px-5 text-sm font-medium border border-rule hover:bg-ink/5">
          Download .zip
        </a>
      </div>
      {!extraSite && <SignOutEverywhere />}
      <div>
        <h3 className="font-medium text-accent">{extraSite ? "Delete this site" : "Delete account"}</h3>
        <p className="mb-3 text-sm text-ink-soft">
          {extraSite
            ? "Permanently deletes this site, its photos and messages. Your other sites stay. This can’t be undone."
            : `Permanently deletes your site, photos and messages${
                extraSites ? `, and your ${extraSites === 1 ? "other site" : `${extraSites} other sites`}` : ""
              }. This can’t be undone.`}
        </p>
        {confirming ? (
          <form action={action} className="flex flex-wrap items-end gap-3">
            <div className="min-w-48 flex-1">
              {confirmByAddress ? (
                <Field label={`Type ${confirmAddress} to confirm`}>
                  <Input name="confirm" required autoCapitalize="none" spellCheck={false} />
                </Field>
              ) : (
                <Field label="Enter your password to confirm">
                  <Input name="password" type="password" required autoComplete="current-password" />
                </Field>
              )}
            </div>
            <Button type="submit" disabled={pending} className="bg-accent hover:bg-ink">
              {pending ? "Deleting…" : "Delete everything"}
            </Button>
            <button type="button" onClick={() => setConfirming(false)} className="h-10 px-4 text-sm hover:bg-ink/5">
              Cancel
            </button>
            <div className="w-full"><Message error={state.error} /></div>
          </form>
        ) : (
          <button
            type="button"
            onClick={() => setConfirming(true)}
            className="h-10 border border-accent px-5 text-sm font-medium text-accent hover:bg-accent-soft"
          >
            {extraSite ? "Delete this site…" : "Delete my account…"}
          </button>
        )}
      </div>
    </div>
  );
}

function SignOutEverywhere() {
  const [state, setState] = useState<FormState>({});
  const [pending, startTransition] = useTransition();
  return (
    <div>
      <h3 className="font-medium">Signed in somewhere else?</h3>
      <p className="mb-3 text-sm text-ink-soft">
        Signs you out on every other phone, tablet and computer. You stay signed in here. Resetting your password does
        this too.
      </p>
      <button
        type="button"
        disabled={pending}
        onClick={() => startTransition(async () => setState(await signOutEverywhereElse()))}
        className={secondaryButtonClass}
      >
        {pending ? "Signing out…" : "Sign out everywhere else"}
      </button>
      <div className="mt-2">
        <Message ok={state.ok} error={state.error} />
      </div>
    </div>
  );
}
