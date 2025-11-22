import Image from "next/image";

export default function Home() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-linear-to-br from-blue-50 to-indigo-100 dark:from-zinc-900 dark:to-zinc-950">
      <main className="flex flex-col items-center gap-8 p-8 text-center max-w-md">
        <div className="relative w-48 h-48 rounded-full overflow-hidden shadow-2xl ring-4 ring-white dark:ring-zinc-800">
          <Image
            src="/whiskerspfp.jpg"
            alt="Whiskers"
            fill
            className="object-cover"
            priority
          />
        </div>

        <div className="space-y-4">
          <h1 className="text-4xl font-bold text-zinc-900 dark:text-zinc-50">
            Mr. Whiskers
          </h1>
          <p className="text-xl font-medium text-zinc-700 dark:text-zinc-300">
            Purrsonal Assistant
          </p>
          <p className="text-lg text-zinc-600 dark:text-zinc-400 leading-relaxed">
            Available 24/7 for all your conversation needs.
          </p>
        </div>

        <a
          href="sms:+17243216167"
          className="inline-flex items-center gap-2 px-8 py-3 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-md shadow-md transition-colors"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="h-5 w-5"
            viewBox="0 0 20 20"
            fill="currentColor"
          >
            <path d="M2.003 5.884L10 9.882l7.997-3.998A2 2 0 0016 4H4a2 2 0 00-1.997 1.884z" />
            <path d="M18 8.118l-8 4-8-4V14a2 2 0 002 2h12a2 2 0 002-2V8.118z" />
          </svg>
          Chat with Mr. Whiskers
        </a>
      </main>
    </div>
  );
}
