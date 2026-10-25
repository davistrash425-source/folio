"use client";

import Link from "next/link";
import { useActionState, useEffect, useRef, useState } from "react";
import { signup } from "@/app/actions/auth";
import { ROOT_DOMAIN } from "@/lib/site";
import { Button, Message } from "@/app/ui/form";
import { GoogleButton } from "@/app/ui/google-button";
import { Turnstile } from "@/app/ui/turnstile";
import { useAddressCheck, type AddressStatus } from "@/app/ui/use-address-check";

// The shared look for a text box that's fine or in error (red border).
const box = (isError: boolean) =>
  `w-full border bg-card text-sm text-ink outline-none transition-colors ${
    isError ? "border-accent" : "border-rule focus:border-ink"
  }`;

export function SignupForm({ initialSubdomain }: { initialSubdomain: string }) {
  const [state, action, pending] = useActionState(signup, {});
  // The password is kept in the component, never sent back by the action, so
  // it survives a failed submit without ever being echoed into the page.
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [subdomain, setSubdomain] = useState(initialSubdomain);
  const [showPassword, setShowPassword] = useState(false);
  const { status, message, checking } = useAddressCheck(subdomain);

  const field = state.field;
  const nameRef = useRef<HTMLInputElement>(null);
  const emailRef = useRef<HTMLInputElement>(null);
  const passwordRef = useRef<HTMLInputElement>(null);
  const subdomainRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!field) return;
    const ref = field === "name" ? nameRef : field === "email" ? emailRef : field === "password" ? passwordRef : subdomainRef;
    ref.current?.focus();
  }, [field]);

  return (
    <div className="space-y-4">
      <h1 className="font-display text-3xl">Create your site</h1>
      <form action={action} noValidate className="space-y-4">
        <label className="block">
          <span className="label text-ink-soft">Your name</span>
          <input
            ref={nameRef}
            name="name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            autoComplete="name"
            className={`mt-1.5 px-3 py-2 ${box(field === "name")}`}
          />
        </label>
        <label className="block">
          <span className="label text-ink-soft">Email</span>
          <input
            ref={emailRef}
            name="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="email"
            className={`mt-1.5 px-3 py-2 ${box(field === "email")}`}
          />
        </label>
        <label className="block">
          <span className="label text-ink-soft">Password</span>
          <div className={`mt-1.5 flex items-center ${box(field === "password")}`}>
            <input
              ref={passwordRef}
              name="password"
              type={showPassword ? "text" : "password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="new-password"
              aria-describedby="signup-password-hint"
              className="min-w-0 flex-1 bg-transparent px-3 py-2 outline-none"
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
          <span id="signup-password-hint" className="mt-1.5 block text-xs text-ink-faint">
            At least 8 characters.
          </span>
        </label>
        <label className="block">
          <span className="label text-ink-soft">Site address</span>
          <div className={`mt-1.5 flex items-center ${box(field === "subdomain")}`}>
            <input
              ref={subdomainRef}
              name="subdomain"
              value={subdomain}
              onChange={(e) => setSubdomain(e.target.value.toLowerCase())}
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              placeholder="yourname"
              aria-describedby="signup-address-hint"
              className="min-w-0 flex-1 bg-transparent px-3 py-2 lowercase outline-none"
            />
            <span className="pr-3 text-sm text-ink-soft">.{ROOT_DOMAIN}</span>
          </div>
          <span id="signup-address-hint" className="mt-1.5 block text-xs text-ink-faint">
            <AddressHint status={status} message={message} checking={checking} />
          </span>
        </label>
        <label className="flex items-start gap-2 text-sm text-ink-soft">
          <input type="checkbox" name="terms" className="mt-0.5" />
          <span>
            I agree to the <Link href="/terms" target="_blank" className="underline">Terms</Link> and{" "}
            <Link href="/privacy" target="_blank" className="underline">Privacy Policy</Link>.
          </span>
        </label>
        <Turnstile resetKey={state} />
        <Message error={state.error} />
        <Button type="submit" disabled={pending} className="w-full">
          {pending ? "Creating…" : "Create account"}
        </Button>
      </form>
      <div className="flex items-center gap-3 text-xs text-ink-faint">
        <span className="h-px flex-1 bg-rule" />
        or
        <span className="h-px flex-1 bg-rule" />
      </div>
      <GoogleButton />
      <p className="text-center text-sm text-ink-soft">
        Already have an account? <Link href="/login" className="underline">Log in</Link>
      </p>
    </div>
  );
}

function AddressHint({ status, message, checking }: { status: AddressStatus; message: string; checking: boolean }) {
  if (checking) return <span aria-live="polite">Checking…</span>;
  if (status === "available") {
    return <span className="text-ink-soft">✓ This address is free — you can change it later.</span>;
  }
  if (status === "taken" || status === "held" || status === "invalid") {
    return <span className="text-accent">✗ {message}</span>;
  }
  return <>You can change it later.</>;
}
