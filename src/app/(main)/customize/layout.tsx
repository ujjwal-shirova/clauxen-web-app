import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Customize - Clauxen",
};

export default function CustomizeLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
