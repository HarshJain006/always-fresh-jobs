/**
 * Data model interfaces. These are the source of truth for the whole app.
 * When you connect a real DB, mirror these in your schema/migrations.
 */

export type SubscriptionStatus = "trial" | "active" | "expired" | "cancelled";
export type AccountStatus = "active" | "suspended" | "deleted";
export type SubscriptionPlan = "free_trial" | "premium_monthly";

export interface User {
  id: string;
  google_user_id: string;
  email: string;
  name: string;
  profile_image: string;
  created_at: string;
  trial_started_at: string;
  trial_expire_at: string;
  trial_used: boolean;
  subscription_status: SubscriptionStatus;
  subscription_plan: SubscriptionPlan | null;
  subscription_started_at: string | null;
  subscription_expire_at: string | null;
  account_status: AccountStatus;
}

export interface Subscription {
  id: string;
  user_id: string;
  plan: SubscriptionPlan;
  status: SubscriptionStatus;
  started_at: string;
  expire_at: string;
  razorpay_subscription_id: string | null;
}

export interface Payment {
  id: string;
  user_id: string;
  amount_paise: number;
  currency: "INR";
  status: "created" | "authorized" | "captured" | "failed" | "refunded";
  razorpay_payment_id: string | null;
  created_at: string;
}

export interface Resume {
  id: string;
  user_id: string;
  file_name: string;
  file_size_bytes: number;
  storage_path: string;
  uploaded_at: string;
}

export type PlatformId = "naukri" | "indeed" | "linkedin";

export interface ConnectedPlatform {
  id: string;
  user_id: string;
  platform: PlatformId;
  connected_at: string;
  encrypted_credentials: string; // encrypted blob
  last_run_at: string | null;
  last_run_ok: boolean | null;
}

export interface AutomationLog {
  id: string;
  user_id: string;
  platform: PlatformId;
  ok: boolean;
  message: string;
  created_at: string;
}
