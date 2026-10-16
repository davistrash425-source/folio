"use client";

/* eslint-disable @next/next/no-img-element -- user uploads are served by our own route */
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import type { PhotoSource } from "@/lib/uploads";

// Wraps a gallery. Clicking any element with data-photo-index opens that
// photo full screen; arrow keys / swipe move between photos, Esc closes.
export function Lightbox({ photos, children }: { photos: PhotoSource[]; children: ReactNode }) {
  const [index, setIndex] = useState<number | null>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const openerRef = useRef<HTMLElement | null>(null);
  const touchX = useRef<number | null>(null);

  const step = useCallback(
    (by: number) => setIndex((i) => (i === null ? i : (i + by + photos.length) % photos.length)),
    [photos.length],
  );
  const close = useCallback(() => {
    setIndex(null);
    openerRef.current?.focus();
  }, []);

  useEffect(() => {
    if (index === null) return;
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
      else if (e.key === "ArrowRight") step(1);
      else if (e.key === "ArrowLeft") step(-1);
    };
    document.addEventListener("keydown", onKey);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = overflow;
    };
  }, [index, close, step]);

  function open(target: EventTarget) {
    const el = (target as HTMLElement).closest<HTMLElement>("[data-photo-index]");
    if (!el) return;
    openerRef.current = el;
    setIndex(Number(el.dataset.photoIndex));
  }

  const photo = index === null ? null : photos[index];

  return (
    <>
      {/* The photos inside are buttons, so keyboard users get clicks too. */}
      <div onClick={(e) => open(e.target)}>{children}</div>
      {photo && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={`Photo ${index! + 1} of ${photos.length}`}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/95 font-sans text-white"
          onClick={(e) => e.target === e.currentTarget && close()}
          onTouchStart={(e) => (touchX.current = e.touches[0].clientX)}
          onTouchEnd={(e) => {
            if (touchX.current === null) return;
            const dx = e.changedTouches[0].clientX - touchX.current;
            if (Math.abs(dx) > 50) step(dx < 0 ? 1 : -1);
            touchX.current = null;
          }}
        >
          <img
            key={photo.id}
            src={photo.src}
            srcSet={photo.srcSet}
            sizes="100vw"
            alt={photo.alt}
            className="max-h-[90vh] max-w-[94vw] object-contain"
          />
          <button
            ref={closeRef}
            type="button"
            onClick={close}
            aria-label="Close"
            className="absolute right-3 top-3 rounded-full px-3 py-1 text-2xl leading-none text-white/80 hover:bg-white/10 hover:text-white"
          >
            ×
          </button>
          {photos.length > 1 && (
            <>
              <button
                type="button"
                onClick={() => step(-1)}
                aria-label="Previous photo"
                className="absolute left-2 top-1/2 -translate-y-1/2 rounded-full px-3 py-2 text-3xl text-white/70 hover:bg-white/10 hover:text-white"
              >
                ‹
              </button>
              <button
                type="button"
                onClick={() => step(1)}
                aria-label="Next photo"
                className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full px-3 py-2 text-3xl text-white/70 hover:bg-white/10 hover:text-white"
              >
                ›
              </button>
            </>
          )}
          <p className="absolute bottom-3 left-0 right-0 text-center text-sm text-white/60">
            {photo.alt && <span className="mr-3 text-white/80">{photo.alt}</span>}
            {index! + 1} / {photos.length}
          </p>
        </div>
      )}
    </>
  );
}
