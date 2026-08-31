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
6. `supabase/migrations/007_daily_job_once_per_day.sql` ← **no re-upload after daily success**
7. `supabase/migrations/008_email_reminder_events.sql` ← **email reminder tracking**
8. `supabase/migrations/009_trial_5_days_and_trial_ending.sql` ← **5-day trial + trial ending emails**
9. `supabase/migrations/011_trial_starts_on_refresh.sql` ← **trial clock starts on Start daily refresh**

Confirm tables `automation_jobs`, `automation_logs`, `user_automation` exist.

---

## 2. Netlify (frontend)

Already deployed. Keep these env vars set (including live Razorpay keys + Resend).

Dashboard actions only enqueue / update state — Selenium never runs on Netlify.

### Resend email env (Netlify)

```bash
RESEND_API_KEY=re_xxxxxxxx
RESEND_FROM_EMAIL=onboarding@resend.dev   # testing only — use no-reply@dailyresume.in after domain verify
RESEND_FROM_NAME=DailyResume
```

Verify `dailyresume.in` in [Resend Domains](https://resend.com/domains), then switch `RESEND_FROM_EMAIL` to `no-reply@dailyresume.in`.

Test locally or on Netlify:

```bash
npm run mail:test -- you@example.com
```

Reminder behavior:
- New accounts get a **pending 5-day free trial** — countdown starts when they press **Start daily refresh**.
- **Before trial ends** (after clock started): emails at **3, 2, and 1** calendar days remaining.
- Send confirmation email when subscription is purchased.
- **Before subscription ends:** reminders at **7, 3, 1, and 0** days left.
- **After trial ends:** up to 5 win-back emails, every **2 days**.
- **After subscription ends:** up to 5 win-back emails, every **2 days**.
- **Wrong Naukri password:** immediate email each time login fails (not sent on success). Queued if daily cap is reached.
- **Daily cap:** max **95 emails per IST calendar day**; overflow is queued and sent the next day (priority order below).
- All scheduled sends tracked in `email_reminder_events` (idempotent — no duplicates).

**Send priority** (when cap is tight):
1. Wrong Naukri username/password
2. Free trial ended (win-back)
3. Subscription ending soon (renew)
4. Trial ending soon, subscription expired win-back
5. Purchase confirmation

Run migrations `009`, `011`, `012`, and `013` in Supabase before enabling.

### Reminder cron (required — once per day)

Use [cron-job.org](https://cron-job.org), EasyCron, or Netlify scheduled trigger:

```http
GET https://dailyresume.in/api/cron/reminders
x-cron-secret: <CRON_SECRET>
```

Recommended time: **10:00 AM IST** daily (`30 4 * * *` UTC).

Response example: `{ "ok": true, "sent": 2, "attempted": 5, "skipped": 3 }`

Run migrations `008` and `009` in Supabase before enabling.

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
