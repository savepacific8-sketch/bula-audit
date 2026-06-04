# BULA AUDIT — Go live checklist

**What the repo already includes (after latest commit):**

- Cloudflare Turnstile on signup + forgot password (when keys are set)
- Fresh signed URLs for receipt images on S3/R2 when loading receipts
- Optional Sentry (`SENTRY_DSN`)
- Helper scripts in `scripts/`

**What only you can do:** create accounts, paste API keys, DNS, Railway dashboard.

---

## Part A — Done in code (pull latest / push to GitHub)

```powershell
cd C:\Users\zufar\bula-audit
git pull
git add -A
git commit -m "Go-live: Turnstile CAPTCHA, signed receipt URLs, Sentry hook, GO_LIVE guide"
git push origin main
```

Railway will redeploy automatically if GitHub is connected.

---

## Part B — Railway (you do this — ~30 min)

### B1. Confirm services

1. Open https://railway.app → your project.
2. You need **two** services:
   - **bula-audit** (app) — Source = GitHub repo `bula-audit`, branch `main`, root = repo root (not `server/`).
   - **MySQL** — database.

### B2. App variables (minimum)

Railway → **app service** → **Variables** → paste (edit values):

```env
NODE_ENV=production
CLIENT_ORIGIN=https://YOUR-RAILWAY-OR-CUSTOM-DOMAIN
DATABASE_URL=${{MySQL.DATABASE_URL}}
JWT_SECRET=PASTE_64_CHAR_HEX
JWT_EXPIRES_IN=15m
APP_NAME=BULA AUDIT
```

Generate JWT:

```powershell
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
```

**Do not set `PORT`** — Railway sets it.

### B3. Resend (real email)

1. https://resend.com → API Keys → Create → copy `re_...`
2. Add to Railway:

```env
EMAIL_DRIVER=resend
RESEND_API_KEY=re_...
EMAIL_FROM=BULA AUDIT <noreply@yourdomain.com>
EMAIL_REPLY_TO=support@yourdomain.com
```

3. Resend → Domains → add your domain → add DNS records at registrar/Cloudflare → Verify.

Until verified you can test with `onboarding@resend.dev` as From (Resend docs).

Local helper:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\configure-resend.ps1
```

### B4. Cloudflare R2 (receipt files)

1. https://dash.cloudflare.com → **R2** → Create bucket `bula-audit` (private, no public access).
2. **Manage R2 API tokens** → Create → Read & Write on that bucket.
3. Copy Account ID, Access Key, Secret, endpoint `https://ACCOUNT_ID.r2.cloudflarestorage.com`
4. Railway:

```env
STORAGE_DRIVER=s3
S3_ENDPOINT=https://ACCOUNT_ID.r2.cloudflarestorage.com
S3_REGION=auto
S3_BUCKET=bula-audit
S3_ACCESS_KEY_ID=...
S3_SECRET_ACCESS_KEY=...
S3_PUBLIC_BASE_URL=
S3_FORCE_PATH_STYLE=true
```

Leave `S3_PUBLIC_BASE_URL` **empty** for signed URLs.

Local helper:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\configure-r2.ps1
```

### B5. Turnstile CAPTCHA

1. Cloudflare dashboard → **Turnstile** → Add site.
2. Hostnames: your Railway URL and custom domain.
3. Copy **Site key** and **Secret key**.

**Railway app variables:**

```env
TURNSTILE_SECRET_KEY=your_secret_key
```

**Railway build variable** (needed for frontend widget — set on same app service):

```env
VITE_TURNSTILE_SITE_KEY=your_site_key
```

Redeploy after adding `VITE_*` (Vite bakes it in at build time).

Local:

```powershell
# server/.env
TURNSTILE_SECRET_KEY=...

# repo root .env (create if missing)
VITE_TURNSTILE_SITE_KEY=...
```

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\configure-turnstile.ps1
```

### B6. OpenAI (optional)

1. https://platform.openai.com/api-keys → create key, set billing cap.
2. Railway:

