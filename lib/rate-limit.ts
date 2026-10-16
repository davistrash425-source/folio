// A simple in-memory sliding-window rate limiter. It resets when the server
// restarts and isn't shared between instances, so use a shared store (Redis,
// Upstash, your database) once the app runs on more than one server.
import { headers } from "next/headers";

const hits = new Map<string, number[]>();

// Records an attempt for `key` and returns false once there have been more
// than `limit` attempts within `windowMs`.
export function rateLimit(key: string, limit: number, windowMs: number) {
  const now = Date.now();
  const recent = (hits.get(key) ?? []).filter((t) => t > now - windowMs);
  recent.push(now);
  hits.set(key, recent);
  if (hits.size > 10_000) {
    for (const [k, times] of hits) if (times.every((t) => t <= now - windowMs)) hits.delete(k);
  }
  return recent.length <= limit;
}

export async function clientIp() {
  const h = await headers();
  return h.get("x-forwarded-for")?.split(",")[0].trim() || h.get("x-real-ip") || "local";
}
