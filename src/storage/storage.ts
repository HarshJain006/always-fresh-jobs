/**
 * File storage adapter.
 * TODO: Wire to Supabase Storage / S3 / Firebase Storage / etc.
 */

export interface StoredFile {
  path: string;
  url: string;
  size: number;
  contentType: string;
}

export async function uploadResume(_userId: string, _file: File): Promise<StoredFile> {
  // TODO: Upload to real storage bucket, return signed URL.
  throw new Error("uploadResume: storage provider not yet configured");
}

export async function downloadResume(_userId: string): Promise<Blob> {
  // TODO: Fetch resume blob for automation worker.
  throw new Error("downloadResume: storage provider not yet configured");
}

export async function deleteResume(_userId: string): Promise<void> {
  // TODO: Remove file from storage bucket.
}
