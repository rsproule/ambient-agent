import { PrismaNeonHttp } from "@prisma/adapter-neon";
import { PrismaClient } from "../generated/prisma";

// Create Prisma client with Neon HTTP adapter (better for serverless)
// Uses HTTP instead of WebSocket which works in all environments
const createPrismaClient = () => {
  const adapter = new PrismaNeonHttp(process.env.DATABASE_URL || "", {
    fullResults: false,
    arrayMode: false,
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
