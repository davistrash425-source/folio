// How far through the dashboard's five steps a photographer is, as booleans
// in order: upload, describe, albums, design, go live. The dashboard's side
// nav ticks off finished steps and shows "2 of 5 done".
import type { User } from "./db";
import { sameDesign } from "./design";
import { draftDesign, publishedDesign } from "./public-site";
import { isLive } from "./site";

export function completedSteps(user: User): boolean[] {
  const photos = user.photos.filter((p) => !p.removed);
  const described = photos.some((p) => Boolean(p.description || p.location || p.alt));
  return [
    photos.length > 0,
    described,
    (user.albums ?? []).length > 0,
    sameDesign(draftDesign(user), publishedDesign(user)),
    isLive(user),
  ];
}

// Where /dashboard sends someone: new photographers start at upload (step 1),
// everyone else lands on their library.
export function entryPath(user: { photos: unknown[] }) {
  return user.photos.length === 0 ? "/dashboard/manage/upload" : "/dashboard/manage/photos";
}
