import { createFileRoute } from "@tanstack/react-router";
import { EarthExplorer } from "@/components/EarthExplorer";

export const Route = createFileRoute("/")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Earth Explorer — 3D Globe & Detailed World Map" },
      { name: "description", content: "Explore a rotating 3D Earth and a detailed interactive world map. Find cities worldwide and search for places using OpenStreetMap data." },
      { property: "og:title", content: "Earth Explorer — 3D Globe & Detailed World Map" },
      { property: "og:description", content: "Explore a rotating 3D Earth, find cities worldwide, and navigate a detailed map." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: EarthExplorer,
});
