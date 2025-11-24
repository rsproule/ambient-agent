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
 * Upsert a user by phone number (creates if doesn't exist, updates if exists)
 */
export async function upsertUser(
  phoneNumber: string,
  input?: Partial<CreateUserInput>,
): Promise<User> {
  const user = await prisma.user.upsert({
    where: { phoneNumber },
    create: {
      phoneNumber,
      name: input?.name,
      email: input?.email,
      metadata: input?.metadata as Prisma.InputJsonValue | undefined,
    },
    update: {
      // Only update fields that are explicitly provided
      ...(input?.name !== undefined && { name: input.name }),
      ...(input?.email !== undefined && { email: input.email }),
      ...(input?.metadata !== undefined && {
        metadata: input.metadata as Prisma.InputJsonValue,
      }),
    },
  });

  return formatUser(user);
}

/**
 * Upsert multiple users by phone numbers (batch operation for groups)
 */
export async function upsertUsers(phoneNumbers: string[]): Promise<User[]> {
  // Filter out empty strings and deduplicate
  const uniquePhoneNumbers = [...new Set(phoneNumbers.filter(Boolean))];

  // Use a transaction to upsert all users
  const users = await Promise.all(
    uniquePhoneNumbers.map((phoneNumber) => upsertUser(phoneNumber)),
  );

  return users;
}

/**
 * Get user context/config from metadata by phone number
 */
export async function getUserContext(
  phoneNumber: string,
): Promise<Record<string, unknown> | null> {
  const user = await prisma.user.findUnique({
    where: { phoneNumber },
    select: { metadata: true },
  });

  return user?.metadata as Record<string, unknown> | null;
}

/**
 * Update user context/config in metadata by phone number
 * Merges with existing metadata unless replace is true
 */
export async function updateUserContext(
  phoneNumber: string,
  context: Record<string, unknown>,
  replace: boolean = false,
): Promise<User> {
  // First ensure the user exists
  const existingUser = await prisma.user.findUnique({
    where: { phoneNumber },
  });

  if (!existingUser) {
    // Create user if doesn't exist
    return await upsertUser(phoneNumber, { metadata: context });
  }

  // Merge or replace metadata
  const existingMetadata = existingUser.metadata as Record<
    string,
    unknown
  > | null;
  const newMetadata = replace
    ? context
    : {
        ...(existingMetadata || {}),
        ...context,
      };

  const user = await prisma.user.update({
    where: { phoneNumber },
    data: {
      metadata: newMetadata as Prisma.InputJsonValue,
    },
  });

  return formatUser(user);
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
