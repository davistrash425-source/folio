"use client";

/* eslint-disable @next/next/no-img-element -- user uploads are served by our own route */
import { useState, useTransition } from "react";
import { toggleFavourite } from "@/app/actions/galleries";
import type { PhotoSource } from "@/lib/uploads";

// The client's view of a gallery: every photo opens full size, and a heart
// marks the ones they like for the photographer.
export function PhotoGrid({ subdomain, slug, photos, favourites }: {
  subdomain: string;
  slug: string;
  photos: PhotoSource[];
  favourites: string[];
}) {
  const [hearted, setHearted] = useState(new Set(favourites));
  const [error, setError] = useState<string>();
  const [, start] = useTransition();

  function toggle(id: string) {
    setError(undefined);
    start(async () => {
      const result = await toggleFavourite(subdomain, slug, id);
      if (result.error) setError(result.error);
      else setHearted(new Set(result.favourites));
    });
  }

  return (
    <>
      <p className="mt-4 text-sm text-ink-soft" aria-live="polite">
        {error ?? `Tap the heart on the photos you like. ${hearted.size > 0 ? `${hearted.size} chosen.` : ""}`}
      </p>
      <ul className="mt-6 columns-1 gap-4 sm:columns-2 lg:columns-3">
        {photos.map((photo) => (
          <li key={photo.id} className="relative mb-4 break-inside-avoid">
            <a href={photo.src} target="_blank" rel="noopener noreferrer" className="block">
              <img
                src={photo.src}
                srcSet={photo.srcSet}
                sizes="(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw"
                alt={photo.alt}
                width={photo.width}
                height={photo.height}
                loading="lazy"
                className="w-full"
              />
            </a>
            <button
              type="button"
              aria-pressed={hearted.has(photo.id)}
              aria-label={hearted.has(photo.id) ? "Remove from favourites" : "Add to favourites"}
              onClick={() => toggle(photo.id)}
              className="absolute right-2 top-2 flex size-10 items-center justify-center rounded-full bg-white/90 text-xl shadow hover:bg-white"
            >
              <span aria-hidden="true" className={hearted.has(photo.id) ? "text-red-600" : "text-zinc-500"}>
                {hearted.has(photo.id) ? "♥" : "♡"}
              </span>
            </button>
          </li>
        ))}
      </ul>
    </>
  );
}
