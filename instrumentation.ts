import * as Sentry from "@sentry/nextjs";
import { sentryOptions } from "@/lib/sentry";

// Runs once when a server instance starts (lib/sentry.ts has the settings).
export function register() {
  Sentry.init(sentryOptions);
}

// Reports errors thrown while the server renders a page or runs an action.
export const onRequestError = Sentry.captureRequestError;
