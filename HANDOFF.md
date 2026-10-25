# Handoff

**Status: phase 1 committed (9cd0616 on `folio-plus`, not pushed); waiting on the owner for the Resend setup**

**Goal:** Folio+ inquiries and bookings (docs/folio-plus/inquiries-and-bookings.md). The owner approved the commit and the in.folio.cam subdomain for incoming replies.

**Done (phase 1, committed):**
- **Sending replies:** lib/email.ts takes fromName and headers. app/actions/clients.ts has sendReply, setStage, markConversationRead, saveInquiryForm, and simulateClientReply (dev only).
- **Receiving replies:** lib/inbound.ts (reply addresses, Svix signature check, removing quoted text, Resend fetch, receiveEmail/saveReply) and the app/api/email/inbound route.
- **Data layer:** lib/db.ts has addMessage, conversationThread, conversationByReplyToken, hasEmailMessage, setConversationStage. Conversations store their kind.
- **Clients pages:** real data, with ?sample=1 for the samples (clients/load.ts). The conversation view sends real replies.
- **Custom contact forms:** lib/inquiry-form.ts (presets, checks). The Offerings "Contact form" editor is real. contact-form.tsx renders site.contactFields. sendInquiry checks answers against the owner's form (onPlus in lib/plans.ts).
- **Tests and checks:** tests/clients.test.ts. npm test (312 passing), tsc, lint and build pass. Checked in Chrome: reply, simulated answer, saving the form, and the form on the public site.

**Waiting on the owner (steps to give them):**
1. In Resend, add the domain in.folio.cam, turn on receiving, and send the DNS records shown.
2. Then Claude adds them in Vercel DNS (team team_Qheb4RdVkn8rmIXUBLI1NLJq). Root folio.cam MX records are ImprovMX; don't touch those.
3. In Resend, create a webhook to https://folio.cam/api/email/inbound for email.received and copy its signing secret.
4. In Vercel, set the env vars INBOUND_EMAIL_DOMAIN=in.folio.cam and RESEND_WEBHOOK_SECRET.
5. Merge or deploy.

**Gotchas:**
- Resend's receiving docs may call it a private beta; the owner's account needs access.
- Site addresses must be at least 3 characters, so "in" can't be claimed as a photographer's site.
- The dev server runs with ADMIN_EMAILS=claude-verify@example.test, and Chrome had been signed in to another local account.
- Restart the dev server after schema changes.
