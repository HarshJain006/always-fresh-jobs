# Deploy: Netlify (frontend) + Supabase (DB + free job queue) + Raspberry Pi (Selenium worker)

## Architecture

```
Browser → Netlify (UI + enqueue APIs)
              ↓
         Supabase Postgres  ←── automation_jobs queue (durable, free)
              ↑
     Raspberry Pi worker  (4 concurrent slots, claims jobs, runs headless Chrome, writes logs)
```

**Daily schedule (IST) — dynamic:**
1. Worker counts eligible users each minute
2. Start time = **8:00 AM − (ceil(users ÷ 4) × 3 min + 5 min buffer)**
3. Example: 27 users → 7 batches × 3 = 21 + 5 buffer → start **~7:34 AM**, finish before 8:00
4. As users grow, start moves earlier automatically (never earlier than 2:00 AM)

If the Pi loses power, jobs stay in Supabase as `pending` / expire their lease and return to `pending`. When the Pi starts again it **reclaims** and continues.

---

## 1. Supabase SQL (required)

In Supabase → SQL Editor, run:

1. `supabase/schema.sql` (if not already)
2. `supabase/migrations/003_lock_trial_fields.sql`
3. `supabase/migrations/004_automation_jobs_queue.sql` ← **job queue**
4. `supabase/migrations/005_security_lockdown.sql` ← **RLS lockdown**
5. `supabase/migrations/006_subscription_plans.sql` ← **plans**

Confirm tables `automation_jobs`, `automation_logs`, `user_automation` exist.

---

## 2. Netlify (frontend)

Already deployed. Keep these env vars set (including live Razorpay keys).

Dashboard actions only enqueue / update state — Selenium never runs on Netlify.

---

## 3. Raspberry Pi (backend worker)

Needs: Node 22+, Chrome/Chromium, git, this repo.

```bash
sudo apt update
sudo apt install -y chromium-browser
# or google-chrome-stable on supported Pi OSes

cd ~/DailyResume/always-fresh-jobs   # clone your repo here
git pull
npm ci
```

### `.env` on the Pi (required)

```bash
VITE_SUPABASE_URL=
VITE_SUPABASE_PUBLISHABLE_KEY=
SUPABASE_SERVICE_ROLE_KEY=
ENCRYPTION_KEY=
SESSION_SECRET=

WORKER_ID=rpi-1
QUEUE_CONCURRENCY=4          # 4 resumes at the same time
QUEUE_MINUTES_PER_USER=3     # assumed time per resume
QUEUE_BUFFER_MINUTES=5       # safety margin before 8:00 AM
QUEUE_FINISH_HOUR_IST=8      # must finish by this hour
QUEUE_EARLIEST_HOUR_IST=2    # never start before this hour
QUEUE_POLL_MS=5000
QUEUE_LEASE_SECONDS=900
```

```bash
npm run worker
```

### systemd (auto-start after reboot)

`/etc/systemd/system/dailyresume-worker.service`:

```ini
[Unit]
Description=DailyResume Selenium queue worker (4 concurrent, dynamic start)
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
| `npm run worker` | Poll forever with 4 slots + dynamic morning enqueue |
| `npm run worker:once` | Claim & run one job then exit |
| `npm run worker:enqueue-daily` | Only push today's daily jobs into the queue |

---

## 4. How jobs flow

| Trigger | Who | Action |
|---------|-----|--------|
| User clicks Start | Netlify | Sets automation `running` + may enqueue today's job |
| Dynamic morning (e.g. 7:40) | Pi worker | Enqueue `daily_refresh` for eligible users |
| Always | Pi (4 slots) | `claim` → Selenium → `complete` + write `automation_logs` |
| Wrong Naukri password | Pi | Log failure to Recent activity: incorrect username/password |
| Pi crash mid-job | Supabase | Lease expires → status back to `pending` |

---

## 5. Optional Netlify cron (backup enqueue)

If you want enqueue even when the Pi is off:

External cron → `POST https://dailyresume.in/api/cron/daily-refresh`  
Header: `x-cron-secret: <CRON_SECRET>`

Prefer running this around the morning window. When the Pi comes online it drains the queue.

---

## 6. Verify

1. On Pi: `sudo journalctl -u dailyresume-worker -f` → see schedule plan log like `27 users → start 07:34 IST`.
2. Manually: `npm run worker:enqueue-daily` then watch jobs move `pending` → `running` → `completed` in Supabase `automation_jobs`.
3. Open dashboard → **Recent activity** shows success or password errors.
4. Wrong password test: save bad Naukri password → run a job → activity should say incorrect username or password.
