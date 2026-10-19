// What a visitor can report a site for (app/actions/report.ts). Kept out of
// the "use server" file, which may only export server actions.
//
// Copyright complaints have their own form (/report/copyright), because a
// valid notice under the DMCA needs details the general form doesn't ask for.
export const REPORT_REASONS = {
  harmful: "Illegal, abusive or harmful content",
  impersonation: "Impersonation, a scam or fraud",
  other: "Something else",
} as const;

// Every reason a saved report can have, for emails and the admin pages.
// Older reports may say "copyright" without a full notice.
export const REASON_LABELS: Record<string, string> = {
  copyright: "Copyright notice",
  ...REPORT_REASONS,
};

// A copyright notice, with the parts 17 U.S.C. § 512(c)(3) lists. The form
// only accepts it once both statements below are confirmed.
export type CopyrightNotice = {
  name: string;
  organization: string;
  role: "owner" | "agent";
  ownerName: string; // the copyright owner, when an agent sends the notice
  address: string;
  phone: string;
  email: string;
  work: string; // the original work, described or linked
  urls: string[]; // where the copies are on the reported site
  signature: string; // typed full name
};

// The two statements a notice must make, word for word as the sender
// confirms them.
export const GOOD_FAITH_STATEMENT =
  "I have a good faith belief that use of the material in the manner complained of is not authorized by the copyright owner, its agent, or the law.";
export const ACCURACY_STATEMENT =
  "The information in this notice is accurate, and under penalty of perjury, I am the owner, or authorized to act on behalf of the owner, of an exclusive right that is allegedly infringed.";

// The notice as plain text, for emails and the admin pages.
export function noticeText(notice: CopyrightNotice) {
  const who = notice.organization ? `${notice.name} (${notice.organization})` : notice.name;
  return [
    `Where it appears:\n${notice.urls.map((url) => `- ${url}`).join("\n")}`,
    `Original work:\n${notice.work}`,
    `From: ${who}`,
    notice.role === "agent" ? `Acting for the copyright owner: ${notice.ownerName}` : "Acting as: the copyright owner",
    `Address:\n${notice.address}`,
    `Phone: ${notice.phone}`,
    `Email: ${notice.email}`,
    `Statements confirmed:\n- ${GOOD_FAITH_STATEMENT}\n- ${ACCURACY_STATEMENT}`,
    `Signature: ${notice.signature}`,
  ].join("\n\n");
}
