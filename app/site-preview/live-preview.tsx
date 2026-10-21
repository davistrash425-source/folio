"use client";

import { useEffect, useState } from "react";
import { SiteRenderer } from "@/app/sites/[subdomain]/renderer";
import type { SiteDesign } from "@/lib/design";
import type { SiteData } from "@/lib/site-data";

export const DESIGN_MESSAGE = "folio:design";
export const PATH_MESSAGE = "folio:path";
export const READY_MESSAGE = "folio:ready";

// Renders the site, swapping in any unsaved design (and the page being
// edited) that the Web design editor sends from the parent window, so
// changes show up instantly.
export function LivePreview({ site }: { site: SiteData }) {
  const [design, setDesign] = useState<SiteDesign>(site.design);
  const [path, setPath] = useState(site.path);
  const [serverDesign, setServerDesign] = useState(site.design);
  if (site.design !== serverDesign) {
    setServerDesign(site.design);
    setDesign(site.design);
  }

  useEffect(() => {
    function onMessage(e: MessageEvent) {
      if (e.origin !== window.location.origin) return;
      if (e.data?.type === DESIGN_MESSAGE) setDesign(e.data.design);
      if (e.data?.type === PATH_MESSAGE) {
        setPath(e.data.path);
        window.scrollTo(0, 0);
      }
    }
    // Links between the site's pages switch the page here rather than
    // loading the address, so they work at once and keep any unsaved design.
    function onClick(e: MouseEvent) {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const link = (e.target as Element).closest?.("a");
      const href = link?.getAttribute("href");
      if (!link || !href || href.startsWith("#")) return;
      const url = new URL(link.href);
      if (url.origin !== window.location.origin || url.pathname !== "/site-preview") return;
      e.preventDefault();
      e.stopPropagation(); // keeps the link's own navigation from running
      setPath(url.searchParams.get("path") ?? "");
      // A link to a section of another page (like "#about") goes there.
      setTimeout(() => (url.hash ? document.getElementById(url.hash.slice(1))?.scrollIntoView() : window.scrollTo(0, 0)));
    }
    window.addEventListener("message", onMessage);
    document.addEventListener("click", onClick, true);
    if (window.parent !== window) window.parent.postMessage({ type: READY_MESSAGE }, window.location.origin);
    return () => {
      window.removeEventListener("message", onMessage);
      document.removeEventListener("click", onClick, true);
    };
  }, []);

  return <SiteRenderer site={{ ...site, design, path }} />;
}
