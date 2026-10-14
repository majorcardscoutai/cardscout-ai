import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import type { ReactNode } from "react";
import Nav from "@/components/Nav";
import "./globals.css";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "CardHawk AI",
  description: "Private trading-card investment analysis",
  robots: { index: false, follow: false }, // private tool — keep out of search engines
  appleWebApp: { capable: true, title: "CardHawk", statusBarStyle: "black-translucent" },
  icons: { icon: "/icon-192.png", apple: "/apple-touch-icon.png" },
};

export const viewport: Viewport = {
  themeColor: "#080b10",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en-AU" className={`${geistSans.variable} ${geistMono.variable}`}>
      <body className="min-h-screen">
        <Nav />
        <main className="md:pl-60">
          <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 md:py-8 lg:px-8">{children}</div>
        </main>
      </body>
    </html>
  );
}
