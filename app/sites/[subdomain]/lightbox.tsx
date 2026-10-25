"use client";

/* eslint-disable @next/next/no-img-element -- user uploads are served by our own route */
import { useEffect, useId, useRef, useState, useSyncExternalStore, type ReactNode } from "react";
import { useFocusTrap } from "@/app/ui/use-focus-trap";
import type { PhotoSource } from "@/lib/uploads";

// The open photo lives in the address (?photo=<id>), so a photo can be
// shared, and the phone's Back button closes the viewer instead of leaving
// the site. Every Lightbox on the page reads it; only the one holding that
// photo opens.
const PHOTO_CHANGED = "folio:photo";

function subscribe(onChange: () => void) {
  window.addEventListener("popstate", onChange);
  window.addEventListener(PHOTO_CHANGED, onChange);
  return () => {
    window.removeEventListener("popstate", onChange);
    window.removeEventListener(PHOTO_CHANGED, onChange);
  };
}
const photoInUrl = () => new URLSearchParams(window.location.search).get("photo");
const noPhotoOnServer = () => null;

function urlWithPhoto(id: string | null) {
  const url = new URL(window.location.href);
  if (id) url.searchParams.set("photo", id);
  else url.searchParams.delete("photo");
  return url.toString();
}

// Whether this page's history entry was added by opening a photo here, so
// closing can go Back to the gallery rather than adding another entry.
let openedHere = false;
// The Lightbox the visitor clicked in, for a photo shown in two galleries on
// one page. Null for a shared link: any gallery with the photo opens it.
let openedIn: string | null = null;

function openPhoto(id: string, lightbox: string) {
  openedIn = lightbox;
  window.history.pushState(null, "", urlWithPhoto(id));
  openedHere = true;
  window.dispatchEvent(new Event(PHOTO_CHANGED));
}
function showPhoto(id: string) {
  window.history.replaceState(window.history.state, "", urlWithPhoto(id));
  window.dispatchEvent(new Event(PHOTO_CHANGED));
}
// `then` runs once the viewer has closed and handed focus back.
function closePhoto(then?: () => void) {
  const after = () => then && setTimeout(then, 50);
  openedIn = null;
  if (openedHere) {
    openedHere = false;
    if (then) window.addEventListener("popstate", after, { once: true });
    window.history.back(); // the popstate closes the viewer
    return;
  }
  // Opened from a shared link: there's no gallery entry to go back to.
  window.history.replaceState(window.history.state, "", urlWithPhoto(null));
  window.dispatchEvent(new Event(PHOTO_CHANGED));
  after();
}

// The smallest copy, which the gallery has usually loaded already.
function smallSrc(photo: PhotoSource) {
  return photo.srcSet?.split(",")[0].trim().split(" ")[0] ?? photo.src;
}

// Wraps a gallery. Clicking any element with data-photo-index opens that
// photo full screen; arrow keys / swipe move between photos, Esc closes.
export function Lightbox({
  photos,
  captions = {},
  inquireHref,
  children,
}: {
  photos: PhotoSource[];
  captions?: Record<string, string>; // photo id → caption the design shows
  inquireHref?: string | null; // the contact form, for "Inquire about this photo"
  children: ReactNode;
}) {
  const me = useId();
  const openId = useSyncExternalStore(subscribe, photoInUrl, noPhotoOnServer);
  const mine = openedIn === null || openedIn === me;
  const index = openId && mine ? photos.findIndex((p) => p.id === openId) : -1;

  function open(target: EventTarget) {
    const el = (target as HTMLElement).closest<HTMLElement>("[data-photo-index]");
    const photo = el && photos[Number(el.dataset.photoIndex)];
    if (photo) openPhoto(photo.id, me);
  }

  return (
    <>
      {/* The photos inside are buttons, so keyboard users get clicks too. */}
      <div onClick={(e) => open(e.target)}>{children}</div>
      {index !== -1 && <Viewer photos={photos} index={index} captions={captions} inquireHref={inquireHref} />}
    </>
  );
}

