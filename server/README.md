# BULA AUDIT — server

Node.js + Express + TypeScript backend replacing Base44.

- **Database:** MySQL via Prisma
- **Auth:** Email/password + Google OAuth (JWT)
- **AI:** OpenAI (receipt OCR + chat)
- **Files:** local disk (`uploads/`), served at `/uploads/*`
- **Realtime:** socket.io (Phase 5)

> Phase 1 (this commit) is the scaffold: env, schema, Express app, health
> endpoint. Auth, entity CRUD, uploads, and AI come in later phases.

## Prerequisites

1. **Node.js 20+**
2. **MySQL 8.x** running locally. Easiest options:
   - Install MySQL Community Server, **or**
   - `docker run --name bula-mysql -e MYSQL_ROOT_PASSWORD=password -e MYSQL_DATABASE=bula_audit -p 3306:3306 -d mysql:8`

## Setup

```powershell
cd C:\Users\zufar\bula-audit\server
npm install
copy .env.example .env
```

Edit `.env`:

- `DATABASE_URL` — your MySQL connection string
- `JWT_SECRET` — long random string (`node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"`)
- `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` — only needed when Phase 2 is wired in
- `OPENAI_API_KEY` — only needed for Phase 5

## Database

```powershell
npm run prisma:generate      # generate Prisma client
npm run prisma:migrate -- --name init    # create tables
npm run db:seed              # optional: create admin@bula.local / admin1234
```

Open Prisma Studio (visual DB browser):

```powershell
npm run prisma:studio
```

## Run

```powershell
npm run dev
```

Server listens on `http://localhost:4000`.

Test it:

```powershell
curl http://localhost:4000/api/health
```

Expected response:

```json
{ "status": "ok", "db": "up", "ts": "..." }
```

## Folder layout

```
server/
├── prisma/
│   ├── schema.prisma    # MySQL schema mirroring Base44 entities
│   └── seed.ts          # demo admin + company
├── src/
│   ├── env.ts           # env validation (zod)
│   ├── prisma.ts        # Prisma client singleton
│   ├── index.ts         # Express app entrypoint
│   ├── middleware/
│   │   ├── auth.ts      # JWT + requireAuth / requireAdmin
│   │   └── error.ts     # HttpError, error handler
│   └── routes/
│       └── health.ts
├── uploads/             # served at /uploads/*
├── .env.example
├── tsconfig.json
└── package.json
```

## Status

| Phase | Status |
|-------|--------|
| 1. Scaffold + schema | done |
| 2. Auth (JWT, Google) | next |
| 3. Entity CRUD | pending |
| 4. File upload | pending |
| 5. AI (OpenAI + sockets) | pending |
| 6. Frontend rewrite (drop `@base44/sdk`) | pending |
| 7. Cleanup | pending |
