import type { Metadata } from "next";
import { OverviewExperience } from "@/marketing/components/overview/overview-experience";

export const metadata: Metadata = {
  title: {
    absolute: "Overview - Clauxen",
  },
  description:
    "One workspace to chat, work, and code. Clauxen keeps conversation, deliverables, and coding agents together — by Shirova AI.",
};

export default function OverviewPage() {
  return <OverviewExperience />;
}
