import Link from "next/link";
import { ADDRESS_HOLD_MONTHS, SUPPORT_EMAIL } from "@/lib/site";
import { STRIKE_LIMIT } from "@/lib/admin";
import {
  FREE_PHOTO_LIMIT,
  FREE_STORAGE_LIMIT,
  PRO_GALLERY_LIMIT,
  PRO_PHOTO_LIMIT,
  PRO_PRICE_MONTHLY,
  PRO_PRICE_YEARLY,
  PRO_STORAGE_LIMIT,
} from "@/lib/plans";
import { VARIANT_WIDTHS } from "@/lib/images";
import { AI_TRAINING_CRAWLERS } from "@/lib/site";
import { CHANGE_NOTICE_DAYS } from "@/lib/retention";
import {
  DISPUTE_VENUE,
  GOVERNING_LAW,
  LIABILITY_FLOOR_USD,
  MERCHANT_BUYER_TERMS_URL,
  MERCHANT_OF_RECORD,
  MINIMUM_AGE,
  OPERATOR_ADDRESS,
  OPERATOR_NAME,
  OPERATOR_STATUS,
} from "@/lib/legal";

export const metadata = { title: "Terms of Service — Folio" };

const GB = 1024 ** 3;
const LARGEST_WEB_COPY = Math.max(...VARIANT_WIDTHS);

