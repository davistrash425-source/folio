"use client";

import * as Sentry from "@sentry/nextjs";
import { useEffect } from "react";

// Shown when even the root layout fails. It replaces the whole page, so it
// carries its own <html>, <body> and styles, and reports the error to Sentry.
export default function GlobalError({ error, retry }: { error: unknown; retry: () => void }) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          display: "grid",
          placeItems: "center",
          background: "#f2efe8",
          color: "#1c1a17",
          fontFamily: "Georgia, 'Times New Roman', serif",
          textAlign: "center",
          padding: "24px",
        }}
      >
        <title>Something went wrong — Folio</title>
        <main>
          <h1 style={{ fontSize: "2.25rem", fontWeight: 400, margin: 0 }}>Something went wrong</h1>
          <p style={{ fontFamily: "system-ui, sans-serif", color: "#6b655c", margin: "12px 0 24px" }}>
            We&rsquo;ve been told about it. Please try again.
          </p>
          <button
            type="button"
            onClick={() => retry()}
            style={{
              fontFamily: "system-ui, sans-serif",
              fontSize: "0.9rem",
              background: "#1c1a17",
              color: "#f2efe8",
              border: 0,
              padding: "12px 24px",
              cursor: "pointer",
            }}
          >
            Try again
          </button>
        </main>
      </body>
    </html>
  );
}
