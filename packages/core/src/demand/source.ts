const HOST_TAGS: Record<string, string> = {
  "news.ycombinator.com": "hn",
  "reddit.com": "reddit",
  "twitter.com": "x",
  "x.com": "x",
  "github.com": "github",
};

/** Normalize a campaign ref (preferred) or referrer host into a short source tag; null if neither. */
export function normalizeSource(ref: string | null, referrerHost: string | null): string | null {
  if (ref) {
    const tag = ref
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 32);
    if (tag) return tag;
  }
  if (referrerHost) {
    const host = referrerHost.trim().toLowerCase().replace(/^www\./, "");
    if (host) return HOST_TAGS[host] ?? host;
  }
  return null;
}
