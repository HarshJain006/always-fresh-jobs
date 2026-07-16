import { n as __exportAll$1 } from "../_runtime.mjs";
import { t as createClient } from "../_libs/supabase__supabase-js.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/users-Cu_iz6if.js
var users_Cu_iz6if_exports = /* @__PURE__ */ __exportAll$1({
	a: () => findUserById,
	c: () => users_exports,
	d: () => isSupabaseConfigured,
	i: () => findUserByGoogleId,
	l: () => formatSupabaseError,
	n: () => checkTrialStatus,
	o: () => reconcileUserAccess,
	r: () => createUser,
	s: () => updateUser,
	t: () => checkSubscriptionStatus,
	u: () => getSupabaseServer
});
var __defProp = Object.defineProperty;
var __exportAll = (all, no_symbols) => {
	let target = {};
	for (var name in all) __defProp(target, name, {
		get: all[name],
		enumerable: true
	});
	if (!no_symbols) __defProp(target, Symbol.toStringTag, { value: "Module" });
	return target;
};
var client = null;
function getClient() {
	if (!client) client = {
		isConnected: true,
		provider: "mock"
	};
	return client;
}
/**
* Shared env helper — works in Vite (import.meta.env) and Node (process.env).
*/
function getEnv(name) {
	if (typeof import.meta !== "undefined" && {
		"BASE_URL": "/",
		"DEV": false,
		"MODE": "production",
		"PROD": true,
		"SSR": true,
		"TSS_DEV_SERVER": "false",
		"TSS_DEV_SSR_STYLES_BASEPATH": "/",
		"TSS_DEV_SSR_STYLES_ENABLED": "true",
		"TSS_DISABLE_CSRF_MIDDLEWARE_WARNING": "false",
		"TSS_INLINE_CSS_ENABLED": "false",
		"TSS_ROUTER_BASEPATH": "",
		"TSS_SERVER_FN_BASE": "/_serverFn/",
		"VITE_APP_URL": "https://dailyresume.in",
		"VITE_GOOGLE_CLIENT_ID": "70892772960-17otv0i9tmdqriq1dcpa661kv702f1et.apps.googleusercontent.com",
		"VITE_GOOGLE_REDIRECT_URI": "https://dailyresume.in/google-callback.html",
		"VITE_SUPABASE_PUBLISHABLE_KEY": "sb_publishable_9eJEWClpgmCfg89L9AUvcQ_PWpoz3QZ",
		"VITE_SUPABASE_URL": "https://dcstqqyyhnnqxgduvaqv.supabase.co"
	}[name]) return String({
		"BASE_URL": "/",
		"DEV": false,
		"MODE": "production",
		"PROD": true,
		"SSR": true,
		"TSS_DEV_SERVER": "false",
		"TSS_DEV_SSR_STYLES_BASEPATH": "/",
		"TSS_DEV_SSR_STYLES_ENABLED": "true",
		"TSS_DISABLE_CSRF_MIDDLEWARE_WARNING": "false",
		"TSS_INLINE_CSS_ENABLED": "false",
		"TSS_ROUTER_BASEPATH": "",
		"TSS_SERVER_FN_BASE": "/_serverFn/",
		"VITE_APP_URL": "https://dailyresume.in",
		"VITE_GOOGLE_CLIENT_ID": "70892772960-17otv0i9tmdqriq1dcpa661kv702f1et.apps.googleusercontent.com",
		"VITE_GOOGLE_REDIRECT_URI": "https://dailyresume.in/google-callback.html",
		"VITE_SUPABASE_PUBLISHABLE_KEY": "sb_publishable_9eJEWClpgmCfg89L9AUvcQ_PWpoz3QZ",
		"VITE_SUPABASE_URL": "https://dcstqqyyhnnqxgduvaqv.supabase.co"
	}[name]);
	if (typeof process !== "undefined" && process.env?.[name]) return String(process.env[name]);
	return "";
}
function getSupabaseUrl() {
	return getEnv("VITE_SUPABASE_URL") || getEnv("NEXT_PUBLIC_SUPABASE_URL") || getEnv("SUPABASE_URL");
}
function getSupabasePublishableKey() {
	return getEnv("VITE_SUPABASE_PUBLISHABLE_KEY") || getEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY") || getEnv("SUPABASE_ANON_KEY") || getEnv("SUPABASE_PUBLISHABLE_KEY");
}
/**
* Supabase clients — publishable (browser, no table access after lockdown)
* and service role (server-only, required for all DB/storage I/O).
*/
var serverClient = null;
function isSupabaseConfigured() {
	return Boolean(getSupabaseUrl() && getSupabasePublishableKey());
}
function getSupabaseServiceRoleKey() {
	return getEnv("SUPABASE_SERVICE_ROLE_KEY");
}
/**
* Server-only client. Requires SUPABASE_SERVICE_ROLE_KEY — no anon fallback.
*/
function getSupabaseServer() {
	if (typeof window !== "undefined") throw new Error("getSupabaseServer() must not run in the browser.");
	if (serverClient) return serverClient;
	const url = getSupabaseUrl() || getEnv("SUPABASE_URL");
	const serviceKey = getSupabaseServiceRoleKey();
	if (!url || !serviceKey) throw new Error("Server Supabase is not configured. Set SUPABASE_URL/VITE_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.");
	serverClient = createClient(url, serviceKey, { auth: {
		persistSession: false,
		autoRefreshToken: false
	} });
	return serverClient;
}
function formatSupabaseError(err, context) {
	if (err && typeof err === "object") {
		const e = err;
		const msg = [
			context,
			e.message || e.error,
			e.hint
		].filter(Boolean).join(" — ");
		if (msg) return new Error(msg);
	}
	return /* @__PURE__ */ new Error(`${context}: ${String(err)}`);
}
/**
* Users data access — Supabase-backed with in-memory fallback.
*
* Free trial is permanent per Google account (google_user_id):
* - Created once on first signup (server clocks only)
* - Never reset on re-login
* - Never taken from the client session
*/
var users_exports = /* @__PURE__ */ __exportAll({
	TRIAL_DAYS: () => 3,
	buildNewTrialFields: () => buildNewTrialFields,
	checkSubscriptionStatus: () => checkSubscriptionStatus,
	checkTrialStatus: () => checkTrialStatus,
	createUser: () => createUser,
	findUserByGoogleId: () => findUserByGoogleId,
	findUserById: () => findUserById,
	reconcileUserAccess: () => reconcileUserAccess,
	updateUser: () => updateUser,
	updateUserProfile: () => updateUserProfile
});
/** Fields clients must never be able to invent or extend. */
var BILLING_FIELDS = [
	"trial_started_at",
	"trial_expire_at",
	"trial_used",
	"subscription_status",
	"subscription_plan",
	"subscription_started_at",
	"subscription_expire_at",
	"account_status",
	"google_user_id",
	"created_at",
	"id"
];
var users = /* @__PURE__ */ new Map();
function rowToUser(row) {
	return {
		id: String(row.id),
		google_user_id: String(row.google_user_id),
		email: String(row.email),
		name: String(row.name ?? ""),
		profile_image: String(row.profile_image ?? ""),
		created_at: String(row.created_at),
		trial_started_at: String(row.trial_started_at),
		trial_expire_at: String(row.trial_expire_at),
		trial_used: Boolean(row.trial_used),
		subscription_status: row.subscription_status,
		subscription_plan: row.subscription_plan ?? null,
		subscription_started_at: row.subscription_started_at ? String(row.subscription_started_at) : null,
		subscription_expire_at: row.subscription_expire_at ? String(row.subscription_expire_at) : null,
		account_status: row.account_status
	};
}
/** Server-only trial clock for a brand-new Google account. */
function buildNewTrialFields(now = /* @__PURE__ */ new Date()) {
	const trialExpire = new Date(now.getTime() + 4320 * 60 * 1e3);
	return {
		created_at: now.toISOString(),
		trial_started_at: now.toISOString(),
		trial_expire_at: trialExpire.toISOString(),
		trial_used: true,
		subscription_status: "trial",
		subscription_plan: "free_trial",
		subscription_started_at: null,
		subscription_expire_at: null,
		account_status: "active"
	};
}
async function findUserByGoogleId(googleId) {
	getClient();
	if (isSupabaseConfigured()) try {
		const { data, error } = await getSupabaseServer().from("users").select("*").eq("google_user_id", googleId).maybeSingle();
		if (error) throw error;
		if (data) {
			const user = rowToUser(data);
			users.set(user.id, user);
			return user;
		}
		return null;
	} catch (err) {
		console.error("findUserByGoogleId (supabase):", err);
	}
	for (const u of users.values()) if (u.google_user_id === googleId) return u;
	if (typeof window !== "undefined") try {
		const raw = window.localStorage.getItem("dailyresume.session");
		if (raw) {
			const u = JSON.parse(raw);
			if (u.google_user_id === googleId) {
				users.set(u.id, u);
				return u;
			}
		}
	} catch {}
	return null;
}
async function findUserById(id) {
	if (isSupabaseConfigured()) try {
		const { data, error } = await getSupabaseServer().from("users").select("*").eq("id", id).maybeSingle();
		if (error) throw error;
		if (data) {
			const user = rowToUser(data);
			users.set(user.id, user);
			return user;
		}
	} catch (err) {
		console.error("findUserById (supabase):", err);
	}
	return users.get(id) ?? null;
}
async function createUser(input) {
	getClient();
	const existing = await findUserByGoogleId(input.google_user_id);
	if (existing) return await updateUserProfile(existing.id, {
		email: input.email,
		name: input.name,
		profile_image: input.profile_image
	}) ?? existing;
	const trial = buildNewTrialFields();
	const payload = {
		google_user_id: input.google_user_id,
		email: input.email,
		name: input.name,
		profile_image: input.profile_image,
		...trial
	};
	if (isSupabaseConfigured()) try {
		const { data, error } = await getSupabaseServer().from("users").insert(payload).select("*").single();
		if (error) {
			const again = await findUserByGoogleId(input.google_user_id);
			if (again) return again;
			throw error;
		}
		const user = rowToUser(data);
		users.set(user.id, user);
		await getSupabaseServer().from("user_automation").upsert({ user_id: user.id }, { onConflict: "user_id" });
		return user;
	} catch (err) {
		console.error("createUser (supabase):", err);
		throw err;
	}
	const user = {
		id: crypto.randomUUID(),
		...payload
	};
	users.set(user.id, user);
	return user;
}
/** Profile-only updates (safe for login/session refresh). */
async function updateUserProfile(id, patch) {
	return updateUser(id, patch, { allowBillingFields: false });
}
/**
* Internal update. Billing/trial fields require allowBillingFields (server-only callers).
*/
async function updateUser(id, patch, options = {}) {
	const safePatch = { ...patch };
	delete safePatch.id;
	if (!options.allowBillingFields) for (const key of BILLING_FIELDS) delete safePatch[key];
	if (Object.keys(safePatch).length === 0) return findUserById(id);
	if (isSupabaseConfigured()) try {
		const { data, error } = await getSupabaseServer().from("users").update(safePatch).eq("id", id).select("*").maybeSingle();
		if (error) throw error;
		if (data) {
			const user = rowToUser(data);
			users.set(user.id, user);
			return user;
		}
	} catch (err) {
		console.error("updateUser (supabase):", err);
	}
	const current = users.get(id);
	if (!current) return null;
	const next = {
		...current,
		...safePatch
	};
	users.set(id, next);
	return next;
}
/**
* Persist expired status when clocks say so (DB timestamps only).
* Does not extend or reset trial_expire_at.
*/
async function reconcileUserAccess(user) {
	if (user.account_status !== "active") return user;
	if (user.subscription_status === "active") {
		if ((user.subscription_expire_at ? new Date(user.subscription_expire_at).getTime() : Number.POSITIVE_INFINITY) >= Date.now()) return user;
		return await updateUser(user.id, { subscription_status: "expired" }, { allowBillingFields: true }) ?? {
			...user,
			subscription_status: "expired"
		};
	}
	if (user.subscription_status === "cancelled") return user;
	if (new Date(user.trial_expire_at).getTime() - Date.now() > 0) {
		if (user.subscription_status !== "trial") return await updateUser(user.id, {
			subscription_status: "trial",
			subscription_plan: "free_trial"
		}, { allowBillingFields: true }) ?? {
			...user,
			subscription_status: "trial",
			subscription_plan: "free_trial"
		};
		return user;
	}
	if (user.subscription_status !== "expired") return await updateUser(user.id, { subscription_status: "expired" }, { allowBillingFields: true }) ?? {
		...user,
		subscription_status: "expired"
	};
	return user;
}
/**
* Trial is active while within trial_expire_at.
* Dates are the anti-fraud clock (immutable after signup).
*/
function checkTrialStatus(user) {
	const expire = new Date(user.trial_expire_at).getTime();
	const now = Date.now();
	const msLeft = expire - now;
	const days = Math.max(0, Math.ceil(msLeft / (1440 * 60 * 1e3)));
	const withinWindow = msLeft > 0;
	const paidActive = user.subscription_status === "active" && (!user.subscription_expire_at || new Date(user.subscription_expire_at).getTime() > now);
	const cancelled = user.subscription_status === "cancelled";
	return {
		active: withinWindow && !paidActive && !cancelled && user.account_status === "active",
		daysRemaining: withinWindow ? days : 0
	};
}
function checkSubscriptionStatus(user) {
	if (user.account_status !== "active") return "expired";
	if ((user.subscription_expire_at ? new Date(user.subscription_expire_at).getTime() : 0) > Date.now()) {
		if (user.subscription_status === "cancelled") return "cancelled";
		return "active";
	}
	if (user.subscription_status === "cancelled") return "cancelled";
	if (new Date(user.trial_expire_at).getTime() > Date.now() && user.subscription_status !== "active") return "trial";
	return "expired";
}
//#endregion
export { findUserById as a, isSupabaseConfigured as c, users_Cu_iz6if_exports as d, findUserByGoogleId as i, reconcileUserAccess as l, checkTrialStatus as n, formatSupabaseError as o, createUser as r, getSupabaseServer as s, checkSubscriptionStatus as t, updateUser as u };
