import { c as createServerFn } from "./createServerFn-CIHAFgYl.mjs";
import { u as updateUser } from "./users-Cu_iz6if.mjs";
import { r as requireSessionUser, t as createServerRpc } from "./serverAuth-QOE1yHEF.mjs";
import { a as getPlan, i as getAuthoritativeAccess, n as addMonths } from "./accessControl-BFm4N4Mn.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/payment.functions-C7E6o2bs.js
/**
* Razorpay integration (placeholder) + subscription activation.
*
* After a verified payment, call activateSubscription(userId, planId).
* Expiry is stored on the user row and enforced server-side.
*/
/**
* Mark premium after a verified payment.
* Extends from now (or from current expire_at if still active — stack renewals).
*/
async function activateSubscription(userId, planId) {
	const plan = getPlan(planId);
	if (!plan) throw new Error("Unknown subscription plan.");
	const { findUserById } = await import("./users-Cu_iz6if.mjs").then((n) => n.d).then((n) => n.c);
	const existing = await findUserById(userId);
	if (!existing) throw new Error("Could not activate subscription — user not found.");
	const now = /* @__PURE__ */ new Date();
	const currentExp = existing.subscription_expire_at ? new Date(existing.subscription_expire_at) : null;
	const expire = addMonths(existing.subscription_status === "active" && currentExp && currentExp.getTime() > now.getTime() ? currentExp : now, plan.months);
	if (!await updateUser(userId, {
		subscription_status: "active",
		subscription_plan: plan.id,
		subscription_started_at: existing.subscription_status === "active" && existing.subscription_started_at ? existing.subscription_started_at : now.toISOString(),
		subscription_expire_at: expire.toISOString()
	}, { allowBillingFields: true })) throw new Error("Could not activate subscription — user not found.");
}
/**
* Server functions for paid plans.
* activatePaidPlan should only be called after a verified payment in production.
*/
var PAID_IDS = /* @__PURE__ */ new Set([
	"premium_1m",
	"premium_3m",
	"premium_6m"
]);
var activatePaidPlan_createServerFn_handler = createServerRpc({
	id: "25043cb6f9c86b28ece294c0a021bb120a6e3ed9f23bca362a2ec80a45547dfb",
	name: "activatePaidPlan",
	filename: "src/routes/payment.functions.ts"
}, (opts) => activatePaidPlan.__executeServer(opts));
var activatePaidPlan = createServerFn({ method: "POST" }).inputValidator((data) => data).handler(activatePaidPlan_createServerFn_handler, async ({ data }) => {
	if (!PAID_IDS.has(data.planId)) throw new Error("Invalid plan selected.");
	const plan = getPlan(data.planId);
	if (!plan) throw new Error("Unknown plan.");
	const user = await requireSessionUser(data.sessionToken);
	if (Boolean(process.env.RAZORPAY_KEY_ID && process.env.RAZORPAY_KEY_SECRET)) throw new Error("Complete payment checkout first, then confirm your plan.");
	await activateSubscription(user.id, data.planId);
	const access = await getAuthoritativeAccess(user.id);
	return {
		ok: true,
		user: access.user,
		plan: plan.id,
		planName: plan.name,
		expireAt: access.subscriptionExpireAt,
		daysRemaining: access.daysRemaining,
		message: `${plan.name} plan is active until your renewal date.`
	};
});
//#endregion
export { activatePaidPlan_createServerFn_handler };
