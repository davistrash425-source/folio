"use server";

import { addReport, findUserBySubdomain } from "@/lib/db";
import { sendEmail } from "@/lib/email";
import { clientIp, rateLimit } from "@/lib/rate-limit";
import { REPORT_REASONS, noticeText, type CopyrightNotice } from "@/lib/reports";
import { appUrl, siteUrl } from "@/lib/site";

export type ReportState = { error?: string; ok?: string; fields?: Record<string, string> };

const SENT = "Thanks — we've received your report and will look into it.";
const NOTICE_SENT = "Thanks — we've received your notice and will review it promptly.";

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
  if (!Object.hasOwn(REPORT_REASONS, reason)) return { error: "Choose what's wrong." };
  if (!details) return { error: "Tell us what's wrong, with links to the photos or pages if you can." };
  if (!/^\S+@\S+\.\S+$/.test(email)) return { error: "Please enter a valid email so we can follow up." };
  if (!(await withinReportLimit())) return { error: "You've sent several reports already. Please try again later." };
  if (!subdomain || !(await findUserBySubdomain(subdomain))) return { error: "We couldn't find that site." };

  const id = await addReport({ subdomain, reason, details, reporterEmail: email });
  await tellReportsInbox({
    replyTo: email,
    subject: `Report about ${subdomain}: ${REPORT_REASONS[reason]}`,
    text: `Site: ${siteUrl(subdomain)}\nReason: ${REPORT_REASONS[reason]}\nFrom: ${email}\nReport id: ${id}\n\n${details}\n\nFrom ${appUrl("/report")}`,
  });
  return { ok: SENT };
}

// A copyright notice under the DMCA (17 U.S.C. § 512(c)(3)). Unlike other
// reports, it isn't anonymous: the photographer is sent the sender's name and
// email with it, so they can answer it (the form says so).
export async function reportCopyright(_prev: ReportState, formData: FormData): Promise<ReportState> {
  if (String(formData.get("company") ?? "")) return { ok: NOTICE_SENT };

  const str = (key: string, max: number) => String(formData.get(key) ?? "").trim().slice(0, max);
  // Names and the like go in email subjects and headers: one line each.
  const line = (key: string, max: number) => str(key, max).replace(/\s+/g, " ");
  const subdomain = str("site", 63).toLowerCase();
  const role = str("role", 10);
  const notice: CopyrightNotice = {
    name: line("name", 120),
    organization: line("organization", 120),
    role: role === "agent" ? "agent" : "owner",
    ownerName: role === "agent" ? line("ownerName", 120) : "",
    address: str("address", 500),
    phone: line("phone", 40),
    email: line("email", 120),
    work: str("work", 4000),
    urls: str("urls", 8000)
      .split(/\r?\n/)
      .map((url) => url.trim().slice(0, 500))
      .filter(Boolean)
      .slice(0, 50),
    signature: line("signature", 120),
  };

  // What was typed, so a long notice isn't lost when one part is missing.
  const fields = Object.fromEntries(
    [...formData.entries()].flatMap(([key, value]) => (typeof value === "string" && key !== "company" ? [[key, value]] : [])),
  );
  const fail = (error: string): ReportState => ({ error, fields });
  if (!notice.urls.length) return fail("List where your work appears on the site: page or photo addresses, one per line.");
  if (!notice.work) return fail("Describe your original work, or link to where you published it.");
  if (role !== "owner" && role !== "agent") return fail("Say whether you own the copyright or act for the owner.");
  if (role === "agent" && !notice.ownerName) return fail("Enter the name of the copyright owner you act for.");
  if (!notice.name) return fail("Enter your full name.");
  if (!notice.address) return fail("Enter your mailing address. A copyright notice must include it.");
  if (!notice.phone) return fail("Enter a phone number. A copyright notice must include it.");
  if (!/^\S+@\S+\.\S+$/.test(notice.email)) return fail("Please enter a valid email so we can follow up.");
  if (!formData.get("goodFaith")) return fail("Confirm the good faith statement.");
  if (!formData.get("accurate")) return fail("Confirm that the notice is accurate, under penalty of perjury.");
  if (!notice.signature) return fail("Sign the notice by typing your full name.");
  if (!(await withinReportLimit())) return fail("You've sent several reports already. Please try again later.");
  if (!subdomain || !(await findUserBySubdomain(subdomain))) return fail("We couldn't find that site.");

  const id = await addReport({
    subdomain,
    reason: "copyright",
    details: noticeText(notice),
    reporterEmail: notice.email,
    notice,
  });
  await tellReportsInbox({
    replyTo: notice.email,
    subject: `Copyright notice about ${subdomain}`,
    text: `Site: ${siteUrl(subdomain)}\nReport id: ${id}\n\n${noticeText(notice)}`,
  });
  return { ok: NOTICE_SENT };
}

// Both forms share one limit: five reports an hour from one address.
async function withinReportLimit() {
  return rateLimit(`report:${await clientIp()}`, 5, 60 * 60 * 1000);
}

// Emails REPORTS_EMAIL when it's set. The report is already saved, so a
// failed email is logged rather than shown to the person reporting.
async function tellReportsInbox(email: { replyTo: string; subject: string; text: string }) {
  const to = process.env.REPORTS_EMAIL;
  if (!to) return;
  try {
    await sendEmail({ to, ...email });
  } catch (err) {
    console.error("Report email failed; the report is saved", err);
  }
}
