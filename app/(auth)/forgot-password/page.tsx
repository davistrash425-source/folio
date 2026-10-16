"use client";

import Link from "next/link";
import { useActionState } from "react";
import { requestPasswordReset } from "@/app/actions/auth";
import { Button, Field, Input, Message } from "@/app/ui/form";

export default function ForgotPasswordPage() {
  const [state, action, pending] = useActionState(requestPasswordReset, {});

  return (
    <form action={action} className="space-y-4">
      <h1 className="font-display text-3xl">Reset your password</h1>
      <p className="text-sm text-ink-soft">Enter your account email and we’ll send you a link to choose a new password.</p>
      <Field label="Email">
        <Input name="email" type="email" required defaultValue={state.fields?.email} autoComplete="email" />
      </Field>
      <Message error={state.error} ok={state.ok} />
      <Button type="submit" disabled={pending} className="w-full">
        {pending ? "Sending…" : "Send reset link"}
      </Button>
      <p className="text-center text-sm text-ink-soft">
        <Link href="/login" className="underline">Back to log in</Link>
      </p>
    </form>
  );
}
