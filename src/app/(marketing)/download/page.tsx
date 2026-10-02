import type { Metadata } from "next";
import {
  MarketingPlaceholder,
  marketingPlaceholderMetadata,
} from "../_components/marketing-placeholder";

export const metadata: Metadata = marketingPlaceholderMetadata(
  "Download",
  "Download the Clauxen app for desktop and mobile.",
);

export default function DownloadPage() {
  return (
    <MarketingPlaceholder
      eyebrow="Download"
      title="Get the Clauxen app"
      description="Available on macOS, Windows, iOS, and Android — with everything synced across your devices."
    />
  );
}
