"use client";

import dynamic from "next/dynamic";
import { AppContentLoader } from "@/components/app-content-loader";

export { ProjectsView } from "@/components/projects/projects-view";

const MarketplaceView = dynamic(
  () =>
    import("@/components/plugins/marketplace-view").then(
      (mod) => mod.MarketplaceView,
    ),
  { loading: () => <AppContentLoader label="Opening plugins" /> },
);

export function PluginsView() {
  return <MarketplaceView />;
}
