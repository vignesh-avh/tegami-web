import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/cart", "/profile", "/owner", "/myshop", "/coins", "/login", "/signup"],
    },
    sitemap: "https://tegami.avapp.in/sitemap.xml",
  };
}