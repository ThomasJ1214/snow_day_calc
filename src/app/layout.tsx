import type { Metadata, Viewport } from "next";
import { Bricolage_Grotesque, Instrument_Sans } from "next/font/google";
import "maplibre-gl/dist/maplibre-gl.css";
import "./globals.css";
import { SiteHeader } from "@/components/layout/site-header";
import { SiteFooter } from "@/components/layout/site-footer";
import { Snowfall } from "@/components/layout/snowfall";
import { themeScript } from "@/components/layout/theme-toggle";

const display = Bricolage_Grotesque({ subsets: ["latin"], variable: "--font-bricolage", display: "swap" });
const sans = Instrument_Sans({ subsets: ["latin"], variable: "--font-instrument", display: "swap" });

const site = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

export const metadata: Metadata = {
  metadataBase: new URL(site),
  title: { default: "SnowDay — How much snow, and will school close?", template: "%s · SnowDay" },
  description:
    "Hyperlocal snowfall forecasts with honest ranges from 80+ model runs, plus transparent school closure predictions and official district announcements across the United States.",
  openGraph: { type: "website", siteName: "SnowDay" },
  icons: { icon: "/icon.svg" },
  manifest: "/manifest.webmanifest",
};

export const viewport: Viewport = {
  themeColor: "#070b1a",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${display.variable} ${sans.variable}`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body>
        <Snowfall />
        <SiteHeader />
        <main id="main" className="mx-auto max-w-6xl px-4 pt-6 sm:px-6 sm:pt-10">
          {children}
        </main>
        <SiteFooter />
      </body>
    </html>
  );
}
