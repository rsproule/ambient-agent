import { PrismaPg } from "@prisma/adapter-pg";
import { attachDatabasePool } from "@vercel/functions";
import { Pool } from "pg";
import { PrismaClient } from "../generated/prisma";

// Create connection pool
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

// Attach pool to Vercel Fluid for proper connection management
attachDatabasePool(pool);

// Create Prisma client with pg adapter
const createPrismaClient = () => {
  return new PrismaClient({
    adapter: new PrismaPg(pool),
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  });
};

declare global {
  var prisma: ReturnType<typeof createPrismaClient> | undefined;
}

export const prisma = global.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") global.prisma = prisma;

export default prisma;
