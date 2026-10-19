"use client";

import { useActionState } from "react";
import { reportCopyright } from "@/app/actions/report";
import { ACCURACY_STATEMENT, GOOD_FAITH_STATEMENT } from "@/lib/reports";
import { Button, Field, Input, Message, inputClass } from "@/app/ui/form";

// The fields are the parts of a notice that 17 U.S.C. § 512(c)(3) asks for.
export function CopyrightForm({ site }: { site: string }) {
  const [state, action, pending] = useActionState(reportCopyright, {});
  if (state.ok) return <Message ok={state.ok} />;
  const f = state.fields ?? {};

  return (
    <form action={action} className="space-y-4">
      <Field label="Site">
        <Input name="site" required defaultValue={f.site ?? site} placeholder="the name before the dot in its address" />
      </Field>
      <Field label="Where your work appears on that site" hint="Page or photo addresses, one per line.">
        <textarea name="urls" required rows={3} defaultValue={f.urls} className={inputClass} />
      </Field>
      <Field label="Your original work" hint="Describe it, or link to where you published it.">
        <textarea name="work" required rows={3} defaultValue={f.work} className={inputClass} />
      </Field>
      <fieldset className="space-y-2">
        <legend className="mb-1 text-sm font-medium">You are</legend>
        <label className="flex items-start gap-2 text-sm">
          <input type="radio" name="role" value="owner" required defaultChecked={f.role === "owner"} className="mt-1" />
          The copyright owner
        </label>
        <label className="flex items-start gap-2 text-sm">
          <input type="radio" name="role" value="agent" required defaultChecked={f.role === "agent"} className="mt-1" />
          Authorized to act for the copyright owner
        </label>
      </fieldset>
      <Field label="The owner’s name" hint="Only if you act for someone else.">
        <Input name="ownerName" defaultValue={f.ownerName} />
      </Field>
      <Field label="Your full name">
        <Input name="name" required defaultValue={f.name} autoComplete="name" />
      </Field>
      <Field label="Company or organization (optional)">
        <Input name="organization" defaultValue={f.organization} autoComplete="organization" />
      </Field>
      <Field label="Mailing address">
        <textarea name="address" required rows={3} defaultValue={f.address} autoComplete="street-address" className={inputClass} />
      </Field>
      <Field label="Phone">
        <Input name="phone" type="tel" required defaultValue={f.phone} autoComplete="tel" />
      </Field>
      <Field label="Email">
        <Input name="email" type="email" required defaultValue={f.email} autoComplete="email" />
      </Field>
      <label className="flex items-start gap-2 text-sm">
        <input type="checkbox" name="goodFaith" value="yes" required defaultChecked={f.goodFaith === "yes"} className="mt-1" />
        {GOOD_FAITH_STATEMENT}
      </label>
      <label className="flex items-start gap-2 text-sm">
        <input type="checkbox" name="accurate" value="yes" required defaultChecked={f.accurate === "yes"} className="mt-1" />
        {ACCURACY_STATEMENT}
      </label>
      <Field label="Signature" hint="Type your full name. It counts as your signature.">
        <Input name="signature" required defaultValue={f.signature} />
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
        {pending ? "Sending…" : "Send notice"}
      </Button>
    </form>
  );
}
