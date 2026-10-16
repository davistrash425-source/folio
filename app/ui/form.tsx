import type { ComponentProps, ReactNode } from "react";

// Shared look for Folio's own screens (see the note in app/globals.css).

export function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: ReactNode;
  children: ReactNode;
}) {
  return (
    <label className="block">
      <span className="label text-ink-soft">{label}</span>
      <div className="mt-1.5">{children}</div>
      {hint && <span className="mt-1.5 block text-xs text-ink-faint">{hint}</span>}
    </label>
  );
}

export const inputClass =
  "w-full border border-rule bg-card px-3 py-2 text-sm text-ink outline-none placeholder:text-ink-faint focus:border-ink";

export function Input(props: ComponentProps<"input">) {
  return <input {...props} className={`${inputClass} ${props.className ?? ""}`} />;
}

export const buttonClass =
  "inline-flex h-10 items-center justify-center gap-2 bg-ink px-5 text-sm font-medium text-paper transition-colors hover:bg-accent disabled:pointer-events-none disabled:opacity-40";

export const secondaryButtonClass =
  "inline-flex h-10 items-center justify-center gap-2 border border-ink px-5 text-sm font-medium text-ink transition-colors hover:bg-ink hover:text-paper disabled:pointer-events-none disabled:opacity-40";

export function Button({ className, ...props }: ComponentProps<"button">) {
  return <button {...props} className={`${buttonClass} ${className ?? ""}`} />;
}

export function SecondaryButton({ className, ...props }: ComponentProps<"button">) {
  return <button type="button" {...props} className={`${secondaryButtonClass} ${className ?? ""}`} />;
}

// A plain text button, for less important actions next to a main button.
export const quietButtonClass =
  "inline-flex h-10 items-center px-2 text-sm text-ink-soft underline-offset-4 hover:text-ink hover:underline disabled:pointer-events-none disabled:opacity-40";

export const dangerButtonClass =
  "inline-flex h-10 items-center px-2 text-sm text-accent underline-offset-4 hover:underline disabled:pointer-events-none disabled:opacity-40";

// Toggle used for small either/or choices (filters, options).
export function chipClass(active: boolean) {
  return `border px-3 py-1.5 text-sm transition-colors ${
    active ? "border-ink bg-ink text-paper" : "border-rule text-ink-soft hover:border-ink hover:text-ink"
  }`;
}

export function Message({ error, ok }: { error?: string; ok?: string }) {
  if (error) return <p className="text-sm text-accent" role="alert">{error}</p>;
  if (ok) return <p className="text-sm text-ink-soft" aria-live="polite">✓ {ok}</p>;
  return null;
}
