import { ClientOnly, createFileRoute, Link } from "@tanstack/react-router";
import { lazy, Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { Globe2, LocateFixed, LogOut, MapPin, Pencil, Search, Sparkles, UserRound, X } from "lucide-react";
import { toast } from "sonner";
import { getSessionToken, getCurrentUser, AUTH_CHANGE_EVENT, STORAGE_KEY, logoutUser } from "@/auth/googleAuth";
import { Button } from "@/components/ui/button";
import { listFreelancerProfiles, getMyFreelancerProfile, saveMyFreelancerProfile, type FreelancerProfile } from "@/routes/freelancers.functions";
import type { MapProfile } from "../../find-my-freelance-map/src/components/FreelancerMap";
import "@/styles/freelancers.css";

const FreelancerMap = lazy(() => import("../../find-my-freelance-map/src/components/FreelancerMap").then((module) => ({ default: module.FreelancerMap })));

export const Route = createFileRoute("/freelancers")({
  loader: async () => {
    try {
      return await listFreelancerProfiles();
    } catch (error) {
      console.error("Could not load freelancer profiles for server rendering:", error);
      return [] as FreelancerProfile[];
    }
  },
  head: () => ({
    meta: [
      { title: "Freelancer Directory & Global Freelance Map | Atlaswork" },
      {
        name: "description",
        content: "Find freelancers worldwide on Atlaswork. Explore independent professionals by skill, service, location, availability, and pricing.",
      },
      { name: "robots", content: "index, follow, max-image-preview:large" },
      { property: "og:title", content: "Freelancer Directory & Global Freelance Map | Atlaswork" },
      {
        property: "og:description",
        content: "Discover independent professionals around the world by their skills, services, and location.",
      },
      { property: "og:type", content: "website" },
      { property: "og:url", content: "https://dailyresume.in/freelancers" },
      { name: "twitter:card", content: "summary" },
    ],
    links: [{ rel: "canonical", href: "https://dailyresume.in/freelancers" }],
  }),
  component: FreelancersPage,
});

function FreelancersPage() {
  const loaderProfiles = Route.useLoaderData();
  const [profiles, setProfiles] = useState<FreelancerProfile[]>(loaderProfiles);
  const [myProfile, setMyProfile] = useState<FreelancerProfile | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [country, setCountry] = useState("all");
  const [selected, setSelected] = useState<FreelancerProfile | null>(null);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [location, setLocation] = useState<{ latitude: number; longitude: number } | null>(null);
  const [viewTarget, setViewTarget] = useState<{ center: [number, number]; zoom: number; key: string }>();

  const refresh = useCallback(async (reloadDirectory = true) => {
    setLoading(true);
    if (reloadDirectory) {
      try {
        const listed = await listFreelancerProfiles();
        setProfiles(listed);
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Could not load the freelancer directory.");
      }
    }
    const token = getSessionToken();
    const user = getCurrentUser();
    setUserId(user?.id ?? null);
    if (token && user) {
      try {
        const mine = await getMyFreelancerProfile({ data: { sessionToken: token } });
        setMyProfile(mine.profile);
      } catch {
        setMyProfile(null);
      }
    } else {
      setMyProfile(null);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    setProfiles(loaderProfiles);
  }, [loaderProfiles]);

  useEffect(() => {
    void refresh(false);
    const sync = () => void refresh();
    const storage = (event: StorageEvent) => {
      if (event.key === STORAGE_KEY || event.key === null) sync();
    };
    window.addEventListener(AUTH_CHANGE_EVENT, sync);
    window.addEventListener("storage", storage);
    window.addEventListener("focus", sync);
    return () => {
      window.removeEventListener(AUTH_CHANGE_EVENT, sync);
      window.removeEventListener("storage", storage);
      window.removeEventListener("focus", sync);
    };
  }, [refresh]);

  const visible = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    return profiles.filter((profile) => {
      if (country !== "all" && profile.country !== country) return false;
      return !normalized || [profile.full_name, profile.username, profile.headline, profile.location_name, profile.country, ...profile.tags, ...profile.services].join(" ").toLowerCase().includes(normalized);
    });
  }, [profiles, query, country]);

  const countries = useMemo(() => [...new Set(profiles.map((profile) => profile.country).filter(Boolean))].sort(), [profiles]);

  const atlasProfiles = useMemo<MapProfile[]>(() => visible.map((profile) => ({
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
  })), [visible]);

  async function saveProfile(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const token = getSessionToken();
    if (!token) {
      toast.error("Sign in with Google to publish your freelancer profile.");
      return;
    }
    const form = new FormData(event.currentTarget);
    const number = (name: string) => {
      const value = String(form.get(name) ?? "").trim();
      return value ? Number(value) : null;
    };
    const latitude = location?.latitude ?? myProfile?.latitude ?? null;
    const longitude = location?.longitude ?? myProfile?.longitude ?? null;
    const profile = {
      username: String(form.get("username") ?? "").trim(),
      full_name: String(form.get("full_name") ?? "").trim(),
      headline: String(form.get("headline") ?? "").trim(),
      bio: String(form.get("bio") ?? "").trim(),
      avatar_url: myProfile?.avatar_url ?? getCurrentUser()?.profile_image ?? null,
      location_name: String(form.get("location_name") ?? "").trim(),
      country: String(form.get("country") ?? "").trim(),
      latitude,
      longitude,
      tags: splitList(String(form.get("tags") ?? "")),
      services: splitList(String(form.get("services") ?? "")),
      starting_price: number("starting_price"),
      currency: String(form.get("currency") ?? "USD").trim().toUpperCase(),
      contact_email: String(form.get("contact_email") ?? "").trim(),
      linkedin_url: String(form.get("linkedin_url") ?? "").trim(),
      instagram_url: String(form.get("instagram_url") ?? "").trim(),
      whatsapp_number: String(form.get("whatsapp_number") ?? "").trim(),
      telegram_id: String(form.get("telegram_id") ?? "").trim(),
      address: String(form.get("address") ?? "").trim(),
      show_address: form.get("show_address") === "on",
      github_repos: splitList(String(form.get("github_repos") ?? "")),
      website_url: String(form.get("website_url") ?? "").trim(),
      is_available: form.get("is_available") === "on",
      is_listed: form.get("is_listed") === "on",
    };
    if (profile.is_listed && (latitude == null || longitude == null)) {
      toast.error("Choose a location on the map before publishing.");
      return;
    }
    setSaving(true);
    try {
      await saveMyFreelancerProfile({ data: { sessionToken: token, profile } });
      setEditing(false);
      setLocation(null);
      await refresh();
      toast.success("Freelancer profile saved.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not save your profile.");
    } finally {
      setSaving(false);
    }
  }

  function locateMe() {
    if (!navigator.geolocation) {
      toast.error("Location access is not available in this browser.");
      return;
    }
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => setLocation({ latitude: coords.latitude, longitude: coords.longitude }),
      () => toast.error("Could not get your location. Click the map to choose it instead."),
      { enableHighAccuracy: true, timeout: 12000 },
    );
    setEditing(true);
  }

  async function changeCountry(next: string) {
    setCountry(next);
    if (next === "all") {
      setViewTarget({ center: [20, 0], zoom: 2.4, key: "all" });
      return;
    }
    const first = profiles.find((profile) => profile.country === next && profile.latitude != null && profile.longitude != null);
    if (first?.latitude != null && first.longitude != null) {
      setViewTarget({ center: [first.latitude, first.longitude], zoom: 5, key: `country-${next}` });
      return;
    }
    try {
      const response = await fetch(`https://nominatim.openstreetmap.org/search?format=json&limit=1&country=${encodeURIComponent(next)}`);
      const result = (await response.json()) as { lat: string; lon: string }[];
      if (result[0]) setViewTarget({ center: [Number(result[0].lat), Number(result[0].lon)], zoom: 5, key: `country-${next}` });
    } catch {
      // Keep the current globe view if geocoding is unavailable.
    }
  }

  const editingProfile = editing;

  return (
    <main className="freelancer-directory app-shell">
      <header className="topbar">
        <Link to="/" className="brand"><span className="brand-mark">A</span>Atlaswork</Link>
        <div className="search-wrap">
          <Search className="search-icon" size={17} aria-hidden="true" />
          <input className="search-input" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search by skill, name or place" aria-label="Search freelancers" />
          <div className="country-filter"><Globe2 size={14} aria-hidden="true" /><select aria-label="Filter by country" value={country} onChange={(event) => void changeCountry(event.target.value)}><option value="all">All countries</option>{countries.map((name) => <option key={name} value={name}>{name}</option>)}</select></div>
        </div>
        <div className="topbar-actions">
          {userId ? <><Button onClick={() => setEditing(true)}><Pencil />{myProfile ? "My profile" : "Create profile"}</Button><Button variant="ghost" size="icon" onClick={() => void logoutUser()} aria-label="Sign out"><LogOut /></Button></> : <Button asChild><Link to="/login" search={{ returnTo: "/freelancers" }}><Sparkles />Join the map</Link></Button>}
          <Button asChild variant="ghost" size="sm"><Link to="/">DailyResume</Link></Button>
        </div>
      </header>
      <section className="map-layout" data-picking={editing}>
        <section className="map-stage" aria-label="World map of freelancers">
          <div className="directory-map-intro">
            <h1>Find freelancers worldwide</h1>
            <p>Explore independent professionals by skill, service, and location.</p>
          </div>
          {!visible.length && !loading && <div className="map-empty">{profiles.length ? "No freelancers match this search." : "Be the first freelancer to appear here."}</div>}
          {editing && <div className="map-help"><span><LocateFixed size={16} />Click the map to place your profile</span><Button variant="secondary" size="sm" onClick={() => setEditing(false)}>Cancel</Button></div>}
          <ClientOnly fallback={<div className="freelancer-map-loading">Loading Atlaswork...</div>}>
            <Suspense fallback={<div className="freelancer-map-loading">Loading Atlaswork...</div>}>
              <FreelancerMap profiles={atlasProfiles} selectedId={selected?.user_id ?? null} onSelect={(profile: MapProfile) => setSelected(profiles.find((entry) => entry.user_id === profile.id) ?? null)} pickLocation={editingProfile ? (latitude: number, longitude: number) => setLocation({ latitude, longitude }) : undefined} pickedPoint={location ? [location.latitude, location.longitude] : editing && myProfile?.latitude != null && myProfile.longitude != null ? [myProfile.latitude, myProfile.longitude] : undefined} focusPoint={selected?.latitude != null && selected.longitude != null ? [selected.latitude, selected.longitude] : undefined} viewTarget={viewTarget} />
            </Suspense>
          </ClientOnly>
          {selected && !editing && <ProfileCard profile={selected} onClose={() => setSelected(null)} />}
        </section>
      </section>
      {editing && <div className="freelancer-modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setEditing(false); }}>
        <section className="freelancer-editor" role="dialog" aria-modal="true" aria-labelledby="freelancer-editor-title">
          <div className="freelancer-editor-heading"><div><span>YOUR MAP PROFILE</span><h2 id="freelancer-editor-title">Show what you do</h2></div><button onClick={() => setEditing(false)} aria-label="Close profile editor"><X /></button></div>
          <form onSubmit={(event) => void saveProfile(event)}>
            <label>Username<input name="username" required minLength={2} maxLength={40} pattern="[a-zA-Z0-9_-]+" defaultValue={myProfile?.username ?? `pro-${userId?.replaceAll("-", "").slice(0, 8) ?? "new"}`} /></label>
            <label>Your name<input name="full_name" required maxLength={100} defaultValue={myProfile?.full_name ?? getCurrentUser()?.name ?? ""} /></label>
            <label>Professional headline<input name="headline" maxLength={120} placeholder="Brand designer · Web developer · Photographer" defaultValue={myProfile?.headline ?? ""} /></label>
            <label>About your work<textarea name="bio" maxLength={2000} rows={3} defaultValue={myProfile?.bio ?? ""} /></label>
            <div className="freelancer-fields"><label>Location<input name="location_name" maxLength={120} placeholder="Lisbon, Portugal" defaultValue={myProfile?.location_name ?? ""} /></label><label>Country<input name="country" maxLength={100} defaultValue={myProfile?.country ?? ""} /></label></div>
            <div className="freelancer-location-actions"><Button type="button" variant="outline" onClick={locateMe}><LocateFixed />Use my location</Button><span>{location ? `${location.latitude.toFixed(4)}, ${location.longitude.toFixed(4)}` : myProfile?.latitude != null ? `${myProfile.latitude.toFixed(4)}, ${myProfile.longitude?.toFixed(4)}` : "Or click anywhere on the map"}</span></div>
            <label>Services<input name="services" placeholder="Brand identity, Web design" defaultValue={myProfile?.services.join(", ") ?? ""} /></label>
            <label>Skills and tools<input name="tags" placeholder="Figma, Illustration, Framer" defaultValue={myProfile?.tags.join(", ") ?? ""} /></label>
            <div className="freelancer-fields"><label>Starting price<input name="starting_price" type="number" min="0" step="0.01" defaultValue={myProfile?.starting_price ?? ""} /></label><label>Currency<input name="currency" maxLength={3} defaultValue={myProfile?.currency ?? "USD"} /></label></div>
            <div className="freelancer-fields"><label>Contact email<input name="contact_email" type="email" defaultValue={myProfile?.contact_email ?? getCurrentUser()?.email ?? ""} /></label><label>Website<input name="website_url" type="url" placeholder="https://" defaultValue={myProfile?.website_url ?? ""} /></label></div>
            <label>LinkedIn profile<input name="linkedin_url" type="url" placeholder="https://linkedin.com/in/..." defaultValue={myProfile?.linkedin_url ?? ""} /></label>
            <div className="freelancer-fields"><label>Instagram<input name="instagram_url" defaultValue={myProfile?.instagram_url ?? ""} /></label><label>WhatsApp<input name="whatsapp_number" defaultValue={myProfile?.whatsapp_number ?? ""} /></label></div>
            <div className="freelancer-fields"><label>Telegram ID<input name="telegram_id" defaultValue={myProfile?.telegram_id ?? ""} /></label><label>GitHub repositories<input name="github_repos" defaultValue={myProfile?.github_repos.join(", ") ?? ""} /></label></div>
            <label>Address<input name="address" defaultValue={myProfile?.address ?? ""} /></label>
            <label className="freelancer-toggle"><input type="checkbox" name="show_address" defaultChecked={myProfile?.show_address ?? false} /><span>Show my address publicly</span></label>
            <label className="freelancer-toggle"><input type="checkbox" name="is_available" defaultChecked={myProfile?.is_available ?? true} /><span>Available for new work</span></label>
            <label className="freelancer-toggle"><input type="checkbox" name="is_listed" defaultChecked={myProfile?.is_listed ?? false} /><span>Publish my profile on the public map</span></label>
            <p className="freelancer-privacy">Your map pin is public when listed. Only add a location you are comfortable sharing.</p>
            <Button type="submit" disabled={saving}>{saving ? "Saving..." : "Save profile"}</Button>
          </form>
        </section>
      </div>}
    </main>
  );
}

