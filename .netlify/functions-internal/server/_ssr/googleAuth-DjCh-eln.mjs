import { i as __toESM } from "../_runtime.mjs";
import { c as createServerFn, i as TSS_SERVER_FUNCTION } from "./createServerFn-CIHAFgYl.mjs";
import { t as getServerFnById } from "../__23tanstack-start-server-fn-resolver-Meuhc6Vl.mjs";
import { n as require_react } from "../_libs/@radix-ui/react-compose-refs+[...].mjs";
import { i as require_jsx_runtime, r as Slot } from "../_libs/@radix-ui/react-label+[...].mjs";
import { n as clsx, t as cva } from "../_libs/class-variance-authority+clsx.mjs";
import { t as twMerge } from "../_libs/tailwind-merge.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/googleAuth-DjCh-eln.js
var import_react = /* @__PURE__ */ __toESM(require_react());
var import_jsx_runtime = require_jsx_runtime();
function cn(...inputs) {
	return twMerge(clsx(inputs));
}
var buttonVariants = cva("inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium cursor-pointer transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 disabled:cursor-not-allowed [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0", {
	variants: {
		variant: {
			default: "bg-primary text-primary-foreground shadow hover:bg-primary/90",
			destructive: "bg-destructive text-destructive-foreground shadow-sm hover:bg-destructive/90",
			outline: "border border-input bg-background shadow-sm hover:bg-accent hover:text-accent-foreground",
			secondary: "bg-secondary text-secondary-foreground shadow-sm hover:bg-secondary/80",
			ghost: "hover:bg-accent hover:text-accent-foreground",
			link: "text-primary underline-offset-4 hover:underline"
		},
		size: {
			default: "h-9 px-4 py-2",
			sm: "h-8 rounded-md px-3 text-xs",
			lg: "h-10 rounded-md px-8",
			icon: "h-9 w-9"
		}
	},
	defaultVariants: {
		variant: "default",
		size: "default"
	}
});
var Button = import_react.forwardRef(({ className, variant, size, asChild = false, ...props }, ref) => {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(asChild ? Slot : "button", {
		className: cn(buttonVariants({
			variant,
			size,
			className
		})),
		ref,
		...props
	});
});
Button.displayName = "Button";
var Card = import_react.forwardRef(({ className, ...props }, ref) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
	ref,
	className: cn("rounded-xl border bg-card text-card-foreground shadow", className),
	...props
}));
Card.displayName = "Card";
var CardHeader = import_react.forwardRef(({ className, ...props }, ref) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
	ref,
	className: cn("flex flex-col space-y-1.5 p-6", className),
	...props
}));
CardHeader.displayName = "CardHeader";
var CardTitle = import_react.forwardRef(({ className, ...props }, ref) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
	ref,
	className: cn("font-semibold leading-none tracking-tight", className),
	...props
}));
CardTitle.displayName = "CardTitle";
var CardDescription = import_react.forwardRef(({ className, ...props }, ref) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
	ref,
	className: cn("text-sm text-muted-foreground", className),
	...props
}));
CardDescription.displayName = "CardDescription";
var CardContent = import_react.forwardRef(({ className, ...props }, ref) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
	ref,
	className: cn("p-6 pt-0", className),
	...props
}));
CardContent.displayName = "CardContent";
var CardFooter = import_react.forwardRef(({ className, ...props }, ref) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
	ref,
	className: cn("flex items-center p-6 pt-0", className),
	...props
}));
CardFooter.displayName = "CardFooter";
var createSsrRpc = (functionId) => {
	const url = "/_serverFn/" + functionId;
	const serverFnMeta = { id: functionId };
	const fn = async (...args) => {
		return (await getServerFnById(functionId, { origin: "server" }))(...args);
	};
	return Object.assign(fn, {
		url,
		serverFnMeta,
		[TSS_SERVER_FUNCTION]: true
	});
};
/**
* Auth server functions — exchange verified Google ID token for an app session.
*/
var loginWithGoogle = createServerFn({ method: "POST" }).inputValidator((data) => data).handler(createSsrRpc("34f6f3a256bdeb57b05dc60a2605f5ab81255c1a92c7c1b6ee1fd6b651512dfc"));
createServerFn({ method: "GET" }).inputValidator((data) => data).handler(createSsrRpc("cef481fa90c8a1e93a93edc7d3eed88bf62382cbb5ab3507ad9532d72a2c9203"));
var STORAGE_KEY = "dailyresume.session";
var SESSION_TOKEN_KEY = "dailyresume.session_token";
var AUTH_CHANGE_EVENT = "dailyresume:auth-change";
var OAUTH_RESULT_KEY = "dailyresume.google_oauth_result";
var OAUTH_RETURN_KEY = "dailyresume.oauth_return";
/** Shared across Strict Mode remounts so we don't clear the token twice. */
var completeInFlight = null;
function notifyAuthChange() {
	if (typeof window === "undefined") return;
	window.dispatchEvent(new Event(AUTH_CHANGE_EVENT));
}
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
	}[name]) return {
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
	}[name];
	if (typeof process !== "undefined" && process.env?.[name]) return process.env[name];
	return "";
}
function getClientId() {
	return getEnv("REACT_APP_GOOGLE_CLIENT_ID") || getEnv("NEXT_PUBLIC_GOOGLE_CLIENT_ID") || getEnv("VITE_GOOGLE_CLIENT_ID");
}
/**
* Must match an Authorized redirect URI in Google Cloud Console EXACTLY.
* Production: https://dailyresume.in/google-callback.html
*/
function getRedirectUri() {
	const fromEnv = getEnv("VITE_GOOGLE_REDIRECT_URI") || getEnv("REACT_APP_GOOGLE_REDIRECT_URI") || getEnv("NEXT_PUBLIC_GOOGLE_REDIRECT_URI");
	if (fromEnv) return fromEnv.trim();
	const appUrl = (getEnv("VITE_APP_URL") || getEnv("REACT_APP_URL") || "").replace(/\/$/, "");
	if (appUrl) return `${appUrl}/google-callback.html`;
	if (typeof window !== "undefined" && window.location?.origin) return `${window.location.origin}/google-callback.html`;
	return "https://dailyresume.in/google-callback.html";
}
function buildAuthUrl(clientId, redirectUri, nonce) {
	return `https://accounts.google.com/o/oauth2/v2/auth?${new URLSearchParams({
		client_id: clientId,
		response_type: "id_token",
		scope: "openid email profile",
		redirect_uri: redirectUri,
		nonce,
		prompt: "select_account"
	}).toString()}`;
}
function readStoredOAuthResult() {
	try {
		const raw = window.localStorage.getItem(OAUTH_RESULT_KEY);
		if (!raw) return null;
		return JSON.parse(raw);
	} catch {
		return null;
	}
}
function clearStoredOAuthResult() {
	try {
		window.localStorage.removeItem(OAUTH_RESULT_KEY);
	} catch {}
}
/**
* Finish sign-in after Google redirects back to /login?oauth=1.
* Server verifies the Google ID token and mints an app session.
*/
async function completeGoogleLogin() {
	if (typeof window === "undefined") throw new Error("Google sign-in only works in the browser.");
	const existingSession = getCurrentUser();
	if (existingSession && getSessionToken()) return existingSession;
	if (completeInFlight) return completeInFlight;
	completeInFlight = (async () => {
		const pending = readStoredOAuthResult();
		if (pending?.error) {
			clearStoredOAuthResult();
			throw new Error(pending.error_description || pending.error || "Google sign-in was cancelled.");
		}
		if (!pending?.id_token) throw new Error("Google sign-in did not return a token. Try again (allow site data / localStorage).");
		try {
			const result = await loginWithGoogle({ data: { idToken: pending.id_token } });
			persistSession(result.user);
			persistSessionToken(result.sessionToken);
			clearStoredOAuthResult();
			return result.user;
		} catch (err) {
			throw err;
		}
	})();
	try {
		return await completeInFlight;
	} finally {
		window.setTimeout(() => {
			completeInFlight = null;
		}, 100);
	}
}
async function startGoogleLogin() {
	if (typeof window === "undefined") throw new Error("Google sign-in only works in the browser.");
	const clientId = getClientId();
	const redirectUri = getRedirectUri();
	if (!clientId) throw new Error("Google client ID is not configured.");
	if (!redirectUri) throw new Error("Google redirect URI is not configured.");
	const authUrl = buildAuthUrl(clientId, redirectUri, Math.random().toString(36).substring(2));
	try {
		sessionStorage.setItem(OAUTH_RETURN_KEY, "/login?oauth=1");
	} catch {}
	window.location.assign(authUrl);
	return new Promise(() => {});
}
async function logoutUser() {
	if (typeof window !== "undefined") {
		window.localStorage.removeItem(STORAGE_KEY);
		window.localStorage.removeItem(SESSION_TOKEN_KEY);
		notifyAuthChange();
	}
}
function getCurrentUser() {
	if (typeof window === "undefined") return null;
	try {
		const raw = window.localStorage.getItem(STORAGE_KEY);
		return raw ? JSON.parse(raw) : null;
	} catch {
		return null;
	}
}
function getSessionToken() {
	if (typeof window === "undefined") return null;
	try {
		return window.localStorage.getItem(SESSION_TOKEN_KEY);
	} catch {
		return null;
	}
}
function persistSession(user) {
	if (typeof window === "undefined") return;
	window.localStorage.setItem(STORAGE_KEY, JSON.stringify(user));
	notifyAuthChange();
}
function persistSessionToken(token) {
	if (typeof window === "undefined") return;
	window.localStorage.setItem(SESSION_TOKEN_KEY, token);
}
function updateSessionUser(user) {
	persistSession(user);
}
/** Helper for dashboard RPC calls — throws if missing. */
function requireClientSessionToken() {
	const token = getSessionToken();
	if (!token) throw new Error("Not signed in. Please sign in with Google again.");
	return token;
}
//#endregion
export { completeGoogleLogin as a, getSessionToken as c, startGoogleLogin as d, updateSessionUser as f, cn as i, logoutUser as l, Button as n, createSsrRpc as o, Card as r, getCurrentUser as s, AUTH_CHANGE_EVENT as t, requireClientSessionToken as u };
