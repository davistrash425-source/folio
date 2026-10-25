import Link from "next/link";
import { STRIKE_LIMIT } from "@/lib/admin";
import { SUPPORT_EMAIL } from "@/lib/site";

export const metadata = { title: "Copyright and takedowns — Folio" };

export default function CopyrightPolicyPage() {
  return (
    <>
      <h1>Copyright and takedowns</h1>
      <p>
        Folio respects creators’ rights and responds to notices under the US Digital Millennium Copyright Act (DMCA).
      </p>
      <h2>If your work is on a Folio site without permission</h2>
      <p>
        Send a notice with our <Link href="/report/copyright">copyright form</Link>. It asks for what the law requires:
        the work, where it appears, your contact details, a good-faith statement and a signature. We remove the
        material promptly and send the site’s owner a copy of the notice without your address and phone.
      </p>
      <h2>If your photo was removed</h2>
      <p>
        If you believe it was a mistake, you can send a counter-notice to{" "}
        <a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a>. We pass it to the sender, and may restore the photo
        if they don’t start a court action within the legal period.
      </p>
      <h2>Repeat infringers</h2>
      <p>Each upheld notice adds a strike to an account. At {STRIKE_LIMIT} strikes the account is closed.</p>
      <h2>Designated agent</h2>
      <p>
        Notices can also be sent to: <a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a>.
      </p>
      <p>
        Other problems with a site? Use the <Link href="/report">general report form</Link>.
      </p>
    </>
  );
}
