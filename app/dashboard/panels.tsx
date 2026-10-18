"use client";

import { useActionState, useState, useTransition } from "react";
import { deleteAccount, resendVerification, signOutEverywhereElse, type FormState } from "@/app/actions/auth";
import { deleteInquiry, setInquiryRead, setPublished } from "@/app/actions/site";
import { Button, Field, Input, Message, buttonClass, secondaryButtonClass } from "@/app/ui/form";
import type { Inquiry } from "@/lib/db";

export function PublishToggle({ published }: { published: boolean }) {
  const [pending, startTransition] = useTransition();
  return (
    <button
      type="button"
      disabled={pending}
      onClick={() => {
        if (published && !confirm("Take your site offline? Visitors will see a “doesn’t exist” page until you put it back online.")) return;
        startTransition(() => setPublished(!published));
      }}
      className={`${published ? secondaryButtonClass : buttonClass} h-8 px-3`}
    >
      {pending ? "Saving…" : published ? "Take offline" : "Put site online"}
    </button>
  );
}

export function VerifyEmailBanner({ email }: { email: string }) {
  const [state, setState] = useState<FormState>({});
  const [pending, startTransition] = useTransition();
  return (
    <div className="flex flex-wrap items-center gap-3 border-l-2 border-accent bg-card px-5 py-3 text-sm">
      <span className="flex-1">Confirm your email address ({email}) so you can reset your password if you ever forget it.</span>
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

export function Inbox({ inquiries }: { inquiries: Inquiry[] }) {
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
                  <button
                    type="button"
                    onClick={() => {
                      if (confirm("Delete this message?")) startTransition(() => deleteInquiry(q.id));
                    }}
                    className="px-3 py-1.5 text-accent hover:bg-accent-soft"
                  >
                    Delete
                  </button>
                </div>
              </div>
            )}
          </li>
        );
      })}
    </ul>
  );
}

export function AccountSettings() {
  const [state, action, pending] = useActionState(deleteAccount, {});
  const [confirming, setConfirming] = useState(false);

  return (
    <div className="space-y-6">
      <div>
        <h3 className="font-medium">Download your data</h3>
        <p className="mb-3 text-sm text-ink-soft">A .zip with your original photos and everything you’ve entered.</p>
        <a href="/api/export" className="inline-flex h-10 items-center px-5 text-sm font-medium border border-rule hover:bg-ink/5">
          Download .zip
        </a>
      </div>
      <SignOutEverywhere />
      <div>
        <h3 className="font-medium text-accent">Delete account</h3>
        <p className="mb-3 text-sm text-ink-soft">Permanently deletes your site, photos and messages. This can’t be undone.</p>
        {confirming ? (
          <form action={action} className="flex flex-wrap items-end gap-3">
            <div className="min-w-48 flex-1">
              <Field label="Enter your password to confirm">
                <Input name="password" type="password" required autoComplete="current-password" />
              </Field>
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
            Delete my account…
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
