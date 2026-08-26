import type { Metadata } from "next";

export const metadata: Metadata = { title: "Plugins - Clauxen" };

export default function PluginsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
