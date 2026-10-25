"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { login } from "@/app/actions/auth";
import { Button, Field, Input, Message } from "@/app/ui/form";
import { GoogleButton } from "@/app/ui/google-button";

export default function LoginPage() {
  const [state, action, pending] = useActionState(login, {});
  const [showPassword, setShowPassword] = useState(false);

  return (
    <div className="space-y-4">
      <h1 className="font-display text-3xl">Log in</h1>
      <form action={action} noValidate className="space-y-4">
        <Field label="Email">
          <Input name="email" type="email" defaultValue={state.fields?.email} autoComplete="email" />
        </Field>
        <Field
          label="Password"
          hint={<Link href="/forgot-password" className="underline">Forgot your password?</Link>}
        >
          <div className="flex items-center border border-rule bg-card focus-within:border-ink">
            <input
              name="password"
              type={showPassword ? "text" : "password"}
              autoComplete="current-password"
              className="min-w-0 flex-1 bg-transparent px-3 py-2 text-sm text-ink outline-none"
            />
            <button
              type="button"
              onClick={() => setShowPassword((s) => !s)}
              className="px-3 py-2 text-xs text-ink-soft hover:text-ink"
              aria-label={showPassword ? "Hide password" : "Show password"}
            >
              {showPassword ? "Hide" : "Show"}
            </button>
          </div>
        </Field>
        <Message error={state.error} />
        <Button type="submit" disabled={pending} className="w-full">
          {pending ? "Logging in…" : "Log in"}
        </Button>
      </form>
      <div className="flex items-center gap-3 text-xs text-ink-faint">
        <span className="h-px flex-1 bg-rule" />
        or
        <span className="h-px flex-1 bg-rule" />
      </div>
      <GoogleButton />
      <p className="text-center text-sm text-ink-soft">
        New here? <Link href="/signup" className="underline">Create your site</Link>
      </p>
    </div>
  );
}
