import { getSessionToken } from "../../../src/auth/googleAuth";
import type { MapProfile } from "../components/FreelancerMap";
import type { FreelancerProfile } from "../../../src/routes/freelancers.functions";

function requiredSessionToken() {
  const token = getSessionToken();
  if (!token) throw new Error("Please sign in with your DailyResume Google account to continue.");
  return token;
}

export async function loadFavoriteProfileIds() {
  const { listFreelancerFavorites } = await import("../../../src/routes/freelancers.functions");
  return listFreelancerFavorites({ data: { sessionToken: requiredSessionToken() } });
}

export async function updateFavorite(profileId: string, favorite: boolean) {
  const { setFreelancerFavorite } = await import("../../../src/routes/freelancers.functions");
  return setFreelancerFavorite({ data: { sessionToken: requiredSessionToken(), profileId, favorite } });
}

export async function saveProfile(profile: unknown) {
  const { saveMyFreelancerProfile } = await import("../../../src/routes/freelancers.functions");
  return saveMyFreelancerProfile({ data: { sessionToken: requiredSessionToken(), profile } });
}

export async function uploadImage(file: File) {
  const { uploadFreelancerMedia } = await import("../../../src/routes/freelancers.functions");
  const bytes = new Uint8Array(await file.arrayBuffer());
  let binary = "";
  const chunkSize = 0x8000;
  for (let offset = 0; offset < bytes.length; offset += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + chunkSize));
  }
  return uploadFreelancerMedia({
    data: {
      sessionToken: requiredSessionToken(),
      filename: file.name,
      contentType: file.type,
      base64: btoa(binary),
    },
  });
}

export async function addPortfolioItem(item: unknown) {
  const { addFreelancerPortfolioItem } = await import("../../../src/routes/freelancers.functions");
  return addFreelancerPortfolioItem({ data: { sessionToken: requiredSessionToken(), item } });
}

export async function loadPortfolio(profileId: string) {
  const { listFreelancerPortfolio } = await import("../../../src/routes/freelancers.functions");
  return listFreelancerPortfolio({ data: { profileId } });
}

export async function loadProfileActivity(profileId: string) {
  const { getFreelancerProfileActivity } = await import("../../../src/routes/freelancers.functions");
  const token = getSessionToken() ?? undefined;
  return getFreelancerProfileActivity({ data: token ? { profileId, sessionToken: token } : { profileId } });
}

export async function saveReaction(profileId: string, value: 1 | -1 | null) {
  const { setFreelancerReaction } = await import("../../../src/routes/freelancers.functions");
  return setFreelancerReaction({ data: { sessionToken: requiredSessionToken(), profileId, value } });
}

export async function postComment(profileId: string, body: string) {
  const { addFreelancerComment } = await import("../../../src/routes/freelancers.functions");
  return addFreelancerComment({ data: { sessionToken: requiredSessionToken(), profileId, body } });
}

export async function removeComment(profileId: string, commentId: string) {
  const { deleteFreelancerComment } = await import("../../../src/routes/freelancers.functions");
  return deleteFreelancerComment({ data: { sessionToken: requiredSessionToken(), profileId, commentId } });
}

export function toAtlasworkProfile(profile: FreelancerProfile): MapProfile {
  return {
    id: profile.user_id,
    username: profile.username,
    full_name: profile.full_name,
    headline: profile.headline,
    bio: profile.bio,
    avatar_url: profile.avatar_url,
    latitude: profile.latitude,
    longitude: profile.longitude,
    location_name: profile.location_name,
    tags: profile.tags,
    services: profile.services,
    starting_price: profile.starting_price,
    currency: profile.currency,
    is_available: profile.is_available,
    is_listed: profile.is_listed,
    contact_email: profile.contact_email,
    linkedin_url: profile.linkedin_url,
    instagram_url: profile.instagram_url,
    whatsapp_number: profile.whatsapp_number,
    telegram_id: profile.telegram_id,
    address: profile.address,
    show_address: profile.show_address,
    github_repos: profile.github_repos,
    country: profile.country,
  };
}

export async function loadListedAtlasworkProfiles() {
  const { listFreelancerProfiles } = await import("../../../src/routes/freelancers.functions");
  return (await listFreelancerProfiles()).map(toAtlasworkProfile);
}

export async function loadMyAtlasworkProfile() {
  const { getMyFreelancerProfile } = await import("../../../src/routes/freelancers.functions");
  const result = await getMyFreelancerProfile({ data: { sessionToken: requiredSessionToken() } });
  return { user: result.user, profile: result.profile ? toAtlasworkProfile(result.profile as FreelancerProfile) : null };
}