"use client";

import { secondaryButtonClass } from "./form";

// The "Continue with Google" link on the sign-up and log-in forms. A plain
// link to /api/auth/google/start, which bounces to Google. It sits at the top
// of both forms so it's seen without scrolling.
export function GoogleButton() {
  return (
    <a href="/api/auth/google/start" className={`${secondaryButtonClass} w-full`}>
      Continue with Google
    </a>
  );
}

// The line between the Google button and the email form.
export function OrDivider({ children = "or" }: { children?: string }) {
  return (
    <div className="flex items-center gap-3 text-xs text-ink-faint">
      <span className="h-px flex-1 bg-rule" />
      {children}
      <span className="h-px flex-1 bg-rule" />
    </div>
  );
}
