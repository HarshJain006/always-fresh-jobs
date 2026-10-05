import { ClientOnly } from "@tanstack/react-router";
import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Globe2, LocateFixed, LogOut, Pencil, Search, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { getCurrentUser, getSessionToken, AUTH_CHANGE_EVENT, STORAGE_KEY, logoutUser } from "../../../src/auth/googleAuth";
import { loadFavoriteProfileIds, loadListedAtlasworkProfiles, loadMyAtlasworkProfile, updateFavorite } from "../lib/dailyresumeBridge";
import type { MapProfile, ViewTarget } from "../components/FreelancerMap";
import { ProfileEditor } from "../components/ProfileEditor";
import { ProfileDetails } from "../components/ProfileDetails";
import { FavoritesSidebar } from "../components/FavoritesSidebar";

const FreelancerMap = lazy(() => import("../components/FreelancerMap").then((module) => ({ default: module.FreelancerMap })));

export function AtlasworkPage() {
  const [profiles, setProfiles] = useState<MapProfile[]>([]);
  const [me, setMe] = useState<{ id: string } | null>(null);
  const [myProfile, setMyProfile] = useState<MapProfile | null>(null);
  const [selected, setSelected] = useState<MapProfile | null>(null);
  const [editing, setEditing] = useState(false);
  const [picking, setPicking] = useState(false);
  const [pickedLocation, setPickedLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [query, setQuery] = useState("");
  const [country, setCountry] = useState("all");
  const [viewTarget, setViewTarget] = useState<ViewTarget | undefined>(undefined);
  const [favoriteIds, setFavoriteIds] = useState<string[]>([]);
  const [favoritesOpen, setFavoritesOpen] = useState(false);
  const promptedSetup = useRef(false);
  const homeSet = useRef(false);

  const loadFavorites = useCallback(async (userId: string | null) => {
    if (!userId) { setFavoriteIds([]); return; }
    try {
      setFavoriteIds(await loadFavoriteProfileIds());
    } catch (error) {
      console.error("Could not load Atlaswork favorites:", error);
      setFavoriteIds([]);
    }
  }, []);

  const loadProfiles = useCallback(async () => {
    const dailyUser = getCurrentUser();
    const currentUser = dailyUser ? { id: dailyUser.id } : null;
    setMe(currentUser);
    try {
      setProfiles(await loadListedAtlasworkProfiles());
    } catch (error) {
      console.error("Could not load the freelancer map:", error);
      toast.error("Could not load the freelancer map. Check the Supabase setup.");
    }
    void loadFavorites(currentUser?.id ?? null);
    if (currentUser && getSessionToken()) {
      try {
        const result = await loadMyAtlasworkProfile();
        const mine = result.profile ?? createEmptyProfile(result.user.id, result.user.name, result.user.email, result.user.profile_image);
        setMyProfile(mine);
        if (!homeSet.current && mine.latitude != null && mine.longitude != null) {
          homeSet.current = true;
          setViewTarget({ center: [mine.latitude, mine.longitude], zoom: 9.5, key: `my-city-${mine.id}` });
        }
        if (!mine.is_listed && !promptedSetup.current) {
          promptedSetup.current = true;
          setEditing(true);
        }
      } catch (error) {
        console.error("Could not load your Atlaswork profile:", error);
        setMyProfile(null);
      }
    } else {
      setMyProfile(null);
      promptedSetup.current = false;
    }
  }, [loadFavorites]);

  function createEmptyProfile(userId: string, name: string, email: string, avatar: string): MapProfile {
    return {
      id: userId,
      username: `freelancer-${userId.replaceAll("-", "").slice(0, 8)}`,
      full_name: name,
      headline: "",
      bio: "",
      avatar_url: avatar || null,
      latitude: null,
      longitude: null,
      location_name: "",
      tags: [],
      services: [],
      starting_price: null,
      currency: "USD",
      is_available: true,
      is_listed: false,
      contact_email: email,
      linkedin_url: "",
      instagram_url: "",
      whatsapp_number: "",
      telegram_id: "",
      address: "",
      show_address: false,
      github_repos: [],
      country: "",
    };
  }

  useEffect(() => {
    void loadProfiles();
    const onStorage = (event: StorageEvent) => {
      if (event.key === STORAGE_KEY || event.key === null) void loadProfiles();
    };
    window.addEventListener(AUTH_CHANGE_EVENT, loadProfiles);
    window.addEventListener("storage", onStorage);
    window.addEventListener("focus", loadProfiles);
    const refreshTimer = window.setInterval(() => void loadProfiles(), 60_000);
    return () => {
      window.removeEventListener(AUTH_CHANGE_EVENT, loadProfiles);
      window.removeEventListener("storage", onStorage);
      window.removeEventListener("focus", loadProfiles);
      window.clearInterval(refreshTimer);
    };
  }, [loadProfiles]);

  useEffect(() => {
    if (selected && !profiles.some((profile) => profile.id === selected.id)) setSelected(null);
  }, [profiles, selected]);

  const countries = useMemo(
    () => [...new Set(profiles.map((profile) => profile.country).filter(Boolean))].sort((a, b) => a.localeCompare(b)),
    [profiles],
  );

  const visible = useMemo(() => profiles.filter((profile) => {
    // While the owner is placing their own point, hide their saved pin so only the
    // one they are moving is on the map.
    if ((editing || picking) && myProfile && profile.id === myProfile.id) return false;
    if (country !== "all" && profile.country !== country) return false;
    const haystack = [profile.full_name, profile.username, profile.headline, profile.location_name, profile.country, ...profile.tags, ...profile.services].join(" ").toLowerCase();
    return haystack.includes(query.toLowerCase());
  }), [profiles, query, country, editing, picking, myProfile]);


  const favorites = useMemo(() => profiles.filter((profile) => favoriteIds.includes(profile.id)), [profiles, favoriteIds]);

  const pickedPoint = useMemo<[number, number] | undefined>(() => {
    if (pickedLocation) return [pickedLocation.lat, pickedLocation.lng];
    if (editing && myProfile?.latitude != null && myProfile.longitude != null) return [myProfile.latitude, myProfile.longitude];
    return undefined;
  }, [editing, myProfile, pickedLocation]);

  async function changeCountry(next: string) {
    setCountry(next);
    if (next === "all") {
      setViewTarget({ center: [20, 0], zoom: 2.4, key: "all" });
      return;
    }
    const inCountry = profiles.filter((profile) => profile.country === next && profile.latitude != null && profile.longitude != null);
    const first = inCountry[0];
    if (first?.latitude != null && first.longitude != null) {
      setViewTarget({ center: [first.latitude, first.longitude], zoom: inCountry.length > 1 ? 5 : 9, key: `country-${next}` });
      return;
    }
    try {
      const response = await fetch(`https://nominatim.openstreetmap.org/search?format=json&limit=1&country=${encodeURIComponent(next)}`);
      const data = (await response.json()) as { lat: string; lon: string }[];
      const hit = data[0];
      if (hit) setViewTarget({ center: [Number(hit.lat), Number(hit.lon)], zoom: 5, key: `country-${next}` });
    } catch {
      /* keep the current view */
    }
  }

  async function signIn() {
    window.location.assign("/login?returnTo=%2Ffreelancers");
  }


  async function signOut() {
    await logoutUser();
    setEditing(false); setPicking(false); setSelected(null); setMe(null); setMyProfile(null); setFavoriteIds([]);
    promptedSetup.current = false;
  }

  async function toggleFavorite(profile: MapProfile) {
    if (!me) { void signIn(); return; }
    const favorite = !favoriteIds.includes(profile.id);
    try {
      await updateFavorite(profile.id, favorite);
      setFavoriteIds((ids) => favorite ? [...ids, profile.id] : ids.filter((id) => id !== profile.id));
      if (favorite) toast.success("Added to your favourites.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not update favourites.");
    }
  }

  function openFavorite(profile: MapProfile) {
    setSelected(profile);
    setFavoritesOpen(false);
    if (profile.latitude != null && profile.longitude != null) {
      setViewTarget({ center: [profile.latitude, profile.longitude], zoom: 12, key: `fav-${profile.id}-${Date.now()}` });
    }
  }

  function startPicking() {
    setSelected(null);
    setEditing(false);
    setPicking(true);
  }

  function finishPicking(lat: number, lng: number) {
    setPickedLocation({ lat, lng });
    setPicking(false);
    setEditing(true);
  }

  return (
    <main className="atlaswork-shell app-shell">
      <header className="topbar">
        <div className="brand"><span className="brand-mark">A</span>Atlaswork</div>
        <div className="search-wrap">
          <Search className="search-icon" size={17} aria-hidden="true" />
          <Input className="search-input" aria-label="Search freelancers" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search by skill, name or place" />
          <div className="country-filter">
            <Globe2 size={14} aria-hidden="true" />
            <select aria-label="Filter by country" value={country} onChange={(event) => void changeCountry(event.target.value)}>
              <option value="all">All countries</option>
              {countries.map((name) => <option key={name} value={name}>{name}</option>)}
            </select>
          </div>
        </div>
        <div className="topbar-actions">
          {me && myProfile ? <><Button variant="map" onClick={() => setEditing(true)}><Pencil />My profile</Button><Button variant="ghost" size="icon" onClick={() => void signOut()} aria-label="Sign out"><LogOut /></Button></> : <Button variant="map" onClick={() => void signIn()}><Sparkles />Join the map</Button>}
        </div>
      </header>
      <div className="map-layout" data-picking={picking}>
        <section className="map-stage" aria-label="World map of freelancers">
          {!visible.length && !picking && <div className="map-empty">{profiles.length ? "No freelancers match this search." : "Be the first freelancer to appear here."}</div>}
          {picking && <>
            <div className="map-help">
              <span><LocateFixed size={16} /> Tap the map to drop your exact point</span>
              <Button variant="secondary" size="sm" onClick={() => { setPicking(false); setEditing(true); }}>Cancel</Button>
            </div>
            <div className="pick-reticle" aria-hidden="true" />
          </>}
          <ClientOnly fallback={<div className="h-full w-full animate-pulse bg-muted" />}><Suspense fallback={<div className="h-full w-full animate-pulse bg-muted" />}><FreelancerMap profiles={visible} selectedId={selected?.id ?? null} onSelect={openFavorite} pickLocation={picking ? finishPicking : undefined} pickedPoint={pickedPoint} focusPoint={pickedPoint} viewTarget={viewTarget} /></Suspense></ClientOnly>
          {!picking && <FavoritesSidebar open={favoritesOpen} onOpenChange={setFavoritesOpen} favorites={favorites} onSelect={openFavorite} onRemove={(profile) => void toggleFavorite(profile)} signedIn={Boolean(me)} />}
          {selected && !picking && <ProfileDetails
            profile={selected}
            viewerId={me?.id ?? null}
            isFavorite={favoriteIds.includes(selected.id)}
            onToggleFavorite={(profile) => void toggleFavorite(profile)}
            onClose={() => setSelected(null)}
            onRequireSignIn={() => void signIn()}
          />}
          {editing && myProfile && <ProfileEditor profile={myProfile} onClose={() => setEditing(false)} onSaved={() => { setEditing(false); void loadProfiles(); }} onPickOnMap={startPicking} onLocationFound={(lat, lng) => setPickedLocation({ lat, lng })} pickedLocation={pickedLocation} />}
        </section>
      </div>
    </main>
  );
}
