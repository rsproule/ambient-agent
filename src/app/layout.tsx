import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { QueryProvider } from "@/src/components/providers/QueryProvider";
import { PrivyProvider } from "@/src/components/providers/PrivyProvider";
import { SessionProvider } from "next-auth/react";
import { Navbar } from "@/src/components/Navbar";

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
        <SessionProvider>
          <PrivyProvider>
            <Navbar />
            <QueryProvider>{children}</QueryProvider>
          </PrivyProvider>
        </SessionProvider>
      </body>
    </html>
  );
}
