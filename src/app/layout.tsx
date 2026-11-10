import type { Metadata, Viewport } from "next";
import { Bricolage_Grotesque, Instrument_Sans } from "next/font/google";
import "maplibre-gl/dist/maplibre-gl.css";
import "./globals.css";
import { SiteHeader } from "@/components/layout/site-header";
import { SiteFooter } from "@/components/layout/site-footer";
import { themeScript } from "@/components/layout/theme-toggle";
import { MotionProvider } from "@/components/ui/motion";

const display = Bricolage_Grotesque({ subsets: ["latin"], variable: "--font-bricolage", display: "swap" });
const sans = Instrument_Sans({ subsets: ["latin"], variable: "--font-instrument", display: "swap" });

const site = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

export const metadata: Metadata = {
  metadataBase: new URL(site),
  title: { default: "Snow Day Scout: Snow Day Predictor & Snowfall Forecast", template: "%s · Snow Day Scout" },
  description:
    "Will school close tomorrow? Snow Day Scout predicts snow days and delays for any U.S. school from 80+ forecast model runs, shows honest snowfall ranges, and checks each district's official announcements.",
  applicationName: "Snow Day Scout",
  openGraph: { type: "website", siteName: "Snow Day Scout" },
  twitter: { card: "summary_large_image" },
  icons: { icon: "/icon.svg", apple: "/apple-touch-icon.png" },
  manifest: "/manifest.webmanifest",
};

const siteJsonLd = {
  "@context": "https://schema.org",
  "@graph": [
    { "@type": "WebSite", "@id": `${site}/#website`, url: site, name: "Snow Day Scout", description: "Snow day predictions and snowfall forecasts for U.S. schools." },
    {
      "@type": "WebApplication",
      name: "Snow Day Scout",
      url: site,
      applicationCategory: "WeatherApplication",
      operatingSystem: "Any",
      offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
    },
  ],
};

export const viewport: Viewport = {
  themeColor: "#e3eaf2",
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
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(siteJsonLd) }} />
        <MotionProvider>
          <SiteHeader />
          <main id="main" className="mx-auto max-w-6xl px-4 pt-6 sm:px-6 sm:pt-10">
            {children}
          </main>
          <SiteFooter />
        </MotionProvider>
      </body>
    </html>
  );
}
