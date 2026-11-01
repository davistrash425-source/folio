import Link from "next/link";
import { STRIKE_LIMIT } from "@/lib/admin";
import { OPERATOR_ADDRESS, OPERATOR_NAME, dmcaAgentToShow } from "@/lib/legal";
import { SUPPORT_EMAIL } from "@/lib/site";

export const metadata = { title: "Copyright and takedowns — Folio" };

export default function CopyrightPolicyPage() {
  const agent = dmcaAgentToShow();
  return (
    <>
      <h1>Copyright and takedowns</h1>
      <p>
        Folio respects creators’ rights and responds to notices under the US Digital Millennium Copyright Act (DMCA),
        17 U.S.C. § 512. We don’t review every photo before it goes up, so we rely on notices like these.
      </p>

      <h2>If your work is on a Folio site without permission</h2>
      <p>
        Send a notice with our <Link href="/report/copyright">copyright form</Link>, or by email or post to our
        designated agent (below). The law sets out what a notice needs, and we ask for:
      </p>
      <ul>
        <li>your physical or electronic signature (a typed full name works);</li>
        <li>the work you own, described or linked;</li>
        <li>where the copy is on the Folio site, with page or photo addresses;</li>
        <li>your name, mailing address, phone and email;</li>
        <li>a statement that you believe in good faith the use isn’t authorised by you, your agent or the law;</li>
        <li>
          a statement that the notice is accurate and, under penalty of perjury, that you own the right or may act for
          the owner.
        </li>
      </ul>
      <p>
        When a notice is complete, we take the material down promptly and email the site’s owner the notice’s
        details, without your mailing address and phone. Your name and email stay in it so they can reply to you. If a notice
        is missing something, we’ll ask you for it.
      </p>
      <p>
        Knowingly sending a false notice can make you liable for damages (17 U.S.C. § 512(f)). If you’re not sure the
        use is infringing, for example because it may be fair use, consider getting advice first.
      </p>

      <h2>If your photo was taken down</h2>
      <p>
        If you believe it was removed by mistake or because it was misidentified, you can send a counter-notice by
        replying to our email, or to our designated agent. It must include:
      </p>
      <ul>
        <li>your physical or electronic signature;</li>
        <li>which photos were removed and where they were on your site;</li>
        <li>
          a statement, under penalty of perjury, that you believe in good faith they were removed by mistake or
          misidentification;
        </li>
        <li>your name, address and phone number;</li>
        <li>
          a statement that you consent to the jurisdiction of the federal district court for the district where your
          address is (or, if you’re outside the US, any district where Folio may be found), and that you’ll accept
          service of process from the person who sent the notice or their agent.
        </li>
      </ul>
      <p>
        We send a complete counter-notice, including your contact details, to the person who sent the notice, and tell
        them the photos will be back in 10 business days. Unless they tell us within that time that they’ve gone to
        court to stop you, we put the photos back between 10 and 14 business days after we received your
        counter-notice. You may want to talk to a lawyer before sending one.
      </p>

      <h2>Repeat infringers</h2>
      <p>
        Each notice we act on adds a strike to the account. At {STRIKE_LIMIT} strikes we take the site offline, and we
        close accounts that keep infringing. A strike is removed if a valid counter-notice leads to the photos being put
        back.
      </p>

      <h2>Designated agent</h2>
      {agent ? (
        <p>
          {agent.name}
          {agent.organization ? (
            <>
              <br />
              {agent.organization}
            </>
          ) : null}
          <br />
          {agent.address}
          {agent.phone ? (
            <>
              <br />
              {agent.phone}
            </>
          ) : null}
          <br />
          <a href={`mailto:${agent.email}`}>{agent.email}</a>
          {agent.registration ? (
            <>
              <br />
              US Copyright Office registration {agent.registration}
            </>
          ) : null}
        </p>
      ) : (
        <p>
          Notices can also be sent to: <a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a>, or by post to{" "}
          {OPERATOR_NAME}, {OPERATOR_ADDRESS}.
        </p>
      )}
      <p>
        Other problems with a site? Use the <Link href="/report">general report form</Link>.
      </p>
    </>
  );
}
