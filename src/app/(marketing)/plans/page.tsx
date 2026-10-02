import type { Metadata } from "next";
import {
  MarketingPlaceholder,
  marketingPlaceholderMetadata,
} from "../_components/marketing-placeholder";

export const metadata: Metadata = marketingPlaceholderMetadata(
  "Plans",
  "Compare Clauxen plans for personal use, business, and enterprise.",
);

export default function PlansIndexPage() {
  return (
    <MarketingPlaceholder
      eyebrow="Pricing"
      title="Plans and pricing"
      description="Clauxen is available in various plans for personal use and for business and enterprise."
    />
  );
}
