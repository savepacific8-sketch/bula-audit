import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

/** Run prisma db push after env is normalized (Railway MYSQL_URL → DATABASE_URL). */
export async function syncDbSchema(): Promise<void> {
  if (process.env.NODE_ENV !== 'production') return;

  const serverRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

  for (let attempt = 1; attempt <= 5; attempt++) {
    const result = spawnSync(
      'npx',
      ['prisma', 'db push', '--accept-data-loss', '--skip-generate'],
      { cwd: serverRoot, stdio: 'inherit', env: process.env },
    );
    if (result.status === 0) {
      console.log(`[db] schema sync ok (attempt ${attempt})`);
      return;
    }
    console.warn(`[db] prisma db push attempt ${attempt} failed`);
    if (attempt < 5) await new Promise((r) => setTimeout(r, 5000));
  }
  throw new Error('prisma db push failed after 5 attempts');
}
