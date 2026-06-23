/** Vercel serverless health check (Supabase mode). */
export default async function handler(_req, res) {
  res.status(200).json({
    ok: true,
    mode: 'vercel',
    db: 'supabase',
    ts: new Date().toISOString(),
  });
}
