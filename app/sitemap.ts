import type { MetadataRoute } from "next";

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    { url: "https://tegami.avapp.in", lastModified: new Date() },
    { url: "https://tegami.avapp.in/welcome", lastModified: new Date() },
  ];
}