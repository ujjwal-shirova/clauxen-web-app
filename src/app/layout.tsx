import type { Metadata, Viewport } from "next";
import { Inter, Playfair_Display } from "next/font/google";
import "./globals.css";
import { ClientToaster } from "@/frontend/components/client-toaster";
import { ClientTelemetry } from "@/frontend/components/client-telemetry";
import { ChunkLoadRecovery } from "@/frontend/components/chunk-load-recovery";
import { AppNotificationsProvider } from "@/frontend/hooks/use-app-notifications";
import { AppNotificationHost } from "@/frontend/components/app-notifications/app-notification-host";
import { AuthProvider } from "@/frontend/contexts/auth-context";

const inter = Inter({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-inter",
  weight: ["400", "500", "600", "700"],
});

const playfair = Playfair_Display({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-playfair",
  weight: ["400", "700"],
});

export const metadata: Metadata = {
  title: {
    default: "Clauxen",
    template: "%s",
  },
  description: "An AI-powered chat application.",
  icons: {
    icon: [
      { url: "/favicon.ico", sizes: "any" },
      {
        url: "/assets/icons/clauxen-favicon.png",
        type: "image/png",
        sizes: "180x180",
      },
    ],
    apple: "/assets/icons/clauxen-favicon.png",
    shortcut: "/favicon.ico",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${inter.variable} ${playfair.variable}`}
      suppressHydrationWarning
    >
      <head>
        {/* Edge / browser connection warm-up for auth + vitals (FCP helpers). */}
        <link rel="dns-prefetch" href="https://vitals.vercel-insights.com" />
        <link rel="preconnect" href="https://vitals.vercel-insights.com" crossOrigin="anonymous" />
      </head>
      <body
        className={`${inter.className} antialiased`}
        suppressHydrationWarning
      >
        <AuthProvider>
          <AppNotificationsProvider>
            <ChunkLoadRecovery />
            {children}
            <ClientToaster />
            <AppNotificationHost />
            <ClientTelemetry />
          </AppNotificationsProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
