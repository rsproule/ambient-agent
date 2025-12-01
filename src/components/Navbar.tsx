"use client";

import { useSession, signOut } from "next-auth/react";
import Link from "next/link";
import Image from "next/image";
import { useState } from "react";
import { ChevronDown, Zap, LogOut } from "lucide-react";

export function Navbar() {
  const { data: session, status } = useSession();
  const [showDropdown, setShowDropdown] = useState(false);

  if (status === "loading") {
    return null; // Don't show navbar while loading
  }

  return (
    <nav className="fixed top-0 left-0 right-0 bg-background/80 backdrop-blur-md border-b border-border z-50">
      <div className="container mx-auto px-4">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
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

          {/* Right side - Auth state */}
          {session?.user ? (
            <div className="relative">
              <button
                onClick={() => setShowDropdown(!showDropdown)}
                className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-accent transition-colors"
              >
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
                <ChevronDown
                  className={`w-4 h-4 text-muted-foreground transition-transform ${showDropdown ? "rotate-180" : ""}`}
                />
              </button>

              {/* Dropdown menu */}
              {showDropdown && (
                <>
                  {/* Backdrop */}
                  <div 
                    className="fixed inset-0 z-40"
                    onClick={() => setShowDropdown(false)}
                  />
                  
                  {/* Menu */}
                  <div className="absolute right-0 mt-2 w-56 rounded-lg shadow-lg bg-popover border border-border z-50">
                    <div className="py-1">
                      <Link
                        href="/connections"
                        className="block px-4 py-2 text-sm text-popover-foreground hover:bg-accent"
                        onClick={() => setShowDropdown(false)}
                      >
                        <div className="flex items-center gap-2">
                          <Zap className="w-4 h-4" />
                          My Connections
                        </div>
                      </Link>
                      
                      <hr className="my-1 border-border" />
                      
                      <button
                        onClick={() => {
                          setShowDropdown(false);
                          signOut({ callbackUrl: "/" });
                        }}
                        className="block w-full text-left px-4 py-2 text-sm text-destructive hover:bg-accent"
                      >
                        <div className="flex items-center gap-2">
                          <LogOut className="w-4 h-4" />
                          Sign Out
                        </div>
                      </button>
                    </div>
                  </div>
                </>
              )}
            </div>
          ) : (
            <Link
              href="/auth/request"
              className="px-4 py-2 text-sm font-medium text-primary-foreground bg-primary hover:bg-primary/90 rounded-lg transition-colors"
            >
              Sign In
            </Link>
          )}
        </div>
      </div>
    </nav>
  );
}

