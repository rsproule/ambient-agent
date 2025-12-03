"use client";

import { useState } from "react";
import Image from "next/image";
import { Loader } from "@/src/components/loader";
import { MessageCircle } from "lucide-react";

export default function RequestMagicLinkPage() {
  const [phoneNumber, setPhoneNumber] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setMessage(null);

    try {
      const response = await fetch("/api/auth/request-link", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phoneNumber }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to send magic link");
      }

      setMessage({
        type: "success",
        text: data.message || "Magic link sent! Check your messages.",
      });
      setPhoneNumber("");
    } catch (error) {
      setMessage({
        type: "error",
        text:
          error instanceof Error ? error.message : "Failed to send magic link",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background pt-16">
      <div className="container mx-auto px-6 py-16 max-w-md">
        {/* Header */}
        <div className="flex items-center gap-4 mb-10">
          <div className="relative w-14 h-14 rounded-xl overflow-hidden shrink-0">
            <Image
              src="/whiskerspfp.jpg"
              alt="Mr. Whiskers"
              fill
              className="object-cover"
              priority
            />
          </div>
          <div>
            <h1 className="text-xl font-semibold text-foreground">
              Request Connection Link
            </h1>
            <p className="text-sm text-muted-foreground">
              Get a link to manage your accounts
            </p>
          </div>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <label
              htmlFor="phoneNumber"
              className="block text-sm font-medium text-foreground"
            >
              Phone Number
            </label>
            <input
              type="tel"
              id="phoneNumber"
              value={phoneNumber}
              onChange={(e) => setPhoneNumber(e.target.value)}
              placeholder="+1234567890"
              required
              className="w-full px-4 py-3 rounded-lg border border-border bg-background text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
              disabled={isLoading}
            />
            <p className="text-xs text-muted-foreground">
              Include country code (e.g., +1 for US)
            </p>
          </div>

          <button
            type="submit"
            disabled={isLoading || !phoneNumber}
            className="w-full inline-flex items-center justify-center gap-2 px-5 py-3 bg-primary hover:bg-primary/90 disabled:bg-muted disabled:text-muted-foreground text-primary-foreground text-sm font-medium rounded-lg transition-colors disabled:cursor-not-allowed"
          >
            {isLoading ? (
              <>
                <Loader />
                <span>Sending...</span>
              </>
            ) : (
              "Send Magic Link"
            )}
          </button>
        </form>

        {/* Message */}
        {message && (
          <div
            className={`mt-4 p-4 rounded-lg text-sm ${
              message.type === "success"
                ? "bg-green-500/10 text-green-700 dark:text-green-300 border border-green-500/20"
                : "bg-red-500/10 text-red-700 dark:text-red-300 border border-red-500/20"
            }`}
          >
            {message.text}
          </div>
        )}

        {/* Alternative */}
        <div className="mt-8 pt-6 border-t border-border">
          <p className="text-sm text-muted-foreground mb-3">
            Or text Mr. Whiskers directly:
          </p>
          <a
            href="sms:+17243216167&body=I need my connection link"
            className="inline-flex items-center gap-2 text-sm text-primary hover:text-primary/80 font-medium transition-colors"
          >
            <MessageCircle className="w-4 h-4" />
            +1 (724) 321-6167
          </a>
        </div>
      </div>
    </div>
  );
}