function ProfileCard({ profile, onClose }: { profile: FreelancerProfile; onClose: () => void }) {
  return <article className="detail-panel freelancer-profile-card">
    <button className="freelancer-close" onClick={onClose} aria-label="Close profile"><X /></button>
    <Avatar profile={profile} large />
    <span className="freelancer-profile-status" data-available={profile.is_available}>{profile.is_available ? "AVAILABLE FOR WORK" : "CURRENTLY BOOKED"}</span>
    <h2>{profile.full_name || profile.username}</h2>
    <p className="freelancer-profile-headline">{profile.headline}</p>
    <p className="freelancer-profile-location"><MapPin size={15} />{profile.location_name || profile.country || "Location not specified"}</p>
    {profile.show_address && profile.address && <p className="freelancer-profile-location">{profile.address}</p>}
    {profile.bio && <p className="freelancer-profile-bio">{profile.bio}</p>}
    {(profile.services.length > 0 || profile.tags.length > 0) && <div className="freelancer-tags">{[...profile.services, ...profile.tags].map((tag, index) => <span key={`${tag}-${index}`}>{tag}</span>)}</div>}
    {profile.starting_price != null && <p className="freelancer-price">From {profile.currency} {profile.starting_price}</p>}
    <div className="freelancer-contact-links">
      {profile.contact_email && <a href={`mailto:${profile.contact_email}`}>Email</a>}
      {profile.linkedin_url && <a href={profile.linkedin_url} target="_blank" rel="noreferrer">LinkedIn</a>}
      {profile.instagram_url && <a href={profile.instagram_url} target="_blank" rel="noreferrer">Instagram</a>}
      {profile.whatsapp_number && <a href={`https://wa.me/${profile.whatsapp_number.replace(/\D/g, "")}`} target="_blank" rel="noreferrer">WhatsApp</a>}
      {profile.telegram_id && <a href={`https://t.me/${profile.telegram_id.replace(/^@/, "")}`} target="_blank" rel="noreferrer">Telegram</a>}
      {profile.website_url && <a href={profile.website_url} target="_blank" rel="noreferrer">Website</a>}
      {profile.github_repos.map((repo) => <a key={repo} href={repo.startsWith("http") ? repo : `https://${repo}`} target="_blank" rel="noreferrer">GitHub</a>)}
    </div>
  </article>;
}

function Avatar({ profile, large = false }: { profile: FreelancerProfile; large?: boolean }) {
  return <span className={`freelancer-avatar${large ? " freelancer-avatar-large" : ""}`}>{profile.avatar_url ? <img src={profile.avatar_url} alt="" referrerPolicy="no-referrer" /> : (profile.full_name || profile.username).slice(0, 1).toUpperCase()}</span>;
}

function splitList(value: string) {
  return [...new Set(value.split(",").map((part) => part.trim()).filter(Boolean))].slice(0, 30);
}