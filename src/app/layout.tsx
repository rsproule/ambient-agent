import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { QueryProvider } from "@/src/components/providers/QueryProvider";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Mr. Whiskers",
  description: "Purrsonal Assistant",
  openGraph: {
    title: "Mr. Whiskers",
    description: "Purrsonal Assistant",
    images: [
      {
        url: "/whiskerspfp.jpg",
        width: 1200,
        height: 1200,
        alt: "Mr. Whiskers",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Mr. Whiskers",
    description: "Purrsonal Assistant",
    images: ["/whiskerspfp.jpg"],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <QueryProvider>{children}</QueryProvider>
      </body>
    </html>
  );
}
