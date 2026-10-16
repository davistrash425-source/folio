// Sends transactional email (password resets, verification, inquiries).
// No provider is wired up yet, so messages are printed to the server console
// in development. To go live, replace the body of sendEmail with your
// provider's API call (Resend, Postmark, SES…) using a key from the env.
export type Email = { to: string; subject: string; text: string; replyTo?: string };

export async function sendEmail(email: Email) {
  if (process.env.NODE_ENV === "production") {
    throw new Error("No email provider configured — see lib/email.ts");
  }
  console.log(
    `\n──── email (dev) ────\nTo: ${email.to}\n${email.replyTo ? `Reply-To: ${email.replyTo}\n` : ""}Subject: ${email.subject}\n\n${email.text}\n─────────────────────\n`,
  );
}
