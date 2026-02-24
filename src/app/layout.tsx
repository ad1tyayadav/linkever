import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { Providers } from "@/components/Providers";
import { Analytics } from "@vercel/analytics/next"
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  metadataBase: new URL("https://linkever.in"),
  title: {
    default: "LinkEver — Download Media from Any URL",
    template: "%s | LinkEver",
  },
  description:
    "Paste any public URL and download video, audio, or images at the highest possible quality. YouTube, Spotify, Instagram, TikTok, and 100+ platforms supported.",
  keywords: [
    "media downloader",
    "youtube downloader",
    "spotify downloader",
    "video download",
    "instagram downloader",
    "tiktok downloader",
    "linkever",
    "linkever.in",
  ],
  authors: [{ name: "LinkEver" }],
  creator: "LinkEver",
  publisher: "LinkEver",
  formatDetection: {
    email: false,
    address: false,
    telephone: false,
  },
  alternates: {
    canonical: "/",
  },
  openGraph: {
    title: "LinkEver — Download Media from Any URL",
    description: "Paste any link, download at the highest quality. No ads, no signup.",
    url: "https://linkever.in",
    siteName: "LinkEver",
    images: [
      {
        url: "/og-image.png", // Assume this exists or will be added
        width: 1200,
        height: 630,
        alt: "LinkEver — Media downloader",
      },
    ],
    locale: "en_US",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "LinkEver — Download Media from Any URL",
    description: "The simplest way to download your favorite media from 100+ platforms.",
    images: ["/og-image.png"],
    creator: "@_its_Adi",
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${geistSans.variable} ${geistMono.variable}`}>
        <Providers>{children}</Providers>
        <Analytics />
      </body>
    </html>
  );
}
