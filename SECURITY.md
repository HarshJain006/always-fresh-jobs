# Security (pre-production)

## Must run in Supabase SQL Editor before going public

1. `supabase/migrations/003_lock_trial_fields.sql`
2. `supabase/migrations/004_automation_jobs_queue.sql`
3. `supabase/migrations/005_security_lockdown.sql` ← **closes open RLS / queue RPC abuse**

## What we fixed in code

| Issue | Fix |
|-------|-----|
| Open RLS (anyone with anon key could read all data) | Deny anon/authenticated; service_role only |
| Queue claim/complete as anon | Revoke execute from anon |
| Client-trusted `userId` / forged session user | Signed `sessionToken` after verified Google ID token |
| Google JWT only base64-decoded | Server calls Google `tokeninfo` (aud/iss/exp) |
| Default encryption key | `ENCRYPTION_KEY` required (no VITE_, no default) |
| Cron open if secret missing | Fail closed (503 without `CRON_SECRET`) |
| `VITE_SUPABASE_SERVICE_ROLE_KEY` | Removed |
| Resume path from DB used as FS path | Worker only uses `getResumePath(userId)` |
| PDF content-type trust | Magic-byte `%PDF-` check |
| Premium self-grant via INSERT/UPDATE | Forced trial on insert + billing update guard |

## Your checklist before build/deploy

1. Run migration **005** in Supabase.
2. Set **real** secrets in local `.env`, Netlify, and Pi:
   - `SUPABASE_SERVICE_ROLE_KEY`
   - `ENCRYPTION_KEY` (32+)
   - `SESSION_SECRET` (32+)
   - `CRON_SECRET` (16+)
3. Remove Google **client secret** from any frontend env (not used; rotate if it was ever committed).
4. Sign out / sign in again after deploy (old localStorage sessions without `sessionToken` will fail).
5. Re-save Naukri passwords once (must be encrypted with the new key).
