/**
 * API smoke test — run: node scripts/smoke-test.js
 */
const BASE = process.env.API_BASE || 'http://localhost:5000';

async function req(method, path, body, token) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let data;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = text;
  }
  return { status: res.status, data };
}

async function login(loginId, password) {
  const r = await req('POST', '/api/auth/login', { loginId, password });
  if (r.status !== 200 || !r.data?.token) {
    throw new Error(`Login failed (${loginId}): ${r.status} ${JSON.stringify(r.data)}`);
  }
  return r.data.token;
}

async function test(name, fn) {
  try {
    await fn();
    console.log(`✅ ${name}`);
    return true;
  } catch (e) {
    console.error(`❌ ${name}: ${e.message}`);
    return false;
  }
}

async function main() {
  console.log(`Smoke testing ${BASE}\n`);
  let passed = 0;
  let failed = 0;
  const ok = async (name, fn) => (await test(name, fn) ? passed++ : failed++);

  await ok('Health + DB', async () => {
    const r = await req('GET', '/health');
    if (r.status !== 200 || r.data?.db !== 'connected') throw new Error(JSON.stringify(r.data));
  });

  await ok('Public crop prices', async () => {
    const r = await req('GET', '/api/crops/prices');
    if (r.status !== 200 || !Array.isArray(r.data)) throw new Error(`status ${r.status}`);
  });

  const adminToken = await login('admin@farmease.in', 'admin123');
  const farmerToken = await login('farmer@farmease.in', 'farmer123');
  const employeeToken = await login('employee@farmease.in', 'employee123');
  const workerToken = await login('worker@farmease.in', 'worker123');
  console.log('✅ Auth login (admin, farmer, employee, worker)');
  passed += 1;

  await ok('Admin dashboard', async () => {
    const r = await req('GET', '/api/admin/dashboard', null, adminToken);
    if (r.status !== 200) throw new Error(`${r.status} ${JSON.stringify(r.data)}`);
  });

  await ok('Admin inventory', async () => {
    const r = await req('GET', '/api/admin/inventory', null, adminToken);
    if (r.status !== 200) throw new Error(`${r.status}`);
  });

  await ok('Admin farmers list', async () => {
    const r = await req('GET', '/api/admin/farmers/list', null, adminToken);
    if (r.status !== 200) throw new Error(`${r.status}`);
  });

  await ok('Admin workers list', async () => {
    const r = await req('GET', '/api/admin/workers/list', null, adminToken);
    if (r.status !== 200) throw new Error(`${r.status}`);
  });

  await ok('Admin price trends', async () => {
    const r = await req('GET', '/api/admin/price-trends', null, adminToken);
    if (r.status !== 200) throw new Error(`${r.status}`);
  });

  await ok('Pickups list (admin)', async () => {
    const r = await req('GET', '/api/pickup/list', null, adminToken);
    if (r.status !== 200) throw new Error(`${r.status}`);
  });

  await ok('Pickups my (farmer)', async () => {
    const r = await req('GET', '/api/pickup/my', null, farmerToken);
    if (r.status !== 200) throw new Error(`${r.status}`);
  });

  await ok('Procurements list', async () => {
    const r = await req('GET', '/api/procurements', null, adminToken);
    if (r.status !== 200) throw new Error(`${r.status}`);
  });

  await ok('Tasks my (worker)', async () => {
    const r = await req('GET', '/api/tasks/my', null, workerToken);
    if (r.status !== 200) throw new Error(`${r.status}`);
  });

  await ok('Attendance history (employee)', async () => {
    const r = await req('GET', '/api/attendance/history', null, employeeToken);
    if (r.status !== 200) throw new Error(`${r.status}`);
  });

  await ok('Attendance all (admin)', async () => {
    const r = await req('GET', '/api/attendance/all', null, adminToken);
    if (r.status !== 200) throw new Error(`${r.status}`);
  });

  await ok('Farmer payments', async () => {
    const r = await req('GET', '/api/farmer/payments', null, farmerToken);
    if (r.status !== 200) throw new Error(`${r.status}`);
  });

  await ok('Farmer transactions', async () => {
    const r = await req('GET', '/api/farmer/transactions', null, farmerToken);
    if (r.status !== 200) throw new Error(`${r.status}`);
  });

  await ok('Admin payments all', async () => {
    const r = await req('GET', '/api/farmer/payments/all', null, adminToken);
    if (r.status !== 200) throw new Error(`${r.status}`);
  });

  await ok('Notifications', async () => {
    const r = await req('GET', '/api/notifications', null, farmerToken);
    if (r.status !== 200) throw new Error(`${r.status}`);
  });

  await ok('Chat list', async () => {
    const r = await req('GET', '/api/chat/list', null, adminToken);
    if (r.status !== 200) throw new Error(`${r.status}`);
  });

  await ok('Vehicles', async () => {
    const r = await req('GET', '/api/admin/vehicles', null, adminToken);
    if (r.status !== 200) throw new Error(`${r.status}`);
  });

  console.log(`\n--- Results: ${passed} passed, ${failed} failed ---`);
  process.exit(failed > 0 ? 1 : 0);
}

main().catch((e) => {
  console.error('Fatal:', e.message);
  process.exit(1);
});
