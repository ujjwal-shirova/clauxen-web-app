import type { Metadata } from "next";
import {
  MarketingPlaceholder,
  marketingPlaceholderMetadata,
} from "../_components/marketing-placeholder";

export const metadata: Metadata = marketingPlaceholderMetadata(
  "Business",
  "Clauxen for business — teams, enterprises, and organizations.",
);

export default function BusinessPage() {
  return (
    <MarketingPlaceholder
      eyebrow="Business"
      title="Clauxen for Business"
      description="Bring Clauxen to your organization with shared workspaces, admin controls, and enterprise-grade security."
    />
  );
}
