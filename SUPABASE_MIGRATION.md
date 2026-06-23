# BULA AUDIT — Supabase + Vercel migration guide

You chose **full Supabase** (Auth, Postgres, Storage) with **Vercel** for the frontend and thin serverless APIs.

This repo now includes the **foundation**. Express + MySQL still works until you flip env vars.

---

## What’s done (Phase 1)

| Piece | Location |
|-------|----------|
| PostgreSQL schema | `supabase/migrations/20250629000001_initial_schema.sql` |
| Row Level Security | `supabase/migrations/20250629000002_rls_policies.sql` |
| Storage buckets | `supabase/migrations/20250629000003_storage.sql` |
| Supabase JS client | `src/lib/supabase.js` |
| Data/auth adapter | `src/api/supabaseClient.js` |
| Auto-switch | `base44Client.js` uses Supabase when `VITE_SUPABASE_URL` is set |
| Vercel SPA config | `vercel.json` |
| Health API | `api/health.js` |

---

## Step 1 — Create Supabase project

1. Go to [supabase.com](https://supabase.com) → **New project**
2. Choose region close to Fiji (e.g. Sydney)
3. Save the **database password**

From **Project Settings → API**, copy:

- **Project URL** → `VITE_SUPABASE_URL`
- **anon public** key → `VITE_SUPABASE_ANON_KEY`
- **service_role** key → server-only (migrations, never in frontend)

---

## Step 2 — Run database migrations

**Option A — SQL Editor (easiest)**

1. Supabase → **SQL Editor**
2. Run each file in order:
   - `supabase/migrations/20250629000001_initial_schema.sql`
   - `supabase/migrations/20250629000002_rls_policies.sql`
   - `supabase/migrations/20250629000003_storage.sql`

**Option B — Supabase CLI**

```powershell
npm i -g supabase
cd C:\Users\zufar\bula-audit
supabase login
supabase link --project-ref YOUR_PROJECT_REF
supabase db push
```

---

## Step 3 — Configure Auth

Supabase → **Authentication → Providers**:

| Provider | Action |
|----------|--------|
| Email | Enable, confirm email if you want |
| Google | Enable, add OAuth client from Google Cloud Console |

**URL configuration** (Authentication → URL configuration):

- Site URL: `https://YOUR-APP.vercel.app`
- Redirect URLs: `http://localhost:5173/**`, `https://YOUR-APP.vercel.app/**`

---

## Step 4 — Local env

Create / edit **repo root** `.env`:

```env
VITE_SUPABASE_URL=https://xxxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOi...
```

Restart frontend: `npm run dev`

When these are set, the app uses **Supabase** instead of Express for auth + data.

---

## Step 5 — Deploy to Vercel

1. Push repo to GitHub
2. [vercel.com](https://vercel.com) → **Import** repo
3. Framework: **Vite**
4. Environment variables (Production + Preview):

```env
VITE_SUPABASE_URL=https://xxxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOi...
```

5. Deploy

---

## Step 6 — Migrate existing MySQL data (optional)

If you have data in local MySQL or Railway MySQL:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\migrate-mysql-to-supabase.ps1
```

This exports MySQL → JSON → imports into Supabase via service role. **User passwords** must be re-created or users use “Forgot password” (Supabase Auth uses new password hashes).

---

## What still needs Phase 2+ (not automatic yet)

| Feature | Current | Next step |
|---------|---------|-----------|
| Receipt OCR / PDF scan | Express (`server/`) | Vercel serverless `api/ai/*` or Supabase Edge Function |
| OpenAI agents | Express | Port to `api/ai/` on Vercel |
| Turnstile CAPTCHA | Express | Supabase Edge Function or Vercel middleware |
| Custom 2FA (TOTP) | Express | Supabase MFA or keep thin API |
| Email (Resend) | Express | Supabase Auth emails + Resend edge |
| Billing webhooks | Express | Vercel API routes |

OCR uses **Tesseract + pdf-parse** (Node-only, ~100MB). Best home: **Vercel serverless** with `maxDuration` or a small **Railway worker** that only handles `/api/ai/*`.

---

## Architecture after full migration

```
Phone/Browser
    ↓
Vercel (React SPA)
    ↓ direct (RLS)
Supabase — Auth, Postgres, Storage
    ↓
Vercel /api/* — OCR, OpenAI, webhooks only
```

---

## Rollback

Remove `VITE_SUPABASE_URL` from `.env` and redeploy. App falls back to Express + MySQL (`npm run dev:server`).

---

## Checklist

- [ ] Supabase project created
- [ ] 3 SQL migrations applied
- [ ] Google + Email auth configured
- [ ] `VITE_SUPABASE_*` in local `.env` and Vercel
- [ ] Vercel deploy green
- [ ] Sign up / login works
- [ ] Company onboarding works
- [ ] Receipt upload → Storage bucket `receipts`
- [ ] (Optional) MySQL data imported
- [ ] Phase 2: OCR API on Vercel
