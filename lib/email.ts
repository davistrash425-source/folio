// Sends transactional email (password resets, verification, inquiries).
// No provider is wired up yet, so messages are printed to the server console
// in development. To go live, replace the body of sendEmail with your
// provider's API call (Resend, Postmark, SES…) using a key from the env.
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
  if (process.env.NODE_ENV === "production") {
    throw new Error("No email provider configured — see lib/email.ts");
  }
  console.log(
    `\n──── email (dev) ────\nTo: ${email.to}\n${email.replyTo ? `Reply-To: ${email.replyTo}\n` : ""}Subject: ${email.subject}\n\n${email.text}\n─────────────────────\n`,
  );
}
