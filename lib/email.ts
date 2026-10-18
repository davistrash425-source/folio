// Sends transactional email (password resets, verification, inquiries)
// through Resend when RESEND_API_KEY and EMAIL_FROM are set. Without them,
// development prints each message to the server console, and production
// refuses to send rather than silently dropping mail.
export type Email = { to: string; subject: string; text: string; replyTo?: string };

// Headers are one line each: a line break in an address or subject could add
// headers of its own (like a hidden Bcc). This covers the Unicode separators
// that `\s` misses too.
const oneLine = (value: string) => value.replace(/[\r\n\x85\p{Zl}\p{Zp}]+/gu, " ").trim();

export async function sendEmail(input: Email) {
  const email: Email = {
    ...input,
    to: oneLine(input.to),
    subject: oneLine(input.subject),
    replyTo: input.replyTo === undefined ? undefined : oneLine(input.replyTo),
  };

  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM; // e.g. "Folio <hello@folio.cam>", on a domain verified in Resend
  if (apiKey && from) {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: oneLine(from),
        to: [email.to],
        subject: email.subject,
        text: email.text,
        ...(email.replyTo ? { reply_to: email.replyTo } : {}),
      }),
    });
    if (!res.ok) throw new Error(`Email not sent: Resend answered ${res.status} ${await res.text()}`);
    return;
  }

  if (process.env.NODE_ENV === "production") {
    throw new Error("No email provider configured: set RESEND_API_KEY and EMAIL_FROM (see lib/email.ts)");
  }
  console.log(
    `\n──── email (dev) ────\nTo: ${email.to}\n${email.replyTo ? `Reply-To: ${email.replyTo}\n` : ""}Subject: ${email.subject}\n\n${email.text}\n─────────────────────\n`,
  );
}