function Viewer({ photos, index, captions, inquireHref }: {
  photos: PhotoSource[];
  index: number;
  captions: Record<string, string>;
  inquireHref?: string | null;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useFocusTrap(ref);
  const photo = photos[index];
  const count = photos.length;
  const at = (by: number) => photos[(index + by + count) % count];

  // Swiping: how far the finger has moved, and the slide it's settling on.
  const [drag, setDrag] = useState(0);
  const [settling, setSettling] = useState<-1 | 0 | 1 | null>(null);
  const touch = useRef<{ x: number; y: number; horizontal?: boolean } | null>(null);

  const step = (by: number) => showPhoto(at(by).id);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") closePhoto();
      else if (e.key === "ArrowRight" && count > 1) showPhoto(photos[(index + 1) % count].id);
      else if (e.key === "ArrowLeft" && count > 1) showPhoto(photos[(index - 1 + count) % count].id);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [index, count, photos]);

  useEffect(() => {
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = overflow;
    };
  }, []);

  function inquire(e: React.MouseEvent<HTMLAnchorElement>) {
    try {
      sessionStorage.setItem(INQUIRE_KEY, JSON.stringify({ id: photo.id, src: smallSrc(photo), label: captions[photo.id] || photo.alt }));
    } catch {}
    // The form is on this page: close the viewer and fill it in here.
    if (document.getElementById("inquire")) {
      e.preventDefault();
      const id = photo.id;
      closePhoto(() => window.dispatchEvent(new CustomEvent(INQUIRE_EVENT, { detail: id })));
    }
  }

  // Three slides (previous, this, next) side by side, so the neighbours are
  // already loaded and follow the finger while swiping.
  const offset = settling === null ? drag : 0;
  const shift = settling === null ? 0 : settling;
  const slides = count > 1 ? [-1, 0, 1] : [0];

  return (
    <div
      ref={ref}
      role="dialog"
      aria-modal="true"
      aria-label={`Photo ${index + 1} of ${count}`}
      tabIndex={-1}
      className="fixed inset-0 z-50 overflow-hidden bg-black/95 font-sans text-white"
      onTouchStart={(e) => {
        if (settling !== null || count < 2) return;
        touch.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
      }}
      onTouchMove={(e) => {
        const t = touch.current;
        if (!t) return;
        const dx = e.touches[0].clientX - t.x;
        const dy = e.touches[0].clientY - t.y;
        t.horizontal ??= Math.abs(dx) > 8 || Math.abs(dy) > 8 ? Math.abs(dx) > Math.abs(dy) : undefined;
        if (t.horizontal) setDrag(dx);
      }}
      onTouchEnd={() => {
        const moved = touch.current?.horizontal && drag !== 0;
        touch.current = null;
        // A tap, or a vertical swipe: nothing to settle (and no transition
        // would fire to finish it).
        if (!moved) return;
        const threshold = Math.min(80, window.innerWidth / 5);
        setSettling(drag < -threshold ? 1 : drag > threshold ? -1 : 0);
        setDrag(0);
      }}
    >
      <div
        className={`flex h-full ${settling === null ? "" : "transition-transform duration-200 ease-out"}`}
        style={{
          width: `${slides.length * 100}vw`,
          transform: `translateX(calc(${count > 1 ? -100 - shift * 100 : 0}vw + ${offset}px))`,
        }}
        onTransitionEnd={(e) => {
          // The photos' own fade-ins end here too.
          if (e.target !== e.currentTarget) return;
          if (settling) step(settling);
          setSettling(null);
        }}
      >
        {slides.map((by) => {
          const p = at(by);
          return (
            <div
              // Keyed by photo so the one swiped to stays loaded as it becomes
              // the middle slide. With two photos both neighbours are the same.
              key={count === 2 ? `${by}:${p.id}` : p.id}
              className="h-full w-screen shrink-0 px-[3vw] py-[6vh]"
              onClick={(e) => e.target === e.currentTarget && closePhoto()}
              aria-hidden={by !== 0 || undefined}
            >
              <Slide photo={p} />
            </div>
          );
        })}
      </div>

      <Control label="Close" onClick={() => closePhoto()} className="right-3 top-3" autoFocus>×</Control>
      {count > 1 && (
        <>
          <Control label="Previous photo" onClick={() => step(-1)} className="left-3 top-1/2 -translate-y-1/2">‹</Control>
          <Control label="Next photo" onClick={() => step(1)} className="right-3 top-1/2 -translate-y-1/2">›</Control>
        </>
      )}
      <div className="absolute inset-x-0 bottom-3 flex flex-wrap items-center justify-center gap-3 px-4 text-sm">
        <p className="rounded-full bg-black/60 px-3 py-1 text-white/80">
          {captions[photo.id] && <span className="mr-3 text-white">{captions[photo.id]}</span>}
          {index + 1} / {count}
        </p>
        {inquireHref && (
          <a
            href={inquireLink(inquireHref, photo.id)}
            onClick={inquire}
            className="rounded-full bg-white px-4 py-1.5 font-medium text-black hover:bg-white/85"
          >
            Inquire about this photo
          </a>
        )}
      </div>
    </div>
  );
}

// The small copy straight away, with the full one fading in over it once
// it has loaded, instead of a black screen.
function Slide({ photo }: { photo: PhotoSource }) {
  const [loaded, setLoaded] = useState(false);
  return (
    <div className="relative h-full w-full">
      <img src={smallSrc(photo)} alt="" aria-hidden="true" className="absolute inset-0 h-full w-full object-contain" />
      <img
        src={photo.src}
        srcSet={photo.srcSet}
        sizes="94vw"
        alt={photo.alt}
        draggable={false}
        onLoad={() => setLoaded(true)}
        ref={(img) => {
          // Already in the browser's cache: onLoad may have fired before React listened.
          if (img?.complete && img.naturalWidth && !loaded) setLoaded(true);
        }}
        className={`absolute inset-0 h-full w-full object-contain transition-opacity duration-300 ${loaded ? "opacity-100" : "opacity-0"}`}
      />
    </div>
  );
}

// On a dark circle, so the controls show on bright photos too.
function Control({ label, onClick, className, autoFocus, children }: {
  label: string;
  onClick: () => void;
  className: string;
  autoFocus?: boolean;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      data-autofocus={autoFocus || undefined}
      className={`absolute flex h-11 w-11 items-center justify-center rounded-full bg-black/60 text-2xl leading-none text-white hover:bg-black/80 ${className}`}
    >
      {children}
    </button>
  );
}

// Shared with the contact form (contact-form.tsx), which fills itself in from
// the address or from the event, and shows the photo from sessionStorage.
export const INQUIRE_KEY = "folio:inquire";
export const INQUIRE_EVENT = "folio:inquire";

function inquireLink(href: string, photoId: string) {
  const url = new URL(href, "http://x");
  url.searchParams.set("inquire", photoId);
  return `${url.pathname}${url.search}${url.hash}`;
}
