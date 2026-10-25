// One place that decides whether a site address is free to take. Used by the
// live check while people type (app/api/address) and by the sign-up forms.
import { findUserBySubdomain, subdomainOnHold } from "./db";
import { ADDRESS_HOLD_MONTHS, SUPPORT_EMAIL, validateSubdomain } from "./site";

export type AddressStatus =
  | { status: "available" }
  | { status: "invalid"; message: string }
  | { status: "held"; message: string }
  | { status: "taken"; message: string };

export async function addressStatus(subdomain: string): Promise<AddressStatus> {
  const value = subdomain.trim().toLowerCase();
  const invalid = validateSubdomain(value);
  if (invalid) return { status: "invalid", message: invalid };
  if (await subdomainOnHold(value, ADDRESS_HOLD_MONTHS)) {
    return {
      status: "held",
      message: `That address belonged to a site that closed recently, so it's held for a year. Write to ${SUPPORT_EMAIL} if it was yours.`,
    };
  }
  if (await findUserBySubdomain(value)) {
    return { status: "taken", message: "That site address is taken." };
  }
  return { status: "available" };
}
