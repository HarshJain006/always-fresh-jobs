/**
 * Runtime helpers — detect serverless (Netlify Functions) vs local dev.
 */

export function isServerlessRuntime(): boolean {
  if (typeof process === "undefined") return false;

  if (
    process.env.AWS_LAMBDA_FUNCTION_NAME ||
    process.env.LAMBDA_TASK_ROOT ||
    process.env.NETLIFY ||
    process.env.VERCEL
  ) {
    return true;
  }

  const cwd = process.cwd();
  return cwd === "/var/task" || cwd.startsWith("/var/task/");
}

/** Local `.data/` writes only work in dev / on the Pi worker — not on Netlify. */
export function canUseLocalFilesystem(): boolean {
  return !isServerlessRuntime();
}
