import { LinkIcon, MessageSquare } from "lucide-react";
import Image from "next/image";
import Link from "next/link";

export default function Home() {
  return (
    <div className="flex min-h-dvh items-center justify-center bg-background pt-16">
      <main className="flex flex-col items-center gap-8 p-8 text-center max-w-md">
        <div className="relative w-48 h-48 rounded-full overflow-hidden shadow-2xl">
          <Image
            src="/whiskerspfp.jpg"
            alt="Whiskers"
            fill
            className="object-cover"
            priority
          />
        </div>

        <div className="space-y-4">
          <h1 className="text-4xl font-bold text-foreground">Mr. Whiskers</h1>
          <p className="text-xl font-medium text-foreground/80">
            Purrsonal Assistant
          </p>
        </div>

        <div className="flex flex-col gap-3 w-full max-w-sm">
          <Link
            href="/connections"
            className="inline-flex items-center justify-center gap-2 px-8 py-3 bg-secondary hover:bg-secondary/80 text-secondary-foreground font-semibold rounded-md shadow-md transition-colors"
          >
            <LinkIcon className="h-5 w-5" />
            Manage Connections
          </Link>

          <a
            href="sms:+17243216167&body=Hi Mr. Whiskers"
            className="inline-flex items-center justify-center gap-2 px-8 py-3 bg-primary hover:bg-primary/90 text-primary-foreground font-semibold rounded-md shadow-md transition-colors"
          >
            <MessageSquare className="h-5 w-5" />
            Text Mr. Whiskers
          </a>
        </div>
      </main>
    </div>
  );
}
