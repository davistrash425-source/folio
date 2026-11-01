import Link from "next/link";
import { ADDRESS_HOLD_MONTHS, SUPPORT_EMAIL } from "@/lib/site";
import { IMPERSONATION_MINUTES } from "@/lib/session";
import { ORPHAN_AFTER_MS } from "@/lib/cleanup";
import { UPLOAD_URL_SECONDS } from "@/lib/uploads";
import { MERCHANT_OF_RECORD, MERCHANT_PRIVACY_URL, MINIMUM_AGE, OPERATOR_ADDRESS, OPERATOR_NAME, OPERATOR_STATUS } from "@/lib/legal";
import {
  ANALYTICS_HASH_HOURS,
  BROWSER_CACHE_DAYS,
  CDN_CACHE_DAYS,
  CHANGE_NOTICE_DAYS,
  DATABASE_RESTORE_DAYS,
  DESIGN_HISTORY_DRAFTS,
  EMAIL_LOG_DAYS,
  ERROR_REPORT_DAYS,
  GALLERY_ACCESS_DAYS,
  GOOGLE_COOKIE_MINUTES,
  HOSTING_LOG_DAYS,
  IP_RATE_LIMIT_MAX_HOURS,
  MAX_INQUIRIES,
  RATE_LIMIT_MAX_HOURS,
  RESET_LINK_HOURS,
  SESSION_DAYS,
  VERIFY_LINK_HOURS,
} from "@/lib/retention";

export const metadata = { title: "Privacy Policy — Folio" };

const DAY = 24 * 60 * 60 * 1000;
const hours = (n: number) => `${n} hour${n === 1 ? "" : "s"}`;
const days = (n: number) => `${n} day${n === 1 ? "" : "s"}`;

