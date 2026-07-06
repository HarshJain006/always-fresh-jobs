/**
 * Naukri.com automation adapter.
 *
 * TypeScript / Playwright port of the original Python + Selenium script
 * (see uploaded `naukri.py`). Behavior parity:
 *   - Log in with username/password
 *   - Dismiss post-login popups (close icon, "SKIP AND CONTINUE")
 *   - Verify login via `#ff-inventory`
 *   - Update mobile number on profile
 *   - Upload/replace resume on the profile page
 *   - Verify "last updated" reflects today
 *   - Log out from the drawer menu
 *
 * IMPORTANT: This module is server/worker-only. Never import from React components.
 */

import type { BrowserContext, Page } from "playwright";
import type { PlatformAdapter, RunContext } from "./types";

const NAUKRI_LOGIN_URL = "https://www.naukri.com/nlogin/login";
const NAUKRI_PROFILE_URL = "https://www.naukri.com/mnjuser/profile";

const SEL = {
  username: "#usernameField",
  password: "#passwordField",
  loginBtn: "button[type='submit']:has-text('Login')",
  loginCheckpoint: "#ff-inventory",
  closeIcon: "[class*='cross-icon'], [alt='cross-icon'], [class*='crossIcon']",
  skipBtn: "text=/SKIP AND CONTINUE/i",
  viewProfile: "[class*='view-profile'] a",
  editIcon: "(//*[contains(@class,'icon edit')])[1]",
  mobileInput: "input[name='mobile'], #mob_number",
  saveBasic: "#saveBasicDetailsBtn, button[type='submit'][value='Save Changes']",
  saveConfirm: "text=/^today$/i",
  attachCV: "#attachCV",
  lazyAttachCV: "#lazyAttachCV",
  uploadCVInput: "input[value='Update resume']",
  updateOn: "[class*='updateOn']",
  drawerIcon: "[class*='drawer__icon'], div[class*='drawer']",
  logoutLink: "a[data-type='logoutLink'], a[href*='logout'], a[class*='logout']",
} as const;

async function safeClick(page: Page, selector: string, timeout = 5000): Promise<boolean> {
  try {
    const loc = page.locator(selector).first();
    await loc.waitFor({ state: "visible", timeout });
    await loc.click({ timeout });
    return true;
  } catch {
    return false;
  }
}

async function isPresent(page: Page, selector: string, timeout = 2000): Promise<boolean> {
  try {
    await page.locator(selector).first().waitFor({ state: "attached", timeout });
    return true;
  } catch {
    return false;
  }
}

function today(): string[] {
  const d = new Date();
  const opts: Intl.DateTimeFormatOptions = { month: "short", day: "numeric", year: "numeric" };
  return [d.toLocaleDateString("en-US", opts), d.toLocaleDateString("en-GB", opts)];
}

export const naukriAdapter: PlatformAdapter = {
  id: "naukri",
  name: "Naukri",

  async login(ctx, run) {
    const page = await ctx.newPage();
    (page as unknown as { __run?: RunContext }).__run = run;
    try {
      run.logger("Naukri: opening login page");
      await page.goto(NAUKRI_LOGIN_URL, { waitUntil: "domcontentloaded" });

      await page.fill(SEL.username, run.credentials.username);
      await page.fill(SEL.password, run.credentials.password);
      await page.click(SEL.loginBtn);

      await safeClick(page, SEL.closeIcon, 8000);
      await safeClick(page, SEL.skipBtn, 5000);

      const ok = await isPresent(page, SEL.loginCheckpoint, 40000);
      run.logger(ok ? "Naukri: login successful" : "Naukri: login checkpoint not found");
      return ok;
    } catch (err) {
      run.logger(`Naukri login error: ${String(err)}`);
      return false;
    }
  },

  async uploadResume(ctx, run) {
    const page = ctx.pages()[0] ?? (await ctx.newPage());
    try {
      run.logger("Naukri: opening profile page");
      await page.goto(NAUKRI_PROFILE_URL, { waitUntil: "domcontentloaded" });
      await safeClick(page, SEL.closeIcon, 5000);

      // Profile: update mobile number
      if (run.credentials.extra?.mobile) {
        await safeClick(page, SEL.viewProfile, 8000);
        if (await isPresent(page, SEL.editIcon, 8000)) {
          await page.locator(SEL.editIcon).first().click();
          const mob = page.locator(SEL.mobileInput).first();
          if (await mob.isVisible().catch(() => false)) {
            await mob.fill("");
            await mob.fill(run.credentials.extra.mobile);
            await page.locator(SEL.saveBasic).first().press("Enter");
          }
        }
      }

      // Resume upload
      await page.goto(NAUKRI_PROFILE_URL, { waitUntil: "domcontentloaded" });
      await safeClick(page, SEL.closeIcon, 5000);

      const fileInput = page
        .locator(`${SEL.attachCV}, ${SEL.lazyAttachCV}, ${SEL.uploadCVInput}`)
        .first();
      await fileInput.setInputFiles(run.resumePath);

      run.logger("Naukri: resume file submitted");
      return true;
    } catch (err) {
      run.logger(`Naukri upload error: ${String(err)}`);
      return false;
    }
  },

  async verifyUpdate(ctx, run) {
    const page = ctx.pages()[0];
    if (!page) return false;
    try {
      await page.locator(SEL.updateOn).first().waitFor({ state: "visible", timeout: 30000 });
      const text = (await page.locator(SEL.updateOn).first().innerText()).trim();
      const ok = today().some((d) => text.includes(d));
      run.logger(`Naukri: last updated = "${text}" (verified=${ok})`);
      return ok;
    } catch (err) {
      run.logger(`Naukri verify error: ${String(err)}`);
      return false;
    }
  },

  async logout(ctx, run) {
    const page = ctx.pages()[0];
    if (!page) return true;
    try {
      await safeClick(page, SEL.drawerIcon, 3000);
      const clicked = await safeClick(page, SEL.logoutLink, 3000);
      run.logger(clicked ? "Naukri: logout successful" : "Naukri: logout button not found");
      await page.close().catch(() => {});
      return clicked;
    } catch (err) {
      run.logger(`Naukri logout error: ${String(err)}`);
      return false;
    }
  },
};
