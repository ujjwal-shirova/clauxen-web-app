import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Shared chat",
  description: "A private read-only chat link.",
  robots: {
    index: false,
    follow: false,
    nocache: true,
    noarchive: true,
    nosnippet: true,
    noimageindex: true,
  },
  referrer: "no-referrer",
};

export default function ShareLinkLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
