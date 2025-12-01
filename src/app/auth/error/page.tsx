import { Metadata } from "next";
import Image from "next/image";

type ErrorType = "expired" | "invalid" | "not_found" | "unknown";

const errorMessages: Record<
  ErrorType,
  { title: string; message: string; hint: string }
> = {
  expired: {
    title: "Link Expired",
    message:
      "This login link has expired. Magic links are only valid for 15 minutes for security reasons.",
    hint: "Send me a message and I'll send you a fresh link! 🐱",
  },
  invalid: {
    title: "Invalid Link",
    message:
      "This login link doesn't look right. It may have been corrupted or modified.",
    hint: "Try copying the full link from your messages, or ask me for a new one.",
  },
  not_found: {
    title: "Link Not Found",
    message:
      "I couldn't find this login link. It may have already been used (links are single-use).",
    hint: "Each link can only be used once. Message me for a new login link!",
  },
  unknown: {
    title: "Something Went Wrong",
    message:
      "I ran into an unexpected issue while logging you in. This is probably my fault, not yours.",
    hint: "Try again in a moment, or message me for a new link.",
  },
};

export const metadata: Metadata = {
  title: "Login Error - Mr Whiskers",
};

interface Props {
  searchParams: Promise<{ type?: string }>;
}

export default async function AuthErrorPage({ searchParams }: Props) {
  const params = await searchParams;
  const errorType = (params.type as ErrorType) || "unknown";
  const { title, message, hint } =
    errorMessages[errorType] || errorMessages.unknown;

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
        <h1 className="text-2xl font-normal text-[#b44] mb-3 tracking-tight">
          {title}
        </h1>
        <p className="text-[#666] text-base leading-relaxed">{message}</p>
        <div className="mt-5 p-4 bg-[#f0efed] rounded-md text-sm text-[#555]">
          {hint}
        </div>
      </div>
    </main>
  );
}

