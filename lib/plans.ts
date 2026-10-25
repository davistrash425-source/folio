// What each plan allows. Only the Free plan exists so far; "pro" is here so
// the limits live in one place when it launches (docs/BACKLOG.md, Phase 4).
import type { User } from "./db";

export const FREE_PHOTO_LIMIT = 150;
export const PRO_PHOTO_LIMIT = 1500;

// Missing means free. An account over its limit (say, from before the limit
// existed) keeps its photos but can't add more.
export function photoLimit(user: Pick<User, "plan">) {
  return user.plan === "pro" ? PRO_PHOTO_LIMIT : FREE_PHOTO_LIMIT;
}

export function photoLimitMessage(user: Pick<User, "plan">) {
  return `You've reached the limit of ${photoLimit(user).toLocaleString("en-US")} photos. Delete some to make room.`;
}
