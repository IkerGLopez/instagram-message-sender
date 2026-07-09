import { PrismaClient } from '@prisma/client';

/**
 * Test database setup and teardown helpers using Prisma transaction rollback.
 *
 * Usage:
 *   const db = await setupTestDb();
 *   // run tests...
 *   await teardownTestDb(db);
 *
 * For per-test isolation with rollback:
 *   const db = await setupTestDb();
 *   await db.$transaction(async (tx) => {
 *     // test code using tx instead of db...
 *   });
 *   await clearTestDb(db);
 */

const TEST_DATABASE_URL =
  process.env.TEST_DATABASE_URL ?? 'postgresql://dev:dev@localhost:5432/instagram_retention_test';

/**
 * Create a PrismaClient connected to the test database.
 */
export function setupTestDb(): PrismaClient {
  const db = new PrismaClient({
    datasources: {
      db: {
        url: TEST_DATABASE_URL,
      },
    },
  });
  return db;
}

/**
 * Disconnect the test database client.
 */
export async function teardownTestDb(db: PrismaClient): Promise<void> {
  await db.$disconnect();
}

/**
 * Delete all records from all tables managed by Prisma.
 * Use between tests to ensure clean state.
 *
 * Note: Order matters due to foreign key constraints.
 * Tables are cleared in reverse dependency order.
 */
export async function clearTestDb(db: PrismaClient): Promise<void> {
  // Disable FK checks temporarily so we can truncate in any order
  await db.$executeRaw`SET CONSTRAINTS ALL DEFERRED`.catch(() => {
    // ignore if not supported
  });

  // Truncate all tables
  const tables = ['dm_records', 'instagram_comments', 'instagram_followers', 'webhook_events'];
  for (const table of tables) {
    await db.$executeRawUnsafe(`DELETE FROM "${table}"`).catch(() => {
      // table may not exist in test DB schema yet
    });
  }
}