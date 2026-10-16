"use client";

import { useEffect, useState } from "react";
import { SiteRenderer } from "@/app/sites/[subdomain]/renderer";
import type { SiteDesign } from "@/lib/design";
import type { SiteData } from "@/lib/site-data";

export const DESIGN_MESSAGE = "folio:design";
export const READY_MESSAGE = "folio:ready";

// Renders the site, swapping in any unsaved design the Web design editor
// sends from the parent window, so changes show up instantly.
export function LivePreview({ site }: { site: SiteData }) {
  const [design, setDesign] = useState<SiteDesign>(site.design);
  const [serverDesign, setServerDesign] = useState(site.design);
  if (site.design !== serverDesign) {
    setServerDesign(site.design);
    setDesign(site.design);
  }

  useEffect(() => {
    function onMessage(e: MessageEvent) {
      if (e.origin !== window.location.origin || e.data?.type !== DESIGN_MESSAGE) return;
      setDesign(e.data.design);
    }
    window.addEventListener("message", onMessage);
    if (window.parent !== window) window.parent.postMessage({ type: READY_MESSAGE }, window.location.origin);
    return () => window.removeEventListener("message", onMessage);
  }, []);

  return <SiteRenderer site={{ ...site, design }} />;
}
