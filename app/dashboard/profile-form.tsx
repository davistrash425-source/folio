"use client";

import { useActionState } from "react";
import { saveProfile } from "@/app/actions/site";
import { Button, Field, Input, Message, inputClass } from "@/app/ui/form";
import { keepFields } from "@/app/ui/keep-fields";
import type { User } from "@/lib/db";

// Name, bio and contact details, shown on the site (the About page and the
// footer). Lives in Web design → About you. `compact` stacks the fields in one
// column for the editor's narrow controls panel.
export function ProfileForm({ profile, compact = false }: { profile: User["profile"]; compact?: boolean }) {
  const [state, action, pending] = useActionState(keepFields(saveProfile), {});
  // After a failed save, what was typed; otherwise what's saved.
  const f = state.fields;
  const value = (name: string, saved: string | undefined) => f?.[name] ?? saved;
  const wide = compact ? "" : "sm:col-span-2";

  return (
    <form action={action} noValidate className={`grid gap-4 ${compact ? "" : "sm:grid-cols-2"}`}>
      <Field label="Name">
        <Input name="name" required maxLength={80} defaultValue={value("name", profile.name)} />
      </Field>
      <Field label="Location">
        <Input name="location" maxLength={80} defaultValue={value("location", profile.location)} placeholder="Lisbon, Portugal" />
      </Field>
      <div className={wide}>
        <Field label="Bio">
          <textarea
            name="bio"
            maxLength={2000}
            rows={4}
            defaultValue={value("bio", profile.bio)}
            placeholder="A few lines about you and your work."
            className={inputClass}
          />
        </Field>
      </div>
      <div className={`space-y-2 border border-rule bg-paper p-4 ${wide}`}>
        <Field label="Contact email" hint="Messages from your site's contact form are sent here.">
          <Input name="contactEmail" type="email" maxLength={120} defaultValue={value("contactEmail", profile.contactEmail)} />
        </Field>
        {/* Hidden by default: it starts as the login email. */}
        <label className="flex items-start gap-3 text-sm">
          <input type="checkbox" name="showEmail" defaultChecked={f ? f.showEmail === "on" : Boolean(profile.showEmail)} className="mt-0.5 h-4 w-4" />
          <span>
            <span className="font-medium">Show this email on my site</span>
            <span className="block text-ink-soft">Off: visitors reach you through the contact form only, and your address stays private.</span>
          </span>
        </label>
      </div>
      <Field label="Phone">
        <Input name="phone" type="tel" maxLength={40} defaultValue={value("phone", profile.phone)} />
      </Field>
      <Field label="Instagram" hint="Your handle, like @yourname.">
        <Input name="instagram" defaultValue={value("instagram", profile.social.instagram)} placeholder="@yourname" autoCapitalize="none" spellCheck={false} />
      </Field>
      <Field label="X / Twitter" hint="Your handle, like @yourname.">
        <Input name="twitter" defaultValue={value("twitter", profile.social.twitter)} placeholder="@yourname" autoCapitalize="none" spellCheck={false} />
      </Field>
      <Field label="Facebook" hint="Your page name, like yourname.">
        <Input name="facebook" defaultValue={value("facebook", profile.social.facebook)} placeholder="yourname" autoCapitalize="none" spellCheck={false} />
      </Field>
      <Field label="Website">
        <Input name="website" defaultValue={value("website", profile.social.website)} placeholder="yourname.com" autoCapitalize="none" spellCheck={false} />
      </Field>
      <div className={wide}>
        <Field label="Copyright line" hint="Shown at the bottom of your site, and saved inside the photos you upload from now on.">
          <Input
            name="copyrightLine"
            maxLength={120}
            defaultValue={value("copyrightLine", profile.copyrightLine)}
            placeholder={`© ${profile.name || "Your Name"}. All rights reserved.`}
          />
        </Field>
      </div>
      <div className={`flex items-center gap-3 ${wide}`}>
        <Button type="submit" disabled={pending}>{pending ? "Saving…" : "Save"}</Button>
        <Message error={state.error} ok={state.ok} />
      </div>
    </form>
  );
}
