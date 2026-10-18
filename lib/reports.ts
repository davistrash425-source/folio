// What a visitor can report a site for (app/actions/report.ts). Kept out of
// the "use server" file, which may only export server actions.
export const REPORT_REASONS = {
  copyright: "These are my photos, used without permission",
  harmful: "Illegal, abusive or harmful content",
  impersonation: "Impersonation, a scam or fraud",
  other: "Something else",
} as const;
