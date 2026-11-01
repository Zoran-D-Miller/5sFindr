import type { Metadata, Viewport } from "next";
import Script from "next/script";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL("https://5sfindr.com"),
  title: "5sFindr — Find your next 5-a-side",
  description:
    "Find or fill a 5-a-side game in Cape Town, and meet people who play. Launching soon and free at launch. Join the waitlist.",
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
    title: "5sFindr — Find your next 5-a-side",
    description: "Find or fill a game in Cape Town, and meet people who play. Join the waitlist.",
    url: "https://5sfindr.com",
    siteName: "5sFindr",
    type: "website",
    images: [
      {
        url: "https://5sfindr.com/og.png",
        width: 1200,
        height: 630,
        alt: "5sFindr: Find your next 5-a-side. Launching soon in Cape Town.",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    images: ["https://5sfindr.com/og.png"],
  },
};

export const viewport: Viewport = {
  themeColor: "#070A09",
  width: "device-width",
  initialScale: 1,
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
