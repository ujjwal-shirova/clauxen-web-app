import type { Metadata } from "next";

export const metadata: Metadata = { title: "Connectors - Clauxen" };

export default function ConnectorsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
