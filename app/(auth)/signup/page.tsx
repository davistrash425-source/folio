"use client";

import Link from "next/link";
import { useActionState } from "react";
import { signup } from "@/app/actions/auth";
import { Button, Field, Input, Message } from "@/app/ui/form";
import { ROOT_DOMAIN } from "@/lib/site";

export default function SignupPage() {
  const [state, action, pending] = useActionState(signup, {});
  const f = state.fields ?? {};

  return (
    <form action={action} className="space-y-4">
      <h1 className="font-display text-3xl">Create your site</h1>
      <Field label="Your name">
        <Input name="name" required defaultValue={f.name} autoComplete="name" />
      </Field>
      <Field label="Email">
        <Input name="email" type="email" required defaultValue={f.email} autoComplete="email" />
      </Field>
      <Field label="Password" hint="At least 8 characters.">
        <Input name="password" type="password" required minLength={8} autoComplete="new-password" />
      </Field>
      <Field label="Site address">
        <div className="flex items-center border border-rule focus-within:border-ink focus-within:border focus-within:border-ink">
          <input
            name="subdomain"
            required
            defaultValue={f.subdomain}
            autoCapitalize="none"
            spellCheck={false}
            placeholder="yourname"
            className="min-w-0 flex-1 rounded-l-lg px-3 py-2 text-sm lowercase outline-none"
          />
          <span className="pr-3 text-sm text-ink-soft">.{ROOT_DOMAIN}</span>
        </div>
      </Field>
      <Message error={state.error} />
      <Button type="submit" disabled={pending} className="w-full">
        {pending ? "Creating…" : "Create account"}
      </Button>
      <p className="text-center text-sm text-ink-soft">
        Already have an account? <Link href="/login" className="underline">Log in</Link>
      </p>
    </form>
  );
}
