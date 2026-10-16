"use client";

import Link from "next/link";
import { use, useActionState } from "react";
import { resetPassword } from "@/app/actions/auth";
import { Button, Field, Input, Message } from "@/app/ui/form";

export function ResetPasswordForm({ token }: { token: Promise<string> }) {
  const value = use(token);
  const [state, action, pending] = useActionState(resetPassword, {});

  if (!value) {
    return (
      <div className="space-y-4">
        <h1 className="text-xl font-semibold">Link missing</h1>
        <p className="text-sm text-zinc-600">Open the link from your reset email, or <Link href="/forgot-password" className="underline">request a new one</Link>.</p>
      </div>
    );
  }

  return (
    <form action={action} className="space-y-4">
      <h1 className="text-xl font-semibold">Choose a new password</h1>
      <input type="hidden" name="token" value={value} />
      <Field label="New password" hint="At least 8 characters.">
        <Input name="password" type="password" required minLength={8} autoComplete="new-password" />
      </Field>
      <Message error={state.error} />
      <Button type="submit" disabled={pending} className="w-full">
        {pending ? "Saving…" : "Save and log in"}
      </Button>
      {state.error && (
        <p className="text-center text-sm"><Link href="/forgot-password" className="underline">Request a new link</Link></p>
      )}
    </form>
  );
}
