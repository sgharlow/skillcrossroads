import type { MetadataRoute } from "next";
import { allCheckDocs } from "@beacon/core";
import { gallery } from "@/lib/gallery";

export const dynamic = "force-dynamic";

function baseUrl(): string {
  return process.env.NEXT_PUBLIC_SITE_URL ?? "https://skillcrossroads.com";
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = baseUrl();
  const entries = await gallery.list({ sort: "recent" });
  const skillUrls: MetadataRoute.Sitemap = entries.map((e) => ({
    url: `${base}/s/${e.id}`,
    lastModified: e.scannedAt,
  }));
  const checkUrls: MetadataRoute.Sitemap = allCheckDocs().map((e) => ({
    url: `${base}/docs/checks/${e.id.toLowerCase()}`,
    changeFrequency: "monthly",
  }));
  return [
    { url: base, changeFrequency: "weekly" },
    { url: `${base}/guide`, changeFrequency: "monthly" },
    { url: `${base}/report`, changeFrequency: "monthly" },
    { url: `${base}/report-agents`, changeFrequency: "monthly" },
    { url: `${base}/paste`, changeFrequency: "monthly" },
    { url: `${base}/pricing`, changeFrequency: "monthly" },
    { url: `${base}/gallery`, changeFrequency: "daily" },
    { url: `${base}/docs/checks`, changeFrequency: "monthly" },
    { url: `${base}/docs/code-handling`, changeFrequency: "monthly" },
    { url: `${base}/privacy`, changeFrequency: "monthly" },
    ...checkUrls,
    ...skillUrls,
  ];
}
