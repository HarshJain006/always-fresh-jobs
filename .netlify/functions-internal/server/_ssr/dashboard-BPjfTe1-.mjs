import { i as __toESM } from "../_runtime.mjs";
import { g as useNavigate, h as Link } from "../_libs/@tanstack/react-router+[...].mjs";
import { c as createServerFn } from "./createServerFn-CIHAFgYl.mjs";
import { n as require_react } from "../_libs/@radix-ui/react-compose-refs+[...].mjs";
import { i as require_jsx_runtime, t as Root } from "../_libs/@radix-ui/react-label+[...].mjs";
import { t as cva } from "../_libs/class-variance-authority+clsx.mjs";
import { c as getSessionToken, f as updateSessionUser, i as cn, l as logoutUser, n as Button, o as createSsrRpc, r as Card, s as getCurrentUser, u as requireClientSessionToken } from "./googleAuth-DjCh-eln.mjs";
import { n as toast } from "../_libs/sonner.mjs";
import { t as Toaster$1 } from "./sonner-DoFKumIW.mjs";
import { S as CircleCheck, a as Square, b as Circle, c as Rocket, d as Play, f as Pause, g as FileText, h as KeyRound, l as RefreshCw, m as LogOut, n as Upload, r as Trash2, t as Zap, u as Plug, v as Crown, x as CircleX } from "../_libs/lucide-react.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/dashboard-BPjfTe1-.js
var import_react = /* @__PURE__ */ __toESM(require_react());
var import_jsx_runtime = require_jsx_runtime();
var badgeVariants = cva("inline-flex items-center rounded-md border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2", {
	variants: { variant: {
		default: "border-transparent bg-primary text-primary-foreground shadow hover:bg-primary/80",
		secondary: "border-transparent bg-secondary text-secondary-foreground hover:bg-secondary/80",
		destructive: "border-transparent bg-destructive text-destructive-foreground shadow hover:bg-destructive/80",
		outline: "text-foreground"
	} },
	defaultVariants: { variant: "default" }
});
function Badge({ className, variant, ...props }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
		className: cn(badgeVariants({ variant }), className),
		...props
	});
}
var Input = import_react.forwardRef(({ className, type, ...props }, ref) => {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
		type,
		className: cn("flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-base shadow-sm transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 md:text-sm", className),
		ref,
		...props
	});
});
Input.displayName = "Input";
var labelVariants = cva("text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70");
var Label = import_react.forwardRef(({ className, ...props }, ref) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Root, {
	ref,
	className: cn(labelVariants(), className),
	...props
}));
Label.displayName = Root.displayName;
/**
* Server functions for dashboard ↔ automation backend.
* Auth: signed app session (minted after verified Google ID token). Never trust client user IDs alone.
*/
var getDashboardState = createServerFn({ method: "GET" }).inputValidator((data) => data).handler(createSsrRpc("82da0c43b9cd6a14c5fcf16cb45804e1739f9ac1473665665b192c84a42ceaca"));
var saveNaukriCredentials = createServerFn({ method: "POST" }).inputValidator((data) => data).handler(createSsrRpc("bb9fbfdcccf0bd22498ecee068733acc90e91d1248dd09c65712cdaa2e6d1e69"));
var uploadUserResume = createServerFn({ method: "POST" }).inputValidator((data) => data).handler(createSsrRpc("080acf463ffa6a4d4d17049f6d7a71fe0ec29fd3e3f2bad1a341aa1d626adf58"));
var deleteUserResume = createServerFn({ method: "POST" }).inputValidator((data) => data).handler(createSsrRpc("9fe87723b8624a0f41a786dc5f73536bdf64d15470bba1adf425740c2c9da03e"));
var setPlatformConnected = createServerFn({ method: "POST" }).inputValidator((data) => data).handler(createSsrRpc("85c351912fbfb488363bd720b81de21ad1a2852fc09d2a3352b391455d8c6a36"));
var setAutomationState = createServerFn({ method: "POST" }).inputValidator((data) => data).handler(createSsrRpc("30c448d84a6a23fb31d80146a350741b2985a366c7b366577c61e9ee92ec2f11"));
/** Start an immediate resume refresh (runs on the automation backend). */
var runNaukriNow = createServerFn({ method: "POST" }).inputValidator((data) => data).handler(createSsrRpc("70d04256afdf57a746e849f7c041c2ce545a2f085472967b6bb15603a61f1733"));
function fileToBase64(file) {
	return new Promise((resolve, reject) => {
		const reader = new FileReader();
		reader.onload = () => {
			const result = String(reader.result || "");
			resolve(result.includes(",") ? result.split(",")[1] : result);
		};
		reader.onerror = () => reject(reader.error);
		reader.readAsDataURL(file);
	});
}
function Dashboard() {
	const navigate = useNavigate();
	const [user, setUser] = (0, import_react.useState)(null);
	const [loading, setLoading] = (0, import_react.useState)(true);
	const [busy, setBusy] = (0, import_react.useState)(false);
	const [resume, setResume] = (0, import_react.useState)(null);
	const [state, setState] = (0, import_react.useState)("idle");
	const [credentials, setCredentials] = (0, import_react.useState)({
		username: "",
		password: "",
		email: "",
		phone: ""
	});
	const [credentialsSaved, setCredentialsSaved] = (0, import_react.useState)(false);
	const [platforms, setPlatforms] = (0, import_react.useState)([{
		id: "naukri",
		name: "Naukri",
		connected: false,
		last: null
	}, {
		id: "indeed",
		name: "Indeed",
		connected: false,
		last: null
	}]);
	const [logs, setLogs] = (0, import_react.useState)([]);
	const [accessAllowed, setAccessAllowed] = (0, import_react.useState)(true);
	const [trialDaysLeft, setTrialDaysLeft] = (0, import_react.useState)(null);
	const [accessReason, setAccessReason] = (0, import_react.useState)("trial");
	const [subscriptionExpireAt, setSubscriptionExpireAt] = (0, import_react.useState)(null);
	const [subscriptionPlan, setSubscriptionPlan] = (0, import_react.useState)(null);
	const now = Date.now();
	const day = 1440 * 60 * 1e3;
	const recentLogs = (0, import_react.useMemo)(() => {
		const cutoff = now - 7 * day;
		return logs.filter((l) => l.ts >= cutoff).sort((a, b) => b.ts - a.ts);
	}, [
		logs,
		now,
		day
	]);
	(0, import_react.useEffect)(() => {
		const u = getCurrentUser();
		if (!u || !getSessionToken()) {
			navigate({ to: "/login" });
			return;
		}
		setUser(u);
		(async () => {
			try {
				const dash = await getDashboardState({ data: { sessionToken: requireClientSessionToken() } });
				if (dash.user) {
					updateSessionUser(dash.user);
					setUser(dash.user);
				}
				setAccessAllowed(dash.access.allowed);
				setTrialDaysLeft(dash.access.daysRemaining);
				setAccessReason(dash.access.reason);
				setSubscriptionExpireAt(dash.access.subscriptionExpireAt ?? null);
				setSubscriptionPlan(dash.access.subscriptionPlan ?? null);
				if (!dash.access.allowed) toast.error("Your access has ended. Renew your plan to keep DailyResume running.", {
					duration: 8e3,
					action: {
						label: "Renew",
						onClick: () => navigate({ to: "/pricing" })
					}
				});
				setResume(dash.resume);
				setCredentialsSaved(dash.credentialsSaved);
				setCredentials({
					username: dash.credentials.username,
					email: dash.credentials.email,
					phone: dash.credentials.phone,
					password: ""
				});
				setPlatforms(dash.platforms);
				setState(dash.automationState);
				setLogs(dash.logs);
			} catch (err) {
				console.error(err);
				const msg = err instanceof Error ? err.message : "Could not load dashboard state.";
				toast.error(msg);
				if (/session|sign in/i.test(msg)) {
					await logoutUser();
					navigate({ to: "/login" });
				}
			} finally {
				setLoading(false);
			}
		})();
	}, [navigate]);
	const anyConnected = platforms.some((p) => p.connected);
	const step1Done = !!resume;
	const step2Done = anyConnected;
	const step3Done = state !== "idle" && step1Done && step2Done;
	const currentStep = (0, import_react.useMemo)(() => {
		if (!step1Done) return 1;
		if (!step2Done) return 2;
		return 3;
	}, [step1Done, step2Done]);
	if (!user || loading) return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
		className: "grid min-h-screen place-items-center bg-background text-sm text-muted-foreground",
		children: "Loading dashboard…"
	});
	const trialDays = trialDaysLeft ?? 0;
	const allowed = accessAllowed;
	function applyServerUserId(serverUserId) {
		if (!serverUserId || serverUserId === user.id) return;
		const updated = {
			...user,
			id: serverUserId
		};
		updateSessionUser(updated);
		setUser(updated);
	}
	async function handleUpload(e) {
		const file = e.target.files?.[0];
		if (!file || !user) return;
		if (file.type !== "application/pdf") {
			toast.error("Please upload a PDF file.");
			return;
		}
		if (file.size > 5 * 1024 * 1024) {
			toast.error("Resume must be under 5 MB.");
			return;
		}
		setBusy(true);
		try {
			const dataBase64 = await fileToBase64(file);
			const stored = await uploadUserResume({ data: {
				sessionToken: requireClientSessionToken(),
				fileName: file.name,
				contentType: file.type,
				dataBase64
			} });
			applyServerUserId(stored.userId);
			setResume(stored);
			toast.success(resume ? "Resume replaced. Only your latest file is kept." : "Resume uploaded.");
		} catch (err) {
			console.error(err);
			toast.error(err instanceof Error ? err.message : "Upload failed.");
		} finally {
			setBusy(false);
			e.target.value = "";
		}
	}
	async function handleRemoveResume() {
		if (!user) return;
		setBusy(true);
		try {
			await deleteUserResume({ data: { sessionToken: requireClientSessionToken() } });
			setResume(null);
			toast("Resume removed");
		} catch (err) {
			toast.error(err instanceof Error ? err.message : "Could not remove resume.");
		} finally {
			setBusy(false);
		}
	}
	async function handleSaveCredentials(e) {
		e.preventDefault();
		if (!user) return;
		if (!credentials.username || !credentials.phone) {
			toast.error("Username and phone are required.");
			return;
		}
		if (!credentials.password && !credentialsSaved) {
			toast.error("Password is required.");
			return;
		}
		setBusy(true);
		try {
			await saveNaukriCredentials({ data: {
				sessionToken: requireClientSessionToken(),
				credentials: {
					username: credentials.username,
					password: credentials.password,
					email: credentials.email || credentials.username,
					phone: credentials.phone
				}
			} });
			setCredentialsSaved(true);
			setCredentials((c) => ({
				...c,
				password: ""
			}));
			toast.success("Credentials saved securely.");
		} catch (err) {
			toast.error(err instanceof Error ? err.message : "Could not save credentials.");
		} finally {
			setBusy(false);
		}
	}
	async function togglePlatform(id) {
		if (id === "indeed" || !user) return;
		const current = platforms.find((p) => p.id === id);
		if (!current) return;
		setBusy(true);
		try {
			const res = await setPlatformConnected({ data: {
				sessionToken: requireClientSessionToken(),
				platformId: id,
				connected: !current.connected
			} });
			applyServerUserId(res.userId);
			setPlatforms(res.platforms);
			toast.success(current.connected ? "Disconnected." : "Naukri connected.");
		} catch (err) {
			toast.error(err instanceof Error ? err.message : "Could not update platform.");
		} finally {
			setBusy(false);
		}
	}
	async function handleLogout() {
		await logoutUser();
		navigate({ to: "/" });
	}
	async function refreshLogs() {
		if (!user) return;
		const dash = await getDashboardState({ data: { sessionToken: requireClientSessionToken() } });
		applyServerUserId(dash.userId);
		setLogs(dash.logs);
		setPlatforms(dash.platforms);
	}
	async function handleStart() {
		if (!user) return;
		if (!allowed) {
			toast.error("Your trial has expired. Please upgrade to start.");
			return;
		}
		if (!step1Done) return toast.error("Upload your resume first.");
		if (!credentialsSaved) return toast.error("Save Naukri credentials first.");
		if (!step2Done) return toast.error("Connect Naukri first.");
		setBusy(true);
		try {
			await setAutomationState({ data: {
				sessionToken: requireClientSessionToken(),
				state: "running"
			} });
			setState("running");
			toast.success("Automation started. Your first refresh is running…");
			const result = await runNaukriNow({ data: { sessionToken: requireClientSessionToken() } });
			await refreshLogs();
			if (result.ok) toast.success(result.message);
			else toast.error(result.message);
		} catch (err) {
			toast.error(err instanceof Error ? err.message : "Could not start automation.");
		} finally {
			setBusy(false);
		}
	}
	async function handlePause() {
		if (!user) return;
		try {
			await setAutomationState({ data: {
				sessionToken: requireClientSessionToken(),
				state: "paused"
			} });
			setState("paused");
			toast("Automation paused. Resume anytime.");
		} catch (err) {
			toast.error(err instanceof Error ? err.message : "Could not pause.");
		}
	}
	async function handleResumeAutomation() {
		if (!user) return;
		try {
			await setAutomationState({ data: {
				sessionToken: requireClientSessionToken(),
				state: "running"
			} });
			setState("running");
			toast.success("Automation resumed. Next refresh at 8:00 AM IST.");
		} catch (err) {
			toast.error(err instanceof Error ? err.message : "Could not resume.");
		}
	}
	async function handleStop() {
		if (!user) return;
		try {
			await setAutomationState({ data: {
				sessionToken: requireClientSessionToken(),
				state: "idle"
			} });
			setState("idle");
			toast("Automation stopped.");
		} catch (err) {
			toast.error(err instanceof Error ? err.message : "Could not stop.");
		}
	}
	async function handleRunNow() {
		if (!user) return;
		if (!allowed) return toast.error("Your trial has expired.");
		if (!step1Done || !credentialsSaved || !step2Done) return toast.error("Complete setup first (resume, credentials, connect Naukri).");
		setBusy(true);
		try {
			toast("Starting your Naukri refresh…");
			const result = await runNaukriNow({ data: { sessionToken: requireClientSessionToken() } });
			await refreshLogs();
			if (result.ok) toast.success(result.message);
			else toast.error(result.message);
		} catch (err) {
			toast.error(err instanceof Error ? err.message : "Refresh failed.");
		} finally {
			setBusy(false);
		}
	}
	const progressPct = step3Done ? 100 : step2Done ? 66 : step1Done ? 33 : 8;
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "min-h-screen bg-background pb-16",
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Toaster$1, {}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("main", {
			className: "mx-auto max-w-3xl px-4 py-10 sm:px-6",
			children: [
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "flex items-start justify-between gap-4",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("h1", {
						className: "text-3xl sm:text-4xl",
						children: ["Hi, ", user.name.split(" ")[0]]
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "mt-1 text-muted-foreground",
						children: "Let’s get your resume refreshing daily — in three quick steps."
					})] }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Button, {
						variant: "ghost",
						size: "sm",
						onClick: handleLogout,
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(LogOut, { className: "mr-2 h-4 w-4" }), " Sign out"]
					})]
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)(SubscriptionBanner, {
					daysRemaining: trialDays,
					reason: accessReason,
					subscriptionExpireAt,
					subscriptionPlan
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Card, {
					className: "mt-6 border-border/60 p-6",
					children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "flex items-start gap-4",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
							className: "grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary",
							children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(KeyRound, { className: "h-4 w-4" })
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "min-w-0 flex-1",
							children: [
								/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
									className: "flex items-center justify-between gap-3",
									children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h3", {
										className: "text-base font-semibold",
										children: "Naukri account credentials"
									}), credentialsSaved && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Badge, {
										variant: "secondary",
										className: "gap-1",
										children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(CircleCheck, { className: "h-3 w-3" }), " Saved"]
									})]
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
									className: "mt-1 text-sm text-muted-foreground",
									children: "We use these to sign in and refresh your profile daily. Stored encrypted — only used for your automatic refreshes."
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("form", {
									className: "mt-4 grid gap-4 sm:grid-cols-2",
									onSubmit: handleSaveCredentials,
									children: [
										/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
											className: "grid gap-1.5",
											children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Label, {
												htmlFor: "cred-username",
												children: "Naukri email / username"
											}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Input, {
												id: "cred-username",
												value: credentials.username,
												onChange: (e) => {
													setCredentials({
														...credentials,
														username: e.target.value
													});
													setCredentialsSaved(false);
												},
												placeholder: "you@example.com",
												disabled: busy
											})]
										}),
										/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
											className: "grid gap-1.5",
											children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Label, {
												htmlFor: "cred-password",
												children: "Password"
											}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Input, {
												id: "cred-password",
												type: "password",
												value: credentials.password,
												onChange: (e) => {
													setCredentials({
														...credentials,
														password: e.target.value
													});
													setCredentialsSaved(false);
												},
												placeholder: credentialsSaved ? "•••••••• (enter to update)" : "••••••••",
												disabled: busy
											})]
										}),
										/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
											className: "grid gap-1.5",
											children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Label, {
												htmlFor: "cred-email",
												children: "Email address"
											}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Input, {
												id: "cred-email",
												type: "email",
												value: credentials.email,
												onChange: (e) => {
													setCredentials({
														...credentials,
														email: e.target.value
													});
													setCredentialsSaved(false);
												},
												placeholder: "you@example.com",
												disabled: busy
											})]
										}),
										/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
											className: "grid gap-1.5",
											children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Label, {
												htmlFor: "cred-phone",
												children: "Phone number"
											}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Input, {
												id: "cred-phone",
												type: "tel",
												value: credentials.phone,
												onChange: (e) => {
													setCredentials({
														...credentials,
														phone: e.target.value
													});
													setCredentialsSaved(false);
												},
												placeholder: "+91 98765 43210",
												disabled: busy
											})]
										}),
										/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
											className: "sm:col-span-2",
											children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
												type: "submit",
												disabled: busy,
												className: "bg-gradient-primary shadow-glow",
												children: credentialsSaved ? "Update credentials" : "Save credentials"
											})
										})
									]
								})
							]
						})]
					})
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "mt-8",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "flex items-center justify-between text-xs font-medium text-muted-foreground",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: "Setup progress" }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
							className: "tabular-nums",
							children: [progressPct, "%"]
						})]
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
						className: "mt-2 h-1.5 w-full overflow-hidden rounded-full bg-secondary",
						children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
							className: "h-full rounded-full bg-gradient-primary transition-all duration-500",
							style: { width: `${progressPct}%` }
						})
					})]
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "mt-10 space-y-4",
					children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)(StepCard, {
							n: 1,
							title: "Upload your resume",
							desc: "One PDF only (max 5 MB). Uploading again replaces the previous file — we keep and compress only the latest version.",
							done: step1Done,
							active: currentStep === 1,
							children: resume ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "flex items-center justify-between rounded-lg border border-border/60 bg-surface-muted/40 p-3",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
									className: "flex items-center gap-3",
									children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
										className: "grid h-9 w-9 place-items-center rounded-lg bg-primary/10 text-primary",
										children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(FileText, { className: "h-4 w-4" })
									}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
										className: "text-sm font-medium",
										children: resume.name
									}) })]
								}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
									className: "flex items-center gap-2",
									children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
										type: "file",
										accept: "application/pdf",
										className: "hidden",
										onChange: handleUpload,
										disabled: busy
									}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
										asChild: true,
										size: "sm",
										variant: "outline",
										disabled: busy,
										children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Upload, { className: "mr-2 h-4 w-4" }), "Replace"] })
									})] }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
										size: "sm",
										variant: "ghost",
										onClick: handleRemoveResume,
										disabled: busy,
										children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Trash2, { className: "h-4 w-4" })
									})]
								})]
							}) : /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", {
								className: "block cursor-pointer",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
									type: "file",
									accept: "application/pdf",
									className: "hidden",
									onChange: handleUpload,
									disabled: busy
								}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
									className: "flex flex-col items-center justify-center rounded-lg border border-dashed border-border/60 bg-surface-muted/40 p-8 text-center transition hover:bg-surface-muted/70",
									children: [
										/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Upload, { className: "h-6 w-6 text-muted-foreground" }),
										/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
											className: "mt-2 text-sm font-medium",
											children: "Click to upload PDF"
										}),
										/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
											className: "text-xs text-muted-foreground",
											children: "Max 5 MB"
										})
									]
								})]
							})
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)(StepCard, {
							n: 2,
							title: "Connect your job portals",
							desc: "Link Naukri so we know where to refresh. Indeed support is coming soon.",
							done: step2Done,
							active: currentStep === 2,
							locked: !step1Done,
							children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
								className: "divide-y divide-border/60 rounded-lg border border-border/60",
								children: platforms.map((p) => {
									const comingSoon = p.id === "indeed";
									return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
										className: `flex items-center justify-between p-3 ${comingSoon ? "opacity-50" : ""}`,
										children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
											className: "flex items-center gap-3",
											children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
												className: "grid h-9 w-9 place-items-center rounded-lg bg-secondary font-semibold text-secondary-foreground",
												children: p.name[0]
											}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
												className: "text-sm font-medium",
												children: p.name
											}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
												className: "text-xs text-muted-foreground",
												children: comingSoon ? "Coming soon" : p.connected ? `Last refresh: ${p.last ?? "—"}` : "Not connected"
											})] })]
										}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
											className: "flex items-center gap-2",
											children: comingSoon ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Badge, {
												variant: "outline",
												children: "Coming soon"
											}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Button, {
												size: "sm",
												variant: "secondary",
												disabled: true,
												children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Plug, { className: "mr-2 h-4 w-4" }), "Connect"]
											})] }) : /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [p.connected && /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Badge, {
												variant: "secondary",
												children: "Connected"
											}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
												size: "sm",
												variant: p.connected ? "ghost" : "default",
												onClick: () => togglePlatform(p.id),
												disabled: !step1Done || !credentialsSaved || busy,
												children: p.connected ? "Remove" : /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Plug, { className: "mr-2 h-4 w-4" }), "Connect"] })
											})] })
										})]
									}, p.id);
								})
							})
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(StepCard, {
							n: 3,
							title: "Control your automation",
							desc: "Runs every morning at 8:00 AM IST. Start, pause, or stop whenever you like.",
							done: step3Done,
							active: currentStep === 3,
							locked: !step1Done || !step2Done,
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(AutomationStatus, { state }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "mt-4 flex flex-wrap gap-2",
								children: [
									state === "idle" && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Button, {
										onClick: handleStart,
										disabled: !allowed || !step1Done || !step2Done || busy,
										className: "bg-gradient-primary shadow-glow",
										children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Rocket, { className: "mr-2 h-4 w-4" }), " Start daily refresh"]
									}),
									state === "running" && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [
										/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Button, {
											variant: "outline",
											onClick: handlePause,
											disabled: busy,
											children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Pause, { className: "mr-2 h-4 w-4" }), " Pause"]
										}),
										/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Button, {
											variant: "ghost",
											onClick: handleStop,
											disabled: busy,
											className: "text-destructive hover:text-destructive",
											children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Square, { className: "mr-2 h-4 w-4" }), " Stop"]
										}),
										/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Button, {
											variant: "secondary",
											onClick: handleRunNow,
											disabled: busy,
											children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(RefreshCw, { className: "mr-2 h-4 w-4" }), " Run now"]
										})
									] }),
									state === "paused" && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [
										/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Button, {
											onClick: handleResumeAutomation,
											disabled: busy,
											className: "bg-gradient-primary shadow-glow",
											children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Play, { className: "mr-2 h-4 w-4" }), " Resume"]
										}),
										/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Button, {
											variant: "ghost",
											onClick: handleStop,
											disabled: busy,
											className: "text-destructive hover:text-destructive",
											children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Square, { className: "mr-2 h-4 w-4" }), " Stop"]
										}),
										/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Button, {
											variant: "secondary",
											onClick: handleRunNow,
											disabled: busy,
											children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(RefreshCw, { className: "mr-2 h-4 w-4" }), " Run now"]
										})
									] })
								]
							})]
						})
					]
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Card, {
					className: "mt-10 border-border/60 p-6",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "flex items-center justify-between",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", {
							className: "text-lg font-semibold",
							children: "Recent activity"
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
							className: "text-xs text-muted-foreground",
							children: "Last 7 days · newest first"
						})]
					}), recentLogs.length === 0 ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "mt-4 text-sm text-muted-foreground",
						children: "No activity yet. Once automation starts, refresh events will appear here."
					}) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)("ul", {
						className: "mt-4 space-y-2",
						children: recentLogs.map((l) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("li", {
							className: "flex items-center justify-between rounded-lg border border-border/60 bg-surface-muted/40 p-3 text-sm",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "flex items-center gap-3",
								children: [l.ok ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(CircleCheck, { className: "h-4 w-4 text-success" }) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)(CircleX, { className: "h-4 w-4 text-destructive" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: l.text })]
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
								className: "text-xs text-muted-foreground",
								children: l.time
							})]
						}, l.id))
					})]
				})
			]
		})]
	});
}
function AutomationStatus({ state }) {
	if (state === "running") return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "flex items-center gap-3 rounded-lg border border-success/30 bg-success/8 p-4",
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
			className: "grid h-9 w-9 place-items-center rounded-lg bg-success/15 text-success",
			children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Zap, { className: "h-4 w-4" })
		}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
			className: "text-sm font-semibold text-success",
			children: "Automation active"
		}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
			className: "text-xs text-muted-foreground",
			children: "Next refresh: tomorrow, 8:00 AM IST"
		})] })]
	});
	if (state === "paused") return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "flex items-center gap-3 rounded-lg border border-warning/30 bg-warning/10 p-4",
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
			className: "grid h-9 w-9 place-items-center rounded-lg bg-warning/20 text-warning-foreground",
			children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Pause, { className: "h-4 w-4" })
		}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
			className: "text-sm font-semibold",
			children: "Automation paused"
		}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
			className: "text-xs text-muted-foreground",
			children: "No refreshes until you resume."
		})] })]
	});
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
		className: "text-sm text-muted-foreground",
		children: [
			"Press ",
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
				className: "font-medium text-foreground",
				children: "Start"
			}),
			" to begin daily refreshes. You can pause or stop at any time."
		]
	});
}
function StepCard({ n, title, desc, done, active, locked, children }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Card, {
		className: [
			"border-border/60 p-6 transition",
			locked ? "opacity-55" : "",
			active && !done ? "ring-1 ring-primary/40 shadow-elegant" : ""
		].join(" "),
		children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "flex items-start gap-4",
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: ["grid h-9 w-9 shrink-0 place-items-center rounded-full text-sm font-bold", done ? "bg-success text-success-foreground" : active ? "bg-gradient-primary text-primary-foreground shadow-glow" : "bg-secondary text-secondary-foreground"].join(" "),
				children: done ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(CircleCheck, { className: "h-4 w-4" }) : n
			}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "min-w-0 flex-1",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "flex items-center justify-between gap-3",
						children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h3", {
								className: "text-base font-semibold",
								children: title
							}),
							done && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Badge, {
								variant: "secondary",
								className: "gap-1",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(CircleCheck, { className: "h-3 w-3" }), " Done"]
							}),
							!done && !active && !locked && /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Circle, { className: "h-3 w-3 text-muted-foreground" })
						]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "mt-1 text-sm text-muted-foreground",
						children: desc
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
						className: "mt-4",
						children
					})
				]
			})]
		})
	});
}
function SubscriptionBanner({ daysRemaining, reason, subscriptionExpireAt, subscriptionPlan }) {
	const expireLabel = subscriptionExpireAt ? new Date(subscriptionExpireAt).toLocaleDateString("en-IN", {
		timeZone: "Asia/Kolkata",
		day: "numeric",
		month: "short",
		year: "numeric"
	}) : null;
	const planName = subscriptionPlan === "premium_3m" ? "3 Months" : subscriptionPlan === "premium_6m" ? "6 Months" : subscriptionPlan === "premium_1m" || subscriptionPlan === "premium_monthly" ? "1 Month" : "Premium";
	if (reason === "active") {
		if (daysRemaining > 0 && daysRemaining <= 7) return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Card, {
			className: "mt-6 flex flex-wrap items-center justify-between gap-3 border-warning/50 bg-warning/10 p-5",
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "flex items-center gap-3",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Crown, { className: "h-5 w-5 text-warning-foreground" }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "font-semibold text-warning-foreground",
					children: [
						"Premium ends in ",
						daysRemaining,
						" day",
						daysRemaining === 1 ? "" : "s"
					]
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "text-sm text-muted-foreground",
					children: [
						planName,
						" · Valid until ",
						expireLabel,
						". Renew now so daily refreshes don’t stop."
					]
				})] })]
			}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
				asChild: true,
				className: "bg-gradient-primary shadow-glow",
				children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Link, {
					to: "/pricing",
					children: "Renew plan"
				})
			})]
		});
		return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Card, {
			className: "mt-6 flex flex-wrap items-center justify-between gap-3 border-primary/40 bg-gradient-primary p-5 text-primary-foreground shadow-glow",
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "flex items-center gap-3",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Crown, { className: "h-5 w-5" }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "font-semibold",
					children: ["Premium active · ", planName]
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
					className: "text-sm opacity-90",
					children: daysRemaining > 0 ? `${daysRemaining} day${daysRemaining === 1 ? "" : "s"} left · until ${expireLabel}` : `Valid until ${expireLabel}`
				})] })]
			}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
				asChild: true,
				variant: "secondary",
				size: "sm",
				children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Link, {
					to: "/pricing",
					children: "Manage"
				})
			})]
		});
	}
	if (reason === "trial" && daysRemaining > 0) return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Card, {
		className: "mt-6 flex flex-wrap items-center justify-between gap-3 border-border/60 bg-surface-muted/40 p-5",
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
			className: "font-semibold",
			children: "Free trial"
		}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "text-sm text-muted-foreground",
			children: [
				daysRemaining,
				" day",
				daysRemaining === 1 ? "" : "s",
				" remaining · Upgrade to keep automation running"
			]
		})] }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
			asChild: true,
			className: "bg-gradient-primary shadow-glow",
			children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Link, {
				to: "/pricing",
				children: "View plans"
			})
		})]
	});
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Card, {
		className: "mt-6 flex flex-wrap items-center justify-between gap-3 border-warning/40 bg-warning/10 p-5",
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
			className: "font-semibold text-warning-foreground",
			children: "Access ended · Automation paused"
		}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
			className: "text-sm text-muted-foreground",
			children: "Choose a plan to resume daily refreshes."
		})] }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
			asChild: true,
			className: "bg-gradient-primary shadow-glow",
			children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Link, {
				to: "/pricing",
				children: "Subscribe"
			})
		})]
	});
}
//#endregion
export { Dashboard as component };
