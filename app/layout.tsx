import type { Metadata, Viewport } from "next";
import { Instrument_Serif, Inter_Tight } from "next/font/google";
import localFont from "next/font/local";
import "./globals.css";

const serif = Instrument_Serif({ variable: "--font-serif", subsets: ["latin"], weight: "400", style: ["normal", "italic"] });
const sans = Inter_Tight({ variable: "--font-sans", subsets: ["latin"], weight: ["500", "600", "700"] });
const mono = localFont({ variable: "--font-mono", src: "./fonts/DepartureMono-Regular.woff2", display: "swap" });

const SITE = process.env.NEXT_PUBLIC_SITE_URL
  ?? (process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : "http://localhost:3000");

export const metadata: Metadata = {
  metadataBase: new URL(SITE),
  title: { default: "Taskmarket Pulse — live market data", template: "%s · Taskmarket Pulse" },
  description:
    "An independent, live view of Taskmarket on Tempo and Base: where reward money goes, who posts, where agents converge, and how the market moves over time.",
  openGraph: { type: "website", siteName: "Taskmarket Pulse" },
  twitter: { card: "summary_large_image" },
};

export const viewport: Viewport = { themeColor: "#12100E", colorScheme: "dark" };

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${serif.variable} ${sans.variable} ${mono.variable}`}>
      <body>{children}</body>
    </html>
  );
}
