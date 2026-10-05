import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { getSupabaseServer } from "@/lib/supabase";
import { requireSessionUser } from "@/security/serverAuth";

const profileSchema = z.object({
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
}).refine((item) => (item.latitude === null) === (item.longitude === null))
  .refine((item) => !item.is_listed || item.latitude !== null);

const portfolioSchema = z.object({
  title: z.string().trim().min(1).max(80),
  category: z.string().trim().max(100),
  client_name: z.string().trim().max(120),
  completion_year: z.number().int().min(1900).max(2100).nullable(),
  project_url: z.string().trim().max(2048),
  description: z.string().trim().max(3000),
  tools: z.array(z.string().trim().min(1).max(80)).max(30),
  results: z.string().trim().max(2000),
  image_urls: z.array(z.string().url().max(2048)).min(1).max(8),
});

export type FreelancerProfile = z.infer<typeof profileSchema> & {
  user_id: string;
  created_at: string;
  updated_at: string;
};

async function requireProfileOwner(sessionToken: string, profileId: string) {
  const user = await requireSessionUser(sessionToken);
  if (user.id !== profileId) throw new Error("You can only manage your own freelancer profile.");
  return user;
}

async function requireListedProfile(profileId: string) {
  const { data, error } = await getSupabaseServer().from("freelancer_profiles")
    .select("is_listed").eq("user_id", profileId).maybeSingle();
  if (error) throw new Error(`Could not verify freelancer profile: ${error.message}`);
  if (!data?.is_listed) throw new Error("This freelancer profile is not public.");
}

export const listFreelancerProfiles = createServerFn({ method: "GET" }).handler(async () => {
  const client = getSupabaseServer();
  const profiles: Record<string, any>[] = [];
  const size = 1000;
  for (let offset = 0; ; offset += size) {
    const { data, error } = await client.from("freelancer_profiles").select("*")
      .eq("is_listed", true).not("latitude", "is", null).not("longitude", "is", null)
      .order("user_id", { ascending: true }).range(offset, offset + size - 1);
    if (error) throw new Error(`Could not load freelancer profiles: ${error.message}`);
    profiles.push(...(data ?? []));
    if (!data || data.length < size) break;
  }
  return profiles.map((profile) => ({ ...profile, address: profile.show_address ? profile.address : "" })) as FreelancerProfile[];
});

export const getMyFreelancerProfile = createServerFn({ method: "POST" })
  .inputValidator((data: { sessionToken: string }) => data)
  .handler(async ({ data }) => {
    const user = await requireSessionUser(data.sessionToken);
    const { data: profile, error } = await getSupabaseServer().from("freelancer_profiles")
      .select("*").eq("user_id", user.id).maybeSingle();
    if (error) throw new Error(`Could not load your profile: ${error.message}`);
    return { user: { id: user.id, name: user.name, email: user.email, profile_image: user.profile_image }, profile };
  });

export const saveMyFreelancerProfile = createServerFn({ method: "POST" })
  .inputValidator((data: { sessionToken: string; profile: unknown }) => ({
    sessionToken: z.string().min(1).parse(data.sessionToken),
    profile: profileSchema.parse(data.profile),
  }))
  .handler(async ({ data }) => {
    const user = await requireSessionUser(data.sessionToken);
    const { data: profile, error } = await getSupabaseServer().from("freelancer_profiles")
      .upsert({ ...data.profile, user_id: user.id }, { onConflict: "user_id" }).select("*").single();
    if (error) throw new Error(`Could not save your profile: ${error.message}`);
    return profile as FreelancerProfile;
  });

export const listFreelancerFavorites = createServerFn({ method: "POST" })
  .inputValidator((data: { sessionToken: string }) => data)
  .handler(async ({ data }) => {
    const user = await requireSessionUser(data.sessionToken);
    const { data: favorites, error } = await getSupabaseServer().from("freelancer_favorites")
      .select("profile_id").eq("user_id", user.id);
    if (error) throw new Error(`Could not load favorites: ${error.message}`);
    return (favorites ?? []).map((row) => row.profile_id as string);
  });

export const setFreelancerFavorite = createServerFn({ method: "POST" })
  .inputValidator((data: { sessionToken: string; profileId: string; favorite: boolean }) => data)
  .handler(async ({ data }) => {
    const user = await requireSessionUser(data.sessionToken);
    await requireListedProfile(data.profileId);
    const db = getSupabaseServer();
    const result = data.favorite
      ? await db.from("freelancer_favorites").upsert({ user_id: user.id, profile_id: data.profileId })
      : await db.from("freelancer_favorites").delete().eq("user_id", user.id).eq("profile_id", data.profileId);
    if (result.error) throw new Error(`Could not update favorite: ${result.error.message}`);
    return { ok: true };
  });

export const listFreelancerPortfolio = createServerFn({ method: "GET" })
  .inputValidator((data: { profileId: string }) => data)
  .handler(async ({ data }) => {
    await requireListedProfile(data.profileId);
    const { data: items, error } = await getSupabaseServer().from("freelancer_portfolio_items")
      .select("*").eq("profile_id", data.profileId).order("sort_order");
    if (error) throw new Error(`Could not load portfolio: ${error.message}`);
    return items ?? [];
  });

export const addFreelancerPortfolioItem = createServerFn({ method: "POST" })
  .inputValidator((data: { sessionToken: string; item: unknown }) => ({
    sessionToken: z.string().min(1).parse(data.sessionToken),
    item: portfolioSchema.parse(data.item),
  }))
  .handler(async ({ data }) => {
    const user = await requireSessionUser(data.sessionToken);
    const { data: item, error } = await getSupabaseServer().from("freelancer_portfolio_items").insert({
      profile_id: user.id,
      ...data.item,
      image_url: data.item.image_urls[0],
      sort_order: Date.now(),
    }).select("*").single();
    if (error) throw new Error(`Could not add portfolio item: ${error.message}`);
    return item;
  });

