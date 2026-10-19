"use client";

import Link from "next/link";
import { useActionState } from "react";
import { reportSite } from "@/app/actions/report";
import { REPORT_REASONS } from "@/lib/reports";
import { Button, Field, Input, Message, inputClass } from "@/app/ui/form";

export function ReportForm({ site }: { site: string }) {
  const [state, action, pending] = useActionState(reportSite, {});
  if (state.ok) return <Message ok={state.ok} />;

  return (
    <form action={action} className="space-y-4">
      <p className="border-l-2 border-accent bg-card px-4 py-3 text-sm">
        Your photos used without permission?{" "}
        <Link href={`/report/copyright${site ? `?site=${encodeURIComponent(site)}` : ""}`} className="underline">
          Send a copyright notice
        </Link>{" "}
        instead. It asks for the details the law requires before we can take photos down.
      </p>
      <Field label="Site">
        <Input name="site" required defaultValue={site} placeholder="the name before the dot in its address" />
      </Field>
      <fieldset className="space-y-2">
        <legend className="mb-1 text-sm font-medium">What’s wrong?</legend>
        {Object.entries(REPORT_REASONS).map(([value, label]) => (
          <label key={value} className="flex items-start gap-2 text-sm">
            <input type="radio" name="reason" value={value} required className="mt-1" />
            {label}
          </label>
        ))}
      </fieldset>
      <Field label="Details">
        <textarea name="details" required rows={5} maxLength={4000} className={inputClass} placeholder="Which photos or pages, and why. Links help." />
      </Field>
      <Field label="Your email">
        <Input name="email" type="email" required autoComplete="email" />
      </Field>
      {/* Hidden from people; bots that fill it in are ignored. */}
      <div aria-hidden="true" className="absolute -left-[9999px]">
        <label>
          Company
          <input name="company" tabIndex={-1} autoComplete="off" />
        </label>
      </div>
      <Message error={state.error} />
      <Button type="submit" disabled={pending} className="w-full">
        {pending ? "Sending…" : "Send report"}
      </Button>
    </form>
  );
}
