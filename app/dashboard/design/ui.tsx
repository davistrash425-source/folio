"use client";

 
import { useState, useSyncExternalStore, type KeyboardEvent, type ReactNode } from "react";
import { chipClass } from "@/app/ui/form";

export function swap<T>(list: T[], a: number, b: number) {
  const next = [...list];
  [next[a], next[b]] = [next[b], next[a]];
  return next;
}

export const toolTabId = (id: string) => `design-tab-${id}`;
export const toolPanelId = (id: string) => `design-panel-${id}`;

// One tool's panel in the Web design editor. Only the current one shows; the
// others stay in the page (hidden), so anything half-typed in them is kept.
export function ToolPanel({ id, title, current, children }: {
  id: string;
  title: string;
  current: boolean;
  children: ReactNode;
}) {
  return (
    <section
      id={toolPanelId(id)}
      role="tabpanel"
      aria-labelledby={toolTabId(id)}
      hidden={!current}
      className="space-y-5 border border-ink bg-paper px-4 pb-5 pt-4"
    >
      <h2 className="font-display text-xl leading-tight">{title}</h2>
      {children}
    </section>
  );
}

// From lg up the rail is a column beside the panel, below that a row.
const subscribeWide = (onChange: () => void) => {
  const query = window.matchMedia("(min-width: 64rem)");
  query.addEventListener("change", onChange);
  return () => query.removeEventListener("change", onChange);
};
const isWide = () => window.matchMedia("(min-width: 64rem)").matches;

// The tools of the Web design editor as tabs. Arrow keys move between them.
export function ToolRail({ tools, current, onSelect }: {
  tools: { id: string; label: string }[];
  current: string;
  onSelect: (id: string) => void;
}) {
  const vertical = useSyncExternalStore(subscribeWide, isWide, () => false);
  function onKeyDown(e: KeyboardEvent<HTMLDivElement>) {
    const at = tools.findIndex((t) => t.id === current);
    let to = -1;
    if (e.key === "ArrowDown" || e.key === "ArrowRight") to = (at + 1) % tools.length;
    else if (e.key === "ArrowUp" || e.key === "ArrowLeft") to = (at - 1 + tools.length) % tools.length;
    else if (e.key === "Home") to = 0;
    else if (e.key === "End") to = tools.length - 1;
    if (to < 0) return;
    e.preventDefault();
    onSelect(tools[to].id);
    document.getElementById(toolTabId(tools[to].id))?.focus();
  }
  return (
    <div
      role="tablist"
      aria-label="Design tools"
      aria-orientation={vertical ? "vertical" : "horizontal"}
      onKeyDown={onKeyDown}
      className="-mx-6 flex gap-1 overflow-x-auto [scrollbar-width:none] px-6 pb-1 lg:mx-0 lg:w-[5.5rem] lg:shrink-0 lg:flex-col lg:overflow-visible lg:px-0 lg:pb-0"
    >
      {tools.map((t) => {
        const active = t.id === current;
        return (
          <button
            key={t.id}
            id={toolTabId(t.id)}
            type="button"
            role="tab"
            aria-selected={active}
            aria-controls={toolPanelId(t.id)}
            tabIndex={active ? 0 : -1}
            onClick={() => onSelect(t.id)}
            className={`shrink-0 border px-3 py-2 text-left text-sm transition-colors lg:px-2 lg:py-3 lg:text-center ${
              active ? "border-ink bg-ink font-medium text-paper" : "border-rule text-ink-soft hover:border-ink hover:text-ink"
            }`}
          >
            {t.label}
          </button>
        );
      })}
    </div>
  );
}

export function AddMenu<T extends string>({ label, options, onAdd, disabled }: {
  label: string;
  options: [T, string][];
  onAdd: (value: T) => void;
  disabled?: boolean;
}) {
  const [value, setValue] = useState(options[0][0]);
  return (
    <div className="flex gap-2">
      <select
        value={value}
        onChange={(e) => setValue(e.target.value as T)}
        aria-label={`${label}: type`}
        className="flex-1 border border-rule bg-card px-2 py-1.5 text-sm"
      >
        {options.map(([v, text]) => (
          <option key={v} value={v}>{text}</option>
        ))}
      </select>
      <button
        type="button"
        disabled={disabled}
        onClick={() => onAdd(value)}
        className="px-4 py-1.5 text-sm font-medium border border-rule hover:bg-ink/5 disabled:opacity-40"
      >
        + {label}
      </button>
    </div>
  );
}

export function Choice<T extends string>({ label, value, options, onChange, locked }: {
  label: string;
  value: T;
  options: [T, string][];
  onChange: (value: T) => void;
  locked?: boolean; // Pro-only and the account is on Free
}) {
  return (
    <fieldset>
      <legend className="label mb-2 text-ink-soft">{label}</legend>
      <div className="flex flex-wrap gap-1">
        {options.map(([v, text]) => (
          <button
            key={v}
            type="button"
            aria-pressed={value === v}
            disabled={locked}
            onClick={() => onChange(v)}
            className={`${chipClass(value === v)} ${locked ? "cursor-not-allowed opacity-50" : ""}`}
          >
            {text}
          </button>
        ))}
      </div>
    </fieldset>
  );
}

// `disabled` keeps the button focusable (aria-disabled): a move button that
// reaches the end of the list would otherwise drop keyboard focus.
export function IconButton({ label, children, disabled, onClick, ...props }: React.ComponentProps<"button"> & { label: string }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      {...props}
      aria-disabled={disabled || undefined}
      onClick={disabled ? undefined : onClick}
      className="rounded px-1.5 opacity-70 hover:bg-ink/10 hover:opacity-100 aria-disabled:opacity-25"
    >
      {children}
    </button>
  );
}

export function ToolbarButton({ children, ...props }: React.ComponentProps<"button">) {
  return (
    <button
      type="button"
      {...props}
      className="h-9 px-4 text-sm font-medium border border-rule hover:bg-ink/5 disabled:opacity-40"
    >
      {children}
    </button>
  );
}

