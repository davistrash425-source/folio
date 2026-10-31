// Purges Cloudflare's edge cache for specific photo addresses. Web copies are
// marked immutable and the photo domain (img.foliocdn.com) is cached at the
// edge for a day, so deleting a taken-down photo's files isn't enough on its
// own: the cached copy must be purged too. Without the token and zone — in
// development and tests — it does nothing, like the other swappable services.
const API = "https://api.cloudflare.com/client/v4";

export async function purgeCache(urls: string[]) {
  const token = process.env.CLOUDFLARE_PURGE_TOKEN;
  const zone = process.env.CLOUDFLARE_PURGE_ZONE_ID;
  if (!token || !zone || urls.length === 0) return;
  try {
    const res = await fetch(`${API}/zones/${zone}/purge_cache`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ files: urls }),
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) console.error("Cloudflare purge failed", res.status);
  } catch (err) {
    console.error("Cloudflare purge failed", err);
  }
}
