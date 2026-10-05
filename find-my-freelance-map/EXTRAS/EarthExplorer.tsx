import { lazy, Suspense, useCallback, useEffect, useRef, useState } from "react";
import { Compass, Crosshair, Earth, Layers3, Map as MapIcon, MapPin, Menu, Minus, Plus, RotateCcw, Search, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { lookupPlace, searchCities } from "@/lib/city-search";
import { GlobeScene, type Destination, type GlobeAction } from "./GlobeScene";

const DetailMap = lazy(() => import("./DetailMap").then((module) => ({ default: module.DetailMap })));
type ViewMode = "globe" | "map";

export function EarthExplorer() {
  const [query, setQuery] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const [layersOpen, setLayersOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [destination, setDestination] = useState<Destination | null>(null);
  const [action, setAction] = useState<GlobeAction>(null);
  const [clouds, setClouds] = useState(true);
  const [night, setNight] = useState(false);
  const [distance, setDistance] = useState(10);
  const [mode, setMode] = useState<ViewMode>("globe");
  const [results, setResults] = useState<Destination[]>([]);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState("");
  const [mapZoom, setMapZoom] = useState<{ direction: number; id: number } | null>(null);
  const [mapCenter, setMapCenter] = useState({ lat: 20, lon: 0 });
  const actionId = useRef(0);
  const lookupId = useRef(0);
  const onPosition = useCallback((value: number) => setDistance((old) => Math.abs(old - value) > 0.05 ? value : old), []);
  const onCenter = useCallback((lat: number, lon: number) => setMapCenter({ lat, lon }), []);
  const runAction = (kind: NonNullable<GlobeAction>["kind"]) => setAction({ kind, id: ++actionId.current });
  const zoom = (direction: number) => {
    if (mode === "map") setMapZoom({ direction, id: ++actionId.current });
    else runAction(direction > 0 ? "zoomIn" : "zoomOut");
  };

  useEffect(() => {
    const text = query.trim();
    if (text.length < 2) { setResults([]); return; }
    let canceled = false;
    const timer = window.setTimeout(() => {
      searchCities(text).then((matches) => { if (!canceled) setResults(matches); }).catch(() => { if (!canceled) setResults([]); });
    }, 120);
    return () => { canceled = true; window.clearTimeout(timer); };
  }, [query]);

  const selectPlace = (place: Destination) => {
    setDestination({ ...place });
    setMapCenter({ lat: place.lat, lon: place.lon });
    setQuery(place.name);
    setSearchOpen(false);
    setMenuOpen(false);
    setSearching(false);
    setSearchError("");
    if (distance > 15 && mode === "globe") runAction("zoomIn");
  };
  const submitSearch = async () => {
    const text = query.trim();
    if (!text) return;
    const match = text.match(/^(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)$/);
    if (match) {
      const lat = Number(match[1]); const lon = Number(match[2]);
      if (Math.abs(lat) <= 90 && Math.abs(lon) <= 180) { selectPlace({ name: `${lat.toFixed(4)}°, ${lon.toFixed(4)}°`, lat, lon }); return; }
    }
    const id = ++lookupId.current;
    setSearching(true);
    setSearchError("");
    try {
      const matches = await lookupPlace(text);
      if (id !== lookupId.current) return;
      setResults(matches);
      setSearchOpen(true);
      if (matches.length === 1 && matches[0]) selectPlace(matches[0]);
      else if (!matches.length) setSearchError("No places found");
    } catch {
      if (id === lookupId.current) setSearchError("Place search is unavailable right now");
    } finally {
      if (id === lookupId.current) setSearching(false);
    }
  };
  const resetView = () => {
    setDestination(null);
    setQuery("");
    setSearchOpen(false);
    if (mode === "globe") runAction("reset");
    else setMode("globe");
  };

  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if (event.key === "Escape") { setSearchOpen(false); setLayersOpen(false); setMenuOpen(false); }
      if (event.target instanceof HTMLInputElement) return;
      if (event.key === "+" || event.key === "=") zoom(1);
      if (event.key === "-") zoom(-1);
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [mode]);

  return <main className="earth-app">
    <div className="earth-scene" style={{ display: mode === "globe" ? "block" : "none" }}><GlobeScene destination={destination} action={action} clouds={clouds} night={night} onPosition={onPosition} /></div>
    {mode === "map" && <Suspense fallback={<div className="earth-map-loading">Loading map…</div>}><DetailMap destination={destination} zoomCommand={mapZoom} onCenter={onCenter} /></Suspense>}
    {mode === "globe" && <div className="earth-vignette" aria-hidden="true" />}
    <div className="earth-topbar">
      <Button variant="earthIcon" size="icon" aria-label="Open menu" title="Open menu" onClick={() => setMenuOpen(!menuOpen)}><Menu /></Button>
      <div className="earth-brand"><Earth className="earth-brand-icon" strokeWidth={1.8} /><span>Earth</span></div>
      <form className="earth-search" onSubmit={(event) => { event.preventDefault(); void submitSearch(); }}>
        <Search size={19} className="earth-search-icon" />
        <input aria-label="Search Earth" value={query} onChange={(event) => { setQuery(event.target.value); setSearchOpen(true); setSearchError(""); }} onFocus={() => setSearchOpen(true)} placeholder="Search Earth" autoComplete="off" />
        {query && <Button type="button" variant="earthIcon" size="icon" aria-label="Clear search" title="Clear search" onClick={() => { ++lookupId.current; setQuery(""); setDestination(null); setSearchOpen(true); }}><X size={17} /></Button>}
      </form>
      <div className="earth-view-switch" role="group" aria-label="View mode">
        <Button variant="earthIcon" size="icon" aria-label="Globe view" title="Globe view" aria-pressed={mode === "globe"} onClick={() => setMode("globe")}><Earth /></Button>
        <Button variant="earthIcon" size="icon" aria-label="Map view" title="Map view" aria-pressed={mode === "map"} onClick={() => setMode("map")}><MapIcon /></Button>
      </div>
    </div>

    {menuOpen && <aside className="earth-menu earth-surface">
      <div className="earth-panel-title"><span>Explore Earth</span><Button variant="earthIcon" size="icon" onClick={() => setMenuOpen(false)} aria-label="Close menu"><X /></Button></div>
      <Button variant="earthMenu" onClick={() => { setMenuOpen(false); setSearchOpen(true); document.querySelector<HTMLInputElement>('.earth-search input')?.focus(); }}><Search /> Search</Button>
      <Button variant="earthMenu" onClick={() => { setMenuOpen(false); setMode("map"); }}><MapIcon /> Detailed map</Button>
      <Button variant="earthMenu" onClick={() => { setMenuOpen(false); setLayersOpen(true); }}><Layers3 /> Map style</Button>
      <Button variant="earthMenu" onClick={() => { setMenuOpen(false); resetView(); }}><Earth /> Explore the globe</Button>
      <div className="earth-menu-credit">Globe imagery: <a href="https://www.solarsystemscope.com/textures/" target="_blank" rel="noreferrer">Solar System Scope</a> · <a href="https://creativecommons.org/licenses/by/4.0/" target="_blank" rel="noreferrer">CC BY 4.0</a><br />Cities: <a href="https://www.geonames.org/" target="_blank" rel="noreferrer">GeoNames</a> · <a href="https://creativecommons.org/licenses/by/4.0/" target="_blank" rel="noreferrer">CC BY 4.0</a><br />Map data © <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap contributors</a></div>
    </aside>}

    {searchOpen && <div className="earth-results earth-surface">
      <div className="earth-results-label">{query ? "PLACES" : "POPULAR CITIES"}</div>
      {searching ? <div className="earth-no-results">Searching places…</div> : searchError ? <div className="earth-no-results">{searchError}</div> : results.length ? results.map((place, index) => <Button variant="earthResult" key={`${place.name}-${index}`} onClick={() => selectPlace(place)}><MapPin size={18} /><span>{place.name}</span></Button>) : <div className="earth-no-results">{query.length < 2 ? "Search for a city or place" : "Press Enter to search all places"}</div>}
    </div>}

    {layersOpen && <aside className="earth-layers earth-surface">
      <div className="earth-panel-title"><span>Map style</span><Button variant="earthIcon" size="icon" onClick={() => setLayersOpen(false)} aria-label="Close map style"><X /></Button></div>
      <Button variant="earthMenu" aria-pressed={mode === "globe"} onClick={() => { setMode("globe"); setLayersOpen(false); }}><Earth /> Globe</Button>
      <Button variant="earthMenu" aria-pressed={mode === "map"} onClick={() => { setMode("map"); setLayersOpen(false); }}><MapIcon /> Detailed map</Button>
      {mode === "globe" && <><label className="earth-layer-row"><span>Clouds</span><input type="checkbox" checked={clouds} onChange={(event) => setClouds(event.target.checked)} /><span className="earth-switch" /></label>
      <label className="earth-layer-row"><span>Night lights</span><input type="checkbox" checked={night} onChange={(event) => setNight(event.target.checked)} /><span className="earth-switch" /></label></>}
    </aside>}

    {destination && <div className="earth-place earth-surface"><MapPin size={18} /><div><strong>{destination.name}</strong><small>{Math.abs(destination.lat).toFixed(4)}° {destination.lat >= 0 ? "N" : "S"}, {Math.abs(destination.lon).toFixed(4)}° {destination.lon >= 0 ? "E" : "W"}</small></div><Button variant="earthIcon" size="icon" aria-label="Close location" title="Close location" onClick={() => { setDestination(null); setQuery(""); }}><X size={17} /></Button></div>}

    <div className="earth-controls">
      <Button variant="earthControl" size="icon" title="Map style" aria-label="Map style" onClick={() => setLayersOpen(!layersOpen)}><Layers3 /></Button>
      <Button variant="earthControl" size="icon" title="Reset view" aria-label="Reset view" onClick={resetView}><Crosshair /></Button>
      {mode === "globe" && <Button variant="earthControl" size="icon" title="Face north" aria-label="Face north" onClick={() => runAction("north")}><Compass /></Button>}
      <span className="earth-control-divider" />
      <Button variant="earthControl" size="icon" title="Zoom in" aria-label="Zoom in" onClick={() => zoom(1)}><Plus /></Button>
      <Button variant="earthControl" size="icon" title="Zoom out" aria-label="Zoom out" onClick={() => zoom(-1)}><Minus /></Button>
    </div>
    <div className="earth-footer"><span>{mode === "globe" ? "Imagery © Solar System Scope" : `${Math.abs(mapCenter.lat).toFixed(3)}° ${mapCenter.lat >= 0 ? "N" : "S"}, ${Math.abs(mapCenter.lon).toFixed(3)}° ${mapCenter.lon >= 0 ? "E" : "W"}`}</span><span className="earth-footer-right">{mode === "globe" ? <>3D globe <span className="earth-footer-dot">·</span> <RotateCcw size={12} /> Drag to explore</> : "© OpenStreetMap contributors"}</span></div>
  </main>;
}
