import type { MetadataRoute } from "next";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  // Fetch shop IDs from the backend
  const res = await fetch("https://api.avapp.in/public/sitemap-urls");

  const staticRoutes = [
    { url: "https://tegami.avapp.in", lastModified: new Date() },
    { url: "https://tegami.avapp.in/welcome", lastModified: new Date() },
  ];

  if (!res.ok) {
    return staticRoutes;
  }

  const data = await res.json();
  const shopRoutes = (data.shops || []).map((s: { id: string, updated_at: string }) => ({
    url: `https://tegami.avapp.in/shop/${s.id}`,
    lastModified: s.updated_at ? new Date(s.updated_at) : new Date(),
  }));

  return [...staticRoutes, ...shopRoutes];
}
