function buildMysqlUrlFromParts(): string | null {
  const host = process.env.MYSQLHOST?.trim();
  const port = process.env.MYSQLPORT?.trim() || '3306';
  const user = process.env.MYSQLUSER?.trim();
  const pass = process.env.MYSQLPASSWORD ?? '';
  const database = process.env.MYSQLDATABASE?.trim();
  if (!host || !user || !database) return null;
  return `mysql://${encodeURIComponent(user)}:${encodeURIComponent(pass)}@${host}:${port}/${database}`;
}

/**
 * Railway injects RAILWAY_PUBLIC_DOMAIN, PORT, and (via reference) MYSQL_URL.
 * Normalize env before zod validation so deploy works with minimal manual vars.
 */
export function applyRailwayEnvDefaults(): void {
  if (process.env.DATABASE_URL?.trim() === '') {
    delete process.env.DATABASE_URL;
  }

  const db = process.env.DATABASE_URL?.trim();
  const mysqlUrl =
    process.env.MYSQL_URL?.trim() ||
    process.env.MYSQL_PUBLIC_URL?.trim() ||
    process.env.MYSQL_PRIVATE_URL?.trim();

  if (!db && mysqlUrl) {
    process.env.DATABASE_URL = mysqlUrl;
    console.log('[env] DATABASE_URL set from MYSQL_URL');
  }

  if (!process.env.DATABASE_URL?.trim()) {
    const built = buildMysqlUrlFromParts();
    if (built) {
      process.env.DATABASE_URL = built;
      console.log('[env] DATABASE_URL built from MYSQLHOST/MYSQLUSER/MYSQLDATABASE');
    }
  }

  const origin = process.env.CLIENT_ORIGIN?.trim() ?? '';
  const isPlaceholder =
    !origin ||
    origin.includes('localhost') ||
    /REPLACE|PASTE-YOUR|your-app\.up\.railway/i.test(origin);

  const publicDomain = process.env.RAILWAY_PUBLIC_DOMAIN?.trim();
  if (isPlaceholder && publicDomain) {
    process.env.CLIENT_ORIGIN = `https://${publicDomain}`;
    console.log(`[env] CLIENT_ORIGIN auto-set: ${process.env.CLIENT_ORIGIN}`);
  }
}
