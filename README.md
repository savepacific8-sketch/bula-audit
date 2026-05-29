# BULA AUDIT

Receipt management and VAT tracking for Fijian small businesses.

This project is now a **self-hosted full-stack app** (no longer Base44):

- **Frontend** — React 18 + Vite + Tailwind + Radix UI (this folder)
- **Backend** — Node.js + Express + TypeScript + Prisma + SQLite (`server/`)
- **AI** — OpenAI (optional; set `OPENAI_API_KEY` in `server/.env`)

## Quick start

### 1. Start the backend

```powershell
cd C:\Users\zufar\bula-audit\server
npm install            # first time only
copy .env.example .env # first time only, then edit it
npm run prisma:migrate -- --name init
npm run db:seed        # optional: admin@bula.local / admin1234
npm run dev
```

Server runs at **http://localhost:4000**.

### 2. Start the frontend

```powershell
cd C:\Users\zufar\bula-audit
npm install            # first time only
npm run dev
```

App runs at **http://localhost:5173**. Vite proxies `/api` and `/uploads` to the
backend on :4000.

### 3. Use it

- Sign up at http://localhost:5173/signup, or sign in with the seeded admin
  account (`admin@bula.local` / `admin1234`).
- Onboarding will prompt you to create a company.
- Upload receipts, view dashboards, manage your team.

## Stack details

| Layer | Tech |
|-------|------|
| UI | React 18, Vite 6, Tailwind 3, Radix UI, shadcn-style components |
| State | React Query, React Context |
| Forms | React Hook Form + Zod |
| Routing | react-router-dom v6 (`/login`, `/signup`, app routes) |
| API client | Local shim in `src/api/base44Client.js` (same shape as Base44 SDK, talks to `/api/*`) |
| Server | Express 4 + TypeScript, helmet/cors/cookies/morgan |
| DB | SQLite via Prisma (single file at `server/dev.db`). Swap to MySQL by editing `server/prisma/schema.prisma` + `DATABASE_URL` |
| Auth | JWT in `Authorization: Bearer` header (also stored in cookie). Email/password + optional Google OAuth |
| Files | Multer to disk (`server/uploads/`), served at `/uploads/*` |
| AI | OpenAI Vision for receipt OCR, OpenAI chat for agent conversations |

## Switching SQLite → MySQL

1. Install MySQL and create a database (e.g. `bula_audit`).
2. In `server/prisma/schema.prisma` change `provider = "sqlite"` to `"mysql"`.
3. In `server/.env` set `DATABASE_URL="mysql://user:pass@host:3306/bula_audit"`.
4. Run: `cd server && npm run prisma:migrate -- --name switch-to-mysql`.

## Enabling Google sign-in

1. Create OAuth 2.0 credentials at <https://console.cloud.google.com/apis/credentials>.
2. Add `http://localhost:4000/api/auth/google/callback` as an authorized redirect URI.
3. Put the client ID + secret into `server/.env`:
   ```
   GOOGLE_CLIENT_ID="..."
   GOOGLE_CLIENT_SECRET="..."
   ```
4. Restart the server. The **Continue with Google** button on `/login` will light up.

## Enabling AI features

1. Get an OpenAI API key from <https://platform.openai.com/api-keys>.
2. Set it in `server/.env`:
   ```
   OPENAI_API_KEY="sk-..."
   ```
3. Restart the server. Receipt OCR + agent chats will start using real GPT.

Without an API key, AI endpoints return 503 — the rest of the app still works.

## Project structure

```
bula-audit/
├── src/                       # React frontend
│   ├── api/base44Client.js    # local API client (shim mirroring Base44 SDK)
│   ├── lib/AuthContext.jsx    # auth state, JWT storage
│   ├── pages/Login.jsx        # local login page (replaces Base44 hosted login)
│   ├── pages/Signup.jsx
│   └── ... existing pages
├── server/                    # Express backend
│   ├── prisma/
│   │   ├── schema.prisma
│   │   └── seed.ts
│   └── src/
│       ├── index.ts
│       ├── env.ts
│       ├── prisma.ts
│       ├── middleware/
│       └── routes/
├── vite.config.js             # proxies /api and /uploads to :4000
└── package.json
```
