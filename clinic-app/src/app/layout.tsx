import type { Metadata, Viewport } from "next";
import { Analytics } from '@vercel/analytics/react';
import { SpeedInsights } from '@vercel/speed-insights/next';
import { Outfit, Inter } from 'next/font/google';
import "./globals.css";
import TopNav from "@/components/TopNav";
import AppCheckProvider from "@/components/AppCheckProvider";

const outfit = Outfit({ subsets: ['latin'], variable: '--font-outfit' });
const inter = Inter({ subsets: ['latin'], variable: '--font-inter' });

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

import Script from 'next/script';

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <Script
          strategy="afterInteractive"
          src="//translate.google.com/translate_a/element.js?cb=googleTranslateElementInit"
        />
        <Script id="google-translate-init" strategy="afterInteractive">
          {`
            function googleTranslateElementInit() {
              new window.google.translate.TranslateElement({
                pageLanguage: 'en',
                includedLanguages: 'en,hi,mr',
                layout: window.google.translate.TranslateElement.InlineLayout.SIMPLE,
                autoDisplay: false
              }, 'google_translate_element');
            }
          `}
        </Script>
      </head>
      <body suppressHydrationWarning={true} className={`${outfit.variable} ${inter.variable}`}>
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
