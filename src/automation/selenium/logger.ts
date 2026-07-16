import * as fs from "node:fs";
import * as path from "node:path";

const LOG_FILE = path.join(process.cwd(), ".data", "naukri.log");

function timestamp(): string {
  return new Date().toISOString().replace("T", " ").replace("Z", "");
}

function ensureLogDir() {
  try {
    fs.mkdirSync(path.dirname(LOG_FILE), { recursive: true });
  } catch {
    // ignore
  }
}

/** Print to console AND append to .data/naukri.log */
export function logMsg(message: string): void {
  console.log(message);
  try {
    ensureLogDir();
    fs.appendFileSync(LOG_FILE, `${timestamp()}    : ${message}\n`);
  } catch {
    // Non-fatal
  }
}

export function logError(error: unknown, context = ""): void {
  const msg = error instanceof Error ? `${error.name}: ${error.message}` : String(error);
  const full = context ? `${context} - ${msg}` : msg;
  console.error(full);
  try {
    ensureLogDir();
    fs.appendFileSync(LOG_FILE, `${timestamp()}    : ERROR - ${full}\n`);
  } catch {
    // ignore
  }
}
