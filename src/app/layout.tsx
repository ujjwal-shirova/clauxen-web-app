import type { Metadata, Viewport } from "next";
import { Inter, Playfair_Display } from "next/font/google";
import "./globals.css";
import { ClientToaster } from "@/frontend/components/client-toaster";
import { ClientTelemetry } from "@/frontend/components/client-telemetry";
import { ChunkLoadRecovery } from "@/frontend/components/chunk-load-recovery";
import { ChatFontLoader } from "@/frontend/components/chat-font-loader";
import { AppNotificationsProvider } from "@/frontend/hooks/use-app-notifications";
import { AppNotificationHost } from "@/frontend/components/app-notifications/app-notification-host";
import { AuthProvider } from "@/frontend/contexts/auth-context";
import { AppPreferencesProvider } from "@/frontend/contexts/app-preferences-context";

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

/** Avoid FOUC for theme + chat font before React hydrates. */
const preferenceBootScript = `(function(){try{var a=localStorage.getItem("clauxen.appearance");var t=localStorage.getItem("theme");var mode=t==="dark"||t==="light"?t:a==="Dark"?"dark":a==="Light"?"light":null;if(!mode)mode=window.matchMedia("(prefers-color-scheme: dark)").matches?"dark":"light";var r=document.documentElement;if(mode==="dark")r.classList.add("dark");else r.classList.remove("dark");var f=localStorage.getItem("clauxen.chatFont");if(f)r.setAttribute("data-chat-font",f);if(localStorage.getItem("clauxen.motion")==="Reduced")r.setAttribute("data-reduce-motion","1");var s=localStorage.getItem("clauxen.followUpSuggestions");if(s==="0"||s==="1")r.setAttribute("data-follow-up-suggestions",s);}catch(e){}})();`;

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

const supabasePreconnect =
  process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/+$/, "") || null;
const chatHistoryPreconnect =
  process.env.NEXT_PUBLIC_CHAT_HISTORY_WORKER_URL?.replace(/\/+$/, "") || null;

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
        <script dangerouslySetInnerHTML={{ __html: preferenceBootScript }} />
        {/* Edge / browser connection warm-up for auth + fonts (FCP helpers). */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link
          rel="preconnect"
          href="https://fonts.gstatic.com"
          crossOrigin="anonymous"
        />
        {supabasePreconnect ? (
          <link rel="preconnect" href={supabasePreconnect} crossOrigin="anonymous" />
        ) : null}
        {chatHistoryPreconnect ? (
          <link
            rel="preconnect"
            href={chatHistoryPreconnect}
            crossOrigin="anonymous"
          />
        ) : null}
      </head>
      <body
        className={`${inter.className} antialiased`}
        suppressHydrationWarning
      >
        <AuthProvider>
          <AppPreferencesProvider>
            <AppNotificationsProvider>
              <ChunkLoadRecovery />
              <ChatFontLoader />
              {children}
              <ClientToaster />
              <AppNotificationHost />
              <ClientTelemetry />
            </AppNotificationsProvider>
          </AppPreferencesProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
