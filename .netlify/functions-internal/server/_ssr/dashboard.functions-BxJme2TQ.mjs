import { c as createServerFn } from "./createServerFn-CIHAFgYl.mjs";
import { c as isSupabaseConfigured, o as formatSupabaseError, s as getSupabaseServer } from "./users-Cu_iz6if.mjs";
import { r as requireSessionUser, t as createServerRpc } from "./serverAuth-QOE1yHEF.mjs";
import { c as saveUserAutomation, i as getAuthoritativeAccess, o as getUserAutomation, r as assertAutomationAccess } from "./accessControl-BFm4N4Mn.mjs";
import { n as getRecentJobsForUser, r as istDateString, t as enqueueJob } from "./jobs-_QHuSMBf.mjs";
import { t as PDFDocument } from "../_libs/pdf-lib.mjs";
import { createCipheriv, createHash, randomBytes } from "node:crypto";
import * as fs from "node:fs";
import * as path from "node:path";
//#region node_modules/.nitro/vite/services/ssr/assets/dashboard.functions-BxJme2TQ.js
/**
* Local AES-256-GCM encryption for portal credentials.
* ENCRYPTION_KEY (32+ chars) is required — no default, never VITE_*.
*/
function getKey() {
	const raw = process.env.ENCRYPTION_KEY || "";
	if (!raw || raw.length < 32) throw new Error("ENCRYPTION_KEY must be set to a secret of at least 32 characters (server-only).");
	if (raw.includes("dailyresume-dev-only") || raw === "changeme") throw new Error("Refusing insecure ENCRYPTION_KEY value.");
	return createHash("sha256").update(raw).digest();
}
/** Returns base64(iv):base64(tag):base64(ciphertext) */
async function encryptData(plaintext) {
	const iv = randomBytes(12);
	const cipher = createCipheriv("aes-256-gcm", getKey(), iv);
	const encrypted = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
	const tag = cipher.getAuthTag();
	return `${iv.toString("base64")}:${tag.toString("base64")}:${encrypted.toString("base64")}`;
}
/**
* Shrink PDFs before upload using pdf-lib re-serialization.
* Falls back to the original bytes if compression fails or grows the file.
*/
async function compressPdfBuffer(input) {
	const originalBytes = input.length;
	try {
		const doc = await PDFDocument.load(input, {
			ignoreEncryption: true,
			updateMetadata: false
		});
		try {
			doc.setTitle("");
			doc.setAuthor("");
			doc.setSubject("");
			doc.setKeywords([]);
			doc.setProducer("");
			doc.setCreator("");
		} catch {}
		const bytes = await doc.save({
			useObjectStreams: true,
			addDefaultPage: false
		});
		const out = Buffer.from(bytes);
		if (out.length < originalBytes) return {
			buffer: out,
			originalBytes,
			storedBytes: out.length,
			compressed: true
		};
	} catch (err) {
		console.warn("compressPdfBuffer:", err);
	}
	return {
		buffer: input,
		originalBytes,
		storedBytes: originalBytes,
		compressed: false
	};
}
/**
* Resume storage — one PDF per user at {userId}/latest.pdf.
*/
var BUCKET = "resumes";
var LATEST_OBJECT = "latest.pdf";
function userDir(userId) {
	return path.join(process.cwd(), ".data", "resumes", userId);
}
function latestStoragePath(userId) {
	return `${userId}/${LATEST_OBJECT}`;
}
function writeLocalLatest(userId, buffer) {
	const dir = userDir(userId);
	if (fs.existsSync(dir)) fs.rmSync(dir, {
		recursive: true,
		force: true
	});
	fs.mkdirSync(dir, { recursive: true });
	const latestPath = path.join(dir, LATEST_OBJECT);
	fs.writeFileSync(latestPath, buffer);
	return latestPath;
}
async function purgeUserStorageObjects(userId) {
	const supabase = getSupabaseServer();
	const prefix = userId;
	const { data: listed, error: listErr } = await supabase.storage.from(BUCKET).list(prefix, { limit: 100 });
	if (listErr) {
		if (!listErr.message?.toLowerCase().includes("not found")) console.warn("purgeUserStorageObjects list:", listErr.message);
		return;
	}
	if (!listed?.length) return;
	const paths = listed.map((f) => `${prefix}/${f.name}`);
	const { error: removeErr } = await supabase.storage.from(BUCKET).remove(paths);
	if (removeErr) console.warn("purgeUserStorageObjects remove:", removeErr.message);
}
async function upsertResumeRow(userId, fileName, fileSizeBytes, storagePath) {
	const supabase = getSupabaseServer();
	await supabase.from("resumes").delete().eq("user_id", userId);
	const { error } = await supabase.from("resumes").insert({
		user_id: userId,
		file_name: fileName,
		file_size_bytes: fileSizeBytes,
		storage_path: storagePath
	});
	if (error) throw error;
}
async function uploadResume(userId, file) {
	const displayName = file.name.replace(/[^\w.\-() ]+/g, "_") || "resume.pdf";
	if (!displayName.toLowerCase().endsWith(".pdf")) throw new Error("Only PDF resumes are allowed.");
	const raw = Buffer.from(file.dataBase64, "base64");
	if (raw.length > 5 * 1024 * 1024) throw new Error("Resume must be under 5 MB.");
	if (raw.subarray(0, 5).toString("utf8") !== "%PDF-") throw new Error("File is not a valid PDF.");
	const { buffer, originalBytes, storedBytes, compressed } = await compressPdfBuffer(raw);
	const storagePath = latestStoragePath(userId);
	const latestPath = writeLocalLatest(userId, buffer);
	if (!isSupabaseConfigured()) return {
		path: latestPath,
		url: `/local-resume/${userId}`,
		size: storedBytes,
		contentType: "application/pdf",
		fileName: displayName,
		originalBytes,
		compressed
	};
	try {
		const supabase = getSupabaseServer();
		const body = new Uint8Array(buffer);
		await purgeUserStorageObjects(userId);
		await supabase.storage.from(BUCKET).remove([storagePath]);
		const { error: upErr } = await supabase.storage.from(BUCKET).upload(storagePath, body, {
			contentType: "application/pdf",
			cacheControl: "3600"
		});
		if (upErr) {
			if (upErr.message?.toLowerCase().includes("bucket") || upErr.message?.includes("404")) throw new Error(`Storage bucket "${BUCKET}" not found. In Supabase → Storage, create a private bucket named "resumes", or run supabase/schema.sql.`);
			if (upErr.message?.toLowerCase().includes("row-level security")) throw new Error(`Storage permission denied. Add SUPABASE_SERVICE_ROLE_KEY to .env (Supabase → Settings → API → service_role), or run the storage policies in supabase/schema.sql.`);
			throw upErr;
		}
		await upsertResumeRow(userId, displayName, storedBytes, storagePath);
		return {
			path: latestPath,
			url: storagePath,
			size: storedBytes,
			contentType: "application/pdf",
			fileName: displayName,
			storagePath,
			originalBytes,
			compressed
		};
	} catch (err) {
		console.error("uploadResume (supabase):", err);
		throw formatSupabaseError(err, "Failed to upload resume to storage");
	}
}
async function getResumePath(userId) {
	const latestPath = path.join(userDir(userId), LATEST_OBJECT);
	if (fs.existsSync(latestPath)) return latestPath;
	if (!isSupabaseConfigured()) return null;
	try {
		const { data, error } = await getSupabaseServer().storage.from(BUCKET).download(latestStoragePath(userId));
		if (error) throw error;
		if (data) return writeLocalLatest(userId, Buffer.from(await data.arrayBuffer()));
	} catch (err) {
		console.error("getResumePath (supabase download):", err);
	}
	return null;
}
async function deleteResume(userId) {
	if (isSupabaseConfigured()) try {
		await purgeUserStorageObjects(userId);
		await getSupabaseServer().from("resumes").delete().eq("user_id", userId);
	} catch (err) {
		console.error("deleteResume (supabase):", err);
	}
	const dir = userDir(userId);
	if (fs.existsSync(dir)) fs.rmSync(dir, {
		recursive: true,
		force: true
	});
}
/**
* Automation log store — Supabase + local JSON fallback.
*/
var LOG_FILE = path.join(process.cwd(), ".data", "logs.json");
function readAllLocal() {
	try {
		if (!fs.existsSync(LOG_FILE)) return [];
		return JSON.parse(fs.readFileSync(LOG_FILE, "utf8"));
	} catch {
		return [];
	}
}
async function getUserLogs(userId, limit = 50) {
	if (isSupabaseConfigured()) try {
		const { data, error } = await getSupabaseServer().from("automation_logs").select("*").eq("user_id", userId).order("created_at", { ascending: false }).limit(limit);
		if (error) throw error;
		return (data ?? []).map((row) => ({
			id: row.id,
			user_id: row.user_id,
			platform: row.platform,
			ok: row.ok,
			message: row.message,
			created_at: row.created_at
		}));
	} catch (err) {
		console.error("getUserLogs (supabase):", err);
	}
	return readAllLocal().filter((l) => l.user_id === userId).slice(0, limit);
}
/**
* Server functions for dashboard ↔ automation backend.
* Auth: signed app session (minted after verified Google ID token). Never trust client user IDs alone.
*/
var getDashboardState_createServerFn_handler = createServerRpc({
	id: "82da0c43b9cd6a14c5fcf16cb45804e1739f9ac1473665665b192c84a42ceaca",
	name: "getDashboardState",
	filename: "src/routes/dashboard.functions.ts"
}, (opts) => getDashboardState.__executeServer(opts));
var getDashboardState = createServerFn({ method: "GET" }).inputValidator((data) => data).handler(getDashboardState_createServerFn_handler, async ({ data }) => {
	const userId = (await requireSessionUser(data.sessionToken)).id;
	const access = await getAuthoritativeAccess(userId);
	const record = await getUserAutomation(userId);
	const logs = await getUserLogs(userId, 20);
	const jobs = await getRecentJobsForUser(userId, 8).catch(() => []);
	return {
		userId,
		user: access.user,
		access: {
			allowed: access.allowed,
			reason: access.reason,
			daysRemaining: access.daysRemaining,
			trialExpireAt: access.trialExpireAt,
			subscriptionExpireAt: access.subscriptionExpireAt,
			subscriptionStatus: access.subscriptionStatus,
			subscriptionPlan: access.subscriptionPlan
		},
		jobs: jobs.map((j) => ({
			id: j.id,
			type: j.job_type,
			status: j.status,
			message: j.result_message || j.error,
			createdAt: j.created_at
		})),
		resume: record.resume ? {
			name: record.resume.name,
			size: record.resume.size
		} : null,
		credentialsSaved: !!record.credentials,
		credentials: record.credentials ? {
			username: record.credentials.username,
			email: record.credentials.email,
			phone: record.credentials.phone,
			password: ""
		} : {
			username: "",
			email: "",
			phone: "",
			password: ""
		},
		platforms: record.platforms,
		automationState: record.automationState,
		lastRunAt: record.lastRunAt,
		logs: logs.map((l) => ({
			id: l.id,
			ok: l.ok,
			text: l.message,
			time: new Date(l.created_at).toLocaleString("en-IN", { timeZone: "Asia/Kolkata" }),
			ts: new Date(l.created_at).getTime()
		}))
	};
});
var saveNaukriCredentials_createServerFn_handler = createServerRpc({
	id: "bb9fbfdcccf0bd22498ecee068733acc90e91d1248dd09c65712cdaa2e6d1e69",
	name: "saveNaukriCredentials",
	filename: "src/routes/dashboard.functions.ts"
}, (opts) => saveNaukriCredentials.__executeServer(opts));
var saveNaukriCredentials = createServerFn({ method: "POST" }).inputValidator((data) => data).handler(saveNaukriCredentials_createServerFn_handler, async ({ data }) => {
	const userId = (await requireSessionUser(data.sessionToken)).id;
	const { credentials } = data;
	if (!credentials.username || !credentials.phone) throw new Error("Username and phone are required");
	const record = await getUserAutomation(userId);
	const existing = record.credentials;
	if (!credentials.password && !existing?.password) throw new Error("Password is required");
	const encryptedPassword = credentials.password ? await encryptData(credentials.password) : existing.password;
	await saveUserAutomation({
		...record,
		credentials: {
			username: credentials.username.trim(),
			email: (credentials.email || credentials.username).trim(),
			phone: credentials.phone.replace(/\s+/g, ""),
			password: encryptedPassword
		}
	});
	return { ok: true };
});
var uploadUserResume_createServerFn_handler = createServerRpc({
	id: "080acf463ffa6a4d4d17049f6d7a71fe0ec29fd3e3f2bad1a341aa1d626adf58",
	name: "uploadUserResume",
	filename: "src/routes/dashboard.functions.ts"
}, (opts) => uploadUserResume.__executeServer(opts));
var uploadUserResume = createServerFn({ method: "POST" }).inputValidator((data) => data).handler(uploadUserResume_createServerFn_handler, async ({ data }) => {
	const userId = (await requireSessionUser(data.sessionToken)).id;
	const stored = await uploadResume(userId, {
		name: data.fileName,
		type: data.contentType,
		dataBase64: data.dataBase64
	});
	await saveUserAutomation({
		...await getUserAutomation(userId),
		userId,
		resume: {
			name: stored.fileName,
			size: `${(stored.size / 1024).toFixed(0)} KB`,
			path: `supabase:${userId}/latest.pdf`
		}
	});
	return {
		userId,
		name: stored.fileName,
		size: `${(stored.size / 1024).toFixed(0)} KB`,
		replaced: true,
		compressed: stored.compressed ?? false,
		savedBytes: stored.originalBytes ? Math.max(0, stored.originalBytes - stored.size) : 0
	};
});
var deleteUserResume_createServerFn_handler = createServerRpc({
	id: "9fe87723b8624a0f41a786dc5f73536bdf64d15470bba1adf425740c2c9da03e",
	name: "deleteUserResume",
	filename: "src/routes/dashboard.functions.ts"
}, (opts) => deleteUserResume.__executeServer(opts));
var deleteUserResume = createServerFn({ method: "POST" }).inputValidator((data) => data).handler(deleteUserResume_createServerFn_handler, async ({ data }) => {
	const userId = (await requireSessionUser(data.sessionToken)).id;
	await deleteResume(userId);
	await saveUserAutomation({
		...await getUserAutomation(userId),
		userId,
		resume: null
	});
	return {
		ok: true,
		userId
	};
});
var setPlatformConnected_createServerFn_handler = createServerRpc({
	id: "85c351912fbfb488363bd720b81de21ad1a2852fc09d2a3352b391455d8c6a36",
	name: "setPlatformConnected",
	filename: "src/routes/dashboard.functions.ts"
}, (opts) => setPlatformConnected.__executeServer(opts));
var setPlatformConnected = createServerFn({ method: "POST" }).inputValidator((data) => data).handler(setPlatformConnected_createServerFn_handler, async ({ data }) => {
	if (data.platformId === "indeed") throw new Error("Indeed is coming soon");
	const userId = (await requireSessionUser(data.sessionToken)).id;
	const record = await getUserAutomation(userId);
	if (data.connected && !record.credentials) throw new Error("Save Naukri credentials before connecting");
	if (data.connected) {
		if (!await getResumePath(userId) && !record.resume) throw new Error("Upload your resume before connecting");
	}
	const platforms = record.platforms.map((p) => p.id === data.platformId ? {
		...p,
		connected: data.connected,
		last: data.connected ? p.last : null
	} : p);
	await saveUserAutomation({
		...record,
		userId,
		platforms
	});
	return {
		platforms,
		userId
	};
});
var setAutomationState_createServerFn_handler = createServerRpc({
	id: "30c448d84a6a23fb31d80146a350741b2985a366c7b366577c61e9ee92ec2f11",
	name: "setAutomationState",
	filename: "src/routes/dashboard.functions.ts"
}, (opts) => setAutomationState.__executeServer(opts));
var setAutomationState = createServerFn({ method: "POST" }).inputValidator((data) => data).handler(setAutomationState_createServerFn_handler, async ({ data }) => {
	const userId = (await requireSessionUser(data.sessionToken)).id;
	if (data.state === "running") await assertAutomationAccess(userId);
	const record = await getUserAutomation(userId);
	if (data.state === "running") {
		if (!record.resume) throw new Error("Upload your resume first");
		if (!record.credentials) throw new Error("Save Naukri credentials first");
		if (!record.platforms.find((p) => p.id === "naukri")?.connected) throw new Error("Connect Naukri first");
	}
	await saveUserAutomation({
		...record,
		userId,
		automationState: data.state
	});
	if (data.state === "running") await enqueueJob({
		userId,
		jobType: "daily_refresh",
		scheduledFor: istDateString()
	});
	return {
		state: data.state,
		userId
	};
});
var runNaukriNow_createServerFn_handler = createServerRpc({
	id: "70d04256afdf57a746e849f7c041c2ce545a2f085472967b6bb15603a61f1733",
	name: "runNaukriNow",
	filename: "src/routes/dashboard.functions.ts"
}, (opts) => runNaukriNow.__executeServer(opts));
var runNaukriNow = createServerFn({ method: "POST" }).inputValidator((data) => data).handler(runNaukriNow_createServerFn_handler, async ({ data }) => {
	const dbUser = await requireSessionUser(data.sessionToken);
	await assertAutomationAccess(dbUser.id);
	const q = await enqueueJob({
		userId: dbUser.id,
		jobType: "run_now",
		platform: "naukri"
	});
	return {
		ok: q.ok,
		jobId: q.job?.id ?? null,
		message: "Your resume refresh has started. We'll update your activity when it's done.",
		durationMs: 0
	};
});
//#endregion
export { deleteUserResume_createServerFn_handler, getDashboardState_createServerFn_handler, runNaukriNow_createServerFn_handler, saveNaukriCredentials_createServerFn_handler, setAutomationState_createServerFn_handler, setPlatformConnected_createServerFn_handler, uploadUserResume_createServerFn_handler };
