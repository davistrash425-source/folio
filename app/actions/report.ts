"use server";

import { addReport, findUserBySubdomain } from "@/lib/db";
import { sendEmail } from "@/lib/email";
import { clientIp, rateLimit } from "@/lib/rate-limit";
import { REPORT_REASONS } from "@/lib/reports";
import { appUrl, siteUrl } from "@/lib/site";

export type ReportState = { error?: string; ok?: string };

const SENT = "Thanks — we've received your report and will look into it.";

// Anyone can report a site. Reports are saved, and emailed to REPORTS_EMAIL
// when it's set; the site's owner isn't told who reported it.
export async function reportSite(_prev: ReportState, formData: FormData): Promise<ReportState> {
  // Bots fill in every field, including this one people never see.
  if (String(formData.get("company") ?? "")) return { ok: SENT };

  const str = (key: string, max: number) => String(formData.get(key) ?? "").trim().slice(0, max);
  const subdomain = str("site", 63).toLowerCase();
  const reason = str("reason", 20) as keyof typeof REPORT_REASONS;
  const details = str("details", 4000);
  const email = str("email", 120);
  if (!(reason in REPORT_REASONS)) return { error: "Choose what's wrong." };
  if (!details) return { error: "Tell us what's wrong, with links to the photos or pages if you can." };
  if (!/^\S+@\S+\.\S+$/.test(email)) return { error: "Please enter a valid email so we can follow up." };
  if (!(await rateLimit(`report:${await clientIp()}`, 5, 60 * 60 * 1000))) {
    return { error: "You've sent several reports already. Please try again later." };
  }
  if (!subdomain || !(await findUserBySubdomain(subdomain))) return { error: "We couldn't find that site." };

  const id = await addReport({ subdomain, reason, details, reporterEmail: email });
  const to = process.env.REPORTS_EMAIL;
  if (to) {
    try {
      await sendEmail({
        to,
        replyTo: email,
        subject: `Report about ${subdomain}: ${REPORT_REASONS[reason]}`,
        text: `Site: ${siteUrl(subdomain)}\nReason: ${REPORT_REASONS[reason]}\nFrom: ${email}\nReport id: ${id}\n\n${details}\n\nFrom ${appUrl("/report")}`,
      });
    } catch (err) {
      console.error("Report email failed; the report is saved", err);
    }
  }
  return { ok: SENT };
}