```env
OPENAI_API_KEY=sk-...
OPENAI_MODEL=gpt-4o-mini
```

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\configure-openai.ps1
```

### B7. Google sign-in (optional)

1. https://console.cloud.google.com/apis/credentials → OAuth Web client.
2. Redirect URI (exact):

```text
https://YOUR-DOMAIN/api/auth/google/callback
```

3. Railway:

```env
GOOGLE_CLIENT_ID=....apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=...
GOOGLE_REDIRECT_URI=https://YOUR-DOMAIN/api/auth/google/callback
```

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\configure-google-oauth.ps1 -RedirectUri "https://YOUR-DOMAIN/api/auth/google/callback"
```

### B8. Sentry (optional)

1. https://sentry.io → Project → Node → Express → copy DSN.
2. Railway: `SENTRY_DSN=https://...@sentry.io/...`
3. Redeploy.

### B9. Custom domain

1. Railway → app → **Settings** → **Networking** → **Custom Domain** → `bulaaudit.com.fj` (or subdomain).
2. Add CNAME at Cloudflare/registrar to Railway’s target.
3. Update `CLIENT_ORIGIN=https://bulaaudit.com.fj` and redeploy.
4. Update Google `GOOGLE_REDIRECT_URI` and Turnstile hostnames if used.

### B10. Verify deploy

1. Open `https://YOUR-DOMAIN/api/health` → `"status":"ok","db":"up"`.
2. Open `https://YOUR-DOMAIN` → sign up (CAPTCHA if Turnstile set).
3. Upload a receipt → image loads after refresh (signed URL).

---

## Part C — Monitoring (you — ~15 min)

### UptimeRobot

1. https://uptimerobot.com → Add monitor → HTTPS → `https://YOUR-DOMAIN/api/health` → 5 min → your email.

### Database backup (weekly)

1. Railway → MySQL → copy `DATABASE_URL` (one-time, do not commit).
2. On PC with MySQL client:

```powershell
mysqldump -h HOST -P PORT -u USER -p DATABASE > C:\Backups\bula-audit\backup-%date%.sql
```

3. Zip with a password; store offline.

---

## Part D — Security on your PC (~10 min)

```powershell
cd C:\Users\zufar\bula-audit
npm audit
npm audit fix

cd server
npm audit
npm audit fix
```

Commit lockfile changes if any.

---

## Part E — QA before marketing (you — ~1 hour)

Use two browsers (User A / User B), two companies.

| # | Test | Pass |
|---|------|------|
| 1 | Signup + email verify | Works |
| 2 | Login / logout | Works |
| 3 | Forgot password + CAPTCHA | Email received |
| 4 | Enable 2FA in Settings | TOTP works |
| 5 | Upload receipt | Image shows |
| 6 | Redeploy Railway | Upload still works (R2) |
| 7 | User B cannot open User A receipt ID (Network tab / guess URL) | 403/404 |
| 8 | `/privacy` `/terms` | Load |

---

## Quick reference — all Railway variables

```env
NODE_ENV=production
CLIENT_ORIGIN=https://your-domain
DATABASE_URL=${{MySQL.DATABASE_URL}}
JWT_SECRET=...
JWT_EXPIRES_IN=15m
APP_NAME=BULA AUDIT

EMAIL_DRIVER=resend
RESEND_API_KEY=re_...
EMAIL_FROM=BULA AUDIT <noreply@yourdomain.com>

STORAGE_DRIVER=s3
S3_ENDPOINT=https://....r2.cloudflarestorage.com
S3_REGION=auto
S3_BUCKET=bula-audit
S3_ACCESS_KEY_ID=...
S3_SECRET_ACCESS_KEY=...
S3_PUBLIC_BASE_URL=
S3_FORCE_PATH_STYLE=true

TURNSTILE_SECRET_KEY=...
VITE_TURNSTILE_SITE_KEY=...

OPENAI_API_KEY=sk-...
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...
GOOGLE_REDIRECT_URI=https://your-domain/api/auth/google/callback

SENTRY_DSN=https://...
```

---

## If something fails

| Problem | Fix |
|---------|-----|
| CORS error | `CLIENT_ORIGIN` must match browser URL exactly |
| CAPTCHA on signup but not locally | Normal — keys only in production build |
| Images break after 7 days | Re-open receipt (API refreshes signed URL) or re-upload |
| Email not sent | Check Resend domain + Railway logs |
| Deploy fails JWT | Use 64-char hex, not dev placeholder |
