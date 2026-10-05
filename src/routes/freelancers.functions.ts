import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSessionUser } from "@/security/serverAuth";
import { getSupabaseServer } from "@/lib/supabase";

const profileInput = z.object({
  username: z.string().trim().min(2).max(40).regex(/^[a-zA-Z0-9_-]+$/),
  full_name: z.string().trim().min(1).max(100),
  headline: z.string().trim().max(120),
  bio: z.string().trim().max(2000),
  avatar_url: z.string().url().max(2048).nullable(),
  location_name: z.string().trim().max(120),
  country: z.string().trim().max(100),
  latitude: z.number().min(-90).max(90).nullable(),
  longitude: z.number().min(-180).max(180).nullable(),
  tags: z.array(z.string().trim().min(1).max(40)).max(30),
  services: z.array(z.string().trim().min(1).max(80)).max(30),
  starting_price: z.number().nonnegative().max(100_000_000).nullable(),
  currency: z.string().regex(/^[A-Z]{3}$/),
  contact_email: z.union([z.literal(""), z.string().email().max(254)]),
  linkedin_url: z.string().trim().max(2048),
  instagram_url: z.string().trim().max(2048),
  whatsapp_number: z.string().trim().max(40),
  telegram_id: z.string().trim().max(80),
  address: z.string().trim().max(250),
  show_address: z.boolean(),
  github_repos: z.array(z.string().trim().min(1).max(2048)).max(20),
  website_url: z.string().trim().max(2048),
  is_available: z.boolean(),
  is_listed: z.boolean(),
}).refine((profile) => (profile.latitude === null) === (profile.longitude === null), {
  message: "Latitude and longitude must be provided together.",
}).refine((profile) => !profile.is_listed || (profile.latitude !== null && profile.longitude !== null), {
  message: "A listed freelancer profile must include a map location.",
});

export type FreelancerProfile = z.infer<typeof profileInput> & {
  user_id: string;
  created_at: string;
  updated_at: string;
};

export const listFreelancerProfiles = createServerFn({ method: "GET" }).handler(async () => {
  const client = getSupabaseServer();
  const pageSize = 1000;
  const rows: Record<string, any>[] = [];
  for (let offset = 0; ; offset += pageSize) {
    const { data, error } = await client
      .from("freelancer_profiles")
      .select("*")
      .eq("is_listed", true)
      .not("latitude", "is", null)
      .not("longitude", "is", null)
      .order("user_id", { ascending: true })
      .range(offset, offset + pageSize - 1);
    if (error) throw new Error(`Could not load freelancer profiles: ${error.message}`);
    rows.push(...(data ?? []));
    if (!data || data.length < pageSize) break;
  }
  return rows.map((profile) => ({
    ...profile,
    address: profile.show_address ? profile.address : "",
  })) as FreelancerProfile[];
});

export const getMyFreelancerProfile = createServerFn({ method: "POST" })
  .inputValidator((data: { sessionToken: string }) => data)
  .handler(async ({ data }) => {
    const user = await requireSessionUser(data.sessionToken);
    const { data: profile, error } = await getSupabaseServer()
      .from("freelancer_profiles")
      .select("*")
      .eq("user_id", user.id)
      .maybeSingle();
    if (error) throw new Error(`Could not load your freelancer profile: ${error.message}`);
    return {
      user: { id: user.id, name: user.name, profile_image: user.profile_image },
      profile: profile as FreelancerProfile | null,
    };
  });

export const saveMyFreelancerProfile = createServerFn({ method: "POST" })
  .inputValidator((data: { sessionToken: string; profile: unknown }) => ({
    sessionToken: z.string().min(1).parse(data.sessionToken),
    profile: profileInput.parse(data.profile),
  }))
  .handler(async ({ data }) => {
    const user = await requireSessionUser(data.sessionToken);
    const { data: profile, error } = await getSupabaseServer()
      .from("freelancer_profiles")
      .upsert({ ...data.profile, user_id: user.id }, { onConflict: "user_id" })
      .select("*")
      .single();
    if (error) throw new Error(`Could not save your freelancer profile: ${error.message}`);
    return profile as FreelancerProfile;
  });