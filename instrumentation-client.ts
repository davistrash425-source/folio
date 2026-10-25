import * as Sentry from "@sentry/nextjs";
import { sentryOptions } from "@/lib/sentry";

// Runs in the browser before the page becomes interactive, so errors in
// Folio's own pages and in photographers' sites reach Sentry.
Sentry.init(sentryOptions);

// Links an error to the page navigation it happened after.
export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
