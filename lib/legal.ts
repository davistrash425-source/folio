// Shared by the Terms, Privacy and Copyright pages (app/(legal)).
// Set LEGAL_DRAFT to false once a lawyer has reviewed the text.
export const LEGAL_DRAFT = true;
export const LEGAL_UPDATED = "26 October 2026";

// Who runs Folio. Update these if it moves into a company (e.g. an LLC).
export const OPERATOR_NAME = "David Leonardo Freeman";
export const OPERATOR_STATUS = "an individual";
export const OPERATOR_ADDRESS = "1250 95th Street, Bay Harbor Islands, FL 33154, USA";
export const GOVERNING_LAW = "the State of Florida, USA";

// The agent registered with the US Copyright Office (dmca.copyright.gov), shown on /copyright.
// Leave null until registered; fill in the fields to show it. See docs/DMCA-AGENT-GUIDE.md.
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
