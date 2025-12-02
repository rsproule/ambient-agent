import { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Login to Mr Whiskers",
  description: "Your personal AI assistant is waiting for you 🐱",
  openGraph: {
    title: "Login to Mr Whiskers",
    description: "Your personal AI assistant is waiting for you 🐱",
    images: ["/whiskerspfp.jpg"],
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Login to Mr Whiskers",
    description: "Your personal AI assistant is waiting for you 🐱",
    images: ["/whiskerspfp.jpg"],
  },
};

export default function LoginPage() {
  return (
    <main className="min-h-screen flex items-center justify-center bg-[#faf9f7]">
      <div className="text-center p-8 max-w-[380px]">
        <Image
          src="/whiskerspfp.jpg"
          alt="Mr Whiskers"
          width={120}
          height={120}
          className="rounded-full border-[3px] border-[#e8e6e3] mx-auto mb-5 object-cover"
        />
        <h1 className="text-2xl font-normal text-[#2c2c2c] mb-3 tracking-tight">
          Mr Whiskers
        </h1>
        <p className="text-[#666] text-base">
          <Link
            href="/connections"
            className="text-[#2c2c2c] underline underline-offset-2 hover:text-black"
          >
            Manage connections
          </Link>
        </p>
      </div>
    </main>
  );
}
