// Small helpers for the site themes that need no framework, so tests can run
// them with Node.
import type { PhotoSource } from "./uploads";

// Black or white, whichever reads better on the given #rrggbb color.
export function readableOn(hex: string) {
  const n = parseInt(hex.slice(1), 16);
  const [r, g, b] = [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  return (r * 299 + g * 587 + b * 114) / 1000 >= 150 ? "#0a0a0a" : "#ffffff";
}

export function sortPhotos(photos: PhotoSource[], sort: "manual" | "newest" | "location") {
  if (sort === "newest") return [...photos].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  if (sort === "location") {
    return [...photos].sort((a, b) => {
      if (Boolean(a.location) !== Boolean(b.location)) return a.location ? -1 : 1; // places first
      return a.location.localeCompare(b.location);
    });
  }
  return photos;
}
