import type { Metadata, Viewport } from "next";
import {
  Atkinson_Hyperlegible,
  IBM_Plex_Sans,
  Inter,
  Literata,
  Lora,
  Merriweather,
  Nunito_Sans,
  Playfair_Display,
  Source_Sans_3,
  Source_Serif_4,
} from "next/font/google";
import "./globals.css";
import { ClientToaster } from "@/frontend/components/client-toaster";
import { ClientTelemetry } from "@/frontend/components/client-telemetry";
import { ChunkLoadRecovery } from "@/frontend/components/chunk-load-recovery";
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

const chatLora = Lora({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-chat-lora",
  weight: ["400", "500", "600", "700"],
});

const chatSourceSerif = Source_Serif_4({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-chat-source-serif",
  weight: ["400", "600", "700"],
});

const chatLiterata = Literata({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-chat-literata",
  weight: ["400", "500", "600", "700"],
});

const chatMerriweather = Merriweather({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-chat-merriweather",
  weight: ["400", "700"],
});

const chatIbmPlex = IBM_Plex_Sans({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-chat-ibm-plex",
  weight: ["400", "500", "600", "700"],
});

const chatSourceSans = Source_Sans_3({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-chat-source-sans",
  weight: ["400", "500", "600", "700"],
});

const chatNunito = Nunito_Sans({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-chat-nunito",
  weight: ["400", "500", "600", "700"],
});

const chatAtkinson = Atkinson_Hyperlegible({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-chat-atkinson",
  weight: ["400", "700"],
});

const chatFontVariables = [
  chatLora.variable,
  chatSourceSerif.variable,
  chatLiterata.variable,
  chatMerriweather.variable,
  chatIbmPlex.variable,
  chatSourceSans.variable,
  chatNunito.variable,
  chatAtkinson.variable,
].join(" ");

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

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${inter.variable} ${playfair.variable} ${chatFontVariables}`}
      suppressHydrationWarning
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: preferenceBootScript }} />
        {/* Edge / browser connection warm-up for auth + vitals (FCP helpers). */}
        <link rel="dns-prefetch" href="https://vitals.vercel-insights.com" />
        <link
          rel="preconnect"
          href="https://vitals.vercel-insights.com"
          crossOrigin="anonymous"
        />
      </head>
      <body
        className={`${inter.className} antialiased`}
        suppressHydrationWarning
      >
        <AuthProvider>
          <AppPreferencesProvider>
            <AppNotificationsProvider>
              <ChunkLoadRecovery />
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
