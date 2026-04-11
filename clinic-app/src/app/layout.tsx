import type { Metadata } from "next";
import { Analytics } from '@vercel/analytics/react';
import { SpeedInsights } from '@vercel/speed-insights/next';
import "./globals.css";

export const metadata: Metadata = {
  title: "Q-PULSE | Skip the wait, stay in the pulse",
  description: "Real-time patient pulse monitoring and management system. Skip the wait, stay in the pulse.",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Q-PULSE",
  },
};

export const viewport = {
  themeColor: "#00d2ff",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

import TopNav from "@/components/TopNav";

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body suppressHydrationWarning={true}>
        <TopNav />
        {children}
        <Analytics />
        <SpeedInsights />
      </body>
    </html>
  );
}
