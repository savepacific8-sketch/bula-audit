# Security posture — BULA AUDIT

This document tracks what's hardened in the codebase and what's still TODO
for going live in production.

## Implemented

### Auth & passwords
- Email/password with bcrypt (cost 10)
- JWT in `Authorization: Bearer` header + httpOnly cookie (sameSite lax, secure in prod)
- **Account lockout**: 5 failed logins per email locks the account for 15 minutes
- **Generic auth errors**: `/login` returns the same "Invalid credentials" message regardless of whether the email exists (no enumeration)
- **Strong password validation**: min 8 chars, must contain letter + digit, no spaces, rejects ~40 common passwords
- **Password reset**: `/api/auth/password-reset/{request,confirm}` with 30-min one-time hashed tokens
- **Role escalation prevention**: `PATCH /api/auth/me` will not accept `role` changes; `current_company_role` must match the user's actual TeamMember record

### Rate limiting (express-rate-limit)
- `/api/auth/*` — 10 requests per 15 min per IP
- `/api/ai/*` — 60 requests per hour per user (or IP if unauth) — protects OpenAI bill
- `/api/uploads` — 30 uploads per hour per user
- `/api/*` general — 300 requests per 5 min per IP

### File uploads
- Multer with memory storage + magic-byte validation via `file-type`
- Allowlist: JPEG, PNG, WEBP, HEIC, HEIF, PDF
- 20 MB hard cap per file, 1 file per request
- Filename stored as random hex; original name only in metadata
- Mismatch between declared MIME and detected MIME = rejected

### HTTP headers (helmet)
- HSTS (1 year, includeSubDomains, preload) — production only
- CSP — production only (Vite HMR needs it off in dev)
  - `default-src 'self'`, no inline scripts, frame ancestors none
- `X-Frame-Options: DENY`
- `Referrer-Policy: strict-origin-when-cross-origin`
- `X-Content-Type-Options: nosniff`

### Audit log
- New `AuditLog` table records: signup, login (success/fail/locked), logout,
  Google sign-in, password reset, role changes, company create/update/delete,
  receipt create/update/delete/approve/reject, team invite/update/remove,
  subscription update, payment proof review, admin actions
- Records: user id, email, action, entity, ip, user agent, metadata JSON, timestamp
- Audit writes are non-blocking — failures are logged, never crash the request

### Soft delete (FRCS retention)
- `Receipt` has `deletedAt` column
- `DELETE /api/receipts/:id` sets `deletedAt` instead of removing the row
- Non-admin reads filter out soft-deleted rows
- Admin can pass `?permanent=true` for hard delete (rare; use for GDPR-style requests)
- Admin can list deleted rows with `?include_deleted=true`

### Error handling
- Production errors are redacted — only the HTTP status and a generic message leak
- Validation (zod) errors are exposed in full so the frontend can show field-level issues
- Stack traces only included in non-production responses
- Prisma errors mapped to friendly codes (P2002 -> 409, P2025 -> 404)

### Infrastructure
- `trust proxy 1` so `req.ip` is the real client behind Cloudflare / Railway / Render
- JSON body limit 2 MB (was 10 MB)
- CORS limited to `CLIENT_ORIGIN` env var, credentials enabled

## TODO before production launch

### High priority
- [ ] **Refresh tokens** — current JWT is 7 days. Switch to 15-min access + 7-day refresh with rotation. Add `RefreshToken` table for revocation.
- [ ] **Email verification on signup** — uses the `emailVerified` / `emailVerificationToken` fields already in the schema. Needs an email provider (Resend / Postmark).
- [ ] **Transactional email integration** — for password reset + verification. Recommend Resend (free tier, simple API).
- [ ] **CAPTCHA** on signup + password reset (Cloudflare Turnstile, free)
- [ ] **2FA / TOTP** for admin and owner accounts (otpauth library + QR code)
- [ ] **Session revocation** — log-out-everywhere endpoint that bumps a `tokenVersion` field; verify on every request
- [ ] **Sensitive operation re-auth** — require password re-entry for: delete company, change email, change password while logged in, promote to admin

### Medium priority
- [ ] **Move uploads to S3-compatible storage** (Cloudflare R2 recommended)
- [ ] **Signed URLs for receipt photos** — currently `/uploads/*` is public for anyone with the URL. For receipts containing PII, generate per-request signed URLs.
- [ ] **Audit log UI** — admin-facing page showing recent activity, filterable by user / entity
- [ ] **IP allowlist** for admin endpoints (optional, useful if you know your office IP)
- [ ] **Backup encryption** — wherever DB backups live, ensure they're encrypted at rest
- [ ] **Database column encryption** for sensitive fields (supplier_tin, payment proof reference numbers) — at the application layer

### Compliance
- [ ] **Privacy policy + Terms of Service** pages (linked from /login + /signup)
- [ ] **Cookie banner** (only required if you add analytics / tracking)
- [ ] **Data export endpoint** — allow user to download all their data (GDPR-style)
- [ ] **Data deletion endpoint** — proper purge respecting the 7-year FRCS retention (anonymize instead of delete)
- [ ] **Document retention policy** publicly (7 years per FRCS)

### Operational
- [ ] **Centralized logging** (Logtail, Datadog, BetterStack)
- [ ] **Error tracking** (Sentry — free tier covers small apps)
- [ ] **Health endpoint behind status page** (e.g. status.bulaaudit.com.fj via Cronitor or UptimeRobot)
- [ ] **Secrets in a vault**, not in `.env` files (Railway/Render env, or HashiCorp Vault)
- [ ] **Rotate JWT_SECRET** on a schedule. Have a JWT_SECRET_PREV for grace period.
- [ ] **Dependency scanning** — `npm audit` in CI, Dependabot on the repo

### Penetration testing checklist
Before launch, test for:
- IDOR (try to read other companies' receipts by guessing IDs)
- Mass assignment (can you pass `role: 'admin'` in a PATCH and have it stick?)
- Path traversal in uploads (`../../etc/passwd`)
- XSS in receipt notes, supplier names, team member names
- CSRF on cookie auth (sameSite lax + Bearer header mitigates most cases)
- Header injection in audit log fields
- Time-based attacks on bcrypt comparison
- Long-running OpenAI prompts that bypass rate limits

## Recommended deploy environment variables

```
NODE_ENV=production
PORT=4000
CLIENT_ORIGIN=https://app.bulaaudit.com.fj   # the real frontend origin
DATABASE_URL=mysql://...                       # PlanetScale / managed DB
JWT_SECRET=<64+ random hex bytes>
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...
GOOGLE_REDIRECT_URI=https://api.bulaaudit.com.fj/api/auth/google/callback
OPENAI_API_KEY=sk-...
OPENAI_MODEL=gpt-4o-mini
UPLOAD_DIR=/data/uploads
MAX_UPLOAD_MB=10
```

Behind Cloudflare / Railway / Render, HTTPS is terminated for you; the app
sets HSTS + secure cookies based on `NODE_ENV=production`.
