/**
 * ADDED (ATS Score feature) — server functions for the ATS checker.
 *
 * Quota: free trial = 2 lifetime checks, paid subscription = unlimited.
 * All limits are enforced here (never in the browser).
 */

import { createServerFn } from "@tanstack/react-start";
import { requireSessionUser } from "@/security/serverAuth";
import { getAuthoritativeAccess } from "@/security/accessControl";
import { countAtsChecks, listAtsChecks, recordAtsCheck, TRIAL_ATS_LIMIT } from "@/database/atsChecks";
import { scoreResume } from "@/lib/atsScore";
import { extractPdfText } from "@/lib/pdfText";
import { downloadResume, resumeExists } from "@/storage/storage";

type AuthInput = { sessionToken: string };

export const getAtsStatus = createServerFn({ method: "GET" })
  .inputValidator((data: AuthInput) => data)
  .handler(async ({ data }) => {
    const dbUser = await requireSessionUser(data.sessionToken);
    const access = await getAuthoritativeAccess(dbUser.id);
    const used = await countAtsChecks(dbUser.id);
    const unlimited = access.allowed && access.reason === "active";
    const history = await listAtsChecks(dbUser.id, 5);
    return {
      unlimited,
      used,
      limit: unlimited ? null : TRIAL_ATS_LIMIT,
      remaining: unlimited ? null : Math.max(0, TRIAL_ATS_LIMIT - used),
      accessAllowed: access.allowed,
      accessReason: access.reason,
      hasStoredResume: await resumeExists(dbUser.id).catch(() => false),
      history: history.map((h) => ({
        id: h.id,
        score: h.score,
        fileName: h.file_name,
        createdAt: h.created_at,
      })),
    };
  });

export const runAtsCheck = createServerFn({ method: "POST" })
  .inputValidator(
    (data: AuthInput & {
      source: "stored" | "upload" | "text";
      fileName?: string;
      dataBase64?: string;
      resumeText?: string;
      jobDescription?: string;
    }) => data,
  )
  .handler(async ({ data }) => {
    const dbUser = await requireSessionUser(data.sessionToken);
    const access = await getAuthoritativeAccess(dbUser.id);

    if (!access.allowed) {
      throw new Error("Your access has ended. Upgrade to keep checking your ATS score.");
    }

    const unlimited = access.reason === "active";
    if (!unlimited) {
      const used = await countAtsChecks(dbUser.id);
      if (used >= TRIAL_ATS_LIMIT) {
        throw new Error(
          `Free trial includes ${TRIAL_ATS_LIMIT} ATS checks. Upgrade for unlimited checks.`,
        );
      }
    }

    let text = "";
    let fileName: string | null = null;

    if (data.source === "text") {
      text = (data.resumeText || "").trim();
    } else if (data.source === "upload") {
      if (!data.dataBase64) throw new Error("No file received.");
      fileName = data.fileName ?? "resume.pdf";
      text = extractPdfText(Buffer.from(data.dataBase64, "base64"));
    } else {
      const blob = await downloadResume(dbUser.id);
      fileName = "Your saved resume";
      text = extractPdfText(Buffer.from(await blob.arrayBuffer()));
    }

    if (text.replace(/\s+/g, "").length < 120) {
      throw new Error(
        "We couldn't read enough text from that resume (it may be a scanned image). Paste your resume text instead.",
      );
    }

    const result = scoreResume(text, data.jobDescription);
    await recordAtsCheck({
      userId: dbUser.id,
      score: result.score,
      fileName,
      usedJobDescription: result.usedJobDescription,
    });

    const usedAfter = await countAtsChecks(dbUser.id);
    return {
      result,
      fileName,
      quota: {
        unlimited,
        used: usedAfter,
        limit: unlimited ? null : TRIAL_ATS_LIMIT,
        remaining: unlimited ? null : Math.max(0, TRIAL_ATS_LIMIT - usedAfter),
      },
    };
  });
