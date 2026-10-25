import { Suspense } from "react";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { entryPath } from "@/lib/steps";

// /dashboard/manage used to redirect to the library; now it sends people with
// no photos to upload first, the same as /dashboard. Reading the session has
// to sit inside Suspense or the build refuses the page.
export default function ManagePage() {
  return (
    <Suspense fallback={null}>
      <SendToStart />
    </Suspense>
  );
}

async function SendToStart() {
  const user = await requireUser();
  redirect(entryPath(user));
  return null; // redirect() never returns; this just satisfies the component type
}
