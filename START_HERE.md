# BULA AUDIT — Start here (run + access the app)

Keep this file. You do not need to ask again for URLs if you follow it.

---

## How to open the app (bookmark these)

| Where | URL | When to use |
|-------|-----|-------------|
| **Local app (normal dev)** | **http://localhost:5173** | Every day on your laptop |
| **Local API health** | http://localhost:4000/api/health | Check backend is up |
| **Live app (Railway)** | **https://YOUR-APP.up.railway.app** | After deploy — replace with your real domain from Railway → Networking |
| **Live API health** | https://YOUR-APP.up.railway.app/api/health | Check production |

**Rule:** Use **5173** for the UI. Do **not** use port 4000 in the browser for the app (API only).

---

## Part 1 — One-time setup on your laptop

### 1. Install (once)

- **Node.js LTS:** https://nodejs.org  
- **MySQL 8** running locally (you already use this)  
- **Git** / GitHub Desktop (you have this)

### 2. Install packages (once per clone)

```powershell
cd C:\Users\zufar\bula-audit
npm install

cd server
npm install
copy .env.example .env
notepad .env
```

In `server\.env` set at least:

- `DATABASE_URL` — your local MySQL (e.g. `mysql://root:PASSWORD@localhost:3306/bula_audit`)
- `JWT_SECRET` — long random string
- `CLIENT_ORIGIN=http://localhost:5173`

### 3. Create database tables (once, or after schema changes)

```powershell
cd C:\Users\zufar\bula-audit\server
npx prisma db push
```

---

## Part 2 — Run locally (every time you work on the app)

You need **two** PowerShell windows. Leave both open while you use the app.

### Window 1 — Backend

```powershell
cd C:\Users\zufar\bula-audit\server
npm run dev
```

Wait for: `listening on http://localhost:4000`

### Window 2 — Frontend

```powershell
cd C:\Users\zufar\bula-audit
npm run dev
```

Wait for: `Local: http://localhost:5173/` (or 5174/5175 if 5173 is busy — use the URL Vite prints)

### Open the app

**http://localhost:5173**

- Login: http://localhost:5173/login  
- Sign up: http://localhost:5173/signup  

### Use on your phone (same Wi‑Fi as your laptop)

1. Start backend + frontend (both windows above). Vite prints a **Network** URL, e.g. `http://192.168.1.42:5173/`.
2. On your phone browser, open that **Network** URL (not `localhost`).
3. Log in with the same account. **Receipts → Upload → Take photo (camera)** scans receipts (free OCR).
4. If the phone cannot connect: allow Node/Vite through Windows Firewall; phone and PC must be on the same Wi‑Fi.

To find your PC IP manually:

```powershell
ipconfig
```

Look for **IPv4 Address** under Wi‑Fi (e.g. `192.168.1.42`), then open `http://THAT-IP:5173`.

### Share with managers (present to superiors)

**Full guide:** `SHARE_ON_MOBILE.md` (HTTPS link, tunnel, QR, Add to Home Screen).

| Situation | Link to share | Notes |
|-----------|---------------|--------|
| **Live on Railway** | `https://YOUR-APP.up.railway.app` | Best for managers — one permanent link. Set `CLIENT_ORIGIN` to this URL, redeploy. |
| **Temporary HTTPS link** | `https://….trycloudflare.com` | Run `scripts\share-tunnel.ps1` while dev is running; send link by WhatsApp/SMS. URL changes each restart. |
| **Same Wi‑Fi only** | Vite **Network** URL (`http://192.168.x.x:5173`) | No install; phone must be on your Wi‑Fi. |
| **Managers / staff** | Same URL + their own login | **Team** → add email as **Manager** → they **Sign up** at that link with that email. |

**For presentations:** approve receipts first (totals/VAT cards are **approved only**). Category and trend charts include **pending** uploads too. Receipts with no date use **upload date** on charts.

### If something fails

| Problem | Fix |
|---------|-----|
| Port 4000 in use | Backend already running — OK, or stop other `node` processes |
| Page won’t load on 5173 | Start frontend (Window 2) |
| Login/API errors | Start backend (Window 1); check http://localhost:4000/api/health |
| No email in inbox (local) | Normal until Resend is configured — see `scripts/RESEND_SETUP.md` |

---

## Part 3 — Railway + MySQL (live app on the internet)

**Database on Railway:** see **`RAILWAY_MYSQL.md`** (connect MySQL plugin, optional copy of local data).

### A. GitHub → Railway can see your repo

1. GitHub → **Settings** → **Applications** → **Railway** → **Save** (All repositories).  
2. If repo is `savepacific8-sketch/bula-audit`, also:  
   https://github.com/organizations/savepacific8-sketch/settings/installations  
   → Railway → allow **bula-audit** → Save.  
3. Railway → deploy → **Refresh** → select **bula-audit**.

**If repo never appears:** use CLI (no GitHub list needed):

```powershell
npm install -g @railway/cli
railway login
cd C:\Users\zufar\bula-audit
railway link
railway up
```

### B. Railway project layout

One project should contain:

1. **App service** (from GitHub `bula-audit` or `railway up`)  
2. **MySQL** database (+ New → Database → MySQL)

### C. App service settings

- **Root directory:** empty (repo root, **not** `server/`)  
- **Branch:** `main`

### D. App variables (Railway → app service → Variables)

```env
DATABASE_URL=${{MySQL.DATABASE_URL}}
NODE_ENV=production
JWT_SECRET=PASTE_64_CHAR_HEX
JWT_EXPIRES_IN=15m
APP_NAME=BULA AUDIT
CLIENT_ORIGIN=https://YOUR-RAILWAY-URL.up.railway.app
EMAIL_DRIVER=resend
RESEND_API_KEY=re_YOUR_KEY
EMAIL_FROM=BULA AUDIT <onboarding@resend.dev>
```

Generate JWT:

```powershell
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
```

Do **not** set `PORT`.

Use **Add Reference** for `DATABASE_URL` → MySQL service.

### E. Public URL

1. App → **Settings** → **Networking** → **Generate Domain**  
2. Copy URL, e.g. `https://bula-audit-production-xxxx.up.railway.app`  
3. Set `CLIENT_ORIGIN` to that exact URL (https, no trailing `/`)  
4. Redeploy  

### F. Test live

- App: **https://YOUR-RAILWAY-URL.up.railway.app**  
- Health: **https://YOUR-RAILWAY-URL.up.railway.app/api/health** → `"db":"up"`

**Write your live URL here after deploy:** ___________________________________

---

## Part 4 — Email (all users, not just you)

See **`scripts/RESEND_SETUP.md`**.

Local:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\configure-resend.ps1
```

Production: same Resend vars on Railway as in section D.

---

## Part 5 — Push code to GitHub (when you change the project)

```powershell
cd C:\Users\zufar\bula-audit
git add -A
git commit -m "Describe your change"
git push origin main
```

Railway redeploys automatically if connected to GitHub.

---

## Quick reference card

```
LOCAL APP     →  http://localhost:5173
LOCAL API     →  http://localhost:4000/api/health

LIVE APP      →  https://(your Railway domain)
LIVE HEALTH   →  https://(your Railway domain)/api/health

RUN LOCAL     →  server: npm run dev  +  root: npm run dev
```

---

## More detail

- `GO_LIVE.md` — production checklist  
- `scripts/RESEND_SETUP.md` — email for everyone  
- `DEPLOY.md` — full deploy options  
