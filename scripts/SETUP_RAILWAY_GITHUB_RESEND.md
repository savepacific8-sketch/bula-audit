# Connect Railway ↔ GitHub + Resend (you do this in the browser)

Do these in order. The app code is already on GitHub at `savepacific8-sketch/bula-audit`.

---

## Part 1 — Link GitHub to Railway (10–15 min)

### 1A. Install Railway GitHub App on your **personal** GitHub

1. Open https://github.com/settings/installations  
2. Click **Configure** next to **Railway** (or install from https://railway.app → New Project → Deploy from GitHub if it asks).  
3. Under **Repository access**:
   - Choose **All repositories**, **or**
   - **Only select repositories** → add **`bula-audit`**.  
4. Click **Save**.

### 1B. Install Railway on the **organization** (if repo is under `savepacific8-sketch`)

Your repo is: `https://github.com/savepacific8-sketch/bula-audit`

1. Open (as org owner):  
   https://github.com/organizations/savepacific8-sketch/settings/installations  
2. If **Railway** is missing → **Install GitHub App** → search **Railway** → Install.  
3. Grant access to **`bula-audit`** (or all org repos).  
4. **Save**.

> If Railway still shows **“No repositories found”**, Part 1B was skipped. Public repo alone is not enough.

### 1C. Create or connect the Railway project

1. https://railway.app → your project (e.g. `bubbly-analysis`).  
2. Click the **app service** (not MySQL).  
3. **Settings** → **Source**:
   - **Connect Repo** → pick **`savepacific8-sketch/bula-audit`**
   - Branch: **`main`**
   - **Root directory:** leave **empty** (repo root — **not** `server/`)
4. **Settings** → confirm **Builder** uses Nixpacks / `railway.toml` from repo root.

### 1D. Add MySQL (same project)

1. Project canvas → **+ New** → **Database** → **MySQL**.  
2. Wait until MySQL is **Online**.

### 1E. Minimum Railway variables (app service)

Open **Variables** → **RAW Editor** → paste and edit:

```env
NODE_ENV=production
CLIENT_ORIGIN=https://REPLACE-WITH-YOUR-RAILWAY-DOMAIN.up.railway.app
DATABASE_URL=${{MySQL.DATABASE_URL}}
JWT_SECRET=REPLACE_WITH_64_CHAR_HEX
JWT_EXPIRES_IN=15m
APP_NAME=BULA AUDIT
```

Generate `JWT_SECRET` on your PC:

```powershell
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
```

Get public URL:

1. App service → **Settings** → **Networking** → **Generate Domain**.  
2. Copy URL (no trailing slash).  
3. Set `CLIENT_ORIGIN` to that exact URL → **Save** → **Redeploy**.

### 1F. Confirm deploy

1. **Deployments** tab → latest should be **Success** (green).  
2. Open `https://YOUR-DOMAIN.up.railway.app/api/health`  
   - Expect: `"status":"ok"` and `"db":"up"`.

If build fails with Prisma / Node version → pull latest `main` (includes Node 22 + nixpacks fix).

### 1G. CLI fallback (if GitHub picker never works)

```powershell
npm i -g @railway/cli
railway login
cd C:\Users\zufar\bula-audit
railway link
railway up
```

---

## Part 2 — Resend (10 min + DNS later)

### 2A. Create Resend account & API key

1. https://resend.com → Sign up.  
2. **API Keys** → **Create API Key**  
   - Name: `bula-audit`  
   - Permission: **Sending access**  
3. Copy key once: `re_...`

### 2B. Test locally first (optional but recommended)

```powershell
cd C:\Users\zufar\bula-audit
powershell -ExecutionPolicy Bypass -File .\scripts\configure-resend.ps1
```

When asked for **From**:

- **No domain verified yet:**  
  `BULA AUDIT <onboarding@resend.dev>`  
  (Resend only delivers to the email you used to sign up for Resend.)
- **After domain verified:**  
  `BULA AUDIT <noreply@bulaaudit.com.fj>`

Check: http://localhost:4000/api/health → `"email":{"configured":true}`

### 2C. Add same vars on Railway (required for production)

Railway → **app service** → **Variables** → add:

```env
EMAIL_DRIVER=resend
RESEND_API_KEY=re_YOUR_KEY_HERE
EMAIL_FROM=BULA AUDIT <onboarding@resend.dev>
EMAIL_REPLY_TO=you@your-email.com
```

Use `onboarding@resend.dev` until your domain is verified in Resend.

Print a reminder anytime:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\print-railway-email-vars.ps1
```

**Redeploy** after saving.

### 2D. Verify your domain (for real users)

1. Resend → **Domains** → **Add Domain** (e.g. `bulaaudit.com.fj`).  
2. Add DNS records at Cloudflare / registrar.  
3. When **Verified**, change Railway:

```env
EMAIL_FROM=BULA AUDIT <noreply@bulaaudit.com.fj>
EMAIL_REPLY_TO=support@bulaaudit.com.fj
```

Redeploy again.

### 2E. Test live email

1. Open your Railway URL → **Sign up** with a new email.  
2. Check inbox + spam.  
3. Or **Forgot password** on live site.

---

## Part 3 — After GitHub + Resend work

| Next (recommended) | Why |
|--------------------|-----|
| Cloudflare R2 (`GO_LIVE.md` Part B4) | Receipts survive redeploy |
| Turnstile CAPTCHA | Stops bot signups |
| UptimeRobot on `/api/health` | Know if site is down |

Full list: `GO_LIVE.md`

---

## Quick troubleshooting

| Symptom | Fix |
|---------|-----|
| No repos in Railway | Org GitHub App (1B) + refresh |
| Build failed Prisma Node | Pull latest `main`, redeploy |
| App crashes on start in prod | Add Resend vars (2C) — `console` email not allowed in production |
| CORS / login broken | `CLIENT_ORIGIN` must match browser URL exactly |
| Email works locally, not live | Same Resend vars on Railway + redeploy |
