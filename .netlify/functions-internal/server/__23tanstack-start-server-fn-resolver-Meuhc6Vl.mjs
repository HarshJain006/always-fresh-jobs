//#region node_modules/.nitro/vite/services/ssr/assets/__23tanstack-start-server-fn-resolver-Meuhc6Vl.js
var manifest = {
	"080acf463ffa6a4d4d17049f6d7a71fe0ec29fd3e3f2bad1a341aa1d626adf58": {
		functionName: "uploadUserResume_createServerFn_handler",
		importer: () => import("./_ssr/dashboard.functions-BxJme2TQ.mjs")
	},
	"25043cb6f9c86b28ece294c0a021bb120a6e3ed9f23bca362a2ec80a45547dfb": {
		functionName: "activatePaidPlan_createServerFn_handler",
		importer: () => import("./_ssr/payment.functions-C7E6o2bs.mjs")
	},
	"30c448d84a6a23fb31d80146a350741b2985a366c7b366577c61e9ee92ec2f11": {
		functionName: "setAutomationState_createServerFn_handler",
		importer: () => import("./_ssr/dashboard.functions-BxJme2TQ.mjs")
	},
	"34f6f3a256bdeb57b05dc60a2605f5ab81255c1a92c7c1b6ee1fd6b651512dfc": {
		functionName: "loginWithGoogle_createServerFn_handler",
		importer: () => import("./_ssr/auth.functions-D53Gk8t2.mjs")
	},
	"70d04256afdf57a746e849f7c041c2ce545a2f085472967b6bb15603a61f1733": {
		functionName: "runNaukriNow_createServerFn_handler",
		importer: () => import("./_ssr/dashboard.functions-BxJme2TQ.mjs")
	},
	"82da0c43b9cd6a14c5fcf16cb45804e1739f9ac1473665665b192c84a42ceaca": {
		functionName: "getDashboardState_createServerFn_handler",
		importer: () => import("./_ssr/dashboard.functions-BxJme2TQ.mjs")
	},
	"85c351912fbfb488363bd720b81de21ad1a2852fc09d2a3352b391455d8c6a36": {
		functionName: "setPlatformConnected_createServerFn_handler",
		importer: () => import("./_ssr/dashboard.functions-BxJme2TQ.mjs")
	},
	"9fe87723b8624a0f41a786dc5f73536bdf64d15470bba1adf425740c2c9da03e": {
		functionName: "deleteUserResume_createServerFn_handler",
		importer: () => import("./_ssr/dashboard.functions-BxJme2TQ.mjs")
	},
	"bb9fbfdcccf0bd22498ecee068733acc90e91d1248dd09c65712cdaa2e6d1e69": {
		functionName: "saveNaukriCredentials_createServerFn_handler",
		importer: () => import("./_ssr/dashboard.functions-BxJme2TQ.mjs")
	},
	"cef481fa90c8a1e93a93edc7d3eed88bf62382cbb5ab3507ad9532d72a2c9203": {
		functionName: "refreshSessionUser_createServerFn_handler",
		importer: () => import("./_ssr/auth.functions-D53Gk8t2.mjs")
	}
};
async function getServerFnById(id, access) {
	const serverFnInfo = manifest[id];
	if (!serverFnInfo) throw new Error("Server function info not found for " + id);
	const fnModule = serverFnInfo.module ?? await serverFnInfo.importer();
	if (!fnModule) throw new Error("Server function module not resolved for " + id);
	const action = fnModule[serverFnInfo.functionName];
	if (!action) throw new Error("Server function module export not resolved for serverFn ID: " + id);
	return action;
}
//#endregion
export { getServerFnById as t };
