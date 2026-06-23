/**
 * Create Supabase storage buckets (needs service role).
 * node scripts/ensure-storage-buckets.mjs
 *
 * Set in .env:
 *   SUPABASE_SERVICE_ROLE_KEY=eyJ...  (Dashboard → Settings → API → service_role)
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
const url = (env.VITE_SUPABASE_URL || env.SUPABASE_URL || '').replace(/\/+$/, '');
const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY?.trim();

if (!url) {
  console.error('Missing VITE_SUPABASE_URL in .env');
  process.exit(1);
}

if (!serviceKey) {
  console.log('');
  console.log('No SUPABASE_SERVICE_ROLE_KEY in .env — cannot create buckets via API.');
  console.log('');
  console.log('Run this in Supabase → SQL Editor:');
  console.log('  supabase/migrations/20250629000003_storage.sql');
  console.log('');
  console.log('Or add service role key to .env and re-run this script.');
  process.exit(1);
}

const buckets = [
  {
    id: 'receipts',
    name: 'receipts',
    public: false,
    file_size_limit: 10485760,
    allowed_mime_types: ['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'application/pdf'],
  },
  {
    id: 'payment-proofs',
    name: 'payment-proofs',
    public: false,
    file_size_limit: 10485760,
    allowed_mime_types: ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'],
  },
];

const headers = {
  apikey: serviceKey,
  Authorization: `Bearer ${serviceKey}`,
  'Content-Type': 'application/json',
};

let ok = true;
for (const bucket of buckets) {
  const res = await fetch(`${url}/storage/v1/bucket`, {
    method: 'POST',
    headers,
    body: JSON.stringify(bucket),
  });
  if (res.ok || res.status === 409) {
    console.log(`OK: bucket "${bucket.id}"`);
  } else {
    const text = await res.text();
    console.error(`FAIL: bucket "${bucket.id}" — HTTP ${res.status} ${text.slice(0, 120)}`);
    ok = false;
  }
}

if (!ok) process.exit(1);

console.log('');
console.log('Buckets created. If upload still fails, run storage policies SQL:');
console.log('  supabase/migrations/20250629000003_storage.sql (lines 21+)');
console.log('');
