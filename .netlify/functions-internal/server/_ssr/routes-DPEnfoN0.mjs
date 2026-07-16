import { i as __toESM } from "../_runtime.mjs";
import { h as Link } from "../_libs/@tanstack/react-router+[...].mjs";
import { n as require_react } from "../_libs/@radix-ui/react-compose-refs+[...].mjs";
import { i as require_jsx_runtime } from "../_libs/@radix-ui/react-label+[...].mjs";
import { n as Button, r as Card, s as getCurrentUser, t as AUTH_CHANGE_EVENT } from "./googleAuth-DjCh-eln.mjs";
import { C as Bell, S as CircleCheck, T as ArrowLeft, _ as Eye, i as Star, l as RefreshCw, n as Upload, o as Sparkles, p as Mail, s as ShieldCheck, t as Zap, w as ArrowRight, y as Clock } from "../_libs/lucide-react.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/routes-DPEnfoN0.js
var import_react = /* @__PURE__ */ __toESM(require_react());
var import_jsx_runtime = require_jsx_runtime();
var recruiter_invites_default = "/assets/recruiter-invites-B67zUWjI.jpg";
var image_default = "/assets/image-wihIcHqm.png";
var panel_features_default = "/assets/panel-features-ZsHMNld4.jpg";
var panel_steps_default = "/assets/panel-steps-D-BP6KPY.jpg";
var panel_platforms_default = "/assets/panel-platforms-CJTczjlb.jpg";
var panel_faq_default = "/assets/panel-faq-DE5_n7T2.jpg";
var panel_cta_default = "/assets/panel-cta-XVZa1wm3.jpg";
/** Reflects localStorage session; clears when the user logs out. */
function useAuthUser() {
	const [user, setUser] = (0, import_react.useState)(null);
	(0, import_react.useEffect)(() => {
		const sync = () => setUser(getCurrentUser());
		sync();
		const onStorage = (e) => {
			if (e.key === "dailyresume.session" || e.key === null) sync();
		};
		window.addEventListener("storage", onStorage);
		window.addEventListener(AUTH_CHANGE_EVENT, sync);
		window.addEventListener("focus", sync);
		return () => {
			window.removeEventListener("storage", onStorage);
			window.removeEventListener(AUTH_CHANGE_EVENT, sync);
			window.removeEventListener("focus", sync);
		};
	}, []);
	return user;
}
var FEATURES = [
	{
		icon: Upload,
		title: "Upload once",
		desc: "Add your resume a single time. We securely store and reuse it."
	},
	{
		icon: RefreshCw,
		title: "Daily auto-refresh",
		desc: "We update your profile every morning while you sleep."
	},
	{
		icon: Eye,
		title: "Recruiter visibility",
		desc: "Active profiles rank higher — get seen first."
	},
	{
		icon: Clock,
		title: "Save hours weekly",
		desc: "No more logging into multiple portals every day."
	},
	{
		icon: ShieldCheck,
		title: "Secure by design",
		desc: "Credentials encrypted. Sessions isolated per user."
	},
	{
		icon: Sparkles,
		title: "Zero maintenance",
		desc: "Set it once. We handle the rest — forever."
	}
];
var STEPS = [
	{
		n: "01",
		title: "Sign in with Google",
		desc: "One click. No passwords to remember."
	},
	{
		n: "02",
		title: "Upload your resume",
		desc: "PDF only. We validate and store it securely."
	},
	{
		n: "03",
		title: "Connect job portals",
		desc: "Link Naukri or Indeed in seconds."
	},
	{
		n: "04",
		title: "We refresh daily",
		desc: "Automation runs every morning. You get notified."
	}
];
var PLATFORMS = [{
	name: "Naukri",
	status: "Live",
	desc: "India's largest job portal"
}, {
	name: "Indeed",
	status: "Coming soon",
	desc: "Global job search platform"
}];
var FAQ = [
	{
		q: "What does DailyResume do?",
		a: "DailyResume automatically refreshes your resume every day on job portals like Naukri and Indeed. You upload it once, connect your accounts, and we keep your profile marked as recently updated — without you lifting a finger."
	},
	{
		q: "Why do we do it?",
		a: "Job seekers waste hours every week logging into multiple portals just to click 'update' so their resume looks fresh. We built DailyResume to remove that repetitive busywork so you can focus on interviews and real applications instead."
	},
	{
		q: "Why is it required?",
		a: "Recruiters filter and sort candidates by 'recently updated' profiles. A resume that hasn't been touched in a week gets buried under thousands of newer ones. Daily refreshes keep you at the top of recruiter searches — which directly translates to more views, more calls and more interviews."
	}
];
var PANELS = [
	"Intro",
	"Features",
	"How it works",
	"Platforms",
	"FAQ",
	"Start"
];
function Landing() {
	const scrollerRef = (0, import_react.useRef)(null);
	const [active, setActive] = (0, import_react.useState)(0);
	const user = useAuthUser();
	(0, import_react.useEffect)(() => {
		const el = scrollerRef.current;
		if (!el) return;
		const onScroll = () => {
			const i = Math.round(el.scrollLeft / el.clientWidth);
			setActive(Math.max(0, Math.min(PANELS.length - 1, i)));
		};
		const onKey = (e) => {
			if (e.key === "ArrowRight") el.scrollBy({
				left: el.clientWidth,
				behavior: "smooth"
			});
			if (e.key === "ArrowLeft") el.scrollBy({
				left: -el.clientWidth,
				behavior: "smooth"
			});
		};
		el.addEventListener("scroll", onScroll, { passive: true });
		window.addEventListener("keydown", onKey);
		return () => {
			el.removeEventListener("scroll", onScroll);
			window.removeEventListener("keydown", onKey);
		};
	}, []);
	const goTo = (i) => {
		const el = scrollerRef.current;
		if (!el) return;
		el.scrollTo({
			left: i * el.clientWidth,
			behavior: "smooth"
		});
	};
	const next = () => goTo(Math.min(active + 1, PANELS.length - 1));
	const prev = () => goTo(Math.max(active - 1, 0));
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
		className: "flex h-screen flex-col overflow-hidden bg-background",
		children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "relative flex-1 overflow-hidden",
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				ref: scrollerRef,
				className: "flex h-full snap-x snap-mandatory overflow-x-auto overflow-y-hidden scroll-smooth [scrollbar-width:none] [&::-webkit-scrollbar]:hidden",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Panel, { children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(IntroPanel, {
						onStart: next,
						signedIn: !!user
					}) }),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Panel, { children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(FeaturesPanel, {}) }),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Panel, { children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(StepsPanel, {}) }),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Panel, { children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(PlatformsPanel, {}) }),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Panel, { children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(FaqPanel, {}) }),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Panel, { children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(CtaPanel, { signedIn: !!user }) })
				]
			}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "absolute bottom-6 left-1/2 z-20 flex -translate-x-1/2 items-center gap-3 rounded-full border border-border/60 bg-background/80 px-3 py-2 shadow-elegant backdrop-blur",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
						onClick: prev,
						disabled: active === 0,
						"aria-label": "Previous",
						className: "grid h-9 w-9 place-items-center rounded-full border border-border/60 bg-background transition hover:scale-105 disabled:pointer-events-none disabled:opacity-30",
						children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ArrowLeft, { className: "h-4 w-4" })
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "flex items-center gap-3 px-1",
						children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
								className: "text-xs font-medium tabular-nums text-muted-foreground",
								children: [
									String(active + 1).padStart(2, "0"),
									" / ",
									String(PANELS.length).padStart(2, "0")
								]
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: "h-3 w-px bg-border" }),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
								className: "flex items-center gap-1.5",
								children: PANELS.map((p, i) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
									onClick: () => goTo(i),
									"aria-label": p,
									className: `h-1.5 rounded-full transition-all ${i === active ? "w-6 bg-primary" : "w-1.5 bg-border hover:bg-muted-foreground/40"}`
								}, p))
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
								className: "hidden text-xs font-medium text-foreground sm:inline",
								children: PANELS[active]
							})
						]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
						onClick: next,
						disabled: active === PANELS.length - 1,
						"aria-label": "Next",
						className: "grid h-9 w-9 place-items-center rounded-full bg-gradient-primary text-primary-foreground shadow-glow transition hover:scale-105 disabled:pointer-events-none disabled:opacity-30",
						children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ArrowRight, { className: "h-4 w-4" })
					})
				]
			})]
		})
	});
}
function Panel({ children }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("section", {
		className: "relative flex h-full w-screen shrink-0 snap-center items-start overflow-y-auto pt-6 sm:pt-10",
		children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
			className: "mx-auto w-full max-w-6xl px-6 pb-28 sm:px-12 sm:pb-32",
			children
		})
	});
}
function IntroPanel({ onStart, signedIn }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "relative",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: "hero-bg absolute -inset-24 -z-10",
				"aria-hidden": true
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: "grid-pattern absolute -inset-24 -z-10",
				"aria-hidden": true
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "grid items-center gap-12 lg:grid-cols-[1.15fr_1fr]",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("h1", {
						className: "text-5xl leading-[1.08] tracking-tight sm:text-6xl md:text-7xl",
						children: [
							"Get seen by recruiters,",
							" ",
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
								className: "text-gradient-primary",
								children: "every single day."
							})
						]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "mt-6 max-w-xl text-lg text-muted-foreground",
						children: "Recruiters filter by recently updated profiles. DailyResume keeps yours on top — automatically, across every job portal you use."
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
						className: "mt-8 max-w-xl rounded-2xl border border-primary/20 bg-gradient-to-r from-primary/8 via-primary/5 to-transparent p-4 ring-soft",
						children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
							className: "text-sm leading-relaxed text-foreground/80",
							children: [
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
									className: "font-semibold text-foreground",
									children: "Land the package you actually deserve"
								}),
								" ",
								"— by reaching the maximum number of recruiters, every single day."
							]
						})
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "mt-8 flex flex-wrap items-center gap-3",
						children: [signedIn ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
							asChild: true,
							size: "lg",
							className: "bg-gradient-primary shadow-glow",
							children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Link, {
								to: "/dashboard",
								children: ["Go to Dashboard ", /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ArrowRight, { className: "ml-2 h-4 w-4" })]
							})
						}) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
							asChild: true,
							size: "lg",
							className: "bg-gradient-primary shadow-glow",
							children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Link, {
								to: "/login",
								children: ["Get Started ", /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ArrowRight, { className: "ml-2 h-4 w-4" })]
							})
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
							size: "lg",
							variant: "ghost",
							onClick: onStart,
							children: "See how it works →"
						})]
					})
				] }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "flex flex-col gap-6",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "relative",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
							className: "absolute -inset-4 -z-10 rounded-3xl bg-gradient-to-br from-primary/15 via-primary/5 to-transparent blur-2xl",
							"aria-hidden": true
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("img", {
							src: image_default,
							alt: "Recruiters reviewing a resume",
							width: 720,
							height: 480,
							className: "w-full h-auto object-contain"
						})]
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "grid grid-cols-2 gap-4",
						children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)(StatCard, {
								value: "8:00 AM",
								label: "Daily refresh, IST"
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)(StatCard, {
								value: "2 min",
								label: "One-time setup"
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)(StatCard, {
								value: "100%",
								label: "Hands-off"
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)(StatCard, {
								value: "Daily",
								label: "Recruiter visibility"
							})
						]
					})]
				})]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "mt-14 grid items-center gap-10 lg:grid-cols-[1fr_1.1fr]",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
						className: "inline-flex items-center gap-2 rounded-full border border-border/60 bg-background/70 px-3 py-1 text-xs font-semibold uppercase tracking-widest text-primary backdrop-blur",
						children: "Real results"
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", {
						className: "mt-4 text-3xl tracking-tight sm:text-4xl",
						children: "Invites land in your inbox — while you sleep."
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "mt-4 max-w-lg text-muted-foreground",
						children: "Users who keep their profile fresh every day get contacted by recruiters across Naukri, Indeed and LinkedIn — for roles they never even applied to."
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "mt-6 grid gap-3 sm:grid-cols-3",
						children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)(TrustStat, {
								icon: Mail,
								value: "3.2×",
								label: "More recruiter messages"
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)(TrustStat, {
								icon: Bell,
								value: "5×",
								label: "More profile views"
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)(TrustStat, {
								icon: Star,
								value: "4.8/5",
								label: "User rating"
							})
						]
					})
				] }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "relative",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
						className: "absolute -inset-4 -z-10 rounded-3xl bg-gradient-to-br from-primary/15 via-primary/5 to-transparent blur-2xl",
						"aria-hidden": true
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("img", {
						src: recruiter_invites_default,
						alt: "Recruiter messages and interview invitations from Google, Microsoft and Amazon",
						loading: "lazy",
						width: 1600,
						height: 912,
						className: "w-full rounded-2xl border border-border/60 shadow-elegant"
					})]
				})]
			})
		]
	});
}
function TrustStat({ icon: Icon, value, label }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "rounded-xl border border-border/60 bg-background/70 p-4 backdrop-blur",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Icon, { className: "h-4 w-4 text-primary" }),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: "mt-2 font-display text-xl font-bold tracking-tight",
				children: value
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: "text-xs text-muted-foreground",
				children: label
			})
		]
	});
}
function PanelImage({ src, alt }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "relative mx-auto mt-10 max-w-3xl",
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
			className: "absolute -inset-4 -z-10 rounded-3xl bg-gradient-to-br from-primary/15 via-primary/5 to-transparent blur-2xl",
			"aria-hidden": true
		}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("img", {
			src,
			alt,
			loading: "lazy",
			width: 1200,
			height: 800,
			className: "w-full rounded-2xl border border-border/60 shadow-elegant"
		})]
	});
}
function FeaturesPanel() {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [
		/* @__PURE__ */ (0, import_jsx_runtime.jsx)(PanelHeader, {
			eyebrow: "Features",
			title: "Everything to stay visible"
		}),
		/* @__PURE__ */ (0, import_jsx_runtime.jsx)(PanelImage, {
			src: panel_features_default,
			alt: "Icons representing DailyResume features"
		}),
		/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
			className: "mt-12 grid gap-px overflow-hidden rounded-2xl border border-border/60 bg-border/60 sm:grid-cols-2 lg:grid-cols-3",
			children: FEATURES.map((f) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "group bg-background p-7 transition-colors hover:bg-surface-muted/40",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
						className: "mb-4 grid h-11 w-11 place-items-center rounded-xl bg-gradient-primary text-primary-foreground shadow-glow",
						children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(f.icon, { className: "h-5 w-5" })
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h3", {
						className: "text-lg font-semibold",
						children: f.title
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "mt-2 text-sm leading-relaxed text-muted-foreground",
						children: f.desc
					})
				]
			}, f.title))
		})
	] });
}
function StepsPanel() {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [
		/* @__PURE__ */ (0, import_jsx_runtime.jsx)(PanelHeader, {
			eyebrow: "How it works",
			title: "Set up in under 2 minutes"
		}),
		/* @__PURE__ */ (0, import_jsx_runtime.jsx)(PanelImage, {
			src: panel_steps_default,
			alt: "Four-step onboarding: sign in, upload resume, connect portals, automate"
		}),
		/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "relative mt-14 grid gap-10 md:grid-cols-4 md:gap-6",
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: "pointer-events-none absolute left-0 right-0 top-6 hidden h-px bg-gradient-to-r from-transparent via-border to-transparent md:block",
				"aria-hidden": true
			}), STEPS.map((s) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "relative",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
						className: "relative z-10 grid h-12 w-12 place-items-center rounded-full border border-border/60 bg-background font-display text-sm font-bold text-primary shadow-elegant",
						children: s.n
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h3", {
						className: "mt-5 text-lg font-semibold",
						children: s.title
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "mt-1.5 text-sm leading-relaxed text-muted-foreground",
						children: s.desc
					})
				]
			}, s.n))]
		})
	] });
}
function PlatformsPanel() {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "mx-auto max-w-3xl",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(PanelHeader, {
				eyebrow: "Supported platforms",
				title: "Currently supported"
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(PanelImage, {
				src: panel_platforms_default,
				alt: "Naukri and Indeed connected to a central resume"
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: "mt-12 grid gap-4 sm:grid-cols-2",
				children: PLATFORMS.map((p) => {
					const live = p.status === "Live";
					return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Card, {
						className: `flex items-center justify-between border-border/60 p-5 transition hover:shadow-elegant ${live ? "" : "opacity-60"}`,
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "flex items-center gap-4",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
								className: "grid h-11 w-11 place-items-center rounded-xl bg-gradient-to-br from-secondary to-background font-semibold text-secondary-foreground ring-soft",
								children: p.name[0]
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
								className: "font-semibold",
								children: p.name
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
								className: "text-xs text-muted-foreground",
								children: p.desc
							})] })]
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
							className: `inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${live ? "bg-success/12 text-success" : "bg-muted text-muted-foreground"}`,
							children: [live && /* @__PURE__ */ (0, import_jsx_runtime.jsx)(CircleCheck, { className: "h-3 w-3" }), p.status]
						})]
					}, p.name);
				})
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "mt-6 text-center text-sm text-muted-foreground",
				children: "More platforms coming soon."
			})
		]
	});
}
function FaqPanel() {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "mx-auto max-w-4xl",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(PanelHeader, {
				eyebrow: "FAQ",
				title: "Questions, answered"
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(PanelImage, {
				src: panel_faq_default,
				alt: "Friendly support answering questions"
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: "mt-12 grid gap-4 md:grid-cols-3",
				children: FAQ.map((item, i) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Card, {
					className: "border-border/60 p-6 shadow-elegant",
					children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
							className: "text-xs font-semibold uppercase tracking-widest text-primary",
							children: String(i + 1).padStart(2, "0")
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h3", {
							className: "mt-3 text-lg font-semibold",
							children: item.q
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
							className: "mt-3 text-sm leading-relaxed text-muted-foreground",
							children: item.a
						})
					]
				}, i))
			})
		]
	});
}
function CtaPanel({ signedIn }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
		className: "relative",
		children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Card, {
			className: "relative overflow-hidden border-border/60 p-14 text-center shadow-elegant",
			children: [
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
					className: "hero-bg absolute inset-0",
					"aria-hidden": true
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
					className: "grid-pattern absolute inset-0",
					"aria-hidden": true
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "relative",
					children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
							className: "mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-gradient-primary text-primary-foreground shadow-glow",
							children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Zap, { className: "h-5 w-5" })
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", {
							className: "mt-6 text-4xl tracking-tight sm:text-5xl",
							children: "Stop chasing recruiters."
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
							className: "mx-auto mt-4 max-w-lg text-muted-foreground",
							children: "Let DailyResume keep your profile alive across every portal, every day."
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("img", {
							src: panel_cta_default,
							alt: "Rocket launching from a laptop, symbolizing career acceleration",
							loading: "lazy",
							width: 1200,
							height: 800,
							className: "mx-auto mt-8 w-full max-w-xl rounded-2xl border border-border/60 shadow-elegant"
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
							asChild: true,
							size: "lg",
							className: "mt-8 bg-gradient-primary shadow-glow",
							children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Link, {
								to: signedIn ? "/dashboard" : "/login",
								children: signedIn ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: ["Go to Dashboard ", /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ArrowRight, { className: "ml-2 h-4 w-4" })] }) : /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: ["Get Started ", /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ArrowRight, { className: "ml-2 h-4 w-4" })] })
							})
						})
					]
				})
			]
		})
	});
}
function StatCard({ value, label }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "rounded-2xl border border-border/60 bg-background/70 p-5 backdrop-blur ring-soft",
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
			className: "font-display text-2xl font-bold tracking-tight sm:text-3xl",
			children: value
		}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
			className: "mt-1 text-xs text-muted-foreground sm:text-sm",
			children: label
		})]
	});
}
function PanelHeader({ eyebrow, title }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "mx-auto max-w-2xl text-center",
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
			className: "inline-flex items-center gap-2 rounded-full border border-border/60 bg-background px-3 py-1 text-xs font-semibold uppercase tracking-widest text-primary",
			children: eyebrow
		}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", {
			className: "mt-5 text-4xl tracking-tight sm:text-5xl",
			children: title
		})]
	});
}
//#endregion
export { Landing as component };
