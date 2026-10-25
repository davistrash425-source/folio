// Sliding-window rate limiting. With UPSTASH_REDIS_REST_URL and
// UPSTASH_REDIS_REST_TOKEN set, attempts are counted in Upstash Redis, so the
// limit holds across every server instance and survives restarts. Without
// them (development, tests) they're counted in this process's memory.
import { randomUUID } from "crypto";
import { headers } from "next/headers";

const hits = new Map<string, number[]>();

function inMemory(key: string, limit: number, windowMs: number) {
  const now = Date.now();
  const recent = (hits.get(key) ?? []).filter((t) => t > now - windowMs);
  recent.push(now);
  hits.set(key, recent);
  if (hits.size > 10_000) {
    for (const [k, times] of hits) if (times.every((t) => t <= now - windowMs)) hits.delete(k);
  }
  return recent.length <= limit;
}

// One sorted set per key, scored by time: drop attempts older than the
// window, add this one, count, and let Redis forget the key once it's idle.
// Runs as a single transaction (multi-exec).
async function inUpstash(url: string, token: string, key: string, limit: number, windowMs: number) {
  const now = Date.now();
  const redisKey = `rl:${key}`;
  const res = await fetch(`${url.replace(/\/+$/, "")}/multi-exec`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify([
      ["ZREMRANGEBYSCORE", redisKey, "0", String(now - windowMs)],
      ["ZADD", redisKey, String(now), `${now}-${randomUUID()}`],
      ["ZCARD", redisKey],
      ["PEXPIRE", redisKey, String(windowMs)],
    ]),
  });
  if (!res.ok) throw new Error(`Upstash answered ${res.status}`);
  const results = (await res.json()) as { result?: unknown; error?: string }[];
  const count = Number(results[2]?.result);
  if (!Number.isFinite(count)) throw new Error(`Upstash gave no count: ${JSON.stringify(results)}`);
  return count <= limit;
}

// Records an attempt for `key` and returns false once there have been more
// than `limit` attempts within `windowMs`. Refused attempts count too, so
// hammering stays blocked.
export async function rateLimit(key: string, limit: number, windowMs: number) {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return inMemory(key, limit, windowMs);
  try {
    return await inUpstash(url, token, key, limit, windowMs);
  } catch (err) {
    // If Redis is down, fall back to this server's own count rather than
    // locking everyone out of logging in.
    console.error("Rate limit store unavailable; counting in memory", err);
    return inMemory(key, limit, windowMs);
  }
}

// The visitor's address. On Vercel, x-vercel-forwarded-for and x-real-ip are
// set by Vercel itself, so a visitor can't fake them; the first
// x-forwarded-for value can be, so it's only the last resort (development).
export async function clientIp() {
  const h = await headers();
  const first = (value: string | null) => value?.split(",")[0].trim();
  return first(h.get("x-vercel-forwarded-for")) || first(h.get("x-real-ip")) || first(h.get("x-forwarded-for")) || "local";
}
