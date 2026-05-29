# Deploying BULA AUDIT to production

This guide walks through deploying the full stack with these services:

| Layer | Service | Why | Cost (small scale) |
|-------|---------|-----|---------------------|
| Frontend | **Cloudflare Pages** | Global CDN, auto SSL, unlimited bandwidth | Free |
| Backend (API) | **Railway** | Easy deploy from GitHub, Singapore region available, MySQL add-on | $5/mo free credit, then ~$5-15/mo |
| Database | **Railway MySQL** (preferred) or **TiDB Cloud Serverless** (free 5 GB) | Co-located with backend (Railway) or genuinely free (TiDB) | Included in Railway / Free (TiDB) |
| File storage | **Cloudflare R2** | S3-compatible, no egress fees | Free up to 10 GB |
| Email | **Resend** | Simple API, generous free tier | Free up to 3000/mo |
| Domain | `.com.fj` registrar | Local trust for Fiji users | ~FJD 100/yr |

Total starting cost: ~$5-15 USD/month + domain. Scales up only with real traffic.

> Note: PlanetScale removed their free tier in April 2024. Replaced with Railway MySQL (small free credit, co-located) or TiDB Cloud Serverless (genuinely free, MySQL-compatible).

> If you want a different stack (Render instead of Railway, Neon instead of PlanetScale, etc.) the steps are nearly identical — only the dashboard names change.

---

## 0. Prerequisites — accounts to create (15 min)

1. **GitHub** account with the BULA AUDIT repo pushed to it
2. **Railway** — https://railway.app (sign in with GitHub)
3. **PlanetScale** — https://planetscale.com (sign in with GitHub)
4. **Cloudflare** — https://dash.cloudflare.com (free)
5. **Resend** — https://resend.com (free)
6. **OpenAI** — https://platform.openai.com (already required for AI features)
7. **Google Cloud Console** — https://console.cloud.google.com (for OAuth, optional)
8. **A `.com.fj` domain** from a Fiji registrar (or any domain you own)

Have all of these signed up before you start. The deploy itself takes ~30 min once the accounts exist.

---

## 1. MySQL database — Railway MySQL plugin (recommended)

The simplest option: add MySQL to your Railway project. Co-located with the backend (no network hop), included in Railway's $5/mo free credit, MySQL 8 (not a proprietary fork).

You'll set this up **inside the Railway project**, after step 6:

1. In your Railway project (created in step 6) → click **+ New** → **Database** → **MySQL**
2. Railway provisions it in ~30 seconds and creates a `DATABASE_URL` variable automatically
3. Reference it from your backend service: in the backend service's Variables tab, add `DATABASE_URL` with value `${{MySQL.DATABASE_URL}}` (Railway substitutes the real URL)
4. Set the backend's **Start Command** to: `npx prisma migrate deploy && node dist/index.js` — runs migrations on every deploy

### Alternative: TiDB Cloud Serverless (free forever, 5 GB)

If you want a separate, genuinely free MySQL-compatible DB:

1. Sign up at <https://tidbcloud.com> (Google sign-in works, no card required)
2. Create a **Serverless** cluster (free tier) in **Singapore**
3. Get the connection string from **Connect → Prisma**
4. Use it as your `DATABASE_URL` instead of Railway's

TiDB is MySQL wire-compatible — Prisma treats it as MySQL. Slight quirks: it doesn't enforce foreign keys (similar to PlanetScale), so we use `relationMode = "prisma"` in the schema.

### Switch our schema to MySQL (one-time)

In your local repo, edit `server/prisma/schema.prisma`:

```prisma
datasource db {
  provider     = "mysql"   // was "sqlite"
  url          = env("DATABASE_URL")
  relationMode = "prisma"  // safe for both Railway MySQL and TiDB
}
```

Commit and push that change. When Railway deploys, the `migrate deploy` step on startup creates all tables in the new MySQL database.

### Keep local on SQLite

Your local dev can stay on SQLite (zero setup, fast). Only production needs MySQL. Both work from the same Prisma schema; the `provider` is read from `schema.prisma` at build time, but Prisma supports building once per DB via separate schema files if you ever need both. Easiest: edit `provider = "mysql"` before deploying, and Prisma generates the correct client for prod.

---

## 2. Cloudflare R2 — file storage (5 min)

1. In Cloudflare dashboard, click **R2** in the left sidebar
2. **Create bucket**:
   - Name: `bula-audit`
   - Location hint: **APAC**
   - Click **Create**
3. Click **Manage R2 API tokens → Create API token**
   - Token name: `bula-audit-server`
   - Permissions: **Object Read & Write**
   - Specify bucket: `bula-audit` (more secure than account-wide)
   - TTL: forever (or rotate later)
   - Click **Create API token**
4. Copy these — they won't show again:
   - **Access Key ID**
   - **Secret Access Key**
   - **Endpoint** (looks like `https://<account_id>.r2.cloudflarestorage.com`)

