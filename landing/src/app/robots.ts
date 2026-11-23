import type { MetadataRoute } from "next";
import { LANDING_URL as LANDING } from "@/api/http";

// docs/SEO.md. The user site (web.zotdor.uz) has its own robots.txt and sitemap.
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [{ userAgent: "*", allow: "/" }],
    sitemap: `${LANDING}/sitemap.xml`,
    host: LANDING,
  };
}
