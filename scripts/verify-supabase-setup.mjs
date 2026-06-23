/**
 * Quick Supabase connectivity check (run from repo root).
 * node scripts/verify-supabase-setup.mjs
 */
import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const envPath = resolve(root, '.env');

function loadEnv() {
  if (!existsSync(envPath)) return {};
  const out = {};
  for (const line of readFileSync(envPath, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (!m) continue;
    out[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
  return out;
}

const env = loadEnv();
const url = env.VITE_SUPABASE_URL?.trim();
const key = env.VITE_SUPABASE_ANON_KEY?.trim();
const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY?.trim();

const results = [];

function ok(label, pass, detail = '') {
  results.push({ label, pass, detail });
}

ok('.env in repo root', existsSync(envPath));
ok('VITE_SUPABASE_URL set', Boolean(url), url || 'missing');
ok('VITE_SUPABASE_ANON_KEY set', Boolean(key), key ? `length ${key.length}` : 'missing');
ok(
  'Publishable key format',
  !key || key.startsWith('sb_publishable_') || key.startsWith('eyJ'),
  key?.slice(0, 16) ?? '',
);

if (!url || !key) {
  printResults();
  process.exit(1);
}

// Auth health (no key needed for some projects)
try {
  const authRes = await fetch(`${url}/auth/v1/health`);
  ok('Supabase Auth reachable', authRes.status < 500, `HTTP ${authRes.status}`);
} catch (e) {
  ok('Supabase Auth reachable', false, e.message);
}

// REST — companies table (RLS + grants)
try {
  const restRes = await fetch(`${url}/rest/v1/companies?select=id&limit=1`, {
    headers: { apikey: key, Authorization: `Bearer ${key}` },
  });
  const body = await restRes.text();
  ok(
    'Data API / companies table',
    restRes.status === 200,
    `HTTP ${restRes.status} ${body.slice(0, 80)}`,
  );
} catch (e) {
  ok('Data API / companies table', false, e.message);
}

// profiles table
try {
  const restRes = await fetch(`${url}/rest/v1/profiles?select=id&limit=1`, {
    headers: { apikey: key, Authorization: `Bearer ${key}` },
  });
  ok('Data API / profiles table', restRes.status === 200, `HTTP ${restRes.status}`);
} catch (e) {
  ok('Data API / profiles table', false, e.message);
}

// team_members (was recursion — should be 200 empty, not 500)
try {
  const restRes = await fetch(`${url}/rest/v1/team_members?select=id&limit=1`, {
    headers: { apikey: key, Authorization: `Bearer ${key}` },
  });
  const body = await restRes.text();
  ok(
    'Data API / team_members (no RLS recursion)',
    restRes.status === 200 && !body.includes('infinite recursion'),
    `HTTP ${restRes.status}`,
  );
} catch (e) {
  ok('Data API / team_members', false, e.message);
}

// Storage buckets (private buckets are not visible to anon key — use service role if set)
try {
  const storageKey = serviceKey || key;
  const storageRes = await fetch(`${url}/storage/v1/bucket`, {
    headers: { apikey: storageKey, Authorization: `Bearer ${storageKey}` },
  });
  const buckets = storageRes.ok ? await storageRes.json() : [];
  const names = Array.isArray(buckets) ? buckets.map((b) => b.name ?? b.id) : [];
  ok('Storage API reachable', storageRes.status === 200, `HTTP ${storageRes.status}`);

  let receiptsExists = names.includes('receipts');
  let paymentProofsExists = names.includes('payment-proofs');
  if (!receiptsExists) {
    const one = await fetch(`${url}/storage/v1/bucket/receipts`, {
      headers: { apikey: storageKey, Authorization: `Bearer ${storageKey}` },
    });
    receiptsExists = one.status === 200;
  }
  if (!paymentProofsExists) {
    const one = await fetch(`${url}/storage/v1/bucket/payment-proofs`, {
      headers: { apikey: storageKey, Authorization: `Bearer ${storageKey}` },
    });
    paymentProofsExists = one.status === 200;
  }
  ok(
    'Bucket "receipts" exists',
    receiptsExists,
    receiptsExists ? 'ok' : names.join(', ') || 'not found — run npm run setup-storage',
  );
  ok(
    'Bucket "payment-proofs" exists',
    paymentProofsExists,
    paymentProofsExists ? 'ok' : 'not found',
  );
} catch (e) {
  ok('Storage API', false, e.message);
}

// Express OCR backend
try {
  const health = await fetch('http://localhost:4000/api/health', { signal: AbortSignal.timeout(3000) });
  const data = await health.json().catch(() => ({}));
  ok('Express OCR backend (:4000)', health.ok, data.db ? `db=${data.db}` : 'up');
} catch {
  ok('Express OCR backend (:4000)', false, 'not running — receipt scan needs: cd server && npm run dev');
}

// Frontend
for (const port of [5173, 5174, 5175, 5176, 5177]) {
  try {
    const r = await fetch(`http://localhost:${port}/`, { signal: AbortSignal.timeout(2000) });
    if (r.ok) {
      ok('Vite frontend', true, `http://localhost:${port}/`);
      break;
    }
  } catch {
    /* try next */
  }
}
if (!results.find((r) => r.label === 'Vite frontend' && r.pass)) {
  ok('Vite frontend', false, 'not running — npm run dev');
}

printResults();

function printResults() {
  console.log('\nBULA AUDIT — Supabase setup check\n');
  let failed = 0;
  for (const { label, pass, detail } of results) {
    const icon = pass ? 'PASS' : 'FAIL';
    console.log(`[${icon}] ${label}${detail ? ` — ${detail}` : ''}`);
    if (!pass) failed++;
  }
  console.log(`\n${failed ? `${failed} issue(s) — see FAIL lines above` : 'All automated checks passed.'}`);
  console.log('\nManual (Supabase dashboard):');
  console.log('  - Migrations 1–5 run in SQL Editor');
  console.log('  - Auth → URL config: Site URL + http://localhost:PORT/**');
  console.log('  - Email confirm OFF for easy local testing');
  process.exit(failed ? 1 : 0);
}
