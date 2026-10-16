import { Suspense } from "react";
import { ResetPasswordForm } from "./form";

export default function ResetPasswordPage({ searchParams }: PageProps<"/reset-password">) {
  const token = searchParams.then((p) => (typeof p.token === "string" ? p.token : ""));
  return (
    <Suspense fallback={<p className="label text-ink-faint">Loading…</p>}>
      <ResetPasswordForm token={token} />
    </Suspense>
  );
}
