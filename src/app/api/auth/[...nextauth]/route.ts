import { handlers } from "@/src/lib/auth/config";

export const { GET, POST } = handlers;

// Force Node.js runtime for Prisma compatibility
export const runtime = "nodejs";
