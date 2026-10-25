// Error reporting through Sentry, shared by the server (instrumentation.ts)
// and the browser (instrumentation-client.ts). It only runs when
// NEXT_PUBLIC_SENTRY_DSN is set (production on Vercel), so development and
// tests never send anything.
import type { BrowserOptions } from "@sentry/nextjs";

export const SENTRY_DSN = process.env.NEXT_PUBLIC_SENTRY_DSN;

export const sentryOptions: BrowserOptions = {
  dsn: SENTRY_DSN,
  enabled: Boolean(SENTRY_DSN),
  environment: process.env.VERCEL_ENV ?? process.env.NODE_ENV,
  // Errors only for now: performance tracing would use up the free plan.
  tracesSampleRate: 0,
  // Send the error and where it happened, nothing personal: no login
  // cookies, no form contents (passwords, inquiries), no query strings
  // (reset links carry their token there), no database values.
  dataCollection: {
    userInfo: false,
    cookies: false,
    httpHeaders: { allow: ["user-agent", "referer"] },
    httpBodies: [],
    urlQueryParams: false,
    databaseQueryData: false,
  },
};
