import type { MetadataRoute } from "next";
import { GUIDES } from "@/content/guides";
import { CONTENT_UPDATED, SITE_URL } from "@/content/site";

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    { url: `${SITE_URL}/`, lastModified: CONTENT_UPDATED, changeFrequency: "monthly", priority: 1 },
    { url: `${SITE_URL}/calculateur-budget-cheval`, lastModified: CONTENT_UPDATED, changeFrequency: "monthly", priority: 0.8 },
    { url: `${SITE_URL}/guides`, lastModified: CONTENT_UPDATED, changeFrequency: "monthly", priority: 0.7 },
    ...GUIDES.map((g) => ({
      url: `${SITE_URL}/guides/${g.slug}`,
      lastModified: g.updated,
      changeFrequency: "monthly" as const,
      priority: 0.7,
    })),
    { url: `${SITE_URL}/mentions-legales`, lastModified: CONTENT_UPDATED, changeFrequency: "yearly", priority: 0.2 },
  ];
}
