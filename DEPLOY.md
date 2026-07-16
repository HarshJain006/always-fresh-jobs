# Deploy: Netlify (frontend) + Supabase (DB + free job queue) + Raspberry Pi (Selenium worker)

## Architecture

```
Browser → Netlify (UI + enqueue APIs)
              ↓
         Supabase Postgres  ←── automation_jobs queue (durable, free)
              ↑
     Raspberry Pi worker  (claims jobs, runs headless Chrome, writes logs)
```

If the Pi loses power, jobs stay in Supabase as `pending` / expire their lease and return to `pending`. When the Pi starts again it **reclaims** and continues.

**Queue tool:** Supabase/Postgres with `FOR UPDATE SKIP LOCKED` — best free fit (no Redis, no BullMQ cloud, already in your stack).

---

## 1. Supabase SQL (required)

In Supabase → SQL Editor, run:

1. `supabase/schema.sql` (if not already)
2. `supabase/migrations/003_lock_trial_fields.sql`
3. `supabase/migrations/004_automation_jobs_queue.sql` ← **job queue**
4. `supabase/migrations/005_security_lockdown.sql` ← **RLS lockdown (required before public launch)**

Confirm table `automation_jobs` exists and RPCs:
`claim_automation_job`, `complete_automation_job`, `heartbeat_automation_job`, `reclaim_stale_automation_jobs`.

---

## 2. Netlify (frontend — free)

1. Push this repo to GitHub.
2. [Netlify](https://app.netlify.com/) → Add new site → Import from Git.
3. Build settings:
   - **Build command:** `npm run build`
   - **Publish directory:** `.output/public`
4. Domain: add `dailyresume.in` (and `www`) under Domain management.  
   **Full guide (build → upload → domain):** [DOMAIN_SETUP.md](./DOMAIN_SETUP.md)
5. Environment variables (Site settings → Environment):

| Name | Value |
|------|--------|
| `VITE_APP_URL` | `https://dailyresume.in` |
| `VITE_GOOGLE_CLIENT_ID` | your Google client id |
| `VITE_GOOGLE_REDIRECT_URI` | `https://dailyresume.in/google-callback.html` |
| `VITE_SUPABASE_URL` | your Supabase URL |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | publishable key |
| `SUPABASE_SERVICE_ROLE_KEY` | **service role** (server enqueue + storage; never expose to browser) |
| `ENCRYPTION_KEY` | 32+ char secret (encrypt Naukri passwords) |
| `SESSION_SECRET` | 32+ char secret (app sessions; can match ENCRYPTION_KEY) |
| `CRON_SECRET` | 16+ char secret for `/api/cron/daily-refresh` |

6. Google Console: Authorized origins + redirect URIs for `https://dailyresume.in` (see earlier setup).

Netlify must **not** run Selenium. “Run now” / Start / Test only **insert rows** into `automation_jobs`.

---

## 3. Raspberry Pi (backend worker)

Needs: Node 22+, Chrome/Chromium, git, this repo.

```bash
sudo apt update
sudo apt install -y chromium-browser
# or google-chrome-stable on supported Pi OSes

cd ~/DailyResume/always-fresh-jobs   # clone your repo here
npm ci

# Create .env.worker (or .env) with at least:
# VITE_SUPABASE_URL=...
# VITE_SUPABASE_PUBLISHABLE_KEY=...
# SUPABASE_SERVICE_ROLE_KEY=...   # recommended on the Pi
# ENCRYPTION_KEY=...              # MUST match Netlify
# WORKER_ID=rpi-living-room       # optional unique name
# QUEUE_POLL_MS=5000
# QUEUE_LEASE_SECONDS=900

npm run worker
```

### systemd (auto-start after reboot)

`/etc/systemd/system/dailyresume-worker.service`:

```ini
[Unit]
Description=DailyResume Selenium queue worker
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
User=pi
WorkingDirectory=/home/pi/DailyResume/always-fresh-jobs
EnvironmentFile=/home/pi/DailyResume/always-fresh-jobs/.env
ExecStart=/usr/bin/npm run worker
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
```

```bash
sudo systemctl daemon-reload
sudo systemctl enable --now dailyresume-worker
sudo journalctl -u dailyresume-worker -f
```

### Commands

| Command | What it does |
|---------|----------------|
| `npm run worker` | Poll forever + enqueue at 8:00 AM IST |
| `npm run worker:once` | Claim & run one job then exit |
| `npm run worker:enqueue-daily` | Only push today's daily jobs into the queue |

---

## 4. How jobs flow

| Trigger | Who | Action |
|---------|-----|--------|
| User clicks Start / Run now / Test | Netlify | `INSERT` into `automation_jobs` |
| 8:00 AM IST | Pi cron **or** Netlify `/api/cron/daily-refresh` | Enqueue `daily_refresh` for eligible users |
| Always | Pi worker | `claim` → Selenium → `complete` / retry |
| Pi crash mid-job | Supabase | Lease expires → status back to `pending` |

---

## 5. Optional Netlify cron

If you want enqueue even when the Pi is off at 8 AM (jobs wait in queue):

Netlify Scheduled Function or external cron (cron-job.org free) →  
`POST https://dailyresume.in/api/cron/daily-refresh`  
Header: `x-cron-secret: <CRON_SECRET>`

When the Pi comes online it drains the queue.

---

## 6. Verify

1. Open dashboard on `dailyresume.in` → Start or Test backend.
2. In Supabase → Table `automation_jobs` → see `pending`.
3. On Pi: `journalctl -u dailyresume-worker -f` → claims job → “Naukri Login Successful”.
4. Unplug Pi mid-run → wait ~15 min (lease) or set shorter `QUEUE_LEASE_SECONDS` → job returns to `pending` → plug in → worker resumes.
