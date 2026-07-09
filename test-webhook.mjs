import { createHmac } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

// Manual .env parse (no dotenv dependency needed)
function loadEnv(path) {
  const env = {};
  try {
    const lines = readFileSync(path, 'utf-8').split('\n');
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const eqIdx = trimmed.indexOf('=');
      if (eqIdx === -1) continue;
      const key = trimmed.slice(0, eqIdx).trim();
      let val = trimmed.slice(eqIdx + 1).trim();
      if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
        val = val.slice(1, -1);
      }
      env[key] = val;
    }
  } catch {
    console.error('⚠️  .env file not found');
    process.exit(1);
  }
  return env;
}

const envPath = resolve(import.meta.dirname, '.env');
const env = loadEnv(envPath);

const secret = env.INSTAGRAM_APP_SECRET;
if (!secret) {
  console.error('❌ INSTAGRAM_APP_SECRET not found in .env');
  process.exit(1);
}

const url = 'http://localhost:3000/webhooks/instagram';
// Generate random user ID for testing
const randomId = Math.random().toString(36).substring(2, 10);
const userId = '1279565511';
// const userId = '74099517673';

const payload = JSON.stringify({
  object: 'instagram',
  entry: [
    {
      id: 'test_page_id',
      time: Math.floor(Date.now() / 1000),
      changes: [
        {
          field: 'comments',
          value: {
            comment: {
              id: '1001',
              created_time: Math.floor(Date.now() / 1000),
              text: '¡BASUSTA! Me encanta este lugar',
              from: { id: userId },
            },
            media: { id: '2001' },
          },
        },
      ],
    },
  ],
});

function computeSignature(body, secret) {
  return `sha256=${createHmac('sha256', secret).update(body).digest('hex')}`;
}

const signature = computeSignature(payload, secret);

console.log('→ POST', url);
console.log('→ Secret:', secret.substring(0, 4) + '...');
console.log('→ Signature:', signature.substring(0, 20) + '...');
console.log('→ Payload:', payload);

const res = await fetch(url, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'X-Hub-Signature-256': signature,
  },
  body: payload,
});

const data = await res.text();

console.log('← Status:', res.status);
console.log('← Body:', data);

if (res.ok) {
  console.log('\n✅ Webhook accepted');
} else {
  console.log('\n❌ Webhook rejected');
}
