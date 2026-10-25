import { Suspense } from "react";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { entryPath } from "@/lib/steps";

// The dashboard's front door: a photographer with no photos yet goes straight
// to upload (step 1); everyone else lands on their library. Reading the
// session has to sit inside Suspense or the build refuses the page.
export default function DashboardPage() {
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
