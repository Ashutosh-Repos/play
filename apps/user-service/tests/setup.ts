import { vi } from 'vitest';

// Global mock for @repo/database
// We use a defined object structure instead of Proxy to avoid "Invalid enum value" errors
// during module interop or Prisma runtime checks.
const mockPrisma = {
  user: {
    findUnique: vi.fn(),
    findFirst: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  },
  channel: {
    findUnique: vi.fn(),
    findMany: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    count: vi.fn(),
  },
  subscription: {
    findUnique: vi.fn(),
    findMany: vi.fn(),
    create: vi.fn(),
    delete: vi.fn(),
    update: vi.fn(),
  },
  emailVerificationToken: {
    create: vi.fn(),
    findUnique: vi.fn(),
    delete: vi.fn(),
  },
  auditLog: {
    create: vi.fn(),
    findFirst: vi.fn(),
  },
  notificationSettings: {
    findUnique: vi.fn(),
    upsert: vi.fn(),
    create: vi.fn(),
  },
  $transaction: vi.fn((actions) => Promise.resolve(actions)),
  $executeRaw: vi.fn(),
  $queryRaw: vi.fn(),
};

vi.mock('@repo/database', () => ({
  prisma: mockPrisma,
}));
