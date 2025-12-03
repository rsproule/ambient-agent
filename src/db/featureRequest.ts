/**
 * Feature Request Database Operations
 *
 * Simple CRUD for storing feature requests from users.
 */

import { prisma } from "./client";

export interface CreateFeatureRequestInput {
  description: string;
  phoneNumber?: string;
  userName?: string;
  context?: string;
}

/**
 * Create a new feature request
 */
export async function createFeatureRequest(input: CreateFeatureRequestInput) {
  return prisma.featureRequest.create({
    data: {
      description: input.description,
      phoneNumber: input.phoneNumber,
      userName: input.userName,
      context: input.context,
    },
  });
}

/**
 * Get all feature requests, ordered by most recent first
 */
export async function getAllFeatureRequests(options?: { limit?: number }) {
  return prisma.featureRequest.findMany({
    orderBy: { createdAt: "desc" },
    take: options?.limit,
  });
}

/**
 * Get feature requests from a specific user
 */
export async function getFeatureRequestsByUser(phoneNumber: string) {
  return prisma.featureRequest.findMany({
    where: { phoneNumber },
    orderBy: { createdAt: "desc" },
  });
}

