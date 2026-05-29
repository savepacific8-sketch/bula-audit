# BULA AUDIT - setup scripts

Run each of these from the project root (`C:\Users\zufar\bula-audit`).

The scripts are idempotent - safe to re-run.

---

## 1. Switch from SQLite to MySQL

**One command:**

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\setup-mysql.ps1
```

What happens (~2 minutes first time):

1. Locates `docker` (Docker Desktop is already installed on your machine but inert)
2. Starts the Docker engine if it's not running
3. Creates a `bula-mysql` container (`mysql:8`, port `3306`, password `bulapass`, db `bula_audit`)
4. Waits for MySQL to accept connections
5. Patches `server/prisma/schema.prisma` (`provider = "sqlite"` -> `"mysql"`)
6. Patches `server/.env` `DATABASE_URL` to the MySQL URL
7. Drops the old SQLite migrations + `dev.db`
8. Runs `prisma generate` + `prisma migrate dev` against MySQL
9. Re-seeds (`admin@bula.local` / `admin1234`)
10. Restarts the backend dev server on `:4000`
11. Health check

If Docker fails to start within 3 minutes the script aborts with a message.

To check the container later: `docker ps`, `docker logs bula-mysql`.

To revert to SQLite, just change `provider = "mysql"` back to `provider = "sqlite"` in `server/prisma/schema.prisma` and put `DATABASE_URL="file:./dev.db"` back in `server/.env`, then re-run migrations.

---

## 2. Enable OpenAI (receipt OCR + AI agent chat)

### Step A - Get an API key (you must do this part)

1. Go to https://platform.openai.com/api-keys
2. Sign in (create an OpenAI account if needed)
3. Add a payment method at https://platform.openai.com/account/billing if you don't have one.
   Receipt OCR uses GPT-4o-mini which is cheap (~$0.0001 per receipt).
4. Click **+ Create new secret key**
5. Name it `bula-audit`, copy the value (starts with `sk-`)

### Step B - Wire it in (one command)

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\configure-openai.ps1 -ApiKey "sk-YOURKEYHERE"
```

Or run without `-ApiKey` and it prompts you securely.

What happens:
- Writes `OPENAI_API_KEY` and `OPENAI_MODEL=gpt-4o-mini` to `server/.env`
- Restarts the backend dev server
- Confirms `/api/health` returns OK

### What you get

- **Receipt upload** uses OpenAI Vision to extract supplier, total, VAT, line items
- **VAT advisor chat** answers Fiji VAT questions
- **Spending trends chat** analyzes your data
- Receipt scanner agent works

### Use a different model

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\configure-openai.ps1 -ApiKey "sk-..." -Model "gpt-4o"
```

(`gpt-4o` is more accurate for handwritten receipts but ~10x the cost of `gpt-4o-mini`.)

---

## 3. Enable Google sign-in

### Step A - Create OAuth credentials (you must do this part)

1. Go to https://console.cloud.google.com/apis/credentials
2. Pick (or create) a project at the top
3. If asked, configure the **OAuth consent screen** first:
   - User Type: **External**
   - App name: `BULA AUDIT`
   - User support email: your email
   - Developer contact: your email
   - Save and continue past the scopes/test-users steps
4. Back on the Credentials page, click **+ Create Credentials -> OAuth client ID**
5. Application type: **Web application**
6. Name: `BULA AUDIT local dev`
7. **Authorized redirect URIs** - click **+ Add URI** and paste:
   ```
   http://localhost:4000/api/auth/google/callback
   ```
8. Click **Create**. A dialog shows your **Client ID** and **Client Secret** - copy both.

### Step B - Wire it in (one command)

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\configure-google-oauth.ps1 -ClientId "YOUR_CLIENT_ID.apps.googleusercontent.com" -ClientSecret "YOUR_SECRET"
```

Or run without args and it prompts for both.

What happens:
- Writes `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` / `GOOGLE_REDIRECT_URI` to `server/.env`
- Restarts the backend
- Checks `/api/auth/google/status` returns `{ configured: true }`

### What you get

- **Continue with Google** button appears on `/login`
- Clicking it sends you through Google's consent screen
- On success you're redirected to `http://localhost:5173/?access_token=...`
- The token is saved by `AuthContext` and you're signed in

---

## Order to run

If you want to do everything:

```powershell
# 1. Switch DB
powershell -ExecutionPolicy Bypass -File .\scripts\setup-mysql.ps1

# 2. AI (paste your sk-... key)
powershell -ExecutionPolicy Bypass -File .\scripts\configure-openai.ps1

# 3. Google (paste your client id + secret)
powershell -ExecutionPolicy Bypass -File .\scripts\configure-google-oauth.ps1

# 4. Start the frontend (separate terminal)
npm run dev
```

After all three, open http://localhost:5173/login - Google button, real AI, MySQL-backed.
