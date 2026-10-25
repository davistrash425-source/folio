"use client";

import { useEffect, useState } from "react";

export type AddressStatus = "available" | "taken" | "invalid" | "held" | "limited" | null;

// Checks a site address as it's typed, with a short pause so it doesn't call
// the server on every keystroke. Returns the status and any message to show.
export function useAddressCheck(subdomain: string) {
  const value = subdomain.trim().toLowerCase();
  const [result, setResult] = useState<{ value: string; status: AddressStatus; message: string } | null>(null);

  // The same shape check the server does, so obviously-bad names fail fast.
  const shapeMessage =
    value && !/^[a-z0-9](?:[a-z0-9-]{1,28}[a-z0-9])$/.test(value)
      ? "Use 3–30 lowercase letters, numbers or dashes (no dash at the start or end)."
      : null;

  useEffect(() => {
    if (!value || shapeMessage) return;
    let cancelled = false;
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(`/api/address?subdomain=${encodeURIComponent(value)}`);
        const data = (await res.json()) as { status: AddressStatus; message?: string };
        if (!cancelled) setResult({ value, status: data.status ?? null, message: data.message ?? "" });
      } catch {
        if (!cancelled) setResult({ value, status: null, message: "" });
      }
    }, 300);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [value, shapeMessage]);

  if (shapeMessage) return { status: "invalid" as AddressStatus, message: shapeMessage, checking: false };
  if (!value) return { status: null, message: "", checking: false };
  const current = result && result.value === value ? result : null;
  return { status: current?.status ?? null, message: current?.message ?? "", checking: current === null };
}
