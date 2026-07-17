/**
 * Resume storage — one PDF per user at {userId}/latest.pdf.
 */

import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import {
  formatSupabaseError,
  getSupabaseServer,
  isSupabaseServerConfigured,
} from "@/lib/supabase";
import { canUseLocalFilesystem } from "@/lib/runtime";
import { compressPdfBuffer } from "./compressPdf";

export interface StoredFile {
  path: string;
  url: string;
  size: number;
  contentType: string;
  fileName: string;
  storagePath?: string;
  originalBytes?: number;
  compressed?: boolean;
}

const BUCKET = "resumes";
const LATEST_OBJECT = "latest.pdf";

function userDir(userId: string): string {
  const base = canUseLocalFilesystem()
    ? path.join(process.cwd(), ".data", "resumes", userId)
    : path.join(os.tmpdir(), "dailyresume", "resumes", userId);
  return base;
}

function latestStoragePath(userId: string): string {
  return `${userId}/${LATEST_OBJECT}`;
}

function writeLocalLatest(userId: string, buffer: Buffer): string {
  const dir = userDir(userId);
  if (fs.existsSync(dir)) {
    fs.rmSync(dir, { recursive: true, force: true });
  }
  fs.mkdirSync(dir, { recursive: true });
  const latestPath = path.join(dir, LATEST_OBJECT);
  fs.writeFileSync(latestPath, buffer);
  return latestPath;
}

async function purgeUserStorageObjects(userId: string): Promise<void> {
  const supabase = getSupabaseServer();
  const prefix = userId;

  const { data: listed, error: listErr } = await supabase.storage.from(BUCKET).list(prefix, {
    limit: 100,
  });
  if (listErr) {
    // Empty folder / missing bucket — non-fatal before first upload
    if (!listErr.message?.toLowerCase().includes("not found")) {
      console.warn("purgeUserStorageObjects list:", listErr.message);
    }
    return;
  }

  if (!listed?.length) return;

  const paths = listed.map((f) => `${prefix}/${f.name}`);
  const { error: removeErr } = await supabase.storage.from(BUCKET).remove(paths);
  if (removeErr) console.warn("purgeUserStorageObjects remove:", removeErr.message);
}

async function upsertResumeRow(
  userId: string,
  fileName: string,
  fileSizeBytes: number,
  storagePath: string,
): Promise<void> {
  const supabase = getSupabaseServer();
  await supabase.from("resumes").delete().eq("user_id", userId);
  const { error } = await supabase.from("resumes").insert({
    user_id: userId,
    file_name: fileName,
    file_size_bytes: fileSizeBytes,
    storage_path: storagePath,
  });
  if (error) throw error;
}

export async function uploadResume(
  userId: string,
  file: { name: string; type: string; dataBase64: string },
): Promise<StoredFile> {
  const displayName = file.name.replace(/[^\w.\-() ]+/g, "_") || "resume.pdf";
  if (!displayName.toLowerCase().endsWith(".pdf")) {
    throw new Error("Only PDF resumes are allowed.");
  }

  const raw = Buffer.from(file.dataBase64, "base64");

  if (raw.length > 5 * 1024 * 1024) {
    throw new Error("Resume must be under 5 MB.");
  }

  // Magic-byte check — do not trust client Content-Type
  const header = raw.subarray(0, 5).toString("utf8");
  if (header !== "%PDF-") {
    throw new Error("File is not a valid PDF.");
  }

  const { buffer, originalBytes, storedBytes, compressed } = await compressPdfBuffer(raw);
  const storagePath = latestStoragePath(userId);

  if (!isSupabaseServerConfigured()) {
    if (!canUseLocalFilesystem()) {
      throw new Error(
        "Resume storage is not configured. Set SUPABASE_SERVICE_ROLE_KEY on Netlify.",
      );
    }
    const latestPath = writeLocalLatest(userId, buffer);
    return {
      path: latestPath,
      url: `/local-resume/${userId}`,
      size: storedBytes,
      contentType: "application/pdf",
      fileName: displayName,
      originalBytes,
      compressed,
    };
  }

  try {
    const supabase = getSupabaseServer();
    const body = new Uint8Array(buffer);

    await purgeUserStorageObjects(userId);

    // Remove target path then upload fresh (more reliable than upsert on some buckets)
    await supabase.storage.from(BUCKET).remove([storagePath]);

    const { error: upErr } = await supabase.storage.from(BUCKET).upload(storagePath, body, {
      contentType: "application/pdf",
      cacheControl: "3600",
    });

    if (upErr) {
      if (upErr.message?.toLowerCase().includes("bucket") || upErr.message?.includes("404")) {
        throw new Error(
          `Storage bucket "${BUCKET}" not found. In Supabase → Storage, create a private bucket named "resumes", or run supabase/schema.sql.`,
        );
      }
      if (upErr.message?.toLowerCase().includes("row-level security")) {
        throw new Error(
          `Storage permission denied. Add SUPABASE_SERVICE_ROLE_KEY to .env (Supabase → Settings → API → service_role), or run the storage policies in supabase/schema.sql.`,
        );
      }
      throw upErr;
    }

    await upsertResumeRow(userId, displayName, storedBytes, storagePath);

    const latestPath = canUseLocalFilesystem() ? writeLocalLatest(userId, buffer) : storagePath;

    return {
      path: latestPath,
      url: storagePath,
      size: storedBytes,
      contentType: "application/pdf",
      fileName: displayName,
      storagePath,
      originalBytes,
      compressed,
    };
  } catch (err) {
    console.error("uploadResume (supabase):", err);
    throw formatSupabaseError(err, "Failed to upload resume to storage");
  }
}

export async function resumeExists(userId: string): Promise<boolean> {
  if (isSupabaseServerConfigured()) {
    const { data, error } = await getSupabaseServer()
      .from("resumes")
      .select("id")
      .eq("user_id", userId)
      .maybeSingle();
    if (error) throw error;
    return Boolean(data);
  }

  const latestPath = path.join(userDir(userId), LATEST_OBJECT);
  return fs.existsSync(latestPath);
}

export async function getResumePath(userId: string): Promise<string | null> {
  const latestPath = path.join(userDir(userId), LATEST_OBJECT);
  if (fs.existsSync(latestPath)) return latestPath;

  if (!isSupabaseServerConfigured()) return null;

  try {
    const { data, error } = await getSupabaseServer()
      .storage.from(BUCKET)
      .download(latestStoragePath(userId));
    if (error) throw error;
    if (data) {
      const buf = Buffer.from(await data.arrayBuffer());
      return writeLocalLatest(userId, buf);
    }
  } catch (err) {
    console.error("getResumePath (supabase download):", err);
  }

  return null;
}

export async function downloadResume(userId: string): Promise<Blob> {
  const resumePath = await getResumePath(userId);
  if (!resumePath) throw new Error("downloadResume: no resume on file");
  const buf = fs.readFileSync(resumePath);
  return new Blob([new Uint8Array(buf)], { type: "application/pdf" });
}

export async function deleteResume(userId: string): Promise<void> {
  if (isSupabaseServerConfigured()) {
    await purgeUserStorageObjects(userId);
    await getSupabaseServer().from("resumes").delete().eq("user_id", userId);
  }

  const dir = userDir(userId);
  if (fs.existsSync(dir)) {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}
