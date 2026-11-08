"use client";

import { useEffect, useRef, useSyncExternalStore, type ReactNode } from "react";

// Whether the panel is open is remembered in the browser. Storage can throw
// (private windows, blocked site data), so the choice is also kept in memory.
const KEY = "folio-agent-panel";
const listeners = new Set<() => void>();
let remembered: boolean | null = null;

function subscribe(listener: () => void) {
  listeners.add(listener);
  const onStorage = (e: StorageEvent) => {
    if (e.key === KEY) {
      remembered = null;
      listener();
    }
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", onStorage);
  };
}

function getOpen() {
  if (remembered !== null) return remembered;
  try {
    return localStorage.getItem(KEY) === "open";
  } catch {
    return false;
  }
}

function setOpen(open: boolean) {
  remembered = open;
  try {
    localStorage.setItem(KEY, open ? "open" : "closed");
  } catch {
    // Not remembered next visit; it still works for now.
  }
  listeners.forEach((l) => l());
}

// The Agent: a tab on the right edge that opens into a chat panel. Beside the
// page from xl up; over the page (with a close button) on smaller screens.
// The chat stays mounted while it's collapsed, so a reply that's still coming
// in and anything half-typed survive.
export function AgentPanel({ header, children }: { header: ReactNode; children: ReactNode }) {
  const open = useSyncExternalStore(subscribe, getOpen, () => false);
  const tab = useRef<HTMLButtonElement>(null);

  function collapse() {
    setOpen(false);
    // The button the focus was on is about to go; put it on the tab instead.
    requestAnimationFrame(() => tab.current?.focus());
  }

  // Escape closes it when it's covering the page.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !window.matchMedia("(min-width: 80rem)").matches) {
        setOpen(false);
        requestAnimationFrame(() => tab.current?.focus());
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <>
      {!open && (
        <button
          ref={tab}
          type="button"
          onClick={() => setOpen(true)}
          aria-expanded={false}
          aria-label="Open Agent"
          className="label z-40 flex items-center justify-center bg-paper px-2 py-5 text-ink-soft hover:text-ink max-xl:fixed max-xl:right-0 max-xl:top-1/2 max-xl:-translate-y-1/2 max-xl:border max-xl:border-r-0 max-xl:border-ink xl:sticky xl:top-[var(--dash-bar,4rem)] xl:h-[calc(100dvh-var(--dash-bar,4rem))] xl:w-10 xl:shrink-0 xl:self-start xl:border-l xl:border-rule xl:px-0 xl:py-8 xl:items-start"
        >
          <span aria-hidden="true" className="[writing-mode:vertical-rl]">
            Agent
          </span>
        </button>
      )}
      <aside
        aria-label="Agent"
        hidden={!open}
        className="fixed inset-y-0 right-0 z-50 w-full max-w-sm flex-col border-l border-ink bg-paper shadow-xl data-[open=true]:flex xl:sticky xl:bottom-auto xl:right-auto xl:top-[var(--dash-bar,4rem)] xl:z-auto xl:h-[calc(100dvh-var(--dash-bar,4rem))] xl:w-[22rem] xl:max-w-none xl:shrink-0 xl:self-start xl:border-rule xl:shadow-none"
        data-open={open}
      >
        <div className="border-b border-rule px-4 py-3">
          <div className="flex items-center justify-between gap-3">
            <h2 className="font-display text-xl leading-tight">Agent</h2>
            <button
              type="button"
              onClick={collapse}
              aria-expanded={true}
              aria-label="Collapse Agent"
              className="flex size-8 items-center justify-center border border-rule text-ink-soft hover:border-ink hover:text-ink"
            >
              <span aria-hidden="true">→</span>
            </button>
          </div>
          {header}
        </div>
        <div className="min-h-0 flex-1 p-4">{children}</div>
      </aside>
    </>
  );
}
