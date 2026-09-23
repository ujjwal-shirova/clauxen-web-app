import type { Metadata, Viewport } from "next";
import { Inter, Playfair_Display } from "next/font/google";
import "./globals.css";
import { ClientToaster } from "@/components/client-toaster";
import { SavedNotificationHost } from "@/components/saved-notification";
import { ClientTelemetry } from "@/components/client-telemetry";
import { ChunkLoadRecovery } from "@/components/chunk-load-recovery";
import { ChatFontLoader } from "@/components/chat-font-loader";
import { HoverScrollEnabler } from "@/components/hover-scroll-enabler";
import { AppNotificationsProvider } from "@/hooks/use-app-notifications";
import { AppNotificationHost } from "@/components/app-notifications/app-notification-host";
import { AuthProvider } from "@/contexts/auth-context";
import { AppPreferencesProvider } from "@/contexts/app-preferences-context";
import { CookieConsent } from "@/components/cookie-consent";

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
const preferenceBootScript = `(function(){try{var a=localStorage.getItem("clauxen.appearance");var t=localStorage.getItem("theme");var mode=t==="dark"||t==="light"?t:a==="Dark"?"dark":a==="Light"?"light":null;if(!mode)mode=window.matchMedia("(prefers-color-scheme: dark)").matches?"dark":"light";var r=document.documentElement;if(mode==="dark")r.classList.add("dark");else r.classList.remove("dark");r.style.colorScheme=mode;r.setAttribute("data-resolved-theme",mode);var tc=document.querySelector('meta[name="theme-color"]');if(tc)tc.setAttribute("content",mode==="dark"?"#111113":"#f4f4f3");var f=localStorage.getItem("clauxen.chatFont");if(f)r.setAttribute("data-chat-font",f);var m=localStorage.getItem("clauxen.motion");var reduce=m==="Reduced"||((!m||m==="System")&&window.matchMedia("(prefers-reduced-motion: reduce)").matches);if(reduce)r.setAttribute("data-reduce-motion","1");else r.removeAttribute("data-reduce-motion");var s=localStorage.getItem("clauxen.followUpSuggestions");if(s==="0"||s==="1")r.setAttribute("data-follow-up-suggestions",s);var ac=localStorage.getItem("clauxen.accent");r.setAttribute("data-accent",(ac==="Forest"||ac==="Amber"||ac==="Rose")?ac:"Blue");var cm=localStorage.getItem("clauxen.contrast");r.setAttribute("data-contrast",(cm==="Default"||cm==="Increased")?cm:"System");var sw=parseInt(localStorage.getItem("clauxen.sidebarWidth")||"",10);if(sw>=220&&sw<=420)r.style.setProperty("--app-sidebar-width",sw+"px");}catch(e){}})();`;

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
        <meta name="theme-color" content="#f4f4f3" />
        {/* Static preference boot script (no user input) — must execute
            before hydration to avoid theme flash. */}
        {/* eslint-disable-next-line react/no-danger */}
        <script dangerouslySetInnerHTML={{ __html: preferenceBootScript }} />
        {/* Edge / browser connection warm-up for auth + chat-history. */}
        {supabasePreconnect ? (
          <link
            rel="preconnect"
            href={supabasePreconnect}
            crossOrigin="anonymous"
          />
        ) : null}
        {chatHistoryPreconnect ? (
          <link
            rel="preconnect"
            href={chatHistoryPreconnect}
            crossOrigin="anonymous"
          />
        ) : null}
        {/* Razorpay is warmed on checkout/pricing — do not preload on every app open. */}
        <link rel="dns-prefetch" href="https://checkout.razorpay.com" />
        <link rel="dns-prefetch" href="https://api.razorpay.com" />
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
              <HoverScrollEnabler />
              {children}
              <ClientToaster />
              <SavedNotificationHost />
              <AppNotificationHost />
              <CookieConsent />
              <ClientTelemetry />
            </AppNotificationsProvider>
          </AppPreferencesProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
