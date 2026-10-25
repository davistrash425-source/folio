"use client";

import { useState } from "react";

// A two-step "click, then confirm" button that replaces the browser's
// confirm() pop-up with an inline Folio-styled question. The first click turns
// the button into the question plus Confirm and Cancel; nothing is done until
// the second, deliberate click. Cancel, or clicking away, forgets it.
export function ConfirmButton({
  label,
  message,
  confirmLabel = "Confirm",
  onConfirm,
  disabled = false,
  className,
  confirmClassName = "bg-accent px-3 py-2 text-sm text-paper hover:bg-ink",
}: {
  label: string;
  message: string;
  confirmLabel?: string;
  onConfirm: () => void;
  disabled?: boolean;
  className?: string;
  confirmClassName?: string;
}) {
  const [confirming, setConfirming] = useState(false);
  if (confirming) {
    return (
      <span className="inline-flex flex-wrap items-center gap-2">
        <span className="text-sm text-ink-soft">{message}</span>
        <button
          type="button"
          onClick={() => {
            setConfirming(false);
            onConfirm();
          }}
          className={confirmClassName}
        >
          {confirmLabel}
        </button>
        <button type="button" onClick={() => setConfirming(false)} className="px-3 py-2 text-sm hover:bg-ink/5">
          Cancel
        </button>
      </span>
    );
  }
  return (
    <button type="button" disabled={disabled} onClick={() => setConfirming(true)} className={className}>
      {label}
    </button>
  );
}
