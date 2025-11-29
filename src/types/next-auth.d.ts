import { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      phoneNumber?: string;
    } & DefaultSession["user"];
  }

  interface User {
    phoneNumber?: string;
  }
}

declare module "@auth/core/jwt" {
  interface JWT {
    phoneNumber?: string;
  }
}

