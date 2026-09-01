# DailyResume — Email Commands & Reference

Run all commands from the project root (`always-fresh-jobs/`).

```bash
cd always-fresh-jobs
```

---

## Setup (required in `.env`)

```bash
RESEND_API_KEY=re_xxxxxxxx
RESEND_FROM_EMAIL=noreply@dailyresume.in   # or onboarding@resend.dev for testing
RESEND_FROM_NAME=DailyResume

# Required for bulk commands (welcome-all, expired-all)
SUPABASE_SERVICE_ROLE_KEY=...
VITE_SUPABASE_URL=...
```

Optional:

```bash
DAILY_EMAIL_CAP=95   # max emails per IST day (default 95)
```

**Supabase migrations** (run in SQL Editor before bulk sends):

- `008` — email_reminder_events table
- `012` — credential failure emails
- `013` — queued status + daily cap
- `014` — welcome_thank_you type
- `015` — expired_access_reengage type

---

## Quick reference

| Command | What it does | Fetches from Supabase? |
|---------|--------------|------------------------|
| `npm run mail:send -- list` | Show all commands | No |
| `npm run mail:test -- you@example.com` | Plain connectivity test | No |
| `npm run mail:send -- test you@example.com` | Same as mail:test | No |
| `npm run mail:send -- welcome ...` | Thank-you to one address | No (you type email) |
| `npm run mail:send -- welcome-all ...` | Thank-you to all active users | **Yes** |
| `npm run mail:send -- expired-all ...` | Upsell to expired trial/sub users | **Yes** |
| `npm run mail:send -- expired-upsell ...` | Preview upsell to one address | No |
| `npm run mail:send -- credentials ...` | Preview wrong-password email | No |
| `npm run mail:send -- purchased ...` | Preview purchase confirmation | No |
| `npm run mail:send -- trial-ending ...` | Preview trial-ending reminder | No |

---

## 1. Help — list all commands

```bash
npm run mail:send -- list
```

---

## 2. Connectivity test

Plain email to verify Resend is working:

```bash
npm run mail:test -- you@example.com
```

Or:

```bash
npm run mail:send -- test you@example.com
```

---

## 3. Single-address previews

Send a branded template to **one email you type** (does not read Supabase).

### Thank-you / welcome

```bash
npm run mail:send -- welcome you@example.com
npm run mail:send -- welcome you@example.com "Harsh"
```

**Subject:** `Welcome to DailyResume — thank you for joining us`

### Wrong Naukri password alert

```bash
npm run mail:send -- credentials you@example.com
npm run mail:send -- credentials you@example.com "Harsh"
```

### Subscription purchase confirmation

```bash
npm run mail:send -- purchased you@example.com "Harsh" "1 Month" "15 Mar 2026"
```

### Trial ending (1 day left)

```bash
npm run mail:send -- trial-ending you@example.com
npm run mail:send -- trial-ending you@example.com "Harsh"
```

### Expired trial / subscription upsell (preview)

```bash
# Trial-ended version
npm run mail:send -- expired-upsell you@example.com "Harsh" trial

# Subscription-ended version
npm run mail:send -- expired-upsell you@example.com "Harsh" subscription
```

**Trial subject:** `Keep your Naukri profile active — you're one step away`  
**Subscription subject:** `Ready to get back on top of recruiter searches?`

---

## 4. Bulk — thank-you to ALL active users

Fetches **name + email** from Supabase (`users` table, `account_status = active`).  
Each user receives it **once** (tracked in `email_reminder_events`).

**Step 1 — preview (no emails sent):**

```bash
npm run mail:send -- welcome-all --dry-run
```

**Step 2 — send for real:**

```bash
npm run mail:send -- welcome-all --confirm
```

> `--confirm` is required for bulk sends (prevents accidental blast).

---

## 5. Bulk — upsell to expired trial / subscription users

Fetches users from Supabase whose **trial or subscription has ended** and they have **no active plan**.

**Who is included:**
- Trial ended — used free trial, it expired, no paid plan
- Subscription ended — paid plan expired

**Who is skipped:**
- Active trial or subscription
- Already received this campaign
- No email on file

**Step 1 — preview:**

```bash
npm run mail:send -- expired-all --dry-run
```

Shows: total eligible, trial vs subscription breakdown, would-send vs already-sent.

**Step 2 — send for real:**

```bash
npm run mail:send -- expired-all --confirm
```

---

## 6. Automatic emails (production)

These run without manual commands. User **name + email** always come from Supabase.

| Trigger | When | How |
|---------|------|-----|
| Wrong Naukri password | Immediately after failed login | Pi queues → Netlify `/api/cron/mail-queue` |
| Trial ending | 3, 2, 1 days before trial ends | Daily cron |
| Trial expired win-back | Every 2 days, max 5 | Daily cron |
| Subscription ending | 7, 3, 1, 0 days before expiry | Daily cron |
| Subscription expired win-back | Every 2 days, max 5 | Daily cron |
| Purchase confirmation | After successful payment | On payment webhook |

