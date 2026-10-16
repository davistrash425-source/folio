"use client";

import Link from "next/link";
import { useActionState } from "react";
import { login } from "@/app/actions/auth";
import { Button, Field, Input, Message } from "@/app/ui/form";

export default function LoginPage() {
  const [state, action, pending] = useActionState(login, {});

  return (
    <form action={action} className="space-y-4">
      <h1 className="font-display text-3xl">Log in</h1>
      <Field label="Email">
        <Input name="email" type="email" required defaultValue={state.fields?.email} autoComplete="email" />
      </Field>
      <Field label="Password" hint={<Link href="/forgot-password" className="underline">Forgot your password?</Link>}>
        <Input name="password" type="password" required autoComplete="current-password" />
      </Field>
      <Message error={state.error} />
      <Button type="submit" disabled={pending} className="w-full">
        {pending ? "Logging in…" : "Log in"}
      </Button>
      <p className="text-center text-sm text-ink-soft">
        New here? <Link href="/signup" className="underline">Create your site</Link>
      </p>
    </form>
  );
}
