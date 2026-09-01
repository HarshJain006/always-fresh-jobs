/**

 * Unified wrong-password email trigger (Pi worker + Netlify).

 * Always queues in Supabase first, then sends via local Resend or Netlify mail-queue flush.

 */



import { isCredentialFailureMessage } from "@/queue/jobErrors";

import { sendCredentialFailureEmail } from "./credentialFailureEmail";

import {

  queueCredentialFailureEmail,

  requestMailQueueFlush,

} from "./credentialFailureQueue";

import { isResendConfigured } from "./resendMailer";

import { isSupabaseServerConfigured } from "@/lib/supabase";



const FLUSH_ATTEMPTS = 5;

const FLUSH_DELAY_MS = 2000;



async function sleep(ms: number): Promise<void> {

  await new Promise((resolve) => setTimeout(resolve, ms));

}



async function requestMailQueueFlushWithRetry(): Promise<boolean> {

  for (let attempt = 1; attempt <= FLUSH_ATTEMPTS; attempt++) {

    const ok = await requestMailQueueFlush();

    if (ok) return true;

    if (attempt < FLUSH_ATTEMPTS) await sleep(FLUSH_DELAY_MS * attempt);

  }

  console.error(

    "[mail] credential email queued but mail-queue flush failed after retries. " +

      "Queued row will retry on next worker flush or: npm run mail:flush-queue",

  );

  return false;

}



/**

 * Call after writing a wrong-password row to automation_logs.

 * Pass both raw backend message and user-facing log text when available.

 */

export async function notifyCredentialFailure(

  userId: string,

  logId: string,

  rawMessage: string,

  userFacingMessage?: string,

): Promise<void> {

  const probe = [rawMessage, userFacingMessage].filter(Boolean).join("\n");

  if (!isCredentialFailureMessage(probe)) {

    console.warn(

      `[mail] credential notify skipped — message not classified as wrong password user=${userId}`,

    );

    return;

  }



  if (!isSupabaseServerConfigured()) {

    console.warn(`[mail] credential notify skipped — Supabase not configured user=${userId}`);

    return;

  }



  let needsDelivery = false;

  try {

    needsDelivery = await queueCredentialFailureEmail(userId, logId, probe);

  } catch (err) {

    console.error(

      `[mail] credential queue failed user=${userId} log=${logId}:`,

      err instanceof Error ? err.message : err,

    );

    return;

  }



  if (!needsDelivery) return;



  if (isResendConfigured()) {

    await sendCredentialFailureEmail(userId, logId, probe);

    return;

  }



  await requestMailQueueFlushWithRetry();

}


