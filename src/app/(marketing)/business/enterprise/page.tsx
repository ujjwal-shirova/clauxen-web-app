import type { Metadata } from "next";
import {
  MarketingPlaceholder,
  marketingPlaceholderMetadata,
} from "../../_components/marketing-placeholder";

export const metadata: Metadata = marketingPlaceholderMetadata(
  "Enterprise",
  "Clauxen Enterprise — advanced security, privacy, and scale.",
);

export default function EnterprisePage() {
  return (
    <MarketingPlaceholder
      eyebrow="Business"
      title="Enterprise"
      description="Advanced security, privacy, and deployment options at scale, with dedicated support and custom agreements."
    />
  );
}
