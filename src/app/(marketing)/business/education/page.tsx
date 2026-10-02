import type { Metadata } from "next";
import {
  MarketingPlaceholder,
  marketingPlaceholderMetadata,
} from "../../_components/marketing-placeholder";

export const metadata: Metadata = marketingPlaceholderMetadata(
  "Higher Education",
  "Clauxen for universities, educators, and students.",
);

export default function EducationPage() {
  return (
    <MarketingPlaceholder
      eyebrow="Business"
      title="Higher Education"
      description="Built for universities and their students and educators, with the controls institutions need."
    />
  );
}
