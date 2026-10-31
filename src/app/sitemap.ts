import type { MetadataRoute } from "next";
import { getVenues } from "@/lib/venues";
import { siteUrl, cityGroups } from "@/lib/seo";
export const dynamic = "force-dynamic";
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const venues = (await getVenues()).filter(
    (v) => !["DEMO", "TEST"].includes(v.source),
  );
  const base = siteUrl();
  return [
    { url: base, changeFrequency: "weekly", priority: 1 },
    {
      url: `${base}/avis-et-moderation`,
      changeFrequency: "monthly",
      priority: 0.3,
    },
    ...venues.map((v) => ({
      url: `${base}/lieux/${v.slug}`,
      changeFrequency: "weekly" as const,
      priority: 0.8,
    })),
    ...cityGroups(venues).flatMap((c) => [
      {
        url: `${base}/villes/${c.slug}`,
        changeFrequency: "weekly" as const,
        priority: 0.7,
      },
      ...c.neighborhoods.map((n) => ({
        url: `${base}/villes/${c.slug}/${n.slug}`,
        changeFrequency: "weekly" as const,
        priority: 0.6,
      })),
    ]),
  ];
}
