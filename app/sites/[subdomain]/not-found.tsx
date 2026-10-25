import { Suspense } from "react";
import { SiteNotFound } from "./site-notice";

// A photographer's address with nothing to show: see SiteNotFound.
export default function SiteNotFoundPage() {
  return (
    <Suspense fallback={<div className="flex-1" />}>
      <SiteNotFound />
    </Suspense>
  );
}
