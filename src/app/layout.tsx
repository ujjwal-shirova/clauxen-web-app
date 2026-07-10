import type { Metadata, Viewport } from "next";
import { SpeedInsights } from "@vercel/speed-insights/next";
import "bootstrap-icons/font/bootstrap-icons.css";
import "./globals.css";
import { ClientToaster } from "@/frontend/components/client-toaster";
import { AppNotificationsProvider } from "@/frontend/hooks/use-app-notifications";
import { AppNotificationHost } from "@/frontend/components/app-notifications/app-notification-host";

export const metadata: Metadata = {
  title: "Clauxen",
  description: "An AI-powered chat application.",
  icons: {
    icon: [
      { url: "/favicon.ico", sizes: "any" },
      { url: "/assets/icons/clauxen-favicon.png", type: "image/png", sizes: "180x180" },
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
    <html lang="en" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link
          rel="preconnect"
          href="https://fonts.gstatic.com"
          crossOrigin=""
        />
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Playfair+Display:wght@400;700&family=Homemade+Apple&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="font-body antialiased" suppressHydrationWarning>
        <AppNotificationsProvider>
          {children}
          <ClientToaster />
          <AppNotificationHost />
          <SpeedInsights />
        </AppNotificationsProvider>
      </body>
    </html>
  );
}
