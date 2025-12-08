import { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      phoneNumber?: string;
      isAdmin?: boolean;
    } & DefaultSession["user"];
  }

  interface User {
    phoneNumber?: string;
    isAdmin?: boolean;
  }
}

declare module "@auth/core/jwt" {
  interface JWT {
    phoneNumber?: string;
    isAdmin?: boolean;
  }
}
