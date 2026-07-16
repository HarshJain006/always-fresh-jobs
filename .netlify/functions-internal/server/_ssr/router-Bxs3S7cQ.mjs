import { i as __toESM } from "../_runtime.mjs";
import { _ as useRouter, c as HeadContent, d as Outlet, f as lazyRouteComponent, h as Link, m as createRootRouteWithContext, p as createFileRoute, s as Scripts, u as createRouter } from "../_libs/@tanstack/react-router+[...].mjs";
import { n as require_react } from "../_libs/@radix-ui/react-compose-refs+[...].mjs";
import { i as require_jsx_runtime } from "../_libs/@radix-ui/react-label+[...].mjs";
import { i as getAuthoritativeAccess, s as listActiveAutomationUsers } from "./accessControl-BFm4N4Mn.mjs";
import { r as istDateString, t as enqueueJob } from "./jobs-_QHuSMBf.mjs";
import { t as QueryClient } from "../_libs/tanstack__query-core.mjs";
import { t as QueryClientProvider } from "../_libs/tanstack__react-query.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/router-Bxs3S7cQ.js
var import_react = /* @__PURE__ */ __toESM(require_react());
var import_jsx_runtime = require_jsx_runtime();
var styles_default = "/assets/styles-BcsIJXg8.css";
function reportLovableError(error, context = {}) {
	if (typeof window === "undefined") return;
	window.__lovableEvents?.captureException?.(error, {
		source: "react_error_boundary",
		route: window.location.pathname,
		...context
	}, {
		mechanism: "react_error_boundary",
		handled: false,
		severity: "error"
	});
}
/**
* Register the Progressive Web App service worker (browser only).
*/
function registerPwa() {
	if (typeof window === "undefined") return;
	if (!("serviceWorker" in navigator)) return;
	const register = () => {
		navigator.serviceWorker.register("/sw.js").catch((err) => {
			console.warn("PWA service worker registration failed:", err);
		});
	};
	if (document.readyState === "complete") register();
	else window.addEventListener("load", register);
}
function NotFoundComponent() {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
		className: "flex min-h-screen items-center justify-center bg-background px-4",
		children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "max-w-md text-center",
			children: [
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h1", {
					className: "text-7xl font-bold text-foreground",
					children: "404"
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", {
					className: "mt-4 text-xl font-semibold text-foreground",
					children: "Page not found"
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "mt-2 text-sm text-muted-foreground",
					children: "The page you're looking for doesn't exist or has been moved."
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
					className: "mt-6",
					children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Link, {
						to: "/",
						className: "inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90",
						children: "Go home"
					})
				})
			]
		})
	});
}
function ErrorComponent({ error, reset }) {
	console.error(error);
	const router = useRouter();
	(0, import_react.useEffect)(() => {
		reportLovableError(error, { boundary: "tanstack_root_error_component" });
	}, [error]);
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
		className: "flex min-h-screen items-center justify-center bg-background px-4",
		children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "max-w-md text-center",
			children: [
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h1", {
					className: "text-xl font-semibold tracking-tight text-foreground",
					children: "This page didn't load"
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "mt-2 text-sm text-muted-foreground",
					children: "Something went wrong on our end. You can try refreshing or head back home."
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "mt-6 flex flex-wrap justify-center gap-2",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
						onClick: () => {
							router.invalidate();
							reset();
						},
						className: "inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90",
						children: "Try again"
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("a", {
						href: "/",
						className: "inline-flex items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent",
						children: "Go home"
					})]
				})
			]
		})
	});
}
var Route$6 = createRootRouteWithContext()({
	head: () => ({
		meta: [
			{ charSet: "utf-8" },
			{
				name: "viewport",
				content: "width=device-width, initial-scale=1"
			},
			{ title: "DailyResume — Keep your resume active on every job portal, automatically" },
			{
				name: "description",
				content: "DailyResume refreshes your resume on Naukri, Indeed and LinkedIn every day so recruiters see you first. Upload once, stay on top."
			},
			{
				name: "author",
				content: "DailyResume"
			},
			{
				property: "og:title",
				content: "DailyResume — Automated daily resume refresh"
			},
			{
				property: "og:description",
				content: "Upload your resume once. We refresh it daily across Naukri, Indeed and LinkedIn so your profile stays active and visible."
			},
			{
				property: "og:type",
				content: "website"
			},
			{
				name: "twitter:card",
				content: "summary_large_image"
			},
			{
				name: "theme-color",
				content: "#0f766e"
			},
			{
				name: "mobile-web-app-capable",
				content: "yes"
			},
			{
				name: "apple-mobile-web-app-capable",
				content: "yes"
			},
			{
				name: "apple-mobile-web-app-title",
				content: "DailyResume"
			}
		],
		links: [
			{
				rel: "stylesheet",
				href: styles_default
			},
			{
				rel: "icon",
				href: "/favicon.ico",
				type: "image/x-icon"
			},
			{
				rel: "manifest",
				href: "/manifest.webmanifest"
			},
			{
				rel: "apple-touch-icon",
				href: "/pwa-icon-192.png"
			},
			{
				rel: "preconnect",
				href: "https://fonts.googleapis.com"
			},
			{
				rel: "preconnect",
				href: "https://fonts.gstatic.com",
				crossOrigin: "anonymous"
			},
			{
				rel: "stylesheet",
				href: "https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Sora:wght@500;600;700&display=swap"
			}
		]
	}),
	shellComponent: RootShell,
	component: RootComponent,
	notFoundComponent: NotFoundComponent,
	errorComponent: ErrorComponent
});
function RootShell({ children }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("html", {
		lang: "en",
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("head", { children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(HeadContent, {}) }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("body", { children: [children, /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Scripts, {})] })]
	});
}
function RootComponent() {
	const { queryClient } = Route$6.useRouteContext();
	(0, import_react.useEffect)(() => {
		registerPwa();
	}, []);
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(QueryClientProvider, {
		client: queryClient,
		children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Outlet, {})
	});
}
var BASE_URL = "";
var Route$5 = createFileRoute("/sitemap.xml")({ server: { handlers: { GET: async () => {
	const xml = [
		`<?xml version="1.0" encoding="UTF-8"?>`,
		`<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">`,
		...[
			{
				path: "/",
				changefreq: "weekly",
				priority: "1.0"
			},
			{
				path: "/pricing",
				changefreq: "monthly",
				priority: "0.8"
			},
			{
				path: "/login",
				changefreq: "yearly",
				priority: "0.5"
			}
		].map((e) => `  <url><loc>${BASE_URL}${e.path}</loc>${e.changefreq ? `<changefreq>${e.changefreq}</changefreq>` : ""}${e.priority ? `<priority>${e.priority}</priority>` : ""}</url>`),
		`</urlset>`
	].join("\n");
	return new Response(xml, { headers: {
		"Content-Type": "application/xml",
		"Cache-Control": "public, max-age=3600"
	} });
} } } });
var $$splitComponentImporter$3 = () => import("./pricing-DdrdBc52.mjs");
var Route$4 = createFileRoute("/pricing")({
	head: () => ({ meta: [{ title: "Pricing — DailyResume" }, {
		name: "description",
		content: "Plans from ₹199/month. 3 months ₹699 · 6 months ₹899. Keep your resume fresh every day."
	}] }),
	component: lazyRouteComponent($$splitComponentImporter$3, "component")
});
var $$splitComponentImporter$2 = () => import("./login-B_tvwqbU.mjs");
var Route$3 = createFileRoute("/login")({
	head: () => ({ meta: [{ title: "Sign in — DailyResume" }, {
		name: "description",
		content: "Sign in to DailyResume with Google to start your free 3-day trial."
	}] }),
	component: lazyRouteComponent($$splitComponentImporter$2, "component")
});
var $$splitComponentImporter$1 = () => import("./dashboard-BPjfTe1-.mjs");
var Route$2 = createFileRoute("/dashboard")({
	head: () => ({ meta: [{ title: "Dashboard — DailyResume" }, {
		name: "description",
		content: "Set up your daily resume refresh in three simple steps."
	}] }),
	component: lazyRouteComponent($$splitComponentImporter$1, "component")
});
var $$splitComponentImporter = () => import("./routes-DPEnfoN0.mjs");
var Route$1 = createFileRoute("/")({ component: lazyRouteComponent($$splitComponentImporter, "component") });
/** Reflects localStorage session; clears when the user logs out. */
/**
* Enqueue daily refresh jobs for all eligible users (does NOT run Selenium).
* Safe to call from Netlify cron OR Raspberry Pi at 8:00 AM IST / catch-up.
*/
async function enqueueDailyJobsForEligibleUsers(scheduledFor = istDateString()) {
	const active = await listActiveAutomationUsers();
	const result = {
		scheduledFor,
		enqueued: 0,
		skipped: 0,
		alreadyQueued: 0,
		errors: []
	};
	for (const u of active) {
		if (!u.credentials || !u.resume) {
			result.skipped++;
			continue;
		}
		if (!u.platforms.find((p) => p.id === "naukri")?.connected) {
			result.skipped++;
			continue;
		}
		try {
			if (!(await getAuthoritativeAccess(u.userId)).allowed) {
				result.skipped++;
				continue;
			}
			if ((await enqueueJob({
				userId: u.userId,
				platform: "naukri",
				jobType: "daily_refresh",
				scheduledFor
			})).alreadyQueued) result.alreadyQueued++;
			else result.enqueued++;
		} catch (err) {
			const msg = err instanceof Error ? err.message : String(err);
			result.errors.push(`${u.userId}: ${msg}`);
		}
	}
	return result;
}
/** True when current time in IST is within the 8:00–8:04 window. */
function isEightAmIstWindow(now = /* @__PURE__ */ new Date()) {
	const parts = new Intl.DateTimeFormat("en-GB", {
		timeZone: "Asia/Kolkata",
		hour: "numeric",
		minute: "numeric",
		hour12: false
	}).formatToParts(now);
	const hour = Number(parts.find((p) => p.type === "hour")?.value ?? -1);
	const minute = Number(parts.find((p) => p.type === "minute")?.value ?? -1);
	return hour === 8 && minute < 5;
}
/**
* Netlify / external cron: enqueue daily jobs into Supabase (no Selenium).
* Requires CRON_SECRET — fails closed if unset.
*/
function authorizeCron(request) {
	const secret = process.env.CRON_SECRET;
	if (!secret || secret.length < 16) return Response.json({ error: "CRON_SECRET is not configured on the server." }, { status: 503 });
	if (request.headers.get("x-cron-secret") !== secret) return Response.json({ error: "Unauthorized" }, { status: 401 });
	return null;
}
var Route = createFileRoute("/api/cron/daily-refresh")({ server: { handlers: {
	GET: async ({ request }) => {
		const denied = authorizeCron(request);
		if (denied) return denied;
		if (!(new URL(request.url).searchParams.get("force") === "1") && !isEightAmIstWindow()) return Response.json({
			skipped: true,
			reason: "Outside 8:00–8:04 AM IST window. Pass ?force=1 (with CRON_SECRET) to enqueue anyway."
		});
		const result = await enqueueDailyJobsForEligibleUsers();
		return Response.json({
			ok: true,
			queued: true,
			...result
		});
	},
	POST: async ({ request }) => {
		const denied = authorizeCron(request);
		if (denied) return denied;
		const result = await enqueueDailyJobsForEligibleUsers();
		return Response.json({
			ok: true,
			queued: true,
			...result
		});
	}
} } });
var SitemapDotxmlRoute = Route$5.update({
	id: "/sitemap.xml",
	path: "/sitemap.xml",
	getParentRoute: () => Route$6
});
var PricingRoute = Route$4.update({
	id: "/pricing",
	path: "/pricing",
	getParentRoute: () => Route$6
});
var LoginRoute = Route$3.update({
	id: "/login",
	path: "/login",
	getParentRoute: () => Route$6
});
var DashboardRoute = Route$2.update({
	id: "/dashboard",
	path: "/dashboard",
	getParentRoute: () => Route$6
});
var rootRouteChildren = {
	IndexRoute: Route$1.update({
		id: "/",
		path: "/",
		getParentRoute: () => Route$6
	}),
	DashboardRoute,
	LoginRoute,
	PricingRoute,
	SitemapDotxmlRoute,
	ApiCronDailyRefreshRoute: Route.update({
		id: "/api/cron/daily-refresh",
		path: "/api/cron/daily-refresh",
		getParentRoute: () => Route$6
	})
};
var routeTree = Route$6._addFileChildren(rootRouteChildren)._addFileTypes();
var getRouter = () => {
	return createRouter({
		routeTree,
		context: { queryClient: new QueryClient() },
		scrollRestoration: true,
		defaultPreloadStaleTime: 0
	});
};
//#endregion
export { getRouter };
