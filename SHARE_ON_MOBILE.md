# Share BULA AUDIT on mobile (links for you and managers)

There is **no secret “view-only” link** without login — that would expose your receipts. Everyone uses the **same app URL** and signs in with their own account.

---

## Option 1 — Permanent link (best for managers)

Deploy to **Railway** (see `GO_LIVE.md` / `START_HERE.md` Part 3).

You get one HTTPS link, e.g.:

`https://bula-audit-production.up.railway.app`

**Share that link** by SMS, WhatsApp, or email. Managers open it on any phone, sign up or log in, then scan or view reports.

1. Railway → app service → **Networking** → copy **Public URL**
2. Set variable `CLIENT_ORIGIN` to that exact URL → redeploy
3. **Team** → add manager email → role **Manager**
4. Manager opens the link → **Sign up** with that email (or log in)

---

## Option 2 — Temporary public link (demo / test without Railway)

While your laptop runs the app, you can get a **free HTTPS link** that works on any phone (even off your Wi‑Fi).

### A. Cloudflare Tunnel (recommended)

1. Install (once):

   ```powershell
   winget install Cloudflare.cloudflared
   ```

2. Start backend + frontend (`START_HERE.md` Part 2).

3. In a **third** PowerShell window:

   ```powershell
   cd C:\Users\zufar\bula-audit
   powershell -ExecutionPolicy Bypass -File .\scripts\share-tunnel.ps1
   ```

4. Copy the `https://….trycloudflare.com` URL from the terminal → send to your phone or managers.

**Note:** The URL changes each time you restart the tunnel. Your PC must stay on and dev servers running.

### B. Same Wi‑Fi only (no install)

Vite prints `Network: http://192.168.x.x:5173/` — only works on your home/office Wi‑Fi.

---

## Option 3 — “App” on the home screen (after you have a link)

1. Open your **Railway** or **tunnel** HTTPS link in **Safari** (iPhone) or **Chrome** (Android).
2. Log in once.
3. **iPhone:** Share → **Add to Home Screen**  
   **Android:** menu → **Install app** / **Add to Home screen**

The app already ships a PWA manifest; shortcuts include **Upload receipt** for quick scanning.

---

## Optional: QR for a meeting (external tool)

If you want a scannable code, paste your HTTPS link into any free QR generator (e.g. qr-code-generator.com), download the image, and show it on a slide. The link itself is what managers need — QR is optional.

---

## Manager access checklist

| Step | Who |
|------|-----|
| Deploy or start tunnel | You |
| Copy HTTPS link | You |
| **Team** → add email → role Manager / Accountant | You |
| Open link → Sign up with that email | Manager |
| **Receipts → Upload → Take photo** | Anyone with upload permission |
| **Dashboard / Reports** for presentations | Manager / Accountant |

Email invite in the app is a stub today — tell managers: *“Sign up at [link] using the email I added on Team.”*

---

## Which option to pick?

| Need | Use |
|------|-----|
| Share with bosses long-term | **Railway HTTPS link** |
| Try on your phone today, no deploy | **Wi‑Fi Network URL** or **Cloudflare tunnel** |
| Feels like a phone app | **Add to Home Screen** after opening HTTPS link |
