import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { confirmEmail } from "@/app/actions/auth";
import { Button } from "@/app/ui/form";

export const metadata: Metadata = { title: "Confirm your email · Folio" };

// The link in the verification email lands here. Confirming takes a click,
// because mail scanners open links before people do (app/actions/auth.ts).
export default function VerifyEmailPage({ searchParams }: PageProps<"/verify-email">) {
  const token = searchParams.then((p) => (typeof p.token === "string" ? p.token : ""));
  return (
    <Suspense fallback={<p className="label text-ink-faint">Loading…</p>}>
      <ConfirmForm token={token} />
    </Suspense>
  );
}

async function ConfirmForm({ token }: { token: Promise<string> }) {
  const value = await token;
  if (!value) {
    return (
      <div className="space-y-4">
        <h1 className="font-display text-3xl">Link missing</h1>
        <p className="text-sm text-ink-soft">
          Open the link from your confirmation email, or send a new one from your <Link href="/dashboard/manage/account" className="underline">account page</Link>.
        </p>
      </div>
    );
  }
  return (
    <form action={confirmEmail} className="space-y-4">
      <h1 className="font-display text-3xl">Confirm your email</h1>
      <p className="text-sm text-ink-soft">One click and your address is confirmed, so your site can go live.</p>
      <input type="hidden" name="token" value={value} />
      <Button type="submit" className="w-full">Confirm my email</Button>
    </form>
  );
}
