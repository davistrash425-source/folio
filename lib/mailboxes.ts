// Real mail addresses for photographers with agents on: name@MAIL_DOMAIN.
// A used name is never given to anyone else, because a new owner would
// receive the old owner's mail (the `mailboxes` rows are never deleted;
// deleting an account only clears their user_id).
import { claimMailbox, mailboxTaken, mailboxesOf, type User } from "./db";
import { RESERVED_LOCAL_PARTS } from "./site";

export { RESERVED_LOCAL_PARTS };

// The domain mail arrives on, or null: real addresses are off.
export function mailDomain() {
  return process.env.MAIL_DOMAIN?.trim().toLowerCase() || null;
}

export function isReservedLocalPart(value: string) {
  return RESERVED_LOCAL_PARTS.has(value.trim().toLowerCase());
}

// Lowercased and trimmed; null unless it is only letters, digits and hyphens.
export function normalizeLocalPart(value: string) {
  const v = value.trim().toLowerCase();
  return /^[a-z0-9-]+$/.test(v) ? v : null;
}

// Why an account may not be given this site address because of mail, or null.
// Used by every path that gives an account a subdomain, after validateSubdomain
// and BEFORE the "held address" check: the admin override for held addresses
// must never bypass this, since a name held in `mailboxes` would send the old
// owner's mail to the new one. Needs no MAIL_DOMAIN: rows outlive the setting.
export async function mailboxBlock(subdomain: string, userId?: string) {
  const name = subdomain.trim().toLowerCase();
  if (isReservedLocalPart(name)) return "That name is reserved.";
  if (await mailboxTaken(name, userId)) {
    return "That address has been used for mail by another account, so it can’t be given out again. Try another.";
  }
  return null;
}

// Claims the account's subdomain as its mailbox if that name is allowed and
// free. Returns the address, or null (real addresses off, name reserved or
// not valid, or another account's).
export async function ensureMailbox(user: Pick<User, "id" | "subdomain">) {
  const domain = mailDomain();
  if (!domain) return null;
  const name = normalizeLocalPart(user.subdomain);
  if (!name || isReservedLocalPart(name)) return null;
  if (!(await claimMailbox(user.id, name))) return null;
  return `${name}@${domain}`;
}

// The address for the account's newest mailbox, or null.
export async function primaryAddress(user: Pick<User, "id">) {
  const domain = mailDomain();
  if (!domain) return null;
  const [newest] = await mailboxesOf(user.id);
  return newest ? `${newest.localPart}@${domain}` : null;
}
