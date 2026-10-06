import type { MetadataRoute } from "next";
import { CONTENT_UPDATED, SITE_URL } from "@/content/site";

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    { url: `${SITE_URL}/`, lastModified: CONTENT_UPDATED, changeFrequency: "monthly", priority: 1 },
    { url: `${SITE_URL}/mentions-legales`, lastModified: CONTENT_UPDATED, changeFrequency: "yearly", priority: 0.2 },
  ];
}