### Optional: custom public domain for files

By default, R2 buckets are **private** (the server uses signed URLs). If you want receipt images served from your own domain (e.g. `files.bulaaudit.com.fj`):

1. In R2 bucket settings → **Public access** → **Connect Custom Domain**
2. Add a subdomain like `files.bulaaudit.com.fj`
3. Cloudflare adds the DNS automatically

If you do this, you'll set `S3_PUBLIC_BASE_URL` in Railway env vars. Otherwise leave it blank — signed URLs work fine.

---

## 3. Resend — email (3 min)

1. Sign in to Resend → **API Keys → Create API Key**
2. Name: `bula-audit-prod`, permission: **Sending access**, all domains
3. Copy the `re_...` key

### Verify your sending domain

1. **Domains → Add Domain** → enter your domain (e.g. `bulaaudit.com.fj`)
2. Resend shows you DNS records (SPF, DKIM, MX). Add them to your domain DNS.
3. Wait a few minutes, click **Verify**.
4. Until verified you can only send from `onboarding@resend.dev` — fine for testing, not for production.

---

## 4. OpenAI — AI receipt OCR (already done)

Make sure your OpenAI key is ready: <https://platform.openai.com/api-keys>. You'll paste it into Railway in the next step.

---

## 5. Google OAuth — for production callback (optional, 5 min)

If you want Google sign-in on production:

1. Open <https://console.cloud.google.com/apis/credentials>
2. **+ Create Credentials → OAuth client ID → Web application**
3. **Authorized redirect URIs**, add:
   ```
   https://api.bulaaudit.com.fj/api/auth/google/callback
   ```
   (replace with whatever your backend domain ends up being)
4. Update the **OAuth consent screen** with your privacy + terms URLs:
   - Privacy: `https://bulaaudit.com.fj/privacy`
   - Terms:   `https://bulaaudit.com.fj/terms`
5. Copy the Client ID + Secret for Railway.

---

## 6. Railway — deploy the backend (10 min)

1. Sign in to Railway → **New Project → Deploy from GitHub repo** → pick the BULA AUDIT repo
2. Railway will detect Node. Important: **set the root directory** to `server/`:
   - Settings → **Root Directory** → `server`
3. Settings → **Build Command**: `npm install && npx prisma generate && npm run build`
4. Settings → **Start Command**: `npx prisma migrate deploy && node dist/index.js`
5. Settings → **Variables** — add these:

| Variable | Value |
|----------|-------|
| `NODE_ENV` | `production` |
| `PORT` | `4000` (or whatever Railway provides via `$PORT`) |
| `CLIENT_ORIGIN` | `https://bulaaudit.com.fj` (your production frontend URL) |
| `DATABASE_URL` | (from PlanetScale step) |
| `JWT_SECRET` | a strong random hex string (`node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"`) |
| `JWT_EXPIRES_IN` | `15m` |
| `STORAGE_DRIVER` | `s3` |
| `S3_ENDPOINT` | (from R2 step) |
| `S3_BUCKET` | `bula-audit` |
| `S3_ACCESS_KEY_ID` | (from R2 step) |
| `S3_SECRET_ACCESS_KEY` | (from R2 step) |
| `S3_PUBLIC_BASE_URL` | (optional, your custom domain for files) |
| `S3_REGION` | `auto` |
| `S3_FORCE_PATH_STYLE` | `true` |
| `EMAIL_DRIVER` | `resend` |
| `EMAIL_FROM` | `BULA AUDIT <noreply@bulaaudit.com.fj>` |
| `RESEND_API_KEY` | (from Resend step) |
| `OPENAI_API_KEY` | (your OpenAI key) |
| `OPENAI_MODEL` | `gpt-4o-mini` |
| `GOOGLE_CLIENT_ID` | (optional, from Google step) |
| `GOOGLE_CLIENT_SECRET` | (optional) |
| `GOOGLE_REDIRECT_URI` | `https://api.bulaaudit.com.fj/api/auth/google/callback` |
| `APP_NAME` | `BULA AUDIT` |

6. Click **Deploy**. Watch the logs.
7. Once deployed, click **Settings → Networking → Generate Domain**. Railway gives you a `*.up.railway.app` URL.
8. Test: open `https://<railway-domain>/api/health`. Should return `{"status":"ok","db":"up",...}`.

### Custom domain for the API

1. Railway → **Settings → Networking → Custom Domain** → enter `api.bulaaudit.com.fj`
2. Railway shows DNS records (a CNAME). Add them to your domain DNS in Cloudflare.
3. Wait ~2 minutes. Railway shows green ✓ when ready.

---

## 7. Cloudflare Pages — deploy the frontend (10 min)

1. Cloudflare dashboard → **Workers & Pages → Create → Pages → Connect to Git**
2. Pick the BULA AUDIT repo
3. Build settings:
   - **Production branch**: `main`
   - **Build command**: `npm install && npm run build`
   - **Build output directory**: `dist`
   - **Root directory**: leave blank (project root, not `server/`)