export default function TermsPage() {
  return (
    <>
      <h1>Terms of Service</h1>
      <p>
        Folio lets photographers upload photos, design a website and publish it at an address like
        name.folio.cam. These terms are an agreement between you and {OPERATOR_NAME}, who runs Folio (“we”, “us”).
        By creating an account you agree to them and to the <Link href="/privacy">Privacy Policy</Link>. If you
        visit a Folio site without an account, only the parts about visitors, reports and copyright apply to you.
      </p>

      <h2>Who can use Folio</h2>
      <ul>
        <li>You must be {MINIMUM_AGE} or older to have an account. If we learn an account holder is younger, we close the account.</li>
        <li>If you sign up for a business, you confirm you’re allowed to agree to these terms for it.</li>
        <li>Folio is run by a US resident. You’re responsible for following the laws that apply where you live.</li>
      </ul>

      <h2>Your account</h2>
      <ul>
        <li>Give a real email address you can read. Your site goes live only after you confirm it.</li>
        <li>Keep your password private. You’re responsible for what happens under your account.</li>
        <li>Tell us at <a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a> if you think someone else got into it.</li>
        <li>You can export your data or delete your account at any time from your account settings, except while a legal hold applies (see the Privacy Policy).</li>
      </ul>

      <h2>Your photos and your site</h2>
      <p>
        Your photos, text and designs stay yours. To run Folio, you give us a worldwide, non-exclusive, royalty-free
        permission to store, copy, resize, convert, show and send your content, and to write your name and copyright
        notice into the web copies. We use that permission only to:
      </p>
      <ul>
        <li>run your site and the Folio features you choose to use, like client galleries, downloads and the export;</li>
        <li>keep Folio secure and working, and act on reports and the law.</li>
      </ul>
      <p>
        We may let the companies that host Folio for us handle your content for those purposes. Otherwise we only
        share it as the Privacy Policy describes, for example when the law requires it. We won’t sell your photos or
        use them to advertise Folio without asking you first.
      </p>
      <p>
        The permission ends for each photo when you delete it or your account. Some copies take a while to disappear,
        and a few we can’t reach at all. The <Link href="/privacy#deleting">Privacy Policy</Link> explains how long.
        It also lasts as long as we must keep content for a legal reason, such as a court order.
      </p>

      <h2>AI training</h2>
      <ul>
        <li>We don’t use your photos or site to train AI models, and we don’t sell or give them to anyone to do so.</li>
        <li>
          Unless you allow it in your settings, your site asks the crawlers that collect pages for AI training to stay
          away (we list {AI_TRAINING_CRAWLERS.length} by name, such as GPTBot and Google-Extended). This only works on crawlers that follow
          those requests. Anything you publish can be seen and copied by people and by crawlers that ignore them, so we
          can’t promise your public photos won’t be collected.
        </li>
      </ul>

      <h2>What you promise about your content</h2>
      <ul>
        <li>You took the photos or have permission to publish them, and showing them on Folio doesn’t break anyone’s rights.</li>
        <li>
          You have the consent the law requires from the people in your photos. A portfolio promotes your work, so in
          many places you need a signed model release before showing a recognisable person on it.
        </li>
        <li>
          For a recognisable person under 18, you have written permission from their parent or guardian. Please think
          twice before naming children or showing where they live or go to school.
        </li>
        <li>You’ll show us the permissions if we ask, for example after a complaint.</li>
      </ul>

      <h2>What isn’t allowed</h2>
      <ul>
        <li>Anything illegal, and any sexual content involving minors. We report it where the law requires.</li>
        <li>Intimate images of someone shared without their consent.</li>
        <li>Content that harasses or threatens people, or shares someone’s private information without permission.</li>
        <li>Work you don’t have the right to publish.</li>
        <li>Pretending to be someone else, scams, phishing, spam or malware.</li>
        <li>Trying to break into, overload, or copy Folio or other people’s accounts, or getting around our limits.</li>
        <li>Using Folio mainly to store or share files that aren’t part of your photography site or client galleries.</li>
      </ul>

      <h2>Client galleries</h2>
      <ul>
        <li>Client galleries are part of Folio Pro (up to {PRO_GALLERY_LIMIT}). Each one is a private link with a password you choose.</li>
        <li>
          A gallery is kept out of sight: the link is random, the password is needed to see the page, and search
          engines are asked to skip it. But the photos in it are the same web copies your site uses. Anyone who
          already has a photo’s exact address can open that photo without the password. Don’t use galleries for
          images that must stay confidential.
        </li>
        <li>Clients can download a gallery’s photos as web copies (up to {LARGEST_WEB_COPY} pixels wide), never your originals.</li>
        <li>
          Your agreements with your clients (what they paid for, how they may use the photos) are between you and them.
          Folio isn’t part of them. You’re responsible for having the right to share each photo with the client.
        </li>
        <li>If you email a gallery link through Folio, the email shows your login email as the reply address.</li>
      </ul>

      <h2>Plans and payment</h2>
      <ul>
        <li>
          <strong>Free</strong> holds up to {FREE_PHOTO_LIMIT} photos and {FREE_STORAGE_LIMIT / GB} GB.{" "}
          <strong>Folio Pro</strong> holds up to {PRO_PHOTO_LIMIT.toLocaleString("en-US")} photos and{" "}
          {PRO_STORAGE_LIMIT / GB} GB, and adds client galleries and extra themes.{" "}
          {`It costs $${PRO_PRICE_MONTHLY} a month or $${PRO_PRICE_YEARLY} a year, plus any sales tax.`} Current prices
          are on the <Link href="/pricing">pricing page</Link>.
        </li>
        <li>
          Folio Pro is sold by {MERCHANT_OF_RECORD} (“Polar”), our reseller and merchant of record. Polar takes the
          payment, charges and pays the tax, sends receipts, handles refunds and runs the billing page. Polar’s{" "}
          <a href={MERCHANT_BUYER_TERMS_URL}>buyer terms</a> cover the payment itself. We never see your card details.
        </li>
        <li>
          <strong>Pro renews automatically</strong> every month or year, at the price shown when it renews, until you
          cancel. Polar charges the card you gave it at the start of each period.
        </li>
        <li>
          <strong>Cancel any time</strong> from Account → Plan → Manage billing, or by writing to{" "}
          <a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a>. You keep Pro until the end of the period you’ve paid
          for. After that, the account moves to Free.
        </li>
        <li>
          <strong>Refunds.</strong> A period that has started isn’t refunded, except where the law requires it or
          something went wrong on our side (for example, you were charged twice or Pro didn’t switch on). Write to us
          and we’ll ask Polar to refund you. If we close Folio, or close your account when you haven’t broken these
          terms, we’ll ask Polar to refund the unused part of the period. Deleting your account ends Pro right away and doesn’t
          refund the rest of the period, so cancel first if you want to use it up.
        </li>
        <li>
          <strong>Price changes.</strong> We’ll email you at least {CHANGE_NOTICE_DAYS} days before a new price
          applies to you. It starts at your next renewal after that. If you don’t want it, cancel before then.
        </li>
        <li>
          <strong>When Pro ends</strong>, no photos are deleted. Client galleries are hidden from visitors until
          you’re Pro again, and if you have more than {FREE_PHOTO_LIMIT} photos you keep them all but can’t add more
          until you’re under the limit. A Pro theme shows as the Classic theme; if you then edit your design, the
          Pro theme and its settings are replaced by Classic, though you can undo back to earlier drafts.
        </li>
      </ul>

      <h2>Takedowns, suspension and closing accounts</h2>
      <ul>
        <li>
          We act on reports and copyright notices (see <Link href="/copyright">Copyright</Link>). We don’t watch
          every site, but we may look at content to keep Folio safe or answer a report.
        </li>
        <li>
          If content breaks these terms or the law, we may take photos down, take your site offline, or close your
          account. We’ll usually tell you why by email, but we may act without warning when it’s urgent, or when the
          law or someone’s safety requires it.
        </li>
        <li>
          Each copyright notice we uphold adds a strike to the account. At {STRIKE_LIMIT} strikes we take the site
          offline, and we close accounts that keep infringing. A strike is removed if you send a valid counter-notice and the photos
          are put back.
        </li>
        <li>
          When an account closes, for any reason, its site address is held for {ADDRESS_HOLD_MONTHS} months so nobody
          else can use it to pass as you. We may release it sooner, for example to give it back to its former owner.
        </li>
        <li>If you think we got it wrong, write to us and we’ll look again.</li>
      </ul>

      <h2>Keep your own copies</h2>
      <p>
        We work to keep Folio running and your files safe, but we can’t promise it will never be down, slow or lose
        data. Keep your originals somewhere else too. You can download everything from your account at any time.
      </p>

      <h2>No warranties</h2>
      <p>
        Folio is provided “as is” and “as available”. As far as the law allows, we don’t promise that it will meet
        your needs, be free of errors, or that what you publish will be safe from copying. Some places don’t allow
        these exclusions, so they may not all apply to you.
      </p>

      <h2>Limit on our liability</h2>
      <p>
        As far as the law allows, we aren’t liable for indirect or consequential losses, such as lost profits, lost
        business, or lost data you could have kept a copy of. Our total liability for all claims about Folio is
        limited to the greater of ${LIABILITY_FLOOR_USD} or what you paid for Folio in the 12 months before the claim.
        These limits don’t apply to losses caused by our fraud, gross negligence or wilful misconduct, or anything else
        the law doesn’t let us limit.
      </p>

      <h2>If someone makes a claim about your content</h2>
      <p>
        If someone makes a claim against us because of your content, how you used Folio, your dealings with your
        clients, or your breaking these terms, you’ll cover our reasonable costs of dealing with it, including
        lawyers’ fees, as far as the law allows. We’ll tell you about the claim promptly and let you take part in
        handling it.
      </p>

      <h2>Disputes</h2>
      <ul>
        <li>If you have a problem with Folio, write to us first. We’ll try to sort it out within 30 days.</li>
        <li>
          These terms are governed by the laws of {GOVERNING_LAW}, without regard to its conflict-of-law rules. Any
          dispute that can’t be settled goes to the state or federal courts in {DISPUTE_VENUE}, or to a small-claims
          court where you live if the claim qualifies.
        </li>
        <li>If you live outside the US, you keep any rights your local consumer law gives you that can’t be signed away.</li>
        <li>Payment disputes with Polar are covered by Polar’s buyer terms.</li>
      </ul>

      <h2>Changes to these terms</h2>
      <p>
        We may update these terms as Folio changes. For changes that matter, such as new fees or anything that
        reduces your rights, we’ll email account holders at least {CHANGE_NOTICE_DAYS} days before they take effect.
        Smaller fixes, like clearer wording, take effect when posted. Changes never apply to a dispute that started
        before them. If you don’t agree, you can cancel Pro or delete your account before the change takes effect;
        using Folio after that means you accept it. The date at the bottom shows the latest version.
      </p>

      <h2>The rest</h2>
      <ul>
        <li>If one part of these terms can’t be enforced, the rest still applies.</li>
        <li>If we don’t enforce a part straight away, we can still enforce it later.</li>
        <li>We may transfer these terms to a company that takes over running Folio, and we’ll tell you if we do.</li>
        <li>These terms, the Privacy Policy and the Copyright page are the whole agreement between us about Folio.</li>
      </ul>

      <h2>Who runs Folio and how to reach us</h2>
      <p>
        Folio is run by {OPERATOR_NAME}, {OPERATOR_STATUS}, {OPERATOR_ADDRESS}. Questions:{" "}
        <a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a>.
      </p>
    </>
  );
}
