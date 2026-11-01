// Shared by the Terms, Privacy and Copyright pages (app/(legal)).
// Set LEGAL_DRAFT to false once a lawyer has reviewed the text.
export const LEGAL_DRAFT = true;
export const LEGAL_UPDATED = "1 November 2026";

// Who runs Folio. Update these if it moves into a company (e.g. an LLC).
export const OPERATOR_NAME = "David Leonardo Freeman";
export const OPERATOR_STATUS = "an individual";
export const OPERATOR_ADDRESS = "1250 95th Street, Bay Harbor Islands, FL 33154, USA";
export const GOVERNING_LAW = "the State of Florida, USA";
export const DISPUTE_VENUE = "Miami-Dade County, Florida";

// Who sells Folio Pro (lib/billing.ts). Polar is the merchant of record.
export const MERCHANT_OF_RECORD = "Polar Software, Inc.";
export const MERCHANT_BUYER_TERMS_URL = "https://polar.sh/legal/checkout-buyer-terms";
export const MERCHANT_PRIVACY_URL = "https://polar.sh/legal/privacy";

// Who may hold a Folio account (the Terms; the sign-up checkbox should say the same).
export const MINIMUM_AGE = 18;

// The most Folio is liable for, in US dollars, when it's more than the fees
// paid in the last 12 months. A draft figure for the lawyer to set.
export const LIABILITY_FLOOR_USD = 50;

// The agent registered with the US Copyright Office (dmca.copyright.gov), shown on /copyright.
// Registered Oct 26, 2026 (DMCA-1084175); renew by Oct 2029. Set to null to fall back to the support address. See docs/DMCA-AGENT-GUIDE.md.
export type DmcaAgent = { name: string; organization?: string; address: string; phone?: string; email: string; registration?: string };
export const DMCA_AGENT: DmcaAgent | null = {
  name: "David Leonardo Freeman",
  organization: "Folio",
  address: "1250 95th Street, Bay Harbor Islands, FL 33154, USA",
  phone: "+1 657 684 9754",
  email: "support@folio.cam",
  registration: "DMCA-1084175",
};

export function dmcaAgentToShow(agent: DmcaAgent | null = DMCA_AGENT): DmcaAgent | null {
  return agent && agent.name.trim() && agent.address.trim() && agent.email.trim() ? agent : null;
}
