/**
 * Sync SUPABASE_URL + SUPABASE_ANON_KEY from repo root .env -> server/.env (for OCR).
 * node scripts/sync-supabase-to-server.mjs
 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const rootEnv = resolve(root, '.env');
const serverEnv = resolve(root, 'server', '.env');

function readKey(path, key) {
  if (!existsSync(path)) return null;
  for (const line of readFileSync(path, 'utf8').split(/\r?\n/)) {
    const m = line.match(new RegExp(`^${key}=(.*)$`));
    if (m) return m[1].replace(/^["']|["']$/g, '');
  }
  return null;
}

function patch(path, key, value) {
  let content = existsSync(path) ? readFileSync(path, 'utf8') : '';
  const line = `${key}="${value}"`;
  const re = new RegExp(`^${key}=.*$`, 'm');
  content = re.test(content) ? content.replace(re, line) : `${content.trimEnd()}\n${line}\n`;
  writeFileSync(path, content);
}

const url = readKey(rootEnv, 'VITE_SUPABASE_URL');
const key = readKey(rootEnv, 'VITE_SUPABASE_ANON_KEY');
if (!url || !key) {
  console.error('Missing VITE_SUPABASE_* in root .env');
  process.exit(1);
}
if (!existsSync(serverEnv)) {
  console.error('server/.env not found');
  process.exit(1);
}
patch(serverEnv, 'SUPABASE_URL', url);
patch(serverEnv, 'SUPABASE_ANON_KEY', key);
console.log('OK: server/.env SUPABASE_URL + SUPABASE_ANON_KEY synced');
