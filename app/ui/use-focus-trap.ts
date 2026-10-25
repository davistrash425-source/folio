"use client";

import { useEffect, type RefObject } from "react";

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

// Keeps Tab and Shift+Tab inside a dialog while it's open, moves focus into
// it on open, and gives focus back to whatever had it (usually the button
// that opened it) on close.
export function useFocusTrap(ref: RefObject<HTMLElement | null>) {
  useEffect(() => {
    const box = ref.current;
    if (!box) return;
    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const focusable = () =>
      Array.from(box.querySelectorAll<HTMLElement>(FOCUSABLE)).filter((el) => el.offsetParent !== null || el === document.activeElement);

    // A field marked data-autofocus gets focus first (not autoFocus, which
    // would move focus before the opener above is noted).
    if (!box.contains(document.activeElement)) {
      (box.querySelector<HTMLElement>("[data-autofocus]") ?? focusable()[0] ?? box).focus();
    }

    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Tab") return;
      const items = focusable();
      if (items.length === 0) {
        e.preventDefault();
        return;
      }
      const first = items[0];
      const last = items[items.length - 1];
      const inside = box.contains(document.activeElement);
      if (e.shiftKey && (document.activeElement === first || !inside)) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && (document.activeElement === last || !inside)) {
        e.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      if (opener?.isConnected) opener.focus();
    };
  }, [ref]);
}
