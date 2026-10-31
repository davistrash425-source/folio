// Headers sent with every page (next.config.ts).
//
// Enforced: the content policy (which scripts, images and connections are
// allowed, and that the site can't be framed by another site), HTTPS is
// remembered for two years, and the usual browser hardening. It was checked
// report-only on folio.cam first (Oct 25, 2026).
type Env = Record<string, string | undefined>;

const origin = (url: string | undefined) => {
  try {
    return url ? new URL(url).origin : undefined;
  } catch {
    return undefined;
  }
};

// https://<key>@o123.ingest.de.sentry.io/456 -> https://o123.ingest.de.sentry.io
const sentryOrigin = (dsn: string | undefined) => {
  try {
    return dsn ? `https://${new URL(dsn).host}` : undefined;
  } catch {
    return undefined;
  }
};

export function contentPolicy(env: Env) {
  const photos = origin(env.R2_PUBLIC_URL);
  const uploads = env.R2_ACCOUNT_ID ? `https://*.r2.cloudflarestorage.com` : undefined;
  const turnstile = "https://challenges.cloudflare.com";
  const list = (...parts: (string | undefined)[]) => parts.filter(Boolean).join(" ");
  return [
    "default-src 'self'",
    // Next.js adds small inline scripts to every page, and the nonce/hash
    // alternatives don't work with this app's partial prerendering (see the
    // Next 16 Content Security Policy guide), so 'unsafe-inline' stays for now.
    `script-src ${list("'self'", "'unsafe-inline'", turnstile)}`,
    "style-src 'self' 'unsafe-inline'",
    `img-src ${list("'self'", "data:", "blob:", photos)}`,
    "font-src 'self' data:",
    `connect-src ${list("'self'", photos, uploads, sentryOrigin(env.NEXT_PUBLIC_SENTRY_DSN), turnstile)}`,
    `frame-src ${list("'self'", turnstile)}`,
    "worker-src 'self' blob:",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'self'",
  ].join("; ");
}

export function securityHeaders(env: Env = process.env) {
  return [
    // The editor's preview is the site in an iframe on the same address.
    { key: "Content-Security-Policy", value: contentPolicy(env) },
    { key: "X-Frame-Options", value: "SAMEORIGIN" },
    { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" },
    { key: "X-Content-Type-Options", value: "nosniff" },
    { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
    { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=()" },
  ];
}
