import prisma from "@/src/db/client";

export interface User {
  id: string;
  phoneNumber?: string;
  name?: string;
  email?: string;
  walletAddress?: string;
  hasCompletedOnboarding: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateUserInput {
  phoneNumber?: string;
  name?: string;
  email?: string;
}

export interface UpdateUserInput {
  phoneNumber?: string;
  name?: string;
  email?: string;
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

export interface UpsertUserResult {
  user: User;
  isNewUser: boolean;
}

/**
 * Upsert a user by phone number (creates if doesn't exist, updates if exists)
 * Returns the user and whether they were newly created
 */
export async function upsertUser(
  phoneNumber: string,
  input?: Partial<CreateUserInput>,
): Promise<UpsertUserResult> {
  // Check if user exists first
  const existingUser = await prisma.user.findUnique({
    where: { phoneNumber },
  });

  const user = await prisma.user.upsert({
    where: { phoneNumber },
    create: {
      phoneNumber,
      name: input?.name,
      email: input?.email,
    },
    update: {
      // Only update fields that are explicitly provided
      ...(input?.name !== undefined && { name: input.name }),
      ...(input?.email !== undefined && { email: input.email }),
    },
  });

  return {
    user: formatUser(user),
    isNewUser: !existingUser,
  };
}

/**
 * Upsert multiple users by phone numbers (batch operation for groups)
 */
export async function upsertUsers(phoneNumbers: string[]): Promise<User[]> {
  // Filter out empty strings and deduplicate
  const uniquePhoneNumbers = [...new Set(phoneNumbers.filter(Boolean))];

  // Use a transaction to upsert all users
  const results = await Promise.all(
    uniquePhoneNumbers.map((phoneNumber) => upsertUser(phoneNumber)),
  );

  return results.map((r) => r.user);
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
 * Set outbound opt-in preference for a user
 */
export async function setOutboundOptIn(
  phoneNumber: string,
  optIn: boolean,
): Promise<void> {
  await prisma.user.update({
    where: { phoneNumber },
    data: { outboundOptIn: optIn },
  });
}

/**
 * Get outbound opt-in status for a user
 */
export async function getOutboundOptIn(
  phoneNumber: string,
): Promise<boolean | null> {
  const user = await prisma.user.findUnique({
    where: { phoneNumber },
    select: { outboundOptIn: true },
  });

  return user?.outboundOptIn ?? null;
}

/**
 * Set onboarding completion status for a user
 */
export async function setOnboardingComplete(
  phoneNumber: string,
  complete: boolean = true,
): Promise<void> {
  await prisma.user.update({
    where: { phoneNumber },
    data: { hasCompletedOnboarding: complete },
  });
}

/**
 * Check if user has completed onboarding
 */
export async function hasCompletedOnboarding(
  phoneNumber: string,
): Promise<boolean> {
  const user = await prisma.user.findUnique({
    where: { phoneNumber },
    select: { hasCompletedOnboarding: true },
  });

  return user?.hasCompletedOnboarding ?? false;
}

/**
 * Format user from database to application format
 */
function formatUser(user: {
  id: string;
  phoneNumber: string | null;
  name: string | null;
  email: string | null;
  walletAddress: string | null;
  hasCompletedOnboarding: boolean;
  createdAt: Date;
  updatedAt: Date;
}): User {
  return {
    id: user.id,
    phoneNumber: user.phoneNumber ?? undefined,
    name: user.name ?? undefined,
    email: user.email ?? undefined,
    walletAddress: user.walletAddress ?? undefined,
    hasCompletedOnboarding: user.hasCompletedOnboarding,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  };
}
