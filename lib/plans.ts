// What each plan allows. Only the Free plan exists so far; "pro" is here so
// the limits live in one place when it launches (docs/BACKLOG.md, Phase 4).
import type { User } from "./db";

export const FREE_PHOTO_LIMIT = 150;
export const PRO_PHOTO_LIMIT = 1500;

// What Pro costs, in US dollars (the Polar products are set up to match).
export const PRO_PRICE_MONTHLY = 12;
export const PRO_PRICE_YEARLY = 120;

// Missing means free. An account over its limit (say, from before the limit
// existed) keeps its photos but can't add more.
export function photoLimit(user: Pick<User, "plan">) {
  return user.plan === "pro" ? PRO_PHOTO_LIMIT : FREE_PHOTO_LIMIT;
}

// Storage: the originals plus the web copies, as recorded in Photo.bytes.
// Free is only a safety net (150 photos of at most 20 MB already fit well
// inside it); Pro's 50 GB is the advertised limit.
const GB = 1024 ** 3;
export const FREE_STORAGE_LIMIT = 5 * GB;
export const PRO_STORAGE_LIMIT = 50 * GB;

export function storageLimit(user: Pick<User, "plan">) {
  return user.plan === "pro" ? PRO_STORAGE_LIMIT : FREE_STORAGE_LIMIT;
}

// Photos uploaded before sizes were recorded count as 0 until a backfill.
export function storageUsed(user: Pick<User, "photos">) {
  return user.photos.reduce((total, p) => total + (p.bytes ?? 0), 0);
}

export function storageLimitMessage(user: Pick<User, "plan">) {
  return `You've used all ${storageLimit(user) / GB} GB of storage. Delete some photos to make room.`;
}

// Bytes of direct uploads that were started and can still arrive.
export function pendingUploadBytes(user: Pick<User, "pendingUploads">, now = Date.now()) {
  return (user.pendingUploads ?? []).reduce((total, p) => total + (p.expires > now ? p.bytes : 0), 0);
}

// Why one more photo of `extraBytes` can't be added right now, or null if it
// can. Checked before an upload starts and again when it is saved.
export function uploadBlock(user: Pick<User, "plan" | "photos">, extraBytes = 0): string | null {
  if (user.photos.length >= photoLimit(user)) return photoLimitMessage(user);
  if (storageUsed(user) + extraBytes > storageLimit(user)) return storageLimitMessage(user);
  return null;
}

// Client galleries are a Pro feature.
export const PRO_GALLERY_LIMIT = 20;
export function galleryLimit(user: Pick<User, "plan">) {
  return user.plan === "pro" ? PRO_GALLERY_LIMIT : 0;
}

// Whether visitors can open this account's galleries. After a downgrade the
// galleries are kept but hidden until the account is Pro again.
export function galleriesOpen(user: Pick<User, "plan">) {
  return galleryLimit(user) > 0;
}

// The emergency off switch for all of Folio AGENTS (takes effect on the next deploy).
export function agentsPaused() {
  return process.env.AGENTS_PAUSED === "1";
}

// Whether an admin has switched the agents on for this account, whatever is
// happening now. A pause or suspension stops the AI (agentsAllowed), but mail
// and site messages must still be saved and shown, so those use this.
export function agentsEnrolled(user: Pick<User, "agents">) {
  return user.agents?.enabled === true;
}

// Whether this account may use the agents. Off unless a Folio admin turned it
// on (setAgentsAccess in app/actions/admin.ts); a suspended account never can.
export function agentsAllowed(user: Pick<User, "agents" | "suspended">) {
  return !agentsPaused() && user.agents?.enabled === true && !user.suspended;
}

export function photoLimitMessage(user: Pick<User, "plan">) {
  return `You've reached the limit of ${photoLimit(user).toLocaleString("en-US")} photos. Delete some to make room.`;
}

// "Made with Folio" footer on client galleries.
// Decided Oct 25, 2026: "free-only" (docs/GALLERY-FOOTER-DECISION.md).
// One-line switch: "always" | "free-only" | "never". Free galleries do not exist yet (galleryLimit is 0), so it only shows if that changes.
export const GALLERY_FOLIO_BADGE: "always" | "free-only" | "never" = "free-only";

export function showFolioBadge(
  user: Pick<User, "plan">,
  mode: "always" | "free-only" | "never" = GALLERY_FOLIO_BADGE,
) {
  if (mode === "always") return true;
  if (mode === "never") return false;
  return user.plan !== "pro";
}
