"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Loader } from "@/src/components/loader";

export default function ConnectionsRedirect() {
  const router = useRouter();

  useEffect(() => {
    async function checkAuth() {
      try {
        const response = await fetch("/api/auth/session");
        const session = await response.json();

        if (session?.user?.id) {
          router.push(`/connections/${session.user.id}`);
        } else {
          router.push("/?signin=true");
        }
      } catch (error) {
        console.error("Error checking auth:", error);
        router.push("/");
      }
    }

    checkAuth();
  }, [router]);

  return (
    <div className="flex min-h-screen items-center justify-center pt-16">
      <Loader />
    </div>
  );
}

