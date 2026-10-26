import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import type { ReactNode } from "react";
import { Suspense } from "react";
import Nav from "@/components/Nav";
import NavProgress from "@/components/NavProgress";
import { currentViewer } from "@/data/session";
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

export default async function RootLayout({ children }: { children: ReactNode }) {
  const viewer = await currentViewer().catch(() => null);
  return (
    <html lang="en-AU" className={`${geistSans.variable} ${geistMono.variable}`}>
      <body className="min-h-screen">
        <Nav admin={viewer?.admin === true} />
        <Suspense fallback={null}>
          <NavProgress />
        </Suspense>
        <main className="md:pl-60">
          <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 md:py-8 lg:px-8">
            {children}
            {viewer && (
              <footer className="mt-12 border-t border-line pt-4 pb-2 text-[11px] leading-relaxed text-faint">
                Listings, images and seller details come from eBay; purchases are made on eBay under the{" "}
                <a href="https://www.ebay.com/help/policies/member-behaviour-policies/user-agreement?id=4259" target="_blank" rel="noopener noreferrer" className="underline hover:text-accent">
                  eBay User Agreement
                </a>
                . CardHawk is not owned or endorsed by eBay. As an eBay Partner, CardHawk may earn a commission when you buy through its
                eBay links — this never changes the price you pay or which listings we show. Market values from SportsCardsPro / PriceCharting.{" "}
                <a href="/terms" className="underline hover:text-accent">Terms of Use</a> ·{" "}
                <a href="/privacy" className="underline hover:text-accent">Privacy Policy</a>
              </footer>
            )}
          </div>
        </main>
      </body>
    </html>
  );
}
