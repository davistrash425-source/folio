// Small helpers for the dashboard: where /dashboard sends someone, and what
// its preview button says.
import type { User } from "./db";
import { sameDesign } from "./design";
import { draftDesign, publishedDesign } from "./public-site";
import { isLive } from "./site";

// Where /dashboard sends someone: new photographers start at upload,
// everyone else lands on their library.
export function entryPath(user: { photos: unknown[] }) {
  return user.photos.length === 0 ? "/dashboard/manage/upload" : "/dashboard/manage/photos";
}

// What the dashboard's preview button says: the preview always shows the
// draft, so it's "Preview draft" while the site is offline or has changes
// that aren't published yet, and "Preview live site" once the draft and the
// live site are the same thing.
export function previewLabel(user: User) {
  const same = sameDesign(draftDesign(user), publishedDesign(user));
  return isLive(user) && same ? "Preview live site" : "Preview draft";
}
