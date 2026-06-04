# Resend email setup — all users

One Resend account sends mail for **every** signup, verification, and password reset in BULA AUDIT.

---

## Step 1 — Create Resend account (5 min)

1. Open https://resend.com and sign up (free tier: 3,000 emails/month).
2. Go to **API Keys** → **Create API Key**.
3. Name: `bula-audit`
4. Permission: **Sending access**
5. Copy the key (`re_...`) — shown once.

---

## Step 2 — Local laptop (test before Railway)

In PowerShell from the repo root:

```powershell
cd C:\Users\zufar\bula-audit
powershell -ExecutionPolicy Bypass -File .\scripts\configure-resend.ps1
```

When prompted:

| Prompt | What to enter |
|--------|----------------|
| API key | `re_...` from Step 1 |
| From address | **Testing (no domain yet):** `BULA AUDIT <onboarding@resend.dev>` — Resend only delivers to the email you used to sign up for Resend. |
| | **With your domain verified:** `BULA AUDIT <noreply@bulaaudit.com.fj>` |

Restart backend if the script did not:

```powershell
cd server
npm run dev
```

Check:

```powershell
curl http://localhost:4000/api/health
```

Look for `"email":{"driver":"resend","configured":true,...}`.

Test:

1. Sign up with a **new** email (or use Forgot password).
2. Check inbox (and spam). With `onboarding@resend.dev`, only your Resend signup email receives mail.

---

## Step 3 — Verify your domain (production / real users)

1. Resend → **Domains** → **Add Domain** → e.g. `bulaaudit.com.fj`
2. Add the DNS records Resend shows (at Cloudflare or your registrar).
3. Wait until status is **Verified**.
4. Update `EMAIL_FROM` to `BULA AUDIT <noreply@bulaaudit.com.fj>` (local `.env` and Railway).

---

## Step 4 — Railway (production)

Railway → **app service** → **Variables** → add:

```env
EMAIL_DRIVER=resend
RESEND_API_KEY=re_YOUR_KEY_HERE
EMAIL_FROM=BULA AUDIT <noreply@bulaaudit.com.fj>
EMAIL_REPLY_TO=support@bulaaudit.com.fj
```

Also ensure:

```env
NODE_ENV=production
CLIENT_ORIGIN=https://your-exact-railway-or-custom-domain
```

**Redeploy** after saving variables.

Health check: `https://YOUR-DOMAIN/api/health` → `"configured":true`.

---

## What emails are sent automatically

| Event | Who receives it |
|-------|-----------------|
| Sign up | That user's email |
| Resend verification (banner / Settings) | Logged-in user's email |
| Forgot password | Email entered on the form |

Same `RESEND_API_KEY` for everyone — not per-user.

---

## Troubleshooting

| Problem | Fix |
|---------|-----|
| Still no email locally | `EMAIL_DRIVER` must be `resend` and key must start with `re_` |
| Resend error in server logs | Domain not verified — use `onboarding@resend.dev` for testing |
| Works locally, not on Railway | Add same 4 variables on Railway and redeploy |
| Production app won't start | `NODE_ENV=production` requires `EMAIL_DRIVER=resend` + `RESEND_API_KEY` |
