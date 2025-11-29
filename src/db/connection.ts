/**
 * Database operations for user connections
 */

import type {
  ConnectionProvider,
  ConnectionStatus,
  Prisma,
} from "@/src/generated/prisma";
import { prisma } from "./client";

export interface CreateConnectionInput {
  userId: string;
  provider: ConnectionProvider;
  accountEmail?: string;
  accountId?: string;
  pipedreamAccountId?: string;
  accessToken?: string;
  refreshToken?: string;
  expiresAt?: Date;
  scopes: string[];
  metadata?: Prisma.InputJsonValue;
}

export interface UpdateConnectionInput {
  status?: ConnectionStatus;
  accountEmail?: string;
  accountId?: string;
  pipedreamAccountId?: string;
  accessToken?: string | null;
  refreshToken?: string | null;
  expiresAt?: Date | null;
  scopes?: string[];
  metadata?: Prisma.InputJsonValue;
  lastSyncedAt?: Date;
}

export async function createConnection(input: CreateConnectionInput) {
  return prisma.connection.create({
    data: {
      userId: input.userId,
      provider: input.provider,
      status: "connected",
      accountEmail: input.accountEmail,
      accountId: input.accountId,
      pipedreamAccountId: input.pipedreamAccountId,
      accessToken: input.accessToken,
      refreshToken: input.refreshToken,
      expiresAt: input.expiresAt,
      scopes: input.scopes,
      metadata: input.metadata || {},
    },
  });
}

export async function updateConnection(
  userId: string,
  provider: ConnectionProvider,
  updates: UpdateConnectionInput,
) {
  return prisma.connection.update({
    where: {
      userId_provider: {
        userId,
        provider,
      },
    },
    data: updates,
  });
}

export async function getConnection(
  userId: string,
  provider: ConnectionProvider,
) {
  return prisma.connection.findUnique({
    where: {
      userId_provider: {
        userId,
        provider,
      },
    },
  });
}

export async function getUserConnections(userId: string) {
  return prisma.connection.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
  });
}

export async function deleteConnection(
  userId: string,
  provider: ConnectionProvider,
) {
  return prisma.connection.delete({
    where: {
      userId_provider: {
        userId,
        provider,
      },
    },
  });
}

export async function upsertConnection(input: CreateConnectionInput) {
  return prisma.connection.upsert({
    where: {
      userId_provider: {
        userId: input.userId,
        provider: input.provider,
      },
    },
    create: {
      userId: input.userId,
      provider: input.provider,
      status: "connected",
      accountEmail: input.accountEmail,
      accountId: input.accountId,
      pipedreamAccountId: input.pipedreamAccountId,
      accessToken: input.accessToken,
      refreshToken: input.refreshToken,
      expiresAt: input.expiresAt,
      scopes: input.scopes,
      metadata: input.metadata || {},
    },
    update: {
      status: "connected",
      accountEmail: input.accountEmail,
      accountId: input.accountId,
      pipedreamAccountId: input.pipedreamAccountId,
      accessToken: input.accessToken,
      refreshToken: input.refreshToken,
      expiresAt: input.expiresAt,
      scopes: input.scopes,
      metadata: input.metadata || {},
    },
  });
}
