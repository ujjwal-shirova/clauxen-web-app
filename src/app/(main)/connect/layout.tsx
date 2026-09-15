import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Connect - Clauxen",
};

export default function ConnectLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
