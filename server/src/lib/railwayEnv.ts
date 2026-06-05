/**
 * Railway injects RAILWAY_PUBLIC_DOMAIN, PORT, and (via reference) MYSQL_URL.
 * Normalize env before zod validation so deploy works with minimal manual vars.
 */
export function applyRailwayEnvDefaults(): void {
  const db = process.env.DATABASE_URL?.trim();
  const mysqlUrl = process.env.MYSQL_URL?.trim();
  if (!db && mysqlUrl) {
    process.env.DATABASE_URL = mysqlUrl;
    console.log('[env] DATABASE_URL set from MYSQL_URL');
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
