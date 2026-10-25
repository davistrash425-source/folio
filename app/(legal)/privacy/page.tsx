import Link from "next/link";
import { SUPPORT_EMAIL } from "@/lib/site";

export const metadata = { title: "Privacy Policy — Folio" };

export default function PrivacyPage() {
  return (
    <>
      <h1>Privacy Policy</h1>
      <p>This explains what Folio collects and why. We don’t sell your data.</p>
      <h2>What we collect</h2>
      <ul>
        <li>Account details: name, email, a hashed password (or your Google sign-in), and your site address.</li>
        <li>What you add: photos, captions, text, design choices, and messages visitors send through your contact form.</li>
        <li>
          Photos: the original is kept privately for your export. Public copies have location data and camera
          details removed and carry your name and copyright notice.
        </li>
        <li>Technical data: visitors’ IP addresses are used briefly for rate limits and abuse protection.</li>
      </ul>
      <h2>Who helps us run Folio</h2>
      <p>
        Vercel (hosting), Neon (database), Cloudflare (photo storage, bot checks), Resend (email), Upstash (rate
        limits), Sentry (error reports) and Google (if you sign in with it). They process data only to provide their
        service to Folio.
      </p>
      <h2>Cookies</h2>
      <p>One cookie keeps you signed in. We don’t use advertising or tracking cookies.</p>
      <h2>Your choices</h2>
      <ul>
        <li>Export all your data and photos, or delete your account, from your account settings.</li>
        <li>Take your site offline at any time.</li>
        <li>
          To ask about your data, write to <a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a>.
        </li>
      </ul>
      <h2>Copyright notices</h2>
      <p>
        If someone files a copyright notice about your site, we share it with you without the sender’s address and
        phone. See <Link href="/copyright">Copyright</Link>.
      </p>
      <h2>Legal holds</h2>
      <p>If the law requires us to preserve an account’s data, we keep it until the hold ends.</p>
    </>
  );
}
