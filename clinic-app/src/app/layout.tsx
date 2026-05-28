import type { Metadata, Viewport } from "next";
import { Analytics } from '@vercel/analytics/react';
import { SpeedInsights } from '@vercel/speed-insights/next';
import "./globals.css";
import TopNav from "@/components/TopNav";
import AppCheckProvider from "@/components/AppCheckProvider";

export const metadata: Metadata = {
  title: "Q-PULSE | Skip the wait, stay in the pulse",
  description: "Real-time clinic queue tracking. Book your token online, track the live queue, and skip the waiting room stress.",
  manifest: "/manifest.json",
  keywords: ["clinic queue", "token booking", "doctor appointment", "live queue", "Q-PULSE"],
  authors: [{ name: "Q-PULSE" }],
  robots: "index, follow",
  openGraph: {
    title: "Q-PULSE | Skip the wait, stay in the pulse",
    description: "Real-time clinic queue tracking. Book your token online and track the live queue.",
    type: "website",
    locale: "en_IN",
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Q-PULSE",
  },
};

export const viewport: Viewport = {
  themeColor: "#007BFF",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,   // prevents unwanted pinch-zoom on mobile forms
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body suppressHydrationWarning={true}>
        <AppCheckProvider>
          <TopNav />
          {children}
        </AppCheckProvider>
        <Analytics />
        <SpeedInsights />
      </body>
    </html>
  );
}
