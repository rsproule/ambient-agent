import { PrismaNeon } from "@prisma/adapter-neon";
import { PrismaClient } from "../generated/prisma";

// Create Prisma client with Neon adapter (following Vercel docs)
// The Neon adapter handles connection pooling internally
const createPrismaClient = () => {
  const adapter = new PrismaNeon({
    connectionString: process.env.DATABASE_URL,
  });
  return new PrismaClient({
    adapter,
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  });
};

declare global {
  var prisma: ReturnType<typeof createPrismaClient> | undefined;
}

export const prisma = global.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") global.prisma = prisma;

export default prisma;
