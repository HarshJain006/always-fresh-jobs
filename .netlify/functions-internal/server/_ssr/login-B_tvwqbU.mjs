import { i as __toESM } from "../_runtime.mjs";
import { g as useNavigate, h as Link } from "../_libs/@tanstack/react-router+[...].mjs";
import { n as require_react } from "../_libs/@radix-ui/react-compose-refs+[...].mjs";
import { i as require_jsx_runtime } from "../_libs/@radix-ui/react-label+[...].mjs";
import { a as completeGoogleLogin, c as getSessionToken, d as startGoogleLogin, n as Button, r as Card, s as getCurrentUser } from "./googleAuth-DjCh-eln.mjs";
import { n as toast } from "../_libs/sonner.mjs";
import { t as Toaster$1 } from "./sonner-DoFKumIW.mjs";
import { t as Zap } from "../_libs/lucide-react.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/login-B_tvwqbU.js
var import_react = /* @__PURE__ */ __toESM(require_react());
var import_jsx_runtime = require_jsx_runtime();
function LoginPage() {
	const navigate = useNavigate();
	const [loading, setLoading] = (0, import_react.useState)(false);
	(0, import_react.useEffect)(() => {
		if (new URLSearchParams(window.location.search).get("oauth") !== "1") return;
		setLoading(true);
		if (getCurrentUser() && getSessionToken()) {
			window.history.replaceState({}, "", "/login");
			navigate({ to: "/dashboard" });
			return;
		}
		(async () => {
			try {
				await completeGoogleLogin();
				toast.success("Welcome to DailyResume!");
				window.history.replaceState({}, "", "/login");
				navigate({ to: "/dashboard" });
			} catch (e) {
				console.error("OAuth complete failed:", e);
				const msg = e instanceof Error ? e.message : "Sign-in failed. Try again.";
				toast.error(msg);
				setLoading(false);
				window.history.replaceState({}, "", "/login");
			}
		})();
	}, [navigate]);
	async function handleGoogle() {
		setLoading(true);
		try {
			await startGoogleLogin();
		} catch (e) {
			const msg = e instanceof Error ? e.message : "Sign-in failed. Try again.";
			toast.error(msg);
			setLoading(false);
		}
	}
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "hero-bg min-h-screen",
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Toaster$1, {}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "mx-auto flex min-h-screen max-w-md flex-col items-center justify-center px-4 py-12",
			children: [
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Link, {
					to: "/",
					className: "mb-8 flex items-center gap-2 font-semibold",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
						className: "grid h-8 w-8 place-items-center rounded-lg bg-gradient-primary text-primary-foreground shadow-glow",
						children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Zap, { className: "h-4 w-4" })
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
						className: "text-lg tracking-tight",
						children: "DailyResume"
					})]
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Card, {
					className: "w-full border-border/60 bg-surface p-8 shadow-elegant",
					children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h1", {
							className: "text-3xl",
							children: "Welcome back"
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
							className: "mt-2 text-sm text-muted-foreground",
							children: "Sign in with Google to continue. New here? We'll start your 3-day free trial automatically."
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Button, {
							onClick: handleGoogle,
							disabled: loading,
							variant: "outline",
							className: "mt-8 h-12 w-full text-base",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(GoogleIcon, { className: "mr-3 h-5 w-5" }), loading ? "Signing you in…" : "Continue with Google"]
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
							className: "mt-6 text-center text-xs text-muted-foreground",
							children: "By continuing you agree to our Terms and Privacy Policy."
						})
					]
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Link, {
					to: "/",
					className: "mt-6 text-sm text-muted-foreground hover:text-foreground",
					children: "← Back to homepage"
				})
			]
		})]
	});
}
function GoogleIcon(props) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("svg", {
		viewBox: "0 0 24 24",
		...props,
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("path", {
				fill: "#4285F4",
				d: "M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.27-4.74 3.27-8.1Z"
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("path", {
				fill: "#34A853",
				d: "M12 23c2.97 0 5.46-.98 7.28-2.65l-3.57-2.77c-.99.66-2.25 1.06-3.71 1.06-2.86 0-5.28-1.93-6.15-4.53H2.18v2.84A11 11 0 0 0 12 23Z"
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("path", {
				fill: "#FBBC05",
				d: "M5.85 14.11a6.6 6.6 0 0 1 0-4.22V7.05H2.18a11 11 0 0 0 0 9.9l3.67-2.84Z"
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("path", {
				fill: "#EA4335",
				d: "M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1A11 11 0 0 0 2.18 7.05l3.67 2.84C6.72 7.3 9.14 5.38 12 5.38Z"
			})
		]
	});
}
//#endregion
export { LoginPage as component };
