import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { Providers } from "@/components/Providers";
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
  title: "LinkEver — Download Media from Any URL",
  description:
    "Paste any public URL and download video, audio, or images at the highest possible quality. YouTube, Spotify, Instagram, TikTok, and 1,000+ more sites supported.",
  keywords: ["media downloader", "youtube downloader", "spotify downloader", "video download"],
  openGraph: {
    title: "LinkEver — Download Media from Any URL",
    description: "Paste any link, download at the highest quality. No ads, no signup.",
    type: "website",
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
      </body>
    </html>
  );
}
