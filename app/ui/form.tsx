import type { ComponentProps, ReactNode } from "react";

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
      <span className="text-sm font-medium text-zinc-800">{label}</span>
      <div className="mt-1">{children}</div>
      {hint && <span className="mt-1 block text-xs text-zinc-500">{hint}</span>}
    </label>
  );
}

export const inputClass =
  "w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm outline-none focus:border-black focus:ring-1 focus:ring-black";

export function Input(props: ComponentProps<"input">) {
  return <input {...props} className={`${inputClass} ${props.className ?? ""}`} />;
}

export function Button({ className, ...props }: ComponentProps<"button">) {
  return (
    <button
      {...props}
      className={`inline-flex h-10 items-center justify-center rounded-full bg-black px-5 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-50 ${className ?? ""}`}
    />
  );
}

export function Message({ error, ok }: { error?: string; ok?: string }) {
  if (error) return <p className="text-sm text-red-600" role="alert">{error}</p>;
  if (ok) return <p className="text-sm text-green-700" aria-live="polite">{ok}</p>;
  return null;
}
