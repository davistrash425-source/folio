"use client";

import { useEffect, useId, useRef } from "react";
import { useFocusTrap } from "./use-focus-trap";

// A centred Folio-styled dialog. Escape, the × and clicking outside close it;
// focus stays inside while it's open and returns to the opener afterwards.
export function Dialog({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const titleId = useId();
  useFocusTrap(ref);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-ink/30 px-4 py-[10vh]"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        className="w-full max-w-lg border border-ink bg-card pb-[var(--keyboard,0px)]"
      >
        <div className="flex items-center justify-between border-b border-rule px-5 py-3">
          <h2 id={titleId} className="font-medium">{title}</h2>
          <button type="button" onClick={onClose} aria-label="Close" className="px-3 py-1 text-xl hover:bg-ink/5">×</button>
        </div>
        <div className="p-5">{children}</div>
      </div>
    </div>
  );
}
