import { PrismaClient } from '@prisma/client';
import { hashApiKey } from '../src/utils/crypto.js';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding database...');

  // Hash API key using the SAME function as the auth middleware
  const hashSecret = process.env.API_KEY_HASH_SECRET || 'dev-secret-do-not-use-in-production';
  const apiKey = 'sk_test_demo_key_12345';
  const apiKeyHash = hashApiKey(apiKey, hashSecret);

  // Create test follower
  const follower = await prisma.instagramFollower.upsert({
    where: { instagramUserId: 'test_user_001' },
    update: {},
    create: {
      instagramUserId: 'test_user_001',
    },
  });
  console.log(`✅ Follower: ${follower.instagramUserId}`);

  // Create test discount code (ACTIVE) — uses valid chars only (no 0 or 1)
  const code = await prisma.discountCode.upsert({
    where: { code: 'WELCOME-ABCDEFGH' },
    update: {},
    create: {
      code: 'WELCOME-ABCDEFGH',
      instagramUserId: follower.instagramUserId,
      status: 'ACTIVE',
      discountPercent: 3,
      expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days from now
    },
  });
  console.log(`✅ Discount code: ${code.code}`);

  // Create test API key hash
  await prisma.apiKey.upsert({
    where: { hash: apiKeyHash },
    update: {},
    create: {
      hash: apiKeyHash,
      name: 'Demo Test Key',
      isActive: true,
      expiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000), // 1 year from now
    },
  });
  console.log(`✅ API key hash created (plain text: ${apiKey})`);

  console.log('🌱 Seed complete!');
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