4. Environment variables (build-time):

| Variable | Value |
|----------|-------|
| `VITE_API_URL` | `https://api.bulaaudit.com.fj` |

5. Click **Save and Deploy**.
6. Cloudflare gives you a `*.pages.dev` URL. Open it to test.

### Custom domain for the app

1. Cloudflare Pages → **Custom domains → Set up a custom domain** → `bulaaudit.com.fj`
2. Cloudflare adds DNS automatically.

### Important: Vite proxy doesn't work in production

In dev, Vite proxies `/api/*` to `localhost:4000`. In production, the built bundle calls `/api/*` directly which means we need it to hit the backend domain.

Easiest fix: instead of `/api`, use a full URL in production. Edit `src/api/base44Client.js`:

```js
const API_BASE = import.meta.env.VITE_API_URL ? `${import.meta.env.VITE_API_URL}/api` : '/api';
```

(This change is included in the latest commit.)

The backend must allow CORS from your frontend domain — that's already wired (`CLIENT_ORIGIN` env var).

---

## 8. Smoke test (5 min)

1. Open `https://bulaaudit.com.fj`
2. Sign up with a real email
3. Check your inbox — verification email should arrive within 30 seconds (sender: your `EMAIL_FROM`)
4. Complete verification
5. Create a company
6. Upload a receipt image
7. Check Cloudflare R2 bucket — the file should appear there
8. Check PlanetScale console — `SELECT * FROM Receipt LIMIT 1` should show your upload
9. Try forgot-password — email should arrive
10. Open `https://bulaaudit.com.fj/privacy` and `/terms` to confirm they render

---

## 9. After launch — operational checklist

- [ ] Set up **Sentry** for error tracking (free tier; add `SENTRY_DSN` env var; install `@sentry/node` later)
- [ ] Set up **UptimeRobot** monitoring on `https://api.bulaaudit.com.fj/api/health`
- [ ] Configure **PlanetScale daily backups** (auto on Hobby plan, verify in settings)
- [ ] Add a **status page** if you want one (BetterStack, free)
- [ ] Test **password reset** end-to-end with a fresh account
- [ ] Verify **rate limits** by sending 20 login attempts in a minute — should get 429
- [ ] Audit Google OAuth consent screen verification status (required for >100 users)
- [ ] Submit your custom domain to be added to Resend "Verified" list if not already
- [ ] Document your secrets in a password manager (1Password / Bitwarden) — never commit to Git

---

## Cost projection (first year, very small scale)

| Item | Cost (USD) |
|------|-----------|
| Domain `.com.fj` | ~$50/yr |
| Railway backend | ~$5-15/mo |
| PlanetScale | Free (Hobby) |
| Cloudflare Pages + R2 | Free |
| Resend | Free (3000 emails/mo) |
| OpenAI | ~$5-20/mo depending on receipt volume |
| **Total** | **~$15-40/mo + domain** |

This scales gracefully. PlanetScale jumps to $29/mo when you exceed 5 GB or 1 billion row reads. Resend bumps to $20/mo at 10k emails. None of these hit until you have real traffic.

---

## Common issues

**Migrations fail on first deploy.** PlanetScale rejects foreign key constraints in some plans. If you see "FOREIGN KEY constraint is incorrectly formed" errors, switch the Prisma schema's `relationMode = "prisma"`:

```prisma
datasource db {
  provider     = "mysql"
  url          = env("DATABASE_URL")
  relationMode = "prisma"
}
```

Then re-migrate.

**CORS errors in browser.** `CLIENT_ORIGIN` in Railway must exactly match the URL you're loading the app from. No trailing slash. Both `http://` and `https://` are case-sensitive.

**Google OAuth fails with "redirect_uri_mismatch".** The redirect URI in Google Cloud Console must match `GOOGLE_REDIRECT_URI` in Railway env vars character-for-character.

**Cookies don't work in production.** Make sure your frontend and API are on the same registrable domain (e.g. `bulaaudit.com.fj` and `api.bulaaudit.com.fj`) so cookies share. If they're on completely different domains you'll need to use Bearer auth only (which the frontend already does as fallback).

**Receipt uploads error out.** Check the bucket name matches `S3_BUCKET`. Check the R2 token has Read+Write on that specific bucket. Watch Railway logs.

**Sign-in works but immediately logs out.** Your JWT secret got rotated. All sessions invalidate. Users have to log in again. Don't do this unless you mean to.

---

## What's intentionally NOT here yet

These would be the next iteration's work:

- 2FA / TOTP for owner and admin accounts
- PWA / offline support for mobile users
- M-PAiSA payment integration (needs Vodafone Fiji contact)
- SMS notifications for receipt-due reminders (Twilio)
- Receipt PDF export
- Audit log viewer UI for admins
- Data export endpoint (GDPR-style)
- IP allowlist on admin endpoints

The codebase is structured to add these incrementally without rewrites.
