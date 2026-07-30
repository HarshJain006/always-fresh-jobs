import { createFileRoute } from "@tanstack/react-router";
import type {} from "@tanstack/react-start";

const BASE_URL = (
  process.env.VITE_APP_URL ||
  process.env.URL ||
  "https://dailyresume.in"
).replace(/\/$/, "");

interface SitemapEntry {
  path: string;
  changefreq?: "always" | "hourly" | "daily" | "weekly" | "monthly" | "yearly" | "never";
  priority?: string;
}

export const Route = createFileRoute("/sitemap.xml")({
  server: {
    handlers: {
      GET: async () => {
        const lastmod = new Date().toISOString().slice(0, 10);
        const entries: SitemapEntry[] = [
          { path: "/", changefreq: "weekly", priority: "1.0" },
          { path: "/pricing", changefreq: "monthly", priority: "0.8" },
          { path: "/login", changefreq: "yearly", priority: "0.5" },
        ];
        const urls = entries.map(
          (e) =>
            [
              `  <url>`,
              `    <loc>${BASE_URL}${e.path === "/" ? "/" : e.path}</loc>`,
              `    <lastmod>${lastmod}</lastmod>`,
              e.changefreq ? `    <changefreq>${e.changefreq}</changefreq>` : "",
              e.priority ? `    <priority>${e.priority}</priority>` : "",
              `  </url>`,
            ]
              .filter(Boolean)
              .join("\n"),
        );
        const xml = [
          `<?xml version="1.0" encoding="UTF-8"?>`,
          `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">`,
          ...urls,
          `</urlset>`,
          ``,
        ].join("\n");
        return new Response(xml, {
          headers: {
            "Content-Type": "application/xml; charset=utf-8",
            "Cache-Control": "public, max-age=3600",
          },
        });
      },
    },
  },
});
