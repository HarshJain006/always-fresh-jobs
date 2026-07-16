import { c as isSupabaseConfigured, s as getSupabaseServer } from "./users-Cu_iz6if.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/jobs-_QHuSMBf.js
var JOB_PRIORITY = {
	test: 5,
	run_now: 10,
	daily_refresh: 100
};
/** Today's date in Asia/Kolkata as YYYY-MM-DD (for daily job uniqueness). */
function istDateString(now = /* @__PURE__ */ new Date()) {
	return new Intl.DateTimeFormat("en-CA", {
		timeZone: "Asia/Kolkata",
		year: "numeric",
		month: "2-digit",
		day: "2-digit"
	}).format(now);
}
/**
* Queue operations against Supabase. Safe to call from Netlify (enqueue)
* or from the Raspberry Pi worker (claim / complete).
*/
function rowToJob(row) {
	return {
		id: String(row.id),
		user_id: String(row.user_id),
		platform: row.platform,
		job_type: row.job_type,
		status: row.status,
		priority: Number(row.priority),
		attempts: Number(row.attempts),
		max_attempts: Number(row.max_attempts),
		worker_id: row.worker_id ? String(row.worker_id) : null,
		locked_at: row.locked_at ? String(row.locked_at) : null,
		lock_expires_at: row.lock_expires_at ? String(row.lock_expires_at) : null,
		available_at: String(row.available_at),
		scheduled_for: row.scheduled_for ? String(row.scheduled_for) : null,
		error: row.error ? String(row.error) : null,
		result_message: row.result_message ? String(row.result_message) : null,
		created_at: String(row.created_at),
		updated_at: String(row.updated_at),
		completed_at: row.completed_at ? String(row.completed_at) : null
	};
}
async function enqueueJob(input) {
	if (!isSupabaseConfigured()) throw new Error("Supabase is required for the job queue.");
	const platform = input.platform ?? "naukri";
	const scheduledFor = input.jobType === "daily_refresh" ? input.scheduledFor ?? istDateString() : null;
	const payload = {
		user_id: input.userId,
		platform,
		job_type: input.jobType,
		status: "pending",
		priority: JOB_PRIORITY[input.jobType],
		available_at: (input.availableAt ?? /* @__PURE__ */ new Date()).toISOString(),
		scheduled_for: scheduledFor
	};
	const { data, error } = await getSupabaseServer().from("automation_jobs").insert(payload).select("*").maybeSingle();
	if (error) {
		if (error.code === "23505" && input.jobType === "daily_refresh") return {
			ok: true,
			job: await findActiveDailyJob(input.userId, platform, scheduledFor),
			alreadyQueued: true,
			message: "Your daily refresh is already scheduled for today."
		};
		throw new Error(`Failed to enqueue job: ${error.message}`);
	}
	return {
		ok: true,
		job: data ? rowToJob(data) : null,
		message: input.jobType === "run_now" ? "Your resume refresh has started." : "Your daily refresh is scheduled."
	};
}
async function findActiveDailyJob(userId, platform, scheduledFor) {
	const { data } = await getSupabaseServer().from("automation_jobs").select("*").eq("user_id", userId).eq("platform", platform).eq("job_type", "daily_refresh").eq("scheduled_for", scheduledFor).in("status", [
		"pending",
		"claimed",
		"running"
	]).maybeSingle();
	return data ? rowToJob(data) : null;
}
async function getRecentJobsForUser(userId, limit = 10) {
	const { data, error } = await getSupabaseServer().from("automation_jobs").select("*").eq("user_id", userId).order("created_at", { ascending: false }).limit(limit);
	if (error) throw error;
	return (data ?? []).map((r) => rowToJob(r));
}
//#endregion
export { getRecentJobsForUser as n, istDateString as r, enqueueJob as t };