**Welcome / thank-you** and **expired upsell (manual campaign)** are **manual only** unless you run the bulk commands above.

### Daily reminder cron (required)

Schedule once per day (~10:00 AM IST):

```http
GET https://dailyresume.in/api/cron/reminders
x-cron-secret: <CRON_SECRET>
```

Cron expression (UTC): `30 4 * * *`

### Mail queue flush (credential failures from Pi)

```http
POST https://dailyresume.in/api/cron/mail-queue
x-cron-secret: <CRON_SECRET>
```

Called automatically by the Pi worker after wrong-password events.

---

## 7. Daily cap & queue

- **Max 95 emails per IST calendar day** (configurable via `DAILY_EMAIL_CAP`)
- Overflow is **queued** in `email_reminder_events` with status `queued`
- Queued emails are sent on the next bulk run or daily cron

**Send priority** (when cap is tight):

1. Wrong Naukri username/password  
2. Free trial ended (automated win-back)  
3. Subscription ending soon  
4. Trial ending soon / subscription expired win-back  
5. Purchase confirmation  
6. Welcome thank-you / manual expired upsell  

If bulk send queues emails, re-run the next day:

```bash
npm run mail:send -- welcome-all --confirm
# or
npm run mail:send -- expired-all --confirm
```

Or trigger the daily cron:

```bash
curl -X GET "https://dailyresume.in/api/cron/reminders" \
  -H "x-cron-secret: YOUR_CRON_SECRET"
```

---

## 8. Typical workflows

### Test Resend is working

```bash
npm run mail:test -- your@gmail.com
```

### Preview welcome email before bulk send

```bash
npm run mail:send -- welcome your@gmail.com "Your Name"
npm run mail:send -- welcome-all --dry-run
npm run mail:send -- welcome-all --confirm
```

### Re-engage churned users

```bash
npm run mail:send -- expired-upsell your@gmail.com "Your Name" trial
npm run mail:send -- expired-all --dry-run
npm run mail:send -- expired-all --confirm
```

### Preview any automated template

```bash
npm run mail:send -- credentials your@gmail.com "Name"
npm run mail:send -- trial-ending your@gmail.com "Name"
npm run mail:send -- purchased your@gmail.com "Name" "3 Months" "30 Jun 2026"
```

---

## 9. Troubleshooting

| Problem | Fix |
|---------|-----|
| Wrong-password email not received | See **Wrong-password checklist** below |
| `Resend not configured` | Set `RESEND_API_KEY` + `RESEND_FROM_EMAIL` in `.env` (Netlify) |
| Bulk command fails on Supabase | Set `SUPABASE_SERVICE_ROLE_KEY` in `.env` |
| Email not received | Check spam; verify domain in [Resend Domains](https://resend.com/domains) |
| `welcome-all` / `expired-all` needs flag | Always pass `--dry-run` or `--confirm` |
| Bulk stopped at 95 | Normal — re-run tomorrow or run `npm run mail:flush-queue` |
| Migration error on bulk send | Run migrations `012`–`015` in Supabase |
| Pi worker mail crash | Pi does not need `resend` — run `npm ci` after pull; see `DEPLOY.md` |

### Wrong-password email checklist

Pi queues the email → Netlify sends it. All of these must be true:

1. **Netlify** has `RESEND_API_KEY`, `RESEND_FROM_EMAIL`, `CRON_SECRET`
2. **Pi `.env`** has the **same** `CRON_SECRET` + `VITE_APP_URL=https://dailyresume.in`
3. Migration **`012_credential_failure_email.sql`** ran in Supabase
4. Latest code deployed to Netlify (`/api/cron/mail-queue` endpoint exists)
5. Pi worker restarted after `git pull`

**Recover stuck queued emails manually:**

```bash
npm run mail:flush-queue
```

Or from curl:

```bash
curl -X POST "https://dailyresume.in/api/cron/mail-queue" \
  -H "x-cron-secret: YOUR_CRON_SECRET"
```

Check Supabase `email_reminder_events` for rows with `reminder_type = naukri_credentials_failed` and `status = queued`.

---

## 10. All commands (copy-paste cheat sheet)

```bash
# Help
npm run mail:send -- list

# Test
npm run mail:test -- you@example.com
npm run mail:send -- test you@example.com

# Single preview
npm run mail:send -- welcome you@example.com "Name"
npm run mail:send -- credentials you@example.com "Name"
npm run mail:send -- purchased you@example.com "Name" "1 Month" "15 Mar 2026"
npm run mail:send -- trial-ending you@example.com "Name"
npm run mail:send -- expired-upsell you@example.com "Name" trial
npm run mail:send -- expired-upsell you@example.com "Name" subscription

# Bulk (Supabase)
npm run mail:send -- welcome-all --dry-run
npm run mail:send -- welcome-all --confirm
npm run mail:send -- expired-all --dry-run
npm run mail:send -- expired-all --confirm

# Drain queued emails (wrong-password stuck, cap overflow)
npm run mail:flush-queue
```
