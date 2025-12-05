"use client";

import { useSession, signOut } from "next-auth/react";
import Link from "next/link";
import Image from "next/image";
import { ChevronDown, Zap, LogOut, Clock, Wallet } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/src/components/ui/dropdown-menu";

export function Navbar() {
  const { data: session, status } = useSession();

  if (status === "loading") {
    return null; // Don't show navbar while loading
  }

  return (
    <nav className="fixed top-0 left-0 right-0 bg-background/80 backdrop-blur-md border-b border-border z-50">
      <div className="container mx-auto px-4">
        <div className="flex items-center justify-between h-16">
          {/* Left side - Logo + Features link */}
          <div className="flex items-center gap-6">
            <Link href="/" className="flex items-center gap-2 hover:opacity-80 transition-opacity">
              <div className="relative w-10 h-10 rounded-full overflow-hidden ring-2 ring-border">
                <Image
                  src="/whiskerspfp.jpg"
                  alt="Mr. Whiskers"
                  fill
                  className="object-cover"
                />
              </div>
              <span className="font-bold text-lg text-foreground">
                Mr. Whiskers
              </span>
            </Link>

            <Link
              href="/features"
              className="hidden sm:block text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              What can Whiskers do?
            </Link>
          </div>

          {/* Right side - Auth state */}
          {session?.user ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-accent transition-colors">
                  {/* User Avatar */}
                  <div className="flex items-center gap-2">
                    {session.user.image ? (
                      <div className="relative w-8 h-8 rounded-full overflow-hidden ring-1 ring-border">
                        <Image
                          src={session.user.image}
                          alt={session.user.name || "User avatar"}
                          fill
                          className="object-cover"
                        />
                      </div>
                    ) : (
                      <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center text-muted-foreground font-semibold text-sm">
                        {session.user.name?.charAt(0)?.toUpperCase() || 
                         session.user.email?.charAt(0)?.toUpperCase() ||
                         (session.user as any).phoneNumber?.slice(-2) || 
                         "U"}
                      </div>
                    )}
                    <div className="hidden sm:block text-left">
                      <p className="text-sm font-medium text-foreground">
                        {session.user.name || "User"}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {(session.user as any).phoneNumber || session.user.email || "Authenticated"}
                      </p>
                    </div>
                  </div>
                  
                  {/* Dropdown arrow */}
                  <ChevronDown className="w-4 h-4 text-muted-foreground" />
                </button>
              </DropdownMenuTrigger>

              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuItem asChild>
                  <Link href="/connections" className="flex items-center gap-2">
                    <Zap className="w-4 h-4" />
                    My Connections
                  </Link>
                </DropdownMenuItem>
                
                <DropdownMenuItem asChild>
                  <Link href="/scheduled-jobs" className="flex items-center gap-2">
                    <Clock className="w-4 h-4" />
                    Scheduled Jobs
                  </Link>
                </DropdownMenuItem>

                <DropdownMenuItem asChild>
                  <Link href="/balance" className="flex items-center gap-2">
                    <Wallet className="w-4 h-4" />
                    Balance
                  </Link>
                </DropdownMenuItem>
                
                <DropdownMenuSeparator />
                
                <DropdownMenuItem
                  variant="destructive"
                  onClick={() => signOut({ callbackUrl: "/" })}
                  className="flex items-center gap-2"
                >
                  <LogOut className="w-4 h-4" />
                  Sign Out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            <Link
              href="/auth/request"
              className="px-4 py-2 text-sm font-medium text-primary-foreground bg-primary hover:bg-primary/90 rounded-lg transition-all active:scale-95"
            >
              Sign In
            </Link>
          )}
        </div>
      </div>
    </nav>
  );
}
