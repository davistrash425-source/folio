"use client";

import { useEffect, useRef, type ReactNode } from "react";

// A region that scrolls sideways on wide screens (and up and down on phones).
// The mouse wheel moves it sideways, and a thin bar underneath shows how far
// along it is.
export function SidewaysScroller({ children, label, footer }: { children: ReactNode; label: string; footer?: ReactNode }) {
  const scroller = useRef<HTMLDivElement>(null);
  const bar = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = scroller.current;
    const fill = bar.current;
    if (!el || !fill) return;
    const wide = window.matchMedia("(min-width: 768px)");

    function onWheel(e: WheelEvent) {
      if (!el || !wide.matches || e.ctrlKey) return;
      if (Math.abs(e.deltaY) <= Math.abs(e.deltaX)) return; // already sideways
      const max = el.scrollWidth - el.clientWidth;
      const atStart = el.scrollLeft <= 0 && e.deltaY < 0;
      const atEnd = el.scrollLeft >= max - 1 && e.deltaY > 0;
      if (max <= 0 || atStart || atEnd) return; // let the page scroll instead
      e.preventDefault();
      el.scrollLeft += e.deltaY;
    }

    function onScroll() {
      if (!el || !fill) return;
      const sideways = wide.matches;
      const max = sideways ? el.scrollWidth - el.clientWidth : el.scrollHeight - el.clientHeight;
      const at = sideways ? el.scrollLeft : el.scrollTop;
      fill.style.width = `${max > 0 ? Math.min(100, (at / max) * 100) : 100}%`;
    }

    el.addEventListener("wheel", onWheel, { passive: false });
    el.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    onScroll();
    return () => {
      el.removeEventListener("wheel", onWheel);
      el.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
    };
  }, []);

  return (
    <>
      <div
        ref={scroller}
        tabIndex={0}
        role="region"
        aria-label={label}
        className="flex h-[calc(100svh-7rem)] min-h-[26rem] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden snap-y snap-mandatory flex-col overflow-y-auto outline-none md:snap-x md:snap-proximity md:flex-row md:overflow-x-auto md:overflow-y-hidden"
      >
        {children}
      </div>
      <div className="flex items-center gap-6 px-6 py-4 md:px-10">
        <div className="font-exh-sans text-[0.65rem] uppercase tracking-[0.3em] text-[var(--muted)]">{footer}</div>
        <div className="h-px flex-1 bg-[var(--fg)]/20">
          <div ref={bar} className="h-px bg-[var(--fg)] transition-[width] duration-150" style={{ width: "0%" }} />
        </div>
      </div>
    </>
  );
}
