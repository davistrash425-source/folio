"use client";

import { useEffect } from "react";

// On phones, keeps the text box being typed in clear of the on-screen
// keyboard. Browsers try to do this themselves, but miss fields inside
// fixed panels (the photo details drawer) and ones that end up under the
// dashboard's pinned top bar. The keyboard's height also goes in
// --keyboard, so fixed panels can add room at the bottom to scroll into.
export function KeepFieldInView() {
  useEffect(() => {
    const viewport = window.visualViewport;
    if (!viewport || !matchMedia("(pointer: coarse)").matches) return;
    const root = document.documentElement;
    let timer: ReturnType<typeof setTimeout> | undefined;

    const isTextField = (el: Element | null): el is HTMLElement =>
      el instanceof HTMLTextAreaElement ||
      el instanceof HTMLSelectElement ||
      (el instanceof HTMLInputElement && !["checkbox", "radio", "range", "color", "file", "button", "submit", "reset", "hidden"].includes(el.type)) ||
      (el instanceof HTMLElement && el.isContentEditable);

    function reveal() {
      const field = document.activeElement;
      if (!isTextField(field)) return;
      const style = getComputedStyle(field);
      const box = field.getBoundingClientRect();
      const top = viewport!.offsetTop + parseFloat(style.scrollMarginTop);
      const bottom = viewport!.offsetTop + viewport!.height - parseFloat(style.scrollMarginBottom);
      // Too low: bring its bottom up, but never push its top out of sight
      // (a tall text box shows its top). Too high: bring its top down.
      let shift = box.bottom > bottom ? Math.min(box.bottom - bottom, box.top - top) : box.top < top ? box.top - top : 0;
      if (Math.abs(shift) < 1) return;
      // Scroll the panels it sits in first, then the page for what's left.
      for (let el = field.parentElement; el && el !== document.body && shift; el = el.parentElement) {
        if (!/auto|scroll/.test(getComputedStyle(el).overflowY) || el.scrollHeight <= el.clientHeight) continue;
        const before = el.scrollTop;
        el.scrollTop += shift;
        shift -= el.scrollTop - before;
      }
      if (shift) window.scrollBy(0, shift);
    }

    function onResize() {
      root.style.setProperty("--keyboard", `${Math.max(0, root.clientHeight - viewport!.height)}px`);
      clearTimeout(timer);
      timer = setTimeout(reveal, 50);
    }

    function onFocus() {
      clearTimeout(timer);
      // Wait for the keyboard to finish sliding up and the browser's own scroll.
      timer = setTimeout(reveal, 350);
    }

    viewport.addEventListener("resize", onResize);
    document.addEventListener("focusin", onFocus);
    return () => {
      clearTimeout(timer);
      viewport.removeEventListener("resize", onResize);
      document.removeEventListener("focusin", onFocus);
      root.style.removeProperty("--keyboard");
    };
  }, []);
  return null;
}
