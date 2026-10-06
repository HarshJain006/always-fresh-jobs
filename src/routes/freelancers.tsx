import { ClientOnly, createFileRoute } from "@tanstack/react-router";
import { lazy, Suspense } from "react";
import "../../find-my-freelance-map/src/styles.css";

const AtlasworkPage = lazy(() =>
  import("../../find-my-freelance-map/src/routes/index").then((module) => ({ default: module.AtlasworkPage })),
);

export const Route = createFileRoute("/freelancers")({
  head: () => ({
    meta: [
      { title: "Atlaswork | Freelancers Around the World" },
      { name: "description", content: "Explore independent professionals, their services, skills, availability, and pricing on the Atlaswork freelancer map." },
      { name: "robots", content: "index, follow, max-image-preview:large" },
      { property: "og:title", content: "Atlaswork | Freelancers Around the World" },
      { property: "og:description", content: "Explore a live map of independent professionals and their services." },
      { property: "og:type", content: "website" },
      { property: "og:url", content: "https://dailyresume.in/freelancers" },
      { name: "twitter:card", content: "summary" },
    ],
    links: [{ rel: "canonical", href: "https://dailyresume.in/freelancers" }],
    scripts: [
      {
        type: "application/ld+json",
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "CollectionPage",
          name: "Atlaswork Freelancer Directory",
          url: "https://dailyresume.in/freelancers",
          description: "Explore independent freelancers worldwide by service, skill, availability, and location.",
          isPartOf: { "@type": "WebSite", name: "DailyResume", url: "https://dailyresume.in/" },
          about: { "@type": "Thing", name: "Freelancing and independent professionals" },
        }),
      },
    ],
  }),
  component: FreelancersRoute,
})

function FreelancersRoute() {
  return (
    <ClientOnly fallback={<div className="grid h-screen place-items-center bg-background text-muted-foreground">Loading Atlaswork...</div>}>
      <Suspense fallback={<div className="grid h-screen place-items-center bg-background text-muted-foreground">Loading Atlaswork...</div>}>
        <AtlasworkPage />
      </Suspense>
    </ClientOnly>
  );
}
