"use client";

import Link from "next/link";
import { useActionState, useEffect, useRef, useState } from "react";
import { completeGoogleSignup } from "@/app/actions/auth";
import { ROOT_DOMAIN } from "@/lib/site";
import { Button, Message } from "@/app/ui/form";
import { useAddressCheck, type AddressStatus } from "@/app/ui/use-address-check";

const box = (isError: boolean) =>
  `w-full border bg-card text-sm text-ink outline-none transition-colors ${
    isError ? "border-accent" : "border-rule focus:border-ink"
  }`;

export function GoogleSignupForm({ name, email }: { name: string; email: string }) {
  const [state, action, pending] = useActionState(completeGoogleSignup, {});
  const [displayName, setDisplayName] = useState(name);
  const [subdomain, setSubdomain] = useState("");
  const { status, message, checking } = useAddressCheck(subdomain);

  const field = state.field;
  const nameRef = useRef<HTMLInputElement>(null);
  const subdomainRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (field === "name") nameRef.current?.focus();
    else if (field === "subdomain") subdomainRef.current?.focus();
  }, [field]);

  return (
    <div className="space-y-4">
      <h1 className="font-display text-3xl">Almost there</h1>
      <p className="text-sm text-ink-soft">
        You signed in with Google as <span className="text-ink">{email}</span>. Choose your name and site address.
      </p>
      <form action={action} noValidate className="space-y-4">
        <label className="block">
          <span className="label text-ink-soft">Your name</span>
          <input
            ref={nameRef}
            name="name"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            autoComplete="name"
            className={`mt-1.5 px-3 py-2 ${box(field === "name")}`}
          />
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
              aria-describedby="google-address-hint"
              className="min-w-0 flex-1 bg-transparent px-3 py-2 lowercase outline-none"
            />
            <span className="pr-3 text-sm text-ink-soft">.{ROOT_DOMAIN}</span>
          </div>
          <span id="google-address-hint" className="mt-1.5 block text-xs text-ink-faint">
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
        <Message error={state.error} />
        <Button type="submit" disabled={pending} className="w-full">
          {pending ? "Creating…" : "Create your site"}
        </Button>
      </form>
    </div>
  );
}

function AddressHint({ status, message, checking }: { status: AddressStatus; message: string; checking: boolean }) {
  if (checking) return <span aria-live="polite">Checking…</span>;
  if (status === "available") return <span className="text-ink-soft">✓ This address is free — you can change it later.</span>;
  if (status === "taken" || status === "held" || status === "invalid") {
    return <span className="text-accent">✗ {message}</span>;
  }
  return <>You can change it later.</>;
}
