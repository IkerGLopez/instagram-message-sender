import IORedis from 'ioredis';
import { config } from 'dotenv';

config();

const redis = new IORedis(process.env.REDIS_URL, { maxRetriesPerRequest: 1 });

redis.on('ready', async () => {
  console.log('Redis connected\n');

  const patterns = ['*follow*', '*bull*', '*dm*'];
  for (const pattern of patterns) {
    const keys = await redis.keys(pattern);
    if (keys.length > 0) {
      console.log(`\n--- Keys matching "${pattern}" (${keys.length}) ---`);
      for (const key of keys) {
        const type = await redis.type(key);
        let value = '';
        if (type === 'list') {
          const len = await redis.llen(key);
          value = `[list, ${len} items]`;
          if (len > 0 && len <= 5) {
            const items = await redis.lrange(key, 0, -1);
            value += '\n  ' + items.map((i) => JSON.parse(i).name || 'unnamed').join(', ');
          }
        } else if (type === 'zset') {
          const len = await redis.zcard(key);
          value = `[sorted set, ${len} items]`;
        } else if (type === 'string') {
          value = await redis.get(key);
        } else if (type === 'hash') {
          value = `[hash]`;
        }
        console.log(`  ${key} (${type}): ${value}`);
      }
    }
  }

  // Check for jobs in the wait list specifically
  const waitLen = await redis.llen('bull:follow-queue:wait');
  const activeLen = await redis.zcard('bull:follow-queue:active');
  const delayedLen = await redis.zcard('bull:follow-queue:delayed');
  const pausedLen = await redis.llen('bull:follow-queue:paused');

  console.log('\n--- Follow Queue Status ---');
  console.log(`  Waiting:  ${waitLen}`);
  console.log(`  Active:   ${activeLen}`);
  console.log(`  Delayed:  ${delayedLen}`);
  console.log(`  Paused:   ${pausedLen}`);

  if (waitLen > 0) {
    const jobs = await redis.lrange('bull:follow-queue:wait', 0, -1);
    console.log('\n  Waiting jobs:');
    for (const j of jobs) {
      const parsed = JSON.parse(j);
      console.log(`    - ${parsed.name} (id: ${parsed.id}, jobId: ${parsed.jobId || 'n/a'})`);
    }
  }

  await redis.quit();
  console.log('\nDone.');
});

redis.on('error', (err) => {
  console.error('Redis connection error:', err.message);
  process.exit(1);
});
