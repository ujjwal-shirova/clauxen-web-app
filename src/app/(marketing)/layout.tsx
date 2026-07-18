import type { Metadata } from "next";
import "bootstrap-icons/font/bootstrap-icons.css";
import { MarketingShell } from "@/website/components/marketing-shell";

export const metadata: Metadata = {
  title: {
    default: "Clauxen",
    template: "%s - Clauxen",
  },
  description:
    "Clauxen is an AI workspace for chat, projects, agents, and tools — by Shirova AI.",
};

export default function MarketingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <MarketingShell>{children}</MarketingShell>;
}
