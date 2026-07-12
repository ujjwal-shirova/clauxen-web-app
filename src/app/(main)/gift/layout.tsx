import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Gift Clauxen · Clauxen",
};

export default function GiftLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
