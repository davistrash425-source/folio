// What photographers are told when Folio takes something down or puts it
// back (app/actions/admin.ts). The counter-notice steps follow 17 U.S.C.
// § 512(g). Have a lawyer review any change to this wording.
import type { SavedReport } from "./db";

type Email = { subject: string; text: string };

const photos = (count: number) => (count === 1 ? "1 photo" : `${count} photos`);

// After photos are taken down. With a copyright notice, the photographer gets
// its contents (but not the sender's address or phone) and how to answer it.
export function takedownEmail(o: { name: string; siteUrl: string; count: number; report?: SavedReport | null; note?: string }): Email {
  const notice = o.report?.reason === "copyright" ? o.report : null;
  if (!notice) {
    return {
      subject: "We took down photos on your Folio site",
      text: `Hi ${o.name},

We've taken down ${photos(o.count)} from your Folio site (${o.siteUrl}) because ${o.note || "they break Folio's rules"}. They no longer appear on your site.

If you think this is a mistake, reply to this email.

— Folio`,
    };
  }
  const n = notice.notice;
  const details = n
    ? [
        `From: ${n.organization ? `${n.name} (${n.organization})` : n.name}`,
        ...(n.role === "agent" ? [`Acting for the copyright owner: ${n.ownerName}`] : []),
        `Email: ${n.email}`,
        `Their original work: ${n.work}`,
        `Where they say it appears:\n${n.urls.map((url) => `- ${url}`).join("\n")}`,
      ].join("\n")
    : notice.details;
  return {
    subject: "We took down photos on your Folio site after a copyright notice",
    text: `Hi ${o.name},

We received a copyright notice about your Folio site (${o.siteUrl}), and we've taken down the ${photos(o.count)} it names. They no longer appear on your site.

THE NOTICE

${details}

IF YOU THINK THIS IS A MISTAKE

If you have permission to use these photos, or the notice names the wrong photos, you can send us a counter-notice by replying to this email. You may want to talk to a lawyer first. Under US law (17 U.S.C. § 512(g)) it must include:

1. Your signature. Typing your full name is enough.
2. Which photos were taken down, and where they appeared on your site.
3. This statement: "I swear, under penalty of perjury, that I have a good faith belief that the material was removed or disabled as a result of mistake or misidentification of the material to be removed or disabled."
4. Your name, address and phone number, and this statement: "I consent to the jurisdiction of the Federal District Court for the judicial district in which my address is located, or, if my address is outside of the United States, for any judicial district in which Folio may be found, and I will accept service of process from the person who provided the notice or an agent of such person."

We'll send your counter-notice, including your contact details, to the person who sent the notice. Unless they tell us within 10 business days that they've filed a court action against you, we'll put the photos back 10 to 14 business days after we receive your counter-notice.

Under Folio's repeat-infringer policy, accounts that receive repeated valid copyright notices are closed.

— Folio`,
  };
}

export function restoredEmail(o: { name: string; siteUrl: string; count: number }): Email {
  return {
    subject: "Your photos are back on your Folio site",
    text: `Hi ${o.name},

We've put back ${photos(o.count)} that we had taken down from your Folio site (${o.siteUrl}).

— Folio`,
  };
}

export function suspendedEmail(o: { name: string; siteUrl: string; reason: string }): Email {
  return {
    subject: "Your Folio site is offline",
    text: `Hi ${o.name},

We've taken your Folio site (${o.siteUrl}) offline because ${o.reason}. Visitors can't see it. You can still sign in to download your photos and everything else in your account.

If you think this is a mistake, reply to this email.

— Folio`,
  };
}

export function unsuspendedEmail(o: { name: string; siteUrl: string }): Email {
  return {
    subject: "Your Folio site is back",
    text: `Hi ${o.name},

We've lifted the suspension on your Folio site (${o.siteUrl}). If your site is set to online in your dashboard, visitors can see it again.

— Folio`,
  };
}
