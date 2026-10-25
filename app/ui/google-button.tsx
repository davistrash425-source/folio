"use client";

import { secondaryButtonClass } from "./form";

// The "Continue with Google" link on the sign-up and log-in forms. A plain
// link to /api/auth/google/start, which bounces to Google.
export function GoogleButton() {
  return (
    <a href="/api/auth/google/start" className={`${secondaryButtonClass} w-full`}>
      Continue with Google
    </a>
  );
}
