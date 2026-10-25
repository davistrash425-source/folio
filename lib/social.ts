// Turning what someone types into a social link. Each network accepts a handle
// (with or without @) or a link on its own domain; anything else is an error
// so a typo can't send visitors somewhere unexpected. Stored values are always
// full links, so themes keep rendering them as before.

type Network = {
  label: string;
  hosts: string[];
  handle: RegExp; // what a handle may look like
  base: string; // canonical link prefix
  notProfiles?: string[]; // first path words that aren't a profile
};

const NETWORKS = {
  instagram: {
    label: "Instagram",
    hosts: ["instagram.com", "instagr.am"],
    handle: /^[A-Za-z0-9._]{1,30}$/,
    base: "https://instagram.com/",
    notProfiles: ["p", "reel", "reels", "explore", "stories", "accounts", "tv"],
  },
  twitter: {
    label: "X / Twitter",
    hosts: ["x.com", "twitter.com"],
    handle: /^[A-Za-z0-9_]{1,15}$/,
    base: "https://x.com/",
    notProfiles: ["i", "home", "search", "explore", "intent", "share", "hashtag"],
  },
  facebook: {
    label: "Facebook",
    hosts: ["facebook.com", "fb.com", "fb.me"],
    handle: /^[A-Za-z0-9.\-]{5,50}$/,
    base: "https://facebook.com/",
    notProfiles: ["sharer", "share", "dialog", "groups", "events", "watch", "marketplace"],
  },
} satisfies Record<string, Network>;

export type SocialNetwork = keyof typeof NETWORKS;

export type SocialResult = { value?: string; error?: string };

const looksLikeLink = (v: string) => /^[a-z][a-z0-9+.-]*:\/\//i.test(v) || v.includes("/") || /^www\./i.test(v);

// Reads a link, adding https:// when it's missing. Null when it isn't one.
function parseLink(raw: string): URL | null {
  try {
    const url = new URL(/^[a-z][a-z0-9+.-]*:\/\//i.test(raw) ? raw : `https://${raw}`);
    return url.protocol === "https:" || url.protocol === "http:" ? url : null;
  } catch {
    return null;
  }
}

const bareHost = (host: string) => host.toLowerCase().replace(/^(www|m|mobile|web)\./, "");

export function cleanSocial(network: SocialNetwork, input: string): SocialResult {
  const n: Network = NETWORKS[network];
  const v = input.trim();
  if (!v) return {};
  const wrong = (why: string) => ({ error: `${n.label}: ${why}` });

  let handle = v;
  if (looksLikeLink(v)) {
    const url = parseLink(v);
    if (!url) return wrong("that doesn’t look like a link.");
    if (!n.hosts.includes(bareHost(url.hostname))) {
      return wrong(`use your handle (like @yourname) or a link on ${n.hosts[0]}.`);
    }
    handle = url.pathname.split("/").filter(Boolean)[0] ?? "";
  }
  handle = handle.replace(/^@/, "");
  if (n.notProfiles?.includes(handle.toLowerCase())) return wrong("that link isn’t to a profile.");
  if (!n.handle.test(handle)) {
    return wrong("that doesn’t look like a valid handle. Use your handle (like @yourname) or a link to your profile.");
  }
  return { value: n.base + handle };
}

// Any web address; https:// is added when it's left off.
export function cleanWebsite(input: string): SocialResult {
  const v = input.trim();
  if (!v) return {};
  if (v.length > 200) return { error: "Website: that address is too long." };
  const url = parseLink(v);
  if (!url || !url.hostname.includes(".") || /\s/.test(v)) {
    return { error: "Website: enter a web address like yourname.com." };
  }
  return { value: /^https?:\/\//i.test(v) ? v : `https://${v}` };
}