export const uploadFreelancerMedia = createServerFn({ method: "POST" })
  .inputValidator((data: { sessionToken: string; filename: string; contentType: string; base64: string }) => data)
  .handler(async ({ data }) => {
    const user = await requireSessionUser(data.sessionToken);
    const mimeToExtension: Record<string, string> = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" };
    const extension = mimeToExtension[data.contentType];
    if (!extension || data.base64.length > 11_200_000) throw new Error("Choose a JPG, PNG, or WebP image under 8 MB.");
    const bytes = Buffer.from(data.base64, "base64");
    if (bytes.length > 8 * 1024 * 1024) throw new Error("Image exceeds 8 MB.");
    const path = `${user.id}/${crypto.randomUUID()}.${extension}`;
    const { error } = await getSupabaseServer().storage.from("freelancer-media").upload(path, bytes, {
      contentType: data.contentType, upsert: false,
    });
    if (error) throw new Error(`Could not upload image: ${error.message}`);
    return getSupabaseServer().storage.from("freelancer-media").getPublicUrl(path).data.publicUrl;
  });

export const getFreelancerProfileActivity = createServerFn({ method: "POST" })
  .inputValidator((data: { profileId: string; sessionToken?: string }) => data)
  .handler(async ({ data }) => {
    const db = getSupabaseServer();
    let viewerId: string | null = null;
    if (data.sessionToken) viewerId = (await requireSessionUser(data.sessionToken)).id;
    if (viewerId !== data.profileId) await requireListedProfile(data.profileId);
    const [{ data: reactions, error: reactionError }, { data: comments, error: commentError }] = await Promise.all([
      db.from("freelancer_profile_reactions").select("user_id,value").eq("profile_id", data.profileId),
      db.from("freelancer_profile_comments").select("id,author_id,body,created_at").eq("profile_id", data.profileId).order("created_at", { ascending: false }),
    ]);
    if (reactionError) throw new Error(`Could not load reactions: ${reactionError.message}`);
    if (commentError) throw new Error(`Could not load comments: ${commentError.message}`);
    const authorsIds = [...new Set((comments ?? []).map((row) => row.author_id))];
    const { data: authors, error: authorsError } = authorsIds.length
      ? await db.from("freelancer_profiles").select("user_id,full_name,username,avatar_url").in("user_id", authorsIds)
      : { data: [], error: null };
    if (authorsError) throw new Error(`Could not load comment authors: ${authorsError.message}`);
    const userReactions = reactions ?? [];
    return {
      likes: userReactions.filter((row) => row.value === 1).length,
      dislikes: userReactions.filter((row) => row.value === -1).length,
      myVote: (userReactions.find((row) => row.user_id === viewerId)?.value ?? null) as 1 | -1 | null,
      comments: (comments ?? []).map((row) => {
        const author = (authors ?? []).find((item) => item.user_id === row.author_id);
        return { ...row, author_name: author?.full_name || (author?.username ? `@${author.username}` : "Someone"), author_avatar: author?.avatar_url ?? null };
      }),
    };
  });

export const setFreelancerReaction = createServerFn({ method: "POST" })
  .inputValidator((data: { sessionToken: string; profileId: string; value: 1 | -1 | null }) => data)
  .handler(async ({ data }) => {
    const user = await requireSessionUser(data.sessionToken);
    await requireListedProfile(data.profileId);
    const db = getSupabaseServer();
    const result = data.value === null
      ? await db.from("freelancer_profile_reactions").delete().eq("profile_id", data.profileId).eq("user_id", user.id)
      : await db.from("freelancer_profile_reactions").upsert({ profile_id: data.profileId, user_id: user.id, value: data.value }, { onConflict: "profile_id,user_id" });
    if (result.error) throw new Error(`Could not save reaction: ${result.error.message}`);
    return { ok: true };
  });

export const addFreelancerComment = createServerFn({ method: "POST" })
  .inputValidator((data: { sessionToken: string; profileId: string; body: string }) => ({ ...data, body: z.string().trim().min(1).max(1000).parse(data.body) }))
  .handler(async ({ data }) => {
    const user = await requireSessionUser(data.sessionToken);
    await requireListedProfile(data.profileId);
    const { error } = await getSupabaseServer().from("freelancer_profile_comments").insert({ profile_id: data.profileId, author_id: user.id, body: data.body });
    if (error) throw new Error(`Could not post comment: ${error.message}`);
    return { ok: true };
  });

export const deleteFreelancerComment = createServerFn({ method: "POST" })
  .inputValidator((data: { sessionToken: string; commentId: string; profileId: string }) => data)
  .handler(async ({ data }) => {
    const user = await requireSessionUser(data.sessionToken);
    const db = getSupabaseServer();
    const { data: comment, error: readError } = await db.from("freelancer_profile_comments").select("author_id").eq("id", data.commentId).eq("profile_id", data.profileId).maybeSingle();
    if (readError) throw new Error(`Could not verify comment: ${readError.message}`);
    if (!comment) throw new Error("Comment not found.");
    const { data: profile, error: profileError } = await db.from("freelancer_profiles").select("user_id").eq("user_id", data.profileId).maybeSingle();
    if (profileError) throw new Error(`Could not verify profile: ${profileError.message}`);
    if (comment.author_id !== user.id && profile?.user_id !== user.id) throw new Error("You cannot delete this comment.");
    const { error } = await db.from("freelancer_profile_comments").delete().eq("id", data.commentId);
    if (error) throw new Error(`Could not delete comment: ${error.message}`);
    return { ok: true };
  });