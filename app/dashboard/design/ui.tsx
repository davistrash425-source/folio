"use client";

 
import { useState, type ReactNode } from "react";
import { chipClass } from "@/app/ui/form";

export function swap<T>(list: T[], a: number, b: number) {
  const next = [...list];
  [next[a], next[b]] = [next[b], next[a]];
  return next;
}

export function Group({ title, children }: { title: string; children: ReactNode }) {
  return (
    <details open className="group border-t border-ink">
      <summary className="flex cursor-pointer list-none items-baseline justify-between py-3">
        <span className="font-display text-2xl">{title}</span>
        <span className="label text-ink-faint group-open:hidden">Show</span>
        <span className="label hidden text-ink-faint group-open:inline">Hide</span>
      </summary>
      <div className="space-y-5 pb-8">{children}</div>
    </details>
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

