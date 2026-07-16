/**
 * Auth server functions — exchange verified Google ID token for an app session.
 */

import { createServerFn } from "@tanstack/react-start";
import { loginWithGoogleIdToken, requireSessionUser } from "@/security/serverAuth";

export const loginWithGoogle = createServerFn({ method: "POST" })
  .inputValidator((data: { idToken: string }) => data)
  .handler(async ({ data }) => {
    const result = await loginWithGoogleIdToken(data.idToken);
    return {
      user: result.user,
      sessionToken: result.sessionToken,
    };
  });

/** Refresh profile from DB using the signed session (no client-trusted user object). */
export const refreshSessionUser = createServerFn({ method: "GET" })
  .inputValidator((data: { sessionToken: string }) => data)
  .handler(async ({ data }) => {
    const user = await requireSessionUser(data.sessionToken);
    return { user };
  });
