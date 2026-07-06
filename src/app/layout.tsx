import type { Metadata, Viewport } from "next";
import Script from "next/script";
import "./globals.css";

export const metadata: Metadata = {
  title: "5sFindr — Find your next 5-a-side",
  description:
    "Tinder meets Strava for 5-a-side football. Find games across Cape Town, build your reliability score, and get on the pitch.",
  manifest: "/manifest.json",
  icons: {
    icon: [
      { url: "/icons/icon-192x192.png", sizes: "192x192", type: "image/png" },
      { url: "/icons/icon-512x512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [{ url: "/icons/icon-192x192.png", sizes: "192x192", type: "image/png" }],
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "5sFindr",
  },
  openGraph: {
    title: "5sFindr",
    description: "Find your next 5-a-side. Launching in Cape Town.",
    url: "https://5sfindr.com",
    siteName: "5sFindr",
    type: "website",
  },
};

export const viewport: Viewport = {
  themeColor: "#070A09",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const umamiId = process.env.NEXT_PUBLIC_UMAMI_WEBSITE_ID;
  return (
    <html lang="en" className="dark">
      <body>
        {children}
        {/* Umami (free/open-source analytics) — only injected when configured.
            Page views are tracked automatically; funnel events can be added
            later via data-umami-event attributes on buttons/links. */}
        {umamiId && (
          <Script
            src="https://cloud.umami.is/script.js"
            data-website-id={umamiId}
            strategy="afterInteractive"
          />
        )}
      </body>
    </html>
  );
}
