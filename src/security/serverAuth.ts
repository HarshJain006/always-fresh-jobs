/**
 * Server-side identity — Google ID token verification + signed app sessions.
 * Never trust client-supplied user IDs without a verified session.
 */

import { createHmac, timingSafeEqual } from "node:crypto";
import type { User } from "@/database/schemas";
import { createUser, findUserByGoogleId, reconcileUserAccess } from "@/database/users";

const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days
const GOOGLE_ISSUERS = new Set(["https://accounts.google.com", "accounts.google.com"]);

export type VerifiedGoogleProfile = {
  google_user_id: string;
  email: string;
  name: string;
  profile_image: string;
  email_verified: boolean;
};

type SessionPayload = {
  uid: string;
  gid: string;
  exp: number;
};

function getClientId(): string {
  return (
    process.env.VITE_GOOGLE_CLIENT_ID ||
    process.env.REACT_APP_GOOGLE_CLIENT_ID ||
    process.env.GOOGLE_CLIENT_ID ||
    ""
  ).trim();
}

function getSessionSecret(): string {
  const secret = process.env.SESSION_SECRET || process.env.ENCRYPTION_KEY || "";
  if (!secret || secret.length < 32) {
    throw new Error(
      "SESSION_SECRET or ENCRYPTION_KEY (32+ chars) must be set on the server. Refusing weak sessions.",
    );
  }
  if (secret.includes("dailyresume-dev-only")) {
    throw new Error("Refusing default/dev encryption secret in session signing.");
  }
  return secret;
}

function b64url(input: Buffer | string): string {
  const buf = typeof input === "string" ? Buffer.from(input, "utf8") : input;
  return buf.toString("base64url");
}

function fromB64url(input: string): Buffer {
  return Buffer.from(input, "base64url");
}

/** Verify Google ID token via Google's tokeninfo endpoint (aud/iss/exp checked). */
export async function verifyGoogleIdToken(idToken: string): Promise<VerifiedGoogleProfile> {
  if (!idToken || idToken.length < 20) {
    throw new Error("Missing Google ID token.");
  }

  const clientId = getClientId();
  if (!clientId) {
    throw new Error("GOOGLE_CLIENT_ID / VITE_GOOGLE_CLIENT_ID is not configured on the server.");
  }

  const url = `https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(idToken)}`;
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error("Invalid or expired Google sign-in. Please sign in again.");
  }

  const data = (await res.json()) as Record<string, string>;
  if (data.aud !== clientId) {
    throw new Error("Google token audience mismatch.");
  }
  if (!GOOGLE_ISSUERS.has(data.iss || "")) {
    throw new Error("Google token issuer mismatch.");
  }
  const exp = Number(data.exp || 0) * 1000;
  if (!exp || exp < Date.now()) {
    throw new Error("Google sign-in expired. Please sign in again.");
  }
  if (!data.sub || !data.email) {
    throw new Error("Google token missing required profile claims.");
  }
  if (data.email_verified === "false") {
    throw new Error("Please verify your Google email before continuing.");
  }

  return {
    google_user_id: `google-oauth2|${data.sub}`,
    email: String(data.email),
    name:
      data.name ||
      `${data.given_name || ""} ${data.family_name || ""}`.trim() ||
      String(data.email),
    profile_image: data.picture || "",
    email_verified: data.email_verified !== "false",
  };
}

export function mintAppSession(user: User): string {
  const payload: SessionPayload = {
    uid: user.id,
    gid: user.google_user_id,
    exp: Date.now() + SESSION_TTL_MS,
  };
  const body = b64url(JSON.stringify(payload));
  const sig = createHmac("sha256", getSessionSecret()).update(body).digest();
  return `${body}.${b64url(sig)}`;
}

export function verifyAppSession(token: string): SessionPayload {
  if (!token || !token.includes(".")) {
    throw new Error("Not signed in. Please sign in with Google.");
  }
  const [body, sigB64] = token.split(".");
  if (!body || !sigB64) throw new Error("Invalid session.");

  const expected = createHmac("sha256", getSessionSecret()).update(body).digest();
  const actual = fromB64url(sigB64);
  if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) {
    throw new Error("Invalid session signature. Please sign in again.");
  }

  const payload = JSON.parse(fromB64url(body).toString("utf8")) as SessionPayload;
  if (!payload.uid || !payload.gid || !payload.exp) {
    throw new Error("Invalid session payload.");
  }
  if (payload.exp < Date.now()) {
    throw new Error("Session expired. Please sign in again.");
  }
  return payload;
}

/**
 * Resolve the authenticated DB user from an app session token.
 * Optionally accept a fresh Google idToken to mint/refresh (login path).
 */
export async function requireSessionUser(sessionToken: string): Promise<User> {
  const session = verifyAppSession(sessionToken);
  const byGoogle = await findUserByGoogleId(session.gid);
  if (!byGoogle || byGoogle.id !== session.uid) {
    throw new Error("Session does not match your account. Please sign in again.");
  }
  if (byGoogle.account_status !== "active") {
    throw new Error("Your account is not active.");
  }
  return reconcileUserAccess(byGoogle);
}

/** Login: verify Google token → create/find user → mint app session. */
export async function loginWithGoogleIdToken(idToken: string): Promise<{
  user: User;
  sessionToken: string;
}> {
  const profile = await verifyGoogleIdToken(idToken);
  const user = await createUser({
    google_user_id: profile.google_user_id,
    email: profile.email,
    name: profile.name,
    profile_image: profile.profile_image,
  });
  const reconciled = await reconcileUserAccess(user);
  return {
    user: reconciled,
    sessionToken: mintAppSession(reconciled),
  };
}

/** Public profile fields safe to send to the client (no secrets). */
export function publicUserView(user: User): User {
  return { ...user };
}
