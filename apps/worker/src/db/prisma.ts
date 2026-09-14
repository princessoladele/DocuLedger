import { PrismaClient } from "@doculedger/database";

/** Single shared Prisma connection for the worker process's lifetime. */
export const prisma = new PrismaClient();
