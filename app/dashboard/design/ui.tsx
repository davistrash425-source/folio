"use client";

 
import { useState, type ReactNode } from "react";
import { chipClass } from "@/app/ui/form";

export function swap<T>(list: T[], a: number, b: number) {
  const next = [...list];
  [next[a], next[b]] = [next[b], next[a]];
  return next;
}

// One numbered step of the Web design editor. Only one is open at a time;
// a closed step shows a one-line summary of what's chosen in it. The button
// at the bottom closes this step and opens the next. Closed steps stay in
// the page (hidden), so anything half-typed in them is kept.
export function Step({ number, title, summary, open, onToggle, nextLabel, onNext, children }: {
  number: number;
  title: string;
  summary?: ReactNode;
  open: boolean;
  onToggle: () => void;
  nextLabel?: string;
  onNext?: () => void;
  children: ReactNode;
}) {
  const id = `design-step-${number}`;
  return (
    <section className={`scroll-mt-40 border bg-paper transition-colors ${open ? "border-ink" : "border-rule hover:border-ink"}`}>
      <h2>
        <button
          type="button"
          onClick={onToggle}
          aria-expanded={open}
          aria-controls={id}
          className="flex w-full items-center gap-3 px-4 py-3 text-left"
        >
          <span
            aria-hidden="true"
            className={`flex size-7 shrink-0 items-center justify-center rounded-full text-sm font-medium ${open ? "bg-ink text-paper" : "border border-rule text-ink-soft"}`}
          >
            {number}
          </span>
          <span className="min-w-0 flex-1">
            <span className="block font-display text-xl leading-tight">{title}</span>
            {!open && summary && <span className="block truncate text-xs text-ink-soft">{summary}</span>}
          </span>
          <span aria-hidden="true" className={`text-ink-faint transition-transform ${open ? "rotate-180" : ""}`}>⌄</span>
        </button>
      </h2>
      <div id={id} hidden={!open} className="space-y-5 border-t border-rule px-4 pb-5 pt-4">
        {children}
        {onNext && (
          <div className="flex justify-end border-t border-rule pt-4">
            <button
              type="button"
              onClick={onNext}
              className="h-9 bg-ink px-4 text-sm font-medium text-paper hover:bg-accent"
            >
              {nextLabel ?? "Save and continue"}
            </button>
          </div>
        )}
      </div>
    </section>
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

