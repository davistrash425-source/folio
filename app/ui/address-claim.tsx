"use client";

import { useState } from "react";
import { ROOT_DOMAIN } from "@/lib/site";
import { buttonClass } from "@/app/ui/form";
import { useAddressCheck, type AddressStatus } from "@/app/ui/use-address-check";

// The landing page's address box: type a name, see whether it's free, and
// carry it into sign-up. It's a real form, so the name rides along as
// ?subdomain=… and the sign-up page starts with it filled in.
export function AddressClaim() {
  const [value, setValue] = useState("");
  const { status, message, checking } = useAddressCheck(value);

  return (
    <form action="/signup" method="get" className="mx-auto mt-10 max-w-xl">
      <div className="flex flex-col gap-3 sm:flex-row">
        <div className="flex h-12 flex-1 items-center border border-ink bg-card px-4 font-label text-sm">
          <span className="text-ink-faint">https://</span>
          <input
            name="subdomain"
            value={value}
            onChange={(e) => setValue(e.target.value.toLowerCase())}
            placeholder="yourname"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            aria-label="Your site address"
            className="min-w-0 flex-1 bg-transparent lowercase outline-none placeholder:text-ink-faint"
          />
          <span className="truncate text-ink-faint">.{ROOT_DOMAIN}</span>
          <span aria-live="polite" className="ml-2 w-4 text-center text-sm">
            <StatusMark status={status} checking={checking} />
          </span>
        </div>
        <button type="submit" className={`${buttonClass} h-12 shrink-0 px-6`}>
          Claim it →
        </button>
      </div>
      <p aria-live="polite" className="mt-2 min-h-5 text-sm text-ink-soft">
        {status && status !== "available" ? <span className="text-accent">{message}</span> : ""}
      </p>
    </form>
  );
}

function StatusMark({ status, checking }: { status: AddressStatus; checking: boolean }) {
  if (checking) return <span className="text-ink-faint">…</span>;
  if (status === "available") return <span className="text-ink-soft">✓</span>;
  if (status) return <span className="text-accent">✗</span>;
  return null;
}
