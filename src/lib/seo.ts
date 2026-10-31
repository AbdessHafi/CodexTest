import type { Metadata } from "next";
import type { Venue } from "./demo";
import type { summarize } from "./reviews/policy";
export const siteUrl = () =>
  new URL(process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000").origin;
export const slugify = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
export function pageMetadata(
  title: string,
  description: string,
  path: string,
  noindex = false,
): Metadata {
  return {
    title,
    description,
    alternates: { canonical: `${siteUrl()}${path}` },
    robots: { index: !noindex, follow: true },
    openGraph: {
      title,
      description,
      url: `${siteUrl()}${path}`,
      locale: "fr_FR",
      siteName: "Pause Café",
      type: "website",
    },
    twitter: { card: "summary", title, description },
  };
}
export const safeJson = (value: unknown) =>
  JSON.stringify(value)
    .replace(/</g, "\\u003c")
    .replace(/\u2028/g, "\\u2028")
    .replace(/\u2029/g, "\\u2029");
export function venueStructuredData(
  v: Venue,
  summary: ReturnType<typeof summarize>,
) {
  return {
    "@context": "https://schema.org",
    "@type": v.type === "Brunch" ? "Restaurant" : "CafeOrCoffeeShop",
    "@id": `${siteUrl()}/lieux/${v.slug}#venue`,
    url: `${siteUrl()}/lieux/${v.slug}`,
    name: v.name,
    description: v.description,
    address: {
      "@type": "PostalAddress",
      streetAddress: v.address,
      addressLocality: v.city,
      addressCountry: "FR",
    },
    geo: {
      "@type": "GeoCoordinates",
      latitude: v.latitude,
      longitude: v.longitude,
    },
    priceRange: "€".repeat(v.price),
    ...(v.source !== "DEMO" && summary.count
      ? {
          aggregateRating: {
            "@type": "AggregateRating",
            ratingValue: Number(summary.average.toFixed(1)),
            reviewCount: summary.count,
            bestRating: 5,
            worstRating: 1,
          },
        }
      : {}),
  };
}
export function cityGroups(venues: Venue[]) {
  return [...new Set(venues.map((v) => v.city))].map((city) => ({
    name: city,
    slug: slugify(city),
    neighborhoods: [
      ...new Set(
        venues
          .filter((v) => v.city === city)
          .map((v) => v.neighborhood)
          .filter(Boolean),
      ),
    ].map((name) => ({ name, slug: slugify(name) })),
  }));
}
