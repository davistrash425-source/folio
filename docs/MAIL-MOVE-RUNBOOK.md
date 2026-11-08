# Moving folio.cam's incoming mail to Resend

**Status: not done. Nothing here has been run.** It needs the owner's yes on decision 3 (real `name@folio.cam` addresses), and the code in this branch live first.

Why it's a single step: a domain's mail goes to its MX records, and Resend warns that mixing its record with another provider's breaks or splits delivery. So all of folio.cam's mail moves at once.

## Where things stand (checked Nov 8, 2026)

| Record | Value today |
| --- | --- |
| `folio.cam` MX | `mx1.improvmx.com` (10), `mx2.improvmx.com` (20) |
| `folio.cam` TXT | `v=spf1 include:spf.improvmx.com ~all` |
| `_dmarc.folio.cam` | none |
| `send.folio.cam` | Resend's return path, with its own SPF and MX |
| `resend._domainkey.folio.cam` | present |

DNS is hosted at Vercel.

## Before the day

1. **List every address ImprovMX handles** and where each goes (ImprovMX dashboard; owner). `support@` at least. Anything missed stops arriving.
2. **Run `npm run audit-mail-names` against production** (owner, since Vercel's Sensitive variables can't be read back). It lists accounts whose address is a reserved name like `admin`. Decide what to do about each.
3. **Merge and deploy** the phase 3 code. It does nothing until the variables below are set.
4. **Set these in Vercel Production** and redeploy:

   | Variable | Value |
   | --- | --- |
   | `MAIL_SYSTEM_FORWARDS` | `support=<owner's inbox>`, `postmaster=...`, `abuse=...`, plus each address from step 1, comma-separated. Only reserved names can be forwarded |
   | `MAIL_WEBHOOK_SECRET` | from step 5 |

   **Not `MAIL_DOMAIN` yet.** It goes in on the day (step 9), or photographers could send from addresses that can't receive replies. Confirm `RESEND_API_KEY` can read received email, not only send: a send-only key makes every event fail.
5. **In Resend:** add a webhook for `email.received` to `https://www.folio.cam/api/webhooks/mail`, and copy its signing secret.
6. **Test the whole path on a subdomain first.** Enable receiving on a throwaway subdomain such as `mailtest.folio.cam`, with **its own Resend webhook and signing secret** pointing at a test deployment (reachable past Vercel's deployment protection) that has `MAIL_DOMAIN=mailtest.folio.cam` and its own `MAIL_WEBHOOK_SECRET`, `RESEND_API_KEY` and `MAIL_SYSTEM_FORWARDS`. Previews share production's database, so use one throwaway account, and know its mailbox row stays forever. Send real mail from outside (Gmail and one other). Check: a message to a test mailbox appears in its Inbox, a message to `support@` is forwarded with its attachment, and replying to the forward reaches the original sender. Then set `MAIL_DOMAIN` back.
7. **Give Folio's own mail its own sender.** Verify `notify.folio.cam` in Resend, add its DNS records, then change `EMAIL_FROM` to `Folio <hello@notify.folio.cam>` and set `EMAIL_REPLY_TO` to an address that receives mail, since `notify.folio.cam` doesn't. Do this before photographers can send, so a photographer's bad sending can't hurt password resets. Send a test password reset.
8. **Lower the MX record's lifetime** to 300 seconds, at least a day ahead.

## On the day (needs the owner's go-ahead that day)

9. Set `MAIL_DOMAIN=folio.cam` in Vercel Production and redeploy. In Resend, turn on receiving for `folio.cam` and copy the MX record it shows.
10. In Vercel DNS, replace the two ImprovMX MX records with Resend's. Write down the old values first.
11. Remove `include:spf.improvmx.com` from the root SPF, keeping anything else that sends from the root domain. Resend's mail authenticates through DKIM and the `send.folio.cam` return path, so it needs nothing here; **check the Resend dashboard**. If anyone sends through ImprovMX's SMTP, that stops now.
12. Add a DMARC record that only reports: `_dmarc.folio.cam` TXT `v=DMARC1; p=none; rua=mailto:<an address @folio.cam>`. A report address on another domain needs that domain's authorization record, or no reports arrive.

## Check straight after

13. From outside Folio, send real mail to `support@` and every address from step 1, then to a test photographer's address. Check each arrives, within a few minutes.
14. Reply to one forwarded message, and check the reply reaches the original sender.
15. Send a password reset and a site inquiry, and check they still arrive.

## If any of that fails

Remove `MAIL_DOMAIN`, then put the two ImprovMX MX records and the old SPF back. Leave the ImprovMX account untouched for 30 days so this always works. With a 300-second lifetime, routing recovers in minutes. Mail Resend already accepted is **not** retried by the sender: in Resend, list what was received during the window and re-deliver those webhook events, once the problem is fixed.

## Afterwards

- Raise the MX lifetime back up.
- After a few weeks of clean DMARC reports, move DMARC to `p=quarantine`.
- Cancel ImprovMX after 30 quiet days.
