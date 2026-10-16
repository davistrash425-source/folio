import { Suspense } from "react";
import { ResetPasswordForm } from "./form";

export default function ResetPasswordPage({ searchParams }: PageProps<"/reset-password">) {
  const token = searchParams.then((p) => (typeof p.token === "string" ? p.token : ""));
  return (
    <Suspense fallback={<p className="text-sm text-zinc-500">Loading…</p>}>
      <ResetPasswordForm token={token} />
    </Suspense>
  );
}
