import { i as __toESM } from "../_runtime.mjs";
import { g as useNavigate, h as Link } from "../_libs/@tanstack/react-router+[...].mjs";
import { c as createServerFn } from "./createServerFn-CIHAFgYl.mjs";
import { n as require_react } from "../_libs/@radix-ui/react-compose-refs+[...].mjs";
import { i as require_jsx_runtime } from "../_libs/@radix-ui/react-label+[...].mjs";
import { f as updateSessionUser, n as Button, o as createSsrRpc, r as Card, s as getCurrentUser, u as requireClientSessionToken } from "./googleAuth-DjCh-eln.mjs";
import { n as toast } from "../_libs/sonner.mjs";
import { t as Toaster$1 } from "./sonner-DoFKumIW.mjs";
import { S as CircleCheck, t as Zap, v as Crown } from "../_libs/lucide-react.mjs";
import { l as subscriptionSummary, t as PAID_PLANS } from "./accessControl-BFm4N4Mn.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/pricing-DdrdBc52.js
var import_react = /* @__PURE__ */ __toESM(require_react());
var import_jsx_runtime = require_jsx_runtime();
function Footer() {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("footer", {
		className: "border-t border-border/60 bg-surface-muted/40",
		children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "mx-auto max-w-6xl px-4 py-12 sm:px-6",
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "flex flex-col items-start justify-between gap-8 md:flex-row md:items-center",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "flex items-center gap-2 font-semibold",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
						className: "grid h-8 w-8 place-items-center rounded-lg bg-gradient-primary text-primary-foreground",
						children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Zap, { className: "h-4 w-4" })
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
						className: "text-lg tracking-tight",
						children: "DailyResume"
					})]
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "mt-3 max-w-sm text-sm text-muted-foreground",
					children: "Automated resume refresh for job seekers. Stay active, get noticed by recruiters — every single day."
				})] }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "grid grid-cols-2 gap-8 text-sm sm:grid-cols-3",
					children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
							className: "mb-3 font-medium text-foreground",
							children: "Product"
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("ul", {
							className: "space-y-2 text-muted-foreground",
							children: [
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("li", { children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("a", {
									href: "/#features",
									className: "hover:text-foreground",
									children: "Features"
								}) }),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("li", { children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("a", {
									href: "/#platforms",
									className: "hover:text-foreground",
									children: "Platforms"
								}) }),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("li", { children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Link, {
									to: "/pricing",
									className: "hover:text-foreground",
									children: "Pricing"
								}) })
							]
						})] }),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
							className: "mb-3 font-medium text-foreground",
							children: "Company"
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("ul", {
							className: "space-y-2 text-muted-foreground",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("li", { children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("a", {
								href: "/#faq",
								className: "hover:text-foreground",
								children: "FAQ"
							}) }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("li", { children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("a", {
								href: "mailto:hello@dailyresume.app",
								className: "hover:text-foreground",
								children: "Contact"
							}) })]
						})] }),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
							className: "mb-3 font-medium text-foreground",
							children: "Legal"
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("ul", {
							className: "space-y-2 text-muted-foreground",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("li", { children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("a", {
								href: "#",
								className: "hover:text-foreground",
								children: "Privacy"
							}) }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("li", { children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("a", {
								href: "#",
								className: "hover:text-foreground",
								children: "Terms"
							}) })]
						})] })
					]
				})]
			}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "mt-10 border-t border-border/60 pt-6 text-xs text-muted-foreground",
				children: [
					"© ",
					(/* @__PURE__ */ new Date()).getFullYear(),
					" DailyResume. All rights reserved."
				]
			})]
		})
	});
}
/**
* Server functions for paid plans.
* activatePaidPlan should only be called after a verified payment in production.
*/
var activatePaidPlan = createServerFn({ method: "POST" }).inputValidator((data) => data).handler(createSsrRpc("25043cb6f9c86b28ece294c0a021bb120a6e3ed9f23bca362a2ec80a45547dfb"));
function Pricing() {
	const navigate = useNavigate();
	const [user, setUser] = (0, import_react.useState)(null);
	const [loadingPlan, setLoadingPlan] = (0, import_react.useState)(null);
	(0, import_react.useEffect)(() => setUser(getCurrentUser()), []);
	const summary = user ? subscriptionSummary(user) : null;
	async function handleSubscribe(planId) {
		if (!user) {
			navigate({ to: "/login" });
			return;
		}
		setLoadingPlan(planId);
		try {
			const result = await activatePaidPlan({ data: {
				sessionToken: requireClientSessionToken(),
				planId
			} });
			updateSessionUser(result.user);
			setUser(result.user);
			toast.success(result.message);
			navigate({ to: "/dashboard" });
		} catch (e) {
			toast.error(e instanceof Error ? e.message : "Could not start your plan.");
		} finally {
			setLoadingPlan(null);
		}
	}
	const hasActivePremium = summary?.kind === "premium";
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "min-h-screen bg-background",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Toaster$1, {}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("main", {
				className: "mx-auto max-w-5xl px-4 py-16 sm:px-6",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "text-center",
						children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
								className: "text-xs font-semibold uppercase tracking-widest text-primary",
								children: "Pricing"
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h1", {
								className: "mt-3 text-4xl sm:text-5xl",
								children: "Stay visible every day"
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
								className: "mx-auto mt-4 max-w-xl text-muted-foreground",
								children: "Start with a 3-day free trial. Pick a Premium plan — access ends exactly when your plan ends, with a reminder in the last 7 days."
							})
						]
					}),
					user && summary && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Card, {
						className: "mt-10 border-border/60 p-5",
						children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
								className: "text-xs font-semibold uppercase tracking-wide text-muted-foreground",
								children: "Current plan"
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
								className: "mt-1 text-lg font-semibold",
								children: summary.title
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
								className: "text-sm text-muted-foreground",
								children: summary.detail
							}),
							summary.endingSoon && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
								className: "mt-2 text-sm font-medium text-warning-foreground",
								children: [
									"Ends in ",
									summary.daysRemaining,
									" day",
									summary.daysRemaining === 1 ? "" : "s",
									" — renew to avoid interruption."
								]
							})
						]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-4",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Card, {
							className: "border-border/60 p-6",
							children: [
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
									className: "text-sm font-medium text-muted-foreground",
									children: "Free trial"
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
									className: "mt-2 flex items-baseline gap-2",
									children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
										className: "font-display text-4xl",
										children: "₹0"
									}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
										className: "text-muted-foreground",
										children: "for 3 days"
									})]
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("ul", {
									className: "mt-5 space-y-2 text-sm",
									children: [
										/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Row, { children: "Upload one resume" }),
										/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Row, { children: "Connect Naukri" }),
										/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Row, { children: "Daily automatic refresh" })
									]
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
									asChild: true,
									variant: "outline",
									className: "mt-6 w-full",
									children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Link, {
										to: user ? "/dashboard" : "/login",
										children: user ? "Go to dashboard" : "Start free trial"
									})
								})
							]
						}), PAID_PLANS.map((plan) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Card, {
							className: plan.popular ? "relative border-primary/40 bg-surface p-6 shadow-glow" : "border-border/60 p-6",
							children: [
								plan.popular && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
									className: "absolute -top-3 left-6 rounded-full bg-gradient-primary px-3 py-1 text-xs font-medium text-primary-foreground",
									children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Crown, { className: "mr-1 inline h-3 w-3" }), " Popular"]
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
									className: "text-sm font-medium text-primary",
									children: plan.name
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
									className: "mt-2 flex items-baseline gap-2",
									children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
										className: "font-display text-4xl",
										children: plan.label
									})
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
									className: "mt-1 text-xs text-muted-foreground",
									children: plan.blurb
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("ul", {
									className: "mt-5 space-y-2 text-sm",
									children: [
										/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Row, { children: "Daily resume refresh" }),
										/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Row, { children: "Full activity history" }),
										/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Row, { children: [
											"Ends after ",
											plan.months,
											" month",
											plan.months === 1 ? "" : "s"
										] }),
										/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Row, { children: "Reminder in last 7 days" })
									]
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
									onClick: () => handleSubscribe(plan.id),
									disabled: loadingPlan !== null,
									className: plan.popular ? "mt-6 w-full bg-gradient-primary shadow-glow" : "mt-6 w-full",
									variant: plan.popular ? "default" : "outline",
									children: loadingPlan === plan.id ? "Activating…" : hasActivePremium ? `Extend ${plan.name}` : `Get ${plan.name}`
								})
							]
						}, plan.id))]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "mt-10 text-center text-xs text-muted-foreground",
						children: "Access runs only for the plan duration you purchase. Renew anytime before it ends."
					})
				]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Footer, {})
		]
	});
}
function Row({ children }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("li", {
		className: "flex items-start gap-2",
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(CircleCheck, { className: "mt-0.5 h-4 w-4 shrink-0 text-success" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children })]
	});
}
//#endregion
export { Pricing as component };
