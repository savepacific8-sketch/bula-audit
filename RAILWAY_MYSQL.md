# Move BULA AUDIT to Railway MySQL

The app **already uses MySQL** in `server/prisma/schema.prisma`. You do **not** need to change the database type — you connect Railway’s MySQL plugin and point the app at it.

---

## Path A — New empty database on Railway (most people)

Use this if you are fine signing up again on the live site (or have little local data).

### 1. Railway project

1. https://railway.app → your project.
2. **+ New** → **Database** → **MySQL** → wait until **Online**.

### 2. Link MySQL to the app service

1. Click your **app** service (bula-audit), not MySQL.
2. **Variables** → add:

```env
DATABASE_URL=${{MySQL.DATABASE_URL}}
NODE_ENV=production
JWT_SECRET=PASTE_64_CHAR_HEX_FROM_BELOW
JWT_EXPIRES_IN=15m
APP_NAME=BULA AUDIT
CLIENT_ORIGIN=https://YOUR-REAL-DOMAIN.up.railway.app
```

Generate JWT:

```powershell
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
```

`CLIENT_ORIGIN` must be your **real** Railway URL from **Settings → Networking → Generate Domain** (not `your-app.up.railway.app`).

### 3. Deploy

- Repo root = **empty** (not `server/`).
- Push to GitHub `main` or **Redeploy**.

On each deploy, `railway.toml` runs:

`npx prisma db push` → creates/updates all tables in Railway MySQL.

### 4. Check

Open:

`https://YOUR-REAL-DOMAIN.up.railway.app/api/health`

Expect: `"status":"ok"` and `"db":"up"`.

### 5. Use the live app

Open the same domain in the browser → **Sign up** (new production account).  
Local laptop data stays on your PC unless you do Path B.

---

## Path B — Copy your local MySQL data to Railway

Use this if you already run MySQL locally with receipts/users you want on Railway.

### 1. Get Railway MySQL URL

1. Railway → **MySQL** service → **Connect** (or **Variables**).
2. Copy **MYSQL_URL** or **DATABASE_URL** (starts with `mysql://`).

### 2. Run the transfer script (on your PC)

```powershell
cd C:\Users\zufar\bula-audit

# Your local DB (from server\.env DATABASE_URL)
$env:LOCAL_DATABASE_URL = "mysql://root:YOUR_PASSWORD@localhost:3306/bula_audit"

# Paste from Railway MySQL service
$env:RAILWAY_DATABASE_URL = "mysql://root:xxxx@containers-us-west-xxx.railway.app:3306/railway"

powershell -ExecutionPolicy Bypass -File .\scripts\railway-mysql-transfer.ps1
```

Requires **mysqldump** and **mysql** on PATH (MySQL Server install or MariaDB client).

### 3. Point Railway app at the same database

App service variable:

`DATABASE_URL=${{MySQL.DATABASE_URL}}`

Redeploy → open your Railway URL → log in with the **same email/password** as local (if users were copied).

---

## Path C — You still use SQLite locally (`file:./dev.db`)

1. Switch local to MySQL first (Docker or local MySQL), or export receipts manually.
2. Easiest for go-live: use **Path A** on Railway and re-upload receipts on the live site.

To switch local dev to MySQL:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\apply-production-ready.ps1
```

(Or set `provider = mysql` in `schema.prisma` and `DATABASE_URL=mysql://...` in `server\.env`, then `cd server` → `npx prisma db push`.)

---

## Receipt files (uploads)

Database migration does **not** copy files in `server/uploads/`. For production set **Cloudflare R2** (`STORAGE_DRIVER=s3`) — see `GO_LIVE.md` Part B4.  
Otherwise new uploads on Railway stay on the server disk and can be lost on redeploy.

---

## Quick checklist

| Step | Done? |
|------|--------|
| MySQL plugin added on Railway | |
| `DATABASE_URL=${{MySQL.DATABASE_URL}}` on app service | |
| `CLIENT_ORIGIN` = real Railway HTTPS URL | |
| `JWT_SECRET` set (64+ char hex) | |
| Deploy success | |
| `/api/health` shows `"db":"up"` | |
| (Optional) Local data transferred via script | |

---

## Troubleshooting

| Problem | Fix |
|---------|-----|
| `/api/health` db down | Check `DATABASE_URL` references **MySQL** service name exactly `${{MySQL.DATABASE_URL}}` |
| 404 on `your-app.up.railway.app` | Use the real domain from Railway Networking |
| Build fails Prisma | Pull latest `main`; Node 22 in `nixpacks.toml` |
| Login works locally but not Railway | Different database — Path A = new signup; Path B = migrate users |
