"use client";

import { useEffect, useRef, type ReactNode } from "react";

// Shows a photo next to the pointer while it is over any element inside that
// has data-preview-src (and optionally data-preview-ratio, width / height).
// Only for devices that can hover; touch screens get thumbnails in the rows.
export function HoverPreview({ children }: { children: ReactNode }) {
  const area = useRef<HTMLDivElement>(null);
  const box = useRef<HTMLDivElement>(null);
  const img = useRef<HTMLImageElement>(null);

  useEffect(() => {
    const root = area.current;
    const frame = box.current;
    const pic = img.current;
    if (!root || !frame || !pic || !window.matchMedia("(hover: hover) and (pointer: fine)").matches) return;

    let shown = "";
    const hide = () => {
      frame.style.opacity = "0";
    };

    function onMove(e: PointerEvent) {
      const row = (e.target as HTMLElement).closest<HTMLElement>("[data-preview-src]");
      if (!row || !frame || !pic) return hide();
      const src = row.dataset.previewSrc ?? "";
      const ratio = Number(row.dataset.previewRatio) || 1.5;
      // As large as fits: at most 22rem wide and 60% of the window tall.
      const width = Math.min(352, window.innerHeight * 0.6 * ratio);
      const height = width / ratio;
      if (src !== shown) {
        shown = src;
        pic.src = src;
      }
      frame.style.width = `${width}px`;
      const gap = 28;
      const x = e.clientX + gap + width > window.innerWidth - 16 ? e.clientX - gap - width : e.clientX + gap;
      const y = Math.max(16, Math.min(window.innerHeight - height - 16, e.clientY - height / 2));
      frame.style.transform = `translate3d(${x}px, ${y}px, 0)`;
      frame.style.opacity = "1";
    }

    root.addEventListener("pointermove", onMove);
    root.addEventListener("pointerleave", hide);
    window.addEventListener("scroll", hide, { passive: true });
    return () => {
      root.removeEventListener("pointermove", onMove);
      root.removeEventListener("pointerleave", hide);
      window.removeEventListener("scroll", hide);
    };
  }, []);

  return (
    <div ref={area}>
      {children}
      <div
        ref={box}
        aria-hidden="true"
        className="pointer-events-none fixed left-0 top-0 z-30 opacity-0 transition-opacity duration-100"
        style={{ width: 0 }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element -- the preview shows our own uploads */}
        <img ref={img} alt="" className="block h-auto w-full bg-[var(--fg)]/10" />
      </div>
    </div>
  );
}
