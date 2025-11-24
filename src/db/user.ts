import prisma from "@/src/db/client";
import type { Prisma } from "@/src/generated/prisma";

export interface User {
  id: string;
  phoneNumber?: string;
  name?: string;
  email?: string;
  metadata?: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateUserInput {
  phoneNumber?: string;
  name?: string;
  email?: string;
  metadata?: Record<string, unknown>;
}

export interface UpdateUserInput {
  phoneNumber?: string;
  name?: string;
  email?: string;
  metadata?: Record<string, unknown>;
}

/**
 * Create a new user (phone-based or web-based)
 */
export async function createUser(input: CreateUserInput): Promise<User> {
  const user = await prisma.user.create({
    data: {
      phoneNumber: input.phoneNumber,
      name: input.name,
      email: input.email,
      metadata: input.metadata as Prisma.InputJsonValue | undefined,
    },
  });

  return formatUser(user);
}

/**
 * Get user by id (UUID)
 */
export async function getUserById(id: string): Promise<User | null> {
  const user = await prisma.user.findUnique({
    where: { id },
  });

  return user ? formatUser(user) : null;
}

/**
 * Get user by phone number
 */
export async function getUserByPhoneNumber(
  phoneNumber: string,
): Promise<User | null> {
  const user = await prisma.user.findUnique({
    where: { phoneNumber },
  });

  return user ? formatUser(user) : null;
}

/**
 * Update user information
 */
export async function updateUser(
  id: string,
  input: UpdateUserInput,
): Promise<User> {
  const user = await prisma.user.update({
    where: { id },
    data: {
      phoneNumber: input.phoneNumber,
      name: input.name,
      email: input.email,
      metadata: input.metadata as Prisma.InputJsonValue | undefined,
    },
  });

  return formatUser(user);
}

/**
 * Delete a user
 */
export async function deleteUser(id: string): Promise<void> {
  await prisma.user.delete({
    where: { id },
  });
}

/**
 * List all users (paginated)
 */
export async function listUsers(
  limit: number = 100,
  offset: number = 0,
): Promise<User[]> {
  const users = await prisma.user.findMany({
    take: limit,
    skip: offset,
    orderBy: { createdAt: "desc" },
  });

  return users.map(formatUser);
}

/**
 * Get phone number for a user id (convenience function)
 */
export async function getPhoneNumberForUser(
  id: string,
): Promise<string | null> {
  const user = await prisma.user.findUnique({
    where: { id },
    select: { phoneNumber: true },
  });

  return user?.phoneNumber ?? null;
}

/**
 * Format user from database to application format
 */
function formatUser(user: {
  id: string;
  phoneNumber: string | null;
  name: string | null;
  email: string | null;
  metadata: unknown;
  createdAt: Date;
  updatedAt: Date;
}): User {
  return {
    id: user.id,
    phoneNumber: user.phoneNumber ?? undefined,
    name: user.name ?? undefined,
    email: user.email ?? undefined,
    metadata: user.metadata as Record<string, unknown> | undefined,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  };
}
