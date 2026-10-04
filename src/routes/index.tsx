import { createFileRoute } from "@tanstack/react-router";
import { ClientOnly } from "@tanstack/react-router";
import { lazy, Suspense } from "react";

const Game = lazy(() => import("@/components/Game"));

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "UNDERWORLD: City of Shadows" },
      { name: "description", content: "Noir gangster action game prototype. Fight, earn cash, buy weapons." },
      { property: "og:title", content: "UNDERWORLD: City of Shadows" },
      { property: "og:description", content: "Noir gangster action game prototype for mobile." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Index,
});

function Index() {
  return (
    <ClientOnly fallback={<div className="h-dvh bg-background" />}>
      <Suspense fallback={<div className="h-dvh bg-background" />}>
        <Game />
      </Suspense>
    </ClientOnly>
  );
}
