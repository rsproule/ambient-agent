/**
 * NextAuth.js Configuration with Magic Link Authentication
 */

import { validateMagicLinkToken } from "@/src/db/magicLink";
import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";

export const { handlers, signIn, signOut, auth } = NextAuth({
  trustHost: true, // Required for production environments
  providers: [
    Credentials({
      id: "magic-link",
      name: "Magic Link",
      credentials: {
        token: { label: "Token", type: "text" },
      },
      async authorize(credentials) {
        if (!credentials?.token || typeof credentials.token !== "string") {
          return null;
        }

        // Validate the magic link token
        const result = await validateMagicLinkToken(credentials.token);

        if (!result.valid || !result.user) {
          return null;
        }

        // Return user object that NextAuth will use for the session
        return {
          id: result.user.id,
          name: result.user.name,
          email: result.user.email,
          phoneNumber: result.user.phoneNumber,
          image: result.user.image,
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user, trigger }) {
      // On sign in, add custom fields to JWT token
      if (user) {
        token.id = user.id;
        token.phoneNumber = user.phoneNumber;
        // Store when the token was created
        token.iat = Math.floor(Date.now() / 1000);
      }

      // On update trigger (e.g., session refresh), update iat
      if (trigger === "update") {
        token.iat = Math.floor(Date.now() / 1000);
      }

      return token;
    },
    async session({ session, token }) {
      // Add custom fields to session
      if (session.user) {
        session.user.id = token.id as string;
        session.user.phoneNumber = token.phoneNumber as string | undefined;
      }
      return session;
    },
  },
  pages: {
    signIn: "/auth/request",
  },
  session: {
    strategy: "jwt",
    maxAge: 30 * 24 * 60 * 60, // 30 days
    updateAge: 24 * 60 * 60, // Update session every 24 hours
  },
  cookies: {
    sessionToken: {
      name: `${
        process.env.NODE_ENV === "production" ? "__Secure-" : ""
      }authjs.session-token`,
      options: {
        httpOnly: true,
        sameSite: "lax",
        path: "/",
        secure: process.env.NODE_ENV === "production",
      },
    },
  },
});
