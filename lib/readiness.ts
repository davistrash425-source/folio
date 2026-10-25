// Optional "is it ready?" checks on the Go live page. They only nudge: none
// of them stops a site from going live.
import type { User } from "./db";

export type QualityCheck = {
  id: "captions" | "about" | "contact" | "albums";
  done: boolean;
  label: string;
  href: string; // where to fix it
  fix: string; // what that link says
};

export function qualityChecks(user: User): QualityCheck[] {
  const photos = user.photos.filter((p) => !p.removed);
  const bare = photos.filter((p) => !p.description?.trim()).length;
  const email = Boolean(user.profile.showEmail && user.profile.contactEmail.trim());
  const phone = Boolean(user.profile.phone.trim());
  return [
    {
      id: "captions",
      done: photos.length === 0 || bare === 0,
      label: bare === 0 ? "Every photo has a description" : `${bare} of ${photos.length} ${photos.length === 1 ? "photo has" : "photos have"} no description`,
      href: "/dashboard/manage/photos?filter=no-description",
      fix: "Describe them",
    },
    {
      id: "about",
      done: Boolean(user.profile.bio.trim()),
      label: user.profile.bio.trim() ? "About text written" : "Your About text is empty",
      href: "/dashboard/manage/design",
      fix: "Write it",
    },
    {
      id: "contact",
      done: email || phone,
      label: email || phone ? "Visitors can see how to reach you" : "No contact details are public (your email is hidden unless you switch it on)",
      href: "/dashboard/manage/design",
      fix: "Add contact details",
    },
    {
      id: "albums",
      done: (user.albums ?? []).some((a) => a.photoIds.length > 0),
      label: (user.albums ?? []).some((a) => a.photoIds.length > 0) ? "Photos grouped into albums" : "No albums yet",
      href: "/dashboard/manage/albums",
      fix: "Make an album",
    },
  ];
}
