import type { Metadata } from "next";
import {
  MarketingPlaceholder,
  marketingPlaceholderMetadata,
} from "../_components/marketing-placeholder";

export const metadata: Metadata = marketingPlaceholderMetadata(
  "Overview",
  "Chat, work, and code all in one place with Clauxen.",
);

export default function OverviewPage() {
  return (
    <MarketingPlaceholder
      eyebrow="Overview"
      title="Now you can chat, work & code all in one place."
      description="Get help with everyday questions and ideas, complete work tasks from start to finish, and ship code — all alongside the same assistant."
    />
  );
}
