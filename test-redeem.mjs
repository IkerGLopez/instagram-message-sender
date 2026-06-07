// fetch is global in Node 22+

const url = 'http://localhost:3000/api/v1/codes/redeem';
const headers = {
  'X-API-Key': 'sk_test_demo_key_12345',
  'Content-Type': 'application/json',
};
const body = JSON.stringify({
  code: 'WELCOME-ABCDEFGH',
  order_id: 'ORD-TEST-001',
  customer_ip: '127.0.0.1',
});

async function redeem() {
  console.log('→ POST', url);
  console.log('→ Body:', body);

  const res = await fetch(url, { method: 'POST', headers, body });
  const data = await res.json();

  console.log('← Status:', res.status);
  console.log('← Body:', JSON.stringify(data, null, 2));
  return data;
}

console.log('=== Test 1: First redeem ===');
const r1 = await redeem();

console.log('\n=== Test 2: Idempotent redeem (same request) ===');
const r2 = await redeem();

console.log('\n=== Idempotency check ===');
if (r1.success && r2.success) {
  console.log('✅ Both requests succeeded');
} else {
  console.log('⚠️  Results differ — check server logs');
}
