import type { MetadataRoute } from "next";
import { siteUrl } from "@/lib/seo";
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: [
        "/admin/",
        "/api/",
        "/compte",
        "/connexion",
        "/auth/",
        "/professionnels/",
        "/pro",
      ],
    },
    sitemap: `${siteUrl()}/sitemap.xml`,
  };
}