export default function PrivacyPage() {
  return (
    <>
      <h1>Privacy Policy</h1>
      <p>
        This explains what Folio collects, why, who else handles it, and how long it’s kept. We don’t sell personal
        information, and we don’t share it for advertising.
      </p>

      <h2>Who is responsible</h2>
      <p>
        Folio is run by {OPERATOR_NAME}, {OPERATOR_STATUS}, {OPERATOR_ADDRESS} (“we”, “us”). We decide how the
        information below is used. For privacy questions or requests, write to{" "}
        <a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a>.
      </p>
      <p>
        Photographers decide what goes on their own sites, including photos of other people and the messages
        visitors send them. If you’re in a photo on a Folio site, the photographer is the first person to ask. You
        can also <Link href="/report">report a site</Link> to us.
      </p>

      <h2>What we collect and why</h2>
      <p>
        <strong>If you have an account:</strong>
      </p>
      <ul>
        <li>
          <strong>Account details</strong> you give us: name, email, site address, and a password, which we store
          only as a scrambled hash we can’t reverse. If you use “Continue with Google”, Google tells us your Google
          account ID, email and name instead, and you have no Folio password. Used to run your account and email you
          about it.
        </li>
        <li>
          <strong>What you put on your site</strong>: photos, captions, locations you type, albums, designs (plus your
          last {DESIGN_HISTORY_DRAFTS} saved drafts, for undo), and your profile (bio, contact email, phone, links).
          Your contact email is hidden unless you choose to show it. Used to build and show your site.
        </li>
        <li>
          <strong>Your photo files.</strong> We keep the original you upload privately: it’s never shown on your site
          and is only included when you export your account. Your site shows web copies we make from it. The web
          copies have the location and camera details removed, and carry your name and copyright notice.
        </li>
        <li>
          <strong>Client galleries</strong> (Pro): each gallery’s name, the photos in it, a scrambled hash of its
          password, an expiry date if you set one, and which photos your client marked as favourites.
        </li>
        <li>
          <strong>Billing</strong>: if you buy Pro, we keep your subscription’s ID, status, monthly or yearly, and
          when the period ends. We don’t receive your card or billing address (see Polar, below).
        </li>
        <li>
          <strong>Records about your account</strong>: when you agreed to these terms, whether your email is
          confirmed, your plan, and any action we take on the account (see “Staff access”).
        </li>
      </ul>
      <p>
        <strong>If you visit or contact a Folio site:</strong>
      </p>
      <ul>
        <li>
          <strong>Contact-form messages</strong>: your name, email, message, any date you mention, and which photo you
          asked about. They’re saved in the photographer’s account and emailed to them, so they can reply to you.
          They’re also in the photographer’s export of their account.
        </li>
        <li>
          <strong>Client galleries</strong>: if you open a gallery with its password, your browser keeps a cookie so
          you don’t have to type it again. If you mark favourites, the photographer sees which photos were marked.
          If a photographer emails you a gallery link through Folio, your email address and their note go through
          our email provider; we don’t keep them. The email shows the photographer’s login email as the reply
          address.
        </li>
        <li>
          <strong>Reports and copyright notices</strong>: what you tell us, and your email. A copyright notice also
          needs your name, address, phone and signature. We send its details to the photographer so they can
          respond, but leave out your address and phone.
        </li>
      </ul>
      <p>
        <strong>From everyone, automatically:</strong>
      </p>
      <ul>
        <li>
          <strong>Your IP address</strong>, to limit how often someone can try things like logging in, signing up or
          sending messages, and to check you’re a person (see Cloudflare Turnstile). When you log in, the email you
          type is counted the same way.
        </li>
        <li>
          <strong>Technical logs</strong> from our hosting: IP address, browser, the page asked for, and when. Used to
          keep Folio running and secure.
        </li>
        <li>
          <strong>Error reports</strong> when something breaks: what failed, the page address (without anything after
          a “?”), your browser type, and the address of the previous page, which can include the part after a “?”.
          Sentry may also record your IP address.
        </li>
        <li>
          <strong>Visit counts</strong> on Folio’s own pages (folio.cam), not on photographers’ sites. See
          “Analytics”.
        </li>
      </ul>
      <p>
        We use this information to provide Folio, keep it secure, prevent abuse, answer you, enforce our terms, and
        meet legal duties. We don’t use it for advertising, and we don’t use photos or messages to train AI.
      </p>

      <h2>Who else handles it</h2>
      <p>We use these companies to run Folio. Each gets only what it needs:</p>
      <ul>
        <li><strong>Vercel</strong> (hosting): every request to Folio and photographers’ sites, logs, and visit counts.</li>
        <li><strong>Neon</strong> (database): account details, site content, messages, galleries, reports and our records.</li>
        <li><strong>Cloudflare</strong>: stores photo files (R2), delivers the web copies (CDN), and runs the Turnstile person check.</li>
        <li><strong>Resend</strong> (email): every email we send, including password links, contact-form messages and notices.</li>
        <li><strong>Upstash</strong> (rate limits): IP addresses, typed login emails and account IDs, for short periods.</li>
        <li><strong>Sentry</strong> (error reports): the error details above.</li>
        <li><strong>ImprovMX</strong> (email forwarding): messages sent to {SUPPORT_EMAIL}.</li>
        <li><strong>Google</strong>: if you use “Continue with Google” or “Choose from Google Drive” (see below). Our own
          email inbox is also Gmail, so it holds messages to {SUPPORT_EMAIL}, reports and copyright notices.</li>
      </ul>
      <p>
        They act on our instructions. Cloudflare also uses the Turnstile signals to improve its bot detection, as its{" "}
        <a href="https://www.cloudflare.com/turnstile-privacy-policy/">Turnstile privacy addendum</a> explains.
      </p>
      <p>
        <strong>Polar</strong> ({MERCHANT_OF_RECORD}) sells Folio Pro. When you check out, we send Polar your account
        ID and email. Polar then collects your payment and billing details itself, as an independent company under its
        own <a href={MERCHANT_PRIVACY_URL}>privacy policy</a>, and keeps its own records of the sale (for tax, for
        example).
      </p>
      <p>
        We may also share information if the law requires it (for example a valid subpoena or court order), to protect
        someone’s safety, to deal with abuse or a legal claim, or with a company that takes over running Folio, which
        would have to keep these promises. Copyright notices go to the photographer as described above, and a
        counter-notice goes to the person who sent the notice, as the law requires.
      </p>

      <h2>Google</h2>
      <ul>
        <li>
          <strong>Continue with Google</strong>: Google tells us your Google account ID, email and name. We use them
          to sign you in, and your Google email becomes your login email. If an unconfirmed Folio account already
          uses that email, signing in with Google takes it over and removes its password, because Google has
          confirmed the address is yours. We don’t keep any Google access token.
        </li>
        <li>
          <strong>Choose from Google Drive</strong>: Google asks you to let Folio see only the files you pick. Your
          browser downloads those files from Google and uploads them to Folio like any other photo. Folio’s servers
          never connect to your Drive, and the permission lasts about an hour, in your browser only.
        </li>
        <li>
          Folio’s use and transfer to any other app of information received from Google APIs will adhere to the{" "}
          <a href="https://developers.google.com/terms/api-services-user-data-policy">
            Google API Services User Data Policy
          </a>
          , including the Limited Use requirements.
        </li>
      </ul>

      <h2>Cookies</h2>
      <p>Folio sets only cookies it needs to work. None are for advertising or tracking.</p>
      <ul>
        <li><code>session</code>: keeps you signed in, for {days(SESSION_DAYS)}.</li>
        <li><code>gallery_…</code>: lets a visitor back into a client gallery after typing its password, for {days(GALLERY_ACCESS_DAYS)}.</li>
        <li><code>google-oauth-state</code> and <code>google-signup</code>: protect “Continue with Google”, for {GOOGLE_COOKIE_MINUTES} minutes.</li>
        <li><code>manager</code> and <code>impersonate</code>: used only by Folio staff (see below).</li>
      </ul>
      <p>
        Cloudflare Turnstile, which runs on the sign-up and contact forms, and Google’s sign-in and Drive windows may
        store their own data in your browser under their own policies. A site’s contact form also remembers, in your
        browser tab only, which photo you asked about.
      </p>

      <h2>Analytics</h2>
      <p>
        We count visits to Folio’s own pages with Vercel Web Analytics. It uses no cookies. Vercel records the page
        address (which can include the part after a “?”),
        the site you came from, your country and region, and your browser, device and operating system, and tells
        visits apart with a code it throws away after {hours(ANALYTICS_HASH_HOURS)}. We only see totals. Photographers’
        sites aren’t counted.
      </p>

      <h2>Staff access</h2>
      <ul>
        <li>
          Folio staff (today, the person who runs Folio, and anyone they add as an admin or read-only helper) can see
          every account’s details, photos and site in our admin pages, to give support, act on reports, and keep Folio
          safe.
        </li>
        <li>
          To fix a problem, an admin can open your dashboard as you, for up to {IMPERSONATION_MINUTES} minutes. They
          must give a reason, and it’s logged. While they do, they see what you see, including messages from visitors,
          and can make changes, including deleting photos or changing a gallery’s password. They can’t delete your
          account, change your site address or profile, export your data, or sign you out.
        </li>
        <li>Staff can keep private notes about an account. They’re not shown to you or included in your export.</li>
        <li>Actions staff take on an account are logged, and so is opening its admin page.</li>
      </ul>

      <h2>Legal holds</h2>
      <p>
        If we’re legally required, or reasonably expect to be required, to preserve an account’s data (for example
        after a court order, a subpoena, a preservation request from law enforcement, or a legal claim), we place a
        hold. While it’s on, the account and its photos can’t be deleted, including by you, and our automatic clean-up
        skips it. We don’t always tell the account holder, because the law sometimes doesn’t allow it. The hold ends when the
        reason does.
      </p>

      <h2>How long we keep things</h2>
      <ul>
        <li><strong>Your account, site, photos, galleries and billing record</strong>: until you delete them or your account.</li>
        <li>
          <strong>Contact-form messages</strong>: until the photographer deletes them or their account. Each inbox
          keeps up to {MAX_INQUIRIES}; past that, the oldest read message goes first (or the oldest message, if none
          have been read).
        </li>
        <li>
          <strong>Photos taken down</strong> after a report: the public copies are deleted; the private original is kept
          so the photo can be put back, until it’s restored or the account owner deletes it or the account. Copies
          already saved in visitors’ browsers or on Cloudflare’s network can last a while longer, as described
          under “Deleting”.
        </li>
        <li>
          <strong>Password reset links</strong> work for {hours(RESET_LINK_HOURS)} and <strong>email confirmation
          links</strong> for {hours(VERIFY_LINK_HOURS)}. We store only a scrambled copy, deleted when used or replaced.
        </li>
        <li>
          <strong>Unfinished uploads</strong>: an upload address works for {UPLOAD_URL_SECONDS / 60} minutes, and files
          from uploads that never finished are deleted after {days(ORPHAN_AFTER_MS / DAY)}.
        </li>
        <li>
          <strong>Rate-limit counts</strong>: those keyed by IP address are forgotten within {hours(IP_RATE_LIMIT_MAX_HOURS)},
          and all of them within {hours(RATE_LIMIT_MAX_HOURS)}.
        </li>
        <li><strong>Hosting logs</strong>: {days(HOSTING_LOG_DAYS)}.</li>
        <li><strong>Copies of emails</strong> we sent, at Resend: about {EMAIL_LOG_DAYS} days.</li>
        <li><strong>Error reports</strong>: about {ERROR_REPORT_DAYS} days.</li>
        <li>
          <strong>Database backups</strong>: our database can be restored to any moment in the last{" "}
          {days(DATABASE_RESTORE_DAYS)}, so deleted information stays in that history for up to {days(DATABASE_RESTORE_DAYS)}.
        </li>
        <li><strong>A closed account’s site address</strong>: held for {ADDRESS_HOLD_MONTHS} months so nobody else can take it.</li>
        <li>
          <strong>Reports, copyright notices and our log of staff actions</strong>: we keep these after an account is
          deleted, as a record that we handled notices and applied our repeat-infringer policy. There’s no set end date
          yet; we’ll add one here.
        </li>
        <li><strong>Emails you send to {SUPPORT_EMAIL}</strong>: in our mailbox, until we decide we no longer need them.</li>
        <li><strong>Polar’s records</strong> of a purchase: under Polar’s policy.</li>
      </ul>

      <h2 id="deleting">Deleting your account and exporting your data</h2>
      <p>
        <strong>Export</strong> (Account settings) downloads a .zip with every original photo and a file with your
        account details: profile, photo details, albums, designs, client galleries (without passwords), the messages
        visitors sent you, your billing record, and any takedowns, strikes or suspension on the account. It doesn’t
        include our private staff notes, legal hold details, reports about your site, or our staff log.
      </p>
      <p>
        <strong>Deleting your account</strong> first ends any Pro subscription, then removes your account from our
        database and deletes your photo files. If deleting files fails, we retry every day until they’re gone. What
        remains for a while, or that we can’t remove:
      </p>
      <ul>
        <li>Our database history, for up to {days(DATABASE_RESTORE_DAYS)} (see above).</li>
        <li>
          Copies of your public photos that visitors’ browsers saved, for up to {days(BROWSER_CACHE_DAYS)}, and copies on
          Cloudflare’s network for up to {days(CDN_CACHE_DAYS)}. Copies other people saved or downloaded are out of our
          reach.
        </li>
        <li>Copies of emails at Resend, hosting logs and error reports, for the periods above.</li>
        <li>Reports, notices and our staff log (above), and the hold on your site address.</li>
        <li>Polar’s records of your purchases.</li>
      </ul>
      <p>You can’t delete your account while it’s on a legal hold.</p>

      <h2>Security</h2>
      <p>
        We use HTTPS everywhere, store passwords and gallery passwords only as slow salted hashes, sign our cookies so
        they can’t be forged, keep original photos in a storage area that isn’t public, remove location data from the
        web copies, limit repeated attempts, and require a confirmed email for staff accounts. No system is perfectly
        secure, so we can’t promise that information will never be accessed without permission.
      </p>

      <h2>If there’s a data breach</h2>
      <p>
        If personal information is accessed without permission in a way that puts people at risk, we’ll tell the
        people affected without unreasonable delay, and the authorities where the law requires, with what happened and
        what you can do.
      </p>

      <h2>Children</h2>
      <p>
        Accounts are for people {MINIMUM_AGE} or older, and Folio isn’t meant for children. We don’t knowingly collect
        information from children under 13; if we learn we have, we delete it. Photographers may post photos of
        children with a parent’s or guardian’s permission (see the <Link href="/terms">Terms</Link>). A parent or
        guardian who wants a photo of their child removed can <Link href="/report">report it</Link> or write to us.
      </p>

      <h2>Your rights</h2>
      <p>
        Wherever you live, you can ask us what personal information we have about you, to correct it, to delete it, or
        for a copy. Account holders can do most of this themselves in their settings. For anything else, write to{" "}
        <a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a>; we may need to confirm it’s you, and we’ll answer
        within 30 days. Some things we may have to keep for legal reasons, as described above. We won’t treat you
        differently for asking.
      </p>
      <ul>
        <li>
          <strong>US states</strong>: some states’ privacy laws (such as California’s and Florida’s) give their
          residents rights like these. Folio is below the size at which most of those laws apply, but we offer the
          same rights to everyone. We don’t sell or share personal information for targeted advertising, so there’s
          nothing to opt out of.
        </li>
        <li>
          <strong>EU and UK</strong>: we use your information to provide the service you signed up for, for our
          legitimate interests in keeping Folio secure and free of abuse, to meet legal duties, and with your consent
          where we ask for it. You can also object to our use of your information or ask us to limit it, and you can
          complain to your data protection authority.
        </li>
        <li>
          <strong>Israel</strong>: you can ask to see and correct information about you, as above. Giving us
          information is your choice, but we can’t create an account or deliver a message without the details the
          forms ask for.
        </li>
      </ul>

      <h2>Where information is stored</h2>
      <p>
        Folio is run by a US resident. Our database and app servers are in Frankfurt, Germany. Photo storage and
        our other providers may handle data elsewhere; Sentry and Polar, for example, are in the United States. Using
        Folio means your information may be handled in countries with different privacy laws from yours. We rely on
        our providers’ data protection terms, including their safeguards for international transfers.
      </p>

      <h2>Changes</h2>
      <p>
        If we change this policy in a way that matters, we’ll email account holders at least {CHANGE_NOTICE_DAYS} days
        before the change takes effect. The date below shows the latest version.
      </p>

      <h2>Contact</h2>
      <p>
        {OPERATOR_NAME}, {OPERATOR_ADDRESS}. <a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a>. Copyright
        matters: see <Link href="/copyright">Copyright</Link>.
      </p>
    </>
  );
}
