import { sendEmail } from "./email";
import { appUrl } from "./site";
import { createToken } from "./tokens";

// Emails the "confirm your email" link, which works for 48 hours. Used at
// sign-up, by "Resend", and by Folio's admins.
export async function sendVerificationEmail(user: { id: string; email: string }) {
  const token = await createToken(user.id, "verify", 48 * 60 * 60 * 1000);
  await sendEmail({
    to: user.email,
    subject: "Confirm your email for Folio",
    text: `Confirm your email address by opening this link:

${appUrl(`/verify-email?token=${token}`)}

The link works for 48 hours.`,
  });
}
