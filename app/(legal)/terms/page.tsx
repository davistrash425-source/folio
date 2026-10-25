import Link from "next/link";
import { ADDRESS_HOLD_MONTHS, SUPPORT_EMAIL } from "@/lib/site";
import { STRIKE_LIMIT } from "@/lib/admin";
import { FREE_PHOTO_LIMIT } from "@/lib/plans";
import { GOVERNING_LAW, OPERATOR_ADDRESS, OPERATOR_NAME, OPERATOR_STATUS } from "@/lib/legal";

export const metadata = { title: "Terms of Service — Folio" };

export default function TermsPage() {
  return (
    <>
      <h1>Terms of Service</h1>
      <p>
        Folio lets photographers upload photos, design a website and publish it at an address like
        name.folio.cam. By creating an account you agree to these terms and to the{" "}
        <Link href="/privacy">Privacy Policy</Link>.
      </p>
      <h2>Your account</h2>
      <ul>
        <li>You must give a real email address you can read, and keep your password private.</li>
        <li>You are responsible for what happens under your account.</li>
        <li>You can delete your account at any time. Your site and photos are then removed.</li>
      </ul>
      <h2>Your photos and your site</h2>
      <ul>
        <li>Your photos stay yours. You give Folio permission to store, resize and show them, only to run your site.</li>
        <li>Upload only work you own or have permission to show.</li>
        <li>
          Folio does not use your photos to train AI, and asks AI crawlers to stay away from your site unless you
          allow them in your settings.
        </li>
        <li>The Free plan holds up to {FREE_PHOTO_LIMIT} photos.</li>
      </ul>
      <h2>What isn’t allowed</h2>
      <ul>
        <li>Photos or text that are illegal, that sexualise minors, or that harass or threaten people.</li>
        <li>Work you don’t have the right to publish.</li>
        <li>Spam, scams, malware, or trying to break or overload Folio.</li>
      </ul>
      <h2>Takedowns and suspension</h2>
      <p>
        We act on reports and copyright notices (see <Link href="/copyright">Copyright</Link>). We may remove a
        photo, hide a site, or close an account that breaks these terms. After {STRIKE_LIMIT} upheld copyright
        notices we close the account. A closed account’s address is held for {ADDRESS_HOLD_MONTHS} months.
      </p>
      <h2>Availability</h2>
      <p>
        Folio is provided as it is. We work to keep it running and your files safe, but we can’t promise it will
        never be down or lose data, so keep your own copy of your originals (you can export everything from your
        account). To the extent the law allows, Folio is not liable for indirect or lost-profit damages.
      </p>
      <h2>Who runs Folio</h2>
      <p>
        Folio is run by {OPERATOR_NAME}, {OPERATOR_STATUS}, {OPERATOR_ADDRESS}.
      </p>
      <h2>Governing law</h2>
      <p>
        These terms are governed by the laws of {GOVERNING_LAW}, without regard to its conflict-of-law rules. Any
        dispute will be brought in the state or federal courts located in Miami-Dade County, Florida.
      </p>
      <h2>Changes and contact</h2>
      <p>
        We may update these terms and will tell account holders about important changes. Questions:{" "}
        <a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a>.
      </p>
    </>
  );
}
