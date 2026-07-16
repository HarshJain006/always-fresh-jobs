import { a as findUserById, c as isSupabaseConfigured, l as reconcileUserAccess, n as checkTrialStatus, s as getSupabaseServer, t as checkSubscriptionStatus } from "./users-Cu_iz6if.mjs";
import * as fs from "node:fs";
import * as path from "node:path";
//#region node_modules/.nitro/vite/services/ssr/assets/accessControl-BFm4N4Mn.js
/**
* Per-user automation state — Supabase-backed with local .data fallback.
*/
var STORE_DIR = path.join(process.cwd(), ".data", "automation");
function filePath(userId) {
	return path.join(STORE_DIR, `${userId}.json`);
}
function ensureDir() {
	fs.mkdirSync(STORE_DIR, { recursive: true });
}
function defaultRecord(userId) {
	return {
		userId,
		credentials: null,
		resume: null,
		platforms: [{
			id: "naukri",
			name: "Naukri",
			connected: false,
			last: null
		}, {
			id: "indeed",
			name: "Indeed",
			connected: false,
			last: null
		}],
		automationState: "idle",
		lastRunAt: null,
		updatedAt: (/* @__PURE__ */ new Date()).toISOString()
	};
}
function rowToRecord(row) {
	return {
		userId: String(row.user_id),
		credentials: row.credentials ?? null,
		resume: row.resume ?? null,
		platforms: row.platforms ?? defaultRecord(String(row.user_id)).platforms,
		automationState: row.automation_state || "idle",
		lastRunAt: row.last_run_at ? String(row.last_run_at) : null,
		updatedAt: String(row.updated_at ?? (/* @__PURE__ */ new Date()).toISOString())
	};
}
function recordToRow(record) {
	return {
		user_id: record.userId,
		credentials: record.credentials,
		resume: record.resume,
		platforms: record.platforms,
		automation_state: record.automationState,
		last_run_at: record.lastRunAt,
		updated_at: (/* @__PURE__ */ new Date()).toISOString()
	};
}
function readLocal(userId) {
	ensureDir();
	const fp = filePath(userId);
	if (!fs.existsSync(fp)) return defaultRecord(userId);
	try {
		return JSON.parse(fs.readFileSync(fp, "utf8"));
	} catch {
		return defaultRecord(userId);
	}
}
function writeLocal(record) {
	ensureDir();
	record.updatedAt = (/* @__PURE__ */ new Date()).toISOString();
	fs.writeFileSync(filePath(record.userId), JSON.stringify(record, null, 2));
	return record;
}
async function getUserAutomation(userId) {
	if (isSupabaseConfigured()) try {
		const { data, error } = await getSupabaseServer().from("user_automation").select("*").eq("user_id", userId).maybeSingle();
		if (error) throw error;
		if (data) return rowToRecord(data);
		const empty = defaultRecord(userId);
		await getSupabaseServer().from("user_automation").upsert(recordToRow(empty), { onConflict: "user_id" });
		return empty;
	} catch (err) {
		console.error("getUserAutomation (supabase):", err);
	}
	return readLocal(userId);
}
async function saveUserAutomation(record) {
	record.updatedAt = (/* @__PURE__ */ new Date()).toISOString();
	if (isSupabaseConfigured()) try {
		const { data, error } = await getSupabaseServer().from("user_automation").upsert(recordToRow(record), { onConflict: "user_id" }).select("*").single();
		if (error) throw error;
		writeLocal(record);
		return rowToRecord(data);
	} catch (err) {
		console.error("saveUserAutomation (supabase):", err);
	}
	return writeLocal(record);
}
async function listActiveAutomationUsers() {
	if (isSupabaseConfigured()) try {
		const { data, error } = await getSupabaseServer().from("user_automation").select("*").eq("automation_state", "running");
		if (error) throw error;
		return (data ?? []).map((row) => rowToRecord(row));
	} catch (err) {
		console.error("listActiveAutomationUsers (supabase):", err);
	}
	ensureDir();
	return fs.readdirSync(STORE_DIR).filter((f) => f.endsWith(".json")).map((f) => {
		try {
			return JSON.parse(fs.readFileSync(path.join(STORE_DIR, f), "utf8"));
		} catch {
			return null;
		}
	}).filter((r) => !!r && r.automationState === "running");
}
var PAID_PLANS = [
	{
		id: "premium_1m",
		legacyId: "premium_monthly",
		name: "1 Month",
		months: 1,
		priceInr: 199,
		amountInPaise: 19900,
		label: "₹199",
		blurb: "Perfect to try Premium"
	},
	{
		id: "premium_3m",
		name: "3 Months",
		months: 3,
		priceInr: 699,
		amountInPaise: 69900,
		label: "₹699",
		blurb: "Best value for job season",
		popular: true
	},
	{
		id: "premium_6m",
		name: "6 Months",
		months: 6,
		priceInr: 899,
		amountInPaise: 89900,
		label: "₹899",
		blurb: "Lowest monthly cost"
	}
];
function getPlan(planId) {
	if (planId === "premium_monthly") return PAID_PLANS.find((p) => p.id === "premium_1m");
	return PAID_PLANS.find((p) => p.id === planId);
}
function planLabel(planId) {
	if (!planId || planId === "free_trial") return "Free trial";
	return getPlan(planId)?.name ?? "Premium";
}
/** Add calendar months in a stable way (local date math). */
function addMonths(from, months) {
	const d = new Date(from.getTime());
	const day = d.getDate();
	d.setMonth(d.getMonth() + months);
	if (d.getDate() < day) d.setDate(0);
	return d;
}
function getPaidDaysRemaining(user) {
	if (!user.subscription_expire_at) return 0;
	const msLeft = new Date(user.subscription_expire_at).getTime() - Date.now();
	if (msLeft <= 0) return 0;
	const status = checkSubscriptionStatus(user);
	if (status !== "active" && status !== "cancelled") return 0;
	return Math.max(0, Math.ceil(msLeft / (1440 * 60 * 1e3)));
}
function formatExpireDate(iso) {
	if (!iso) return "—";
	return new Date(iso).toLocaleDateString("en-IN", {
		timeZone: "Asia/Kolkata",
		day: "numeric",
		month: "short",
		year: "numeric"
	});
}
function subscriptionSummary(user) {
	if (checkSubscriptionStatus(user) === "active") {
		const days = getPaidDaysRemaining(user);
		const planName = planLabel(user.subscription_plan);
		return {
			kind: "premium",
			title: `Premium · ${planName}`,
			detail: `Valid until ${formatExpireDate(user.subscription_expire_at)}`,
			daysRemaining: days,
			endingSoon: days > 0 && days <= 7,
			planName
		};
	}
	const trial = checkTrialStatus(user);
	if (trial.active) return {
		kind: "trial",
		title: "Free trial",
		detail: `${trial.daysRemaining} day${trial.daysRemaining === 1 ? "" : "s"} remaining`,
		daysRemaining: trial.daysRemaining,
		endingSoon: false,
		planName: "Free trial"
	};
	return {
		kind: "expired",
		title: "Subscription ended",
		detail: "Renew to keep daily refreshes running.",
		daysRemaining: 0,
		endingSoon: false,
		planName: "None"
	};
}
function validateSubscription(user) {
	if (user.account_status !== "active") return {
		allowed: false,
		reason: "suspended",
		daysRemaining: 0,
		subscriptionExpireAt: null
	};
	const status = checkSubscriptionStatus(user);
	if (status === "active") return {
		allowed: true,
		reason: "active",
		daysRemaining: getPaidDaysRemaining(user),
		subscriptionExpireAt: user.subscription_expire_at
	};
	if (status === "cancelled" && user.subscription_expire_at && new Date(user.subscription_expire_at).getTime() > Date.now()) return {
		allowed: true,
		reason: "active",
		daysRemaining: getPaidDaysRemaining({
			...user,
			subscription_status: "active"
		}),
		subscriptionExpireAt: user.subscription_expire_at
	};
	if (status === "cancelled") return {
		allowed: false,
		reason: "expired",
		daysRemaining: 0,
		subscriptionExpireAt: user.subscription_expire_at
	};
	const trial = checkTrialStatus(user);
	if (trial.active) return {
		allowed: true,
		reason: "trial",
		daysRemaining: trial.daysRemaining,
		subscriptionExpireAt: null
	};
	return {
		allowed: false,
		reason: "expired",
		daysRemaining: 0,
		subscriptionExpireAt: user.subscription_expire_at
	};
}
/** Load user from DB, expire stale trial/premium, pause automation if locked out. */
async function getAuthoritativeAccess(userId) {
	const raw = await findUserById(userId);
	if (!raw) throw new Error("Account not found. Sign out and sign in again with Google.");
	const user = await reconcileUserAccess(raw);
	const access = validateSubscription(user);
	if (!access.allowed) await pauseAutomationIfNeeded(user.id);
	return {
		...access,
		trialExpireAt: user.trial_expire_at,
		subscriptionExpireAt: access.subscriptionExpireAt,
		subscriptionStatus: user.subscription_status,
		subscriptionPlan: user.subscription_plan,
		user
	};
}
/** Throws if the account cannot run automation (trial/paid ended or suspended). */
async function assertAutomationAccess(userId) {
	const access = await getAuthoritativeAccess(userId);
	if (!access.allowed) {
		const msg = access.reason === "suspended" ? "Your account is suspended." : "Your access has ended. Renew your subscription to continue.";
		throw new Error(msg);
	}
	return access;
}
async function pauseAutomationIfNeeded(userId) {
	try {
		const record = await getUserAutomation(userId);
		if (record.automationState === "running") await saveUserAutomation({
			...record,
			userId,
			automationState: "idle"
		});
	} catch (err) {
		console.error("pauseAutomationIfNeeded:", err);
	}
}
//#endregion
export { getPlan as a, saveUserAutomation as c, getAuthoritativeAccess as i, subscriptionSummary as l, addMonths as n, getUserAutomation as o, assertAutomationAccess as r, listActiveAutomationUsers as s, PAID_PLANS as t };
