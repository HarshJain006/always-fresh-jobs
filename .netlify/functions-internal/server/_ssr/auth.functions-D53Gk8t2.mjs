import { c as createServerFn } from "./createServerFn-CIHAFgYl.mjs";
import { n as loginWithGoogleIdToken, r as requireSessionUser, t as createServerRpc } from "./serverAuth-QOE1yHEF.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/auth.functions-D53Gk8t2.js
/**
* Auth server functions — exchange verified Google ID token for an app session.
*/
var loginWithGoogle_createServerFn_handler = createServerRpc({
	id: "34f6f3a256bdeb57b05dc60a2605f5ab81255c1a92c7c1b6ee1fd6b651512dfc",
	name: "loginWithGoogle",
	filename: "src/routes/auth.functions.ts"
}, (opts) => loginWithGoogle.__executeServer(opts));
var loginWithGoogle = createServerFn({ method: "POST" }).inputValidator((data) => data).handler(loginWithGoogle_createServerFn_handler, async ({ data }) => {
	const result = await loginWithGoogleIdToken(data.idToken);
	return {
		user: result.user,
		sessionToken: result.sessionToken
	};
});
var refreshSessionUser_createServerFn_handler = createServerRpc({
	id: "cef481fa90c8a1e93a93edc7d3eed88bf62382cbb5ab3507ad9532d72a2c9203",
	name: "refreshSessionUser",
	filename: "src/routes/auth.functions.ts"
}, (opts) => refreshSessionUser.__executeServer(opts));
var refreshSessionUser = createServerFn({ method: "GET" }).inputValidator((data) => data).handler(refreshSessionUser_createServerFn_handler, async ({ data }) => {
	return { user: await requireSessionUser(data.sessionToken) };
});
//#endregion
export { loginWithGoogle_createServerFn_handler, refreshSessionUser_createServerFn_handler };
