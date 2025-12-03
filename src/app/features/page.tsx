import {
  Calendar,
  Clock,
  Github,
  ImageIcon,
  Mail,
  MessageCircle,
  Search,
} from "lucide-react";
import Image from "next/image";

export default function FeaturesPage() {
  return (
    <div className="min-h-screen bg-background pt-16">
      <div className="container mx-auto px-6 py-16 max-w-2xl">
        {/* Hero */}
        <div className="flex items-center gap-5 mb-12">
          <div className="relative w-16 h-16 rounded-xl overflow-hidden shrink-0">
            <Image
              src="/whiskerspfp.jpg"
              alt="Mr. Whiskers"
              fill
              className="object-cover"
              priority
            />
          </div>
          <div>
            <h1 className="text-2xl font-semibold text-foreground tracking-tight">
              Mr. Whiskers
            </h1>
            <p className="text-muted-foreground">
              Your assistant that lives in iMessage
            </p>
          </div>
        </div>

        {/* Single list of capabilities */}
        <div className="space-y-8">
          <div>
            <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wide mb-4">
              Connect your accounts
            </h2>
            <div className="space-y-3">
              {[
                {
                  icon: Calendar,
                  text: "Google Calendar: view, create, and manage events",
                },
                { icon: Mail, text: "Gmail: search, read, and send emails" },
                {
                  icon: Github,
                  text: "GitHub: check repos, PRs, and activity",
                },
              ].map((item, i) => (
                <div
                  key={i}
                  className="flex items-center gap-3 text-foreground"
                >
                  <item.icon className="w-4 h-4 text-muted-foreground shrink-0" />
                  <span className="text-sm">{item.text}</span>
                </div>
              ))}
            </div>
          </div>

          <div>
            <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wide mb-4">
              Built-in tools
            </h2>
            <div className="space-y-3">
              {[
                { icon: Search, text: "Web search with real-time results" },
                { icon: ImageIcon, text: "Generate and edit images from text" },
                {
                  icon: Clock,
                  text: "Schedule recurring tasks in natural language",
                },
              ].map((item, i) => (
                <div
                  key={i}
                  className="flex items-center gap-3 text-foreground"
                >
                  <item.icon className="w-4 h-4 text-muted-foreground shrink-0" />
                  <span className="text-sm">{item.text}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="pt-4 border-t border-border">
            <p className="text-sm text-muted-foreground mb-1">
              Works in DMs and group chats. Remembers your preferences. Gets
              smarter over time.
            </p>
            <p className="text-sm text-muted-foreground">
              Missing something? Just ask. Requests help us build what matters.
            </p>
          </div>
        </div>

        {/* CTA */}
        <div className="mt-12 text-center">
          <a
            href="sms:+17243216167&body=Hi Mr. Whiskers"
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-primary text-primary-foreground text-sm font-medium rounded-lg hover:bg-primary/90 transition-colors"
          >
            <MessageCircle className="w-4 h-4" />
            Text Mr. Whiskers
          </a>
        </div>
      </div>
    </div>
  );
}
