import type { Metadata } from "next";

export const metadata: Metadata = { title: "Automations - Clauxen" };

export default function AutomationsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
