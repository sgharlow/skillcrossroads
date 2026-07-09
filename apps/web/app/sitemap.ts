import type { MetadataRoute } from "next";
import { gallery } from "@/lib/gallery";

export const dynamic = "force-dynamic";

function baseUrl(): string {
  return process.env.NEXT_PUBLIC_SITE_URL ?? "https://beacon.dev";
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = baseUrl();
  const entries = await gallery.list({ sort: "recent" });
  const skillUrls: MetadataRoute.Sitemap = entries.map((e) => ({
    url: `${base}/s/${e.id}`,
    lastModified: e.scannedAt,
  }));
  return [
    { url: base, changeFrequency: "weekly" },
    { url: `${base}/pricing`, changeFrequency: "monthly" },
    { url: `${base}/gallery`, changeFrequency: "daily" },
    ...skillUrls,
  ];
}
