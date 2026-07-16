/**
 * Removes the temporary backend test button + related files.
 * Usage: npm run remove:backend-test
 */

import * as fs from "node:fs";
import * as path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const testDir = path.join(root, "src", "dev", "backend-test");
const dashboardPath = path.join(root, "src", "routes", "dashboard.tsx");

function rmDir(dir) {
  if (!fs.existsSync(dir)) return false;
  fs.rmSync(dir, { recursive: true, force: true });
  return true;
}

function stripDashboard(source) {
  let out = source;

  out = out.replace(
    /\r?\n\/\* __BACKEND_TEST_START__ \*\/\r?\nimport \{ BackendTestButton \} from "@\/dev\/backend-test";\r?\n\/\* __BACKEND_TEST_END__ \*\/\r?\n/,
    "\n",
  );

  out = out.replace(
    /\r?\n\s*\{\/\* __BACKEND_TEST_START__ \*\/\}\r?\n\s*<BackendTestButton[\s\S]*?\/>\r?\n\s*\{\/\* __BACKEND_TEST_END__ \*\/\}\r?\n/,
    "\n",
  );

  if (out.includes("BackendTestButton") || out.includes("__BACKEND_TEST_")) {
    out = out.replace(/^.*BackendTestButton.*$\r?\n?/gm, "");
    out = out.replace(/^.*__BACKEND_TEST_.*$\r?\n?/gm, "");
  }

  return out;
}

const removedDir = rmDir(testDir);
console.log(removedDir ? `Removed ${testDir}` : `Already gone: ${testDir}`);

if (fs.existsSync(dashboardPath)) {
  const before = fs.readFileSync(dashboardPath, "utf8");
  const after = stripDashboard(before);
  if (after !== before) {
    fs.writeFileSync(dashboardPath, after);
    console.log(`Cleaned ${dashboardPath}`);
  } else {
    console.log("dashboard.tsx already clean.");
  }
}

const devDir = path.join(root, "src", "dev");
if (fs.existsSync(devDir) && fs.readdirSync(devDir).length === 0) {
  fs.rmSync(devDir, { recursive: true, force: true });
  console.log("Removed empty src/dev");
}

console.log("Done. Backend test button removed.");
