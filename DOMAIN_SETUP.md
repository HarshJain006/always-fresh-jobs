# Deploy DailyResume to Netlify + connect `dailyresume.in`

This guide starts with **how to build** and **what to put on Netlify**, then how to attach your domain.

Official DNS docs: [Configure external DNS](https://docs.netlify.com/manage/domains/configure-domains/configure-external-dns/).

---

## Part 0 — Build the site (local)

From the project folder `always-fresh-jobs`:

```bash
npm ci
npm run build
```

### What the build creates

After a successful build you get:

```text
always-fresh-jobs/
├── dist/                        ← static files Netlify serves to browsers
│   ├── assets/                  ← JS, CSS, images
│   ├── google-callback.html     ← REQUIRED for Google sign-in
│   ├── favicon.ico
│   └── robots.txt
└── .netlify/functions-internal/ ← generated server functions for SSR/server actions
```

| Path | Upload / use on Netlify? | Why |
|------|---------------------------|-----|
| `dist/**` | **Yes** — this is the browser site | HTML assets, OAuth callback, CSS/JS |
| `dist/google-callback.html` | **Must be present** | Google redirect URI ends here |
| `dist/assets/**` | **Yes** | App UI code and images |
| `.netlify/functions-internal/**` | Do **not** drag-drop alone | Generated Netlify Functions for SSR/server actions |
| `src/`, `node_modules/`, `.env` | **Never** upload secrets or source via drag-drop | Env vars go in Netlify UI |

> `npm run build` already targets Netlify via `NITRO_PRESET=netlify`.

---

## Part 1 — Put the site on Netlify

### Option A — Recommended: connect Git (Netlify builds for you)

You do **not** manually zip/upload files. Netlify clones the repo and runs the build.

1. Push `always-fresh-jobs` to GitHub.
2. [Netlify](https://app.netlify.com/) → **Add new site** → **Import an existing project**.
3. Pick the repo / branch.
4. Build settings:

   | Setting | Value |
   |---------|--------|
   | **Base directory** | `always-fresh-jobs` (if the repo root is `DailyResume`) — or leave blank if the repo **is** the app folder |
   | **Build command** | `npm run build` |
   | **Publish directory** | `dist` |
   | **Node version** | `22` (set in `netlify.toml` or env `NODE_VERSION=22`) |

5. The repo already has `netlify.toml` with those defaults — confirm Netlify picked them up.
6. Add **environment variables** before the first deploy (Site settings → Environment variables):

   | Name | Example |
   |------|---------|
   | `VITE_APP_URL` | `https://dailyresume.in` |
   | `VITE_GOOGLE_CLIENT_ID` | your Google client id |
   | `VITE_GOOGLE_REDIRECT_URI` | `https://dailyresume.in/google-callback.html` |
   | `VITE_SUPABASE_URL` | your Supabase URL |
   | `VITE_SUPABASE_PUBLISHABLE_KEY` | publishable key |
   | `SUPABASE_SERVICE_ROLE_KEY` | service role (server only) |
   | `ENCRYPTION_KEY` | same key as Raspberry Pi |
   | `CRON_SECRET` | random secret for cron route |
   | `NITRO_PRESET` | `netlify` (helps SSR/server functions on Netlify) |

7. Click **Deploy site**. Wait until status is **Published**.
8. Open the temporary URL Netlify gives you, e.g.:

   ```text
   https://your-site-name.netlify.app
   ```

   Confirm the homepage loads and `/google-callback.html` exists.

**Files Netlify uses from the build (automatic):**

```text
dist/assets/*
dist/google-callback.html
dist/favicon.ico
dist/robots.txt
(+ Netlify Functions generated in .netlify/functions-internal)
```

---

### Option B — Manual upload (drag & drop) — static only

Use this only for a quick static peek. **Dashboard “Run now” / save / queue enqueue need server functions**, so Option A is what you want for production.

1. On your PC:

   ```bash
   cd always-fresh-jobs
   npm ci
   npm run build
   ```

2. Open the folder:

   ```text
   always-fresh-jobs/dist
   ```

3. Netlify → **Add new site** → **Deploy manually** → drag **the contents** of `dist`.

   Upload **these**:

   ```text
   assets/                 (entire folder)
   google-callback.html
   favicon.ico
   robots.txt
   _headers                (optional but fine)
   ```

4. Do **not** upload:

   ```text
   .output/server/
   src/
   node_modules/
   .env
   package.json alone without building
   ```

5. After upload, open the `*.netlify.app` URL and check:

   - Homepage loads (if you only have assets and no SSR HTML shell, some routes may be blank — use Option A for the full app).
   - `https://YOUR-SITE.netlify.app/google-callback.html` opens (needed for Google login).

---

## Before you start domain setup

You need:

1. A Netlify site already live (`something.netlify.app`)
2. Ownership of **dailyresume.in** at your registrar
3. Access to that registrar’s **DNS** settings

Copy your Netlify hostname:

```text
your-site-name.netlify.app
```

You will paste that into the `www` CNAME record below.

---

## Part A — Add the domain in Netlify

1. Open [Netlify](https://app.netlify.com/) → select your **DailyResume** site.
2. Left sidebar → **Domain management** (sometimes under **Project configuration** → **Domain management**).
3. Under **Production domains**, click **Add a domain** → **Add a domain you already own**.
4. Enter:

   ```text
   dailyresume.in
   ```

5. Confirm / verify you own it when Netlify asks.
6. Netlify will usually add **both**:
   - `dailyresume.in` (apex / root)
   - `www.dailyresume.in`

   If `www` is missing, click **Add domain alias** / **Add domain** and add `www.dailyresume.in`.

7. Set the **primary domain** to `dailyresume.in` (recommended for your OAuth URLs).

8. Leave **HTTPS** / **Let’s Encrypt** enabled (default). Certificate appears after DNS is correct.

You will see **Awaiting External DNS** until Part B is done — that is expected.

---

## Part B — Point DNS at your registrar (external DNS)

Prefer **one** A record for `@` and **one** CNAME for `www`.

### Records to create

| Type | Name / Host | Value | TTL |
|------|-------------|--------|-----|
| **A** | `@` (or blank / `dailyresume.in`) | `75.2.60.5` | Auto / 3600 |
| **CNAME** | `www` | `your-site-name.netlify.app` | Auto / 3600 |

Replace `your-site-name.netlify.app` with your real Netlify URL.

> **Preferred (if supported):** ALIAS / ANAME / flattened CNAME on `@` → `apex-loadbalancer.netlify.com`. Otherwise use the A record `75.2.60.5`.

### Example (GoDaddy / Namecheap / Hostinger-style)

1. Log in where you bought **dailyresume.in**.
2. Open **DNS** / **Manage DNS** / **DNS Zone**.
3. Remove old A/CNAME for `@` and `www` that point to parking/old hosts. Keep **MX** if you use email.
4. Add:

   - **A** → Host `@` → `75.2.60.5`
   - **CNAME** → Host `www` → `your-site-name.netlify.app`

5. Save.

### Optional: Netlify DNS

Domain management → **Set up Netlify DNS** → copy 4 nameservers → set those at your registrar.

---

## Part C — Wait for DNS + HTTPS

1. Propagation: often **5–30 minutes**, sometimes up to **24–48 hours**.
2. Check [dnschecker.org](https://dnschecker.org):
   - **A** `dailyresume.in` → `75.2.60.5`
   - **CNAME** `www.dailyresume.in` → `*.netlify.app`
3. Netlify → Domain management → HTTPS **Provisioned**.
4. Open https://dailyresume.in and https://www.dailyresume.in.

---

## Part D — Align app + Google OAuth with the domain

### Netlify environment variables

| Name | Value |
|------|--------|
| `VITE_APP_URL` | `https://dailyresume.in` |
| `VITE_GOOGLE_REDIRECT_URI` | `https://dailyresume.in/google-callback.html` |

Then **Deploys** → **Trigger deploy** → **Clear cache and deploy site**.

### Google Cloud Console

**Authorized JavaScript origins:**

```text
https://dailyresume.in
https://www.dailyresume.in
```

**Authorized redirect URIs:**

```text
https://dailyresume.in/google-callback.html
https://www.dailyresume.in/google-callback.html
```

---

## Checklist

### Build / Netlify

- [ ] `npm run build` succeeds locally (optional check)
- [ ] Netlify publish directory = `.output/public`
- [ ] `google-callback.html` reachable on the site
- [ ] Env vars set (Google + Supabase + encryption)
- [ ] Prefer Git deploy (Option A), not drag-drop for production

### Domain

- [ ] `dailyresume.in` + `www` in Domain management
- [ ] A `@` → `75.2.60.5`
- [ ] CNAME `www` → `your-site.netlify.app`
- [ ] HTTPS provisioned
- [ ] https://dailyresume.in loads
- [ ] Google OAuth URIs updated + login tested

---

## Troubleshooting

| Problem | Fix |
|---------|-----|
| Blank site after drag-drop | Use **Option A (Git)** — SSR needs Netlify build, not static assets alone |
| `google-callback.html` 404 | Rebuild; ensure `public/google-callback.html` is in the repo; publish `.output/public` |
| “Awaiting External DNS” | Fix A/CNAME; wait for propagation |
| HTTPS fails | One A record only on `@` → `75.2.60.5` |
| Google `redirect_uri_mismatch` | Console URI must match Netlify env **exactly** |

---

## Quick reference

```text
Build
  npm run build
  → use .output/public on Netlify

Netlify (best)
  Git connect → build: npm run build → publish: .output/public

Domain
  Add dailyresume.in (+ www)
  A     @     75.2.60.5
  CNAME www   your-site-name.netlify.app

Then
  HTTPS → env + Google OAuth → redeploy
```
