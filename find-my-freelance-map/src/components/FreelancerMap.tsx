import { useCallback, useEffect, useRef, useState } from "react";
import * as maplibregl from "maplibre-gl";
import type { MapMouseEvent, StyleSpecification } from "maplibre-gl";
import * as THREE from "three";
import workerUrl from "maplibre-gl/dist/maplibre-gl-worker.mjs?url";
import "maplibre-gl/dist/maplibre-gl.css";

const spaceImage = "/textures/milky-way.jpg";
const earthTextureImage = "/textures/earth-day.jpg";
const earthTileCache = new Map<string, Promise<Uint8Array>>();
let earthSourcePromise: Promise<{ pixels: Uint8ClampedArray; width: number; height: number }> | null = null;
let earthProtocolRegistered = false;

function loadEarthSourcePixels() {
  if (earthSourcePromise) return earthSourcePromise;
  earthSourcePromise = new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = image.naturalWidth;
      canvas.height = image.naturalHeight;
      const context = canvas.getContext("2d", { willReadFrequently: true });
      if (!context) {
        reject(new Error("Could not create the Earth texture canvas."));
        return;
      }
      context.drawImage(image, 0, 0);
      const imageData = context.getImageData(0, 0, canvas.width, canvas.height);
      resolve({ pixels: imageData.data, width: canvas.width, height: canvas.height });
    };
    image.onerror = () => reject(new Error("Could not load the local Earth texture."));
    image.src = earthTextureImage;
  });
  return earthSourcePromise;
}

async function renderEarthTile(zoom: number, tileX: number, tileY: number) {
  const source = await loadEarthSourcePixels();
  const tileSize = 256;
  const worldSize = tileSize * 2 ** zoom;
  const output = new Uint8ClampedArray(tileSize * tileSize * 4);

  for (let row = 0; row < tileSize; row += 1) {
    const worldY = tileY * tileSize + row + 0.5;
    const latitude = Math.atan(Math.sinh(Math.PI * (1 - (2 * worldY) / worldSize))) * (180 / Math.PI);
    const sourceY = Math.max(0, Math.min(source.height - 1, ((90 - latitude) / 180) * source.height));
    const top = Math.floor(sourceY);
    const bottom = Math.min(source.height - 1, top + 1);
    const verticalWeight = sourceY - top;

    for (let column = 0; column < tileSize; column += 1) {
      const worldX = tileX * tileSize + column + 0.5;
      const longitude = (worldX / worldSize) * 360 - 180;
      const sourceX = (((longitude + 180) / 360) * source.width) % source.width;
      const left = Math.floor(sourceX);
      const right = (left + 1) % source.width;
      const horizontalWeight = sourceX - left;
      const upperLeft = (top * source.width + left) * 4;
      const upperRight = (top * source.width + right) * 4;
      const lowerLeft = (bottom * source.width + left) * 4;
      const lowerRight = (bottom * source.width + right) * 4;
      const target = (row * tileSize + column) * 4;

      for (let channel = 0; channel < 3; channel += 1) {
        const upper = source.pixels[upperLeft + channel]! * (1 - horizontalWeight) + source.pixels[upperRight + channel]! * horizontalWeight;
        const lower = source.pixels[lowerLeft + channel]! * (1 - horizontalWeight) + source.pixels[lowerRight + channel]! * horizontalWeight;
        output[target + channel] = upper * (1 - verticalWeight) + lower * verticalWeight;
      }
      output[target + 3] = 255;
    }
  }

  const canvas = document.createElement("canvas");
  canvas.width = tileSize;
  canvas.height = tileSize;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Could not render an Earth imagery tile.");
  context.putImageData(new ImageData(output, tileSize, tileSize), 0, 0);
  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((value) => value ? resolve(value) : reject(new Error("Could not encode an Earth imagery tile.")), "image/png");
  });
  return new Uint8Array(await blob.arrayBuffer());
}

const solarTextureProtocol: Parameters<typeof maplibregl.addProtocol>[1] = async (request, abortController) => {
  console.info("Solar texture tile request", request.url);
  const tileUrl = new URL(request.url);
  const parts = tileUrl.pathname.match(/^\/(\d+)\/(\d+)\/(\d+)(?:\.\w+)?$/);
  if (tileUrl.hostname !== "earth" || !parts) throw new Error("Invalid Solar System Scope tile URL.");
  const [, zoomText, xText, yText] = parts;
  const zoom = Number(zoomText);
  const x = Number(xText);
  const y = Number(yText);
  const key = `${zoom}/${x}/${y}`;
  let tile = earthTileCache.get(key);
  if (!tile) {
    tile = renderEarthTile(zoom, x, y);
    earthTileCache.set(key, tile);
  }
  const data = await tile;
  if (abortController.signal.aborted) throw new DOMException("Tile request aborted.", "AbortError");
  return { data: data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength) as ArrayBuffer };
};

export type MapProfile = {
  id: string;
  username: string;
  full_name: string;
  headline: string;
  bio: string;
  avatar_url: string | null;
  latitude: number | null;
  longitude: number | null;
  location_name: string;
  tags: string[];
  services: string[];
  starting_price: number | null;
  currency: string;
  is_available: boolean;
  is_listed: boolean;
  contact_email: string;
  linkedin_url: string;
  instagram_url: string;
  whatsapp_number: string;
  telegram_id: string;
  address: string;
  show_address: boolean;
  github_repos: string[];
  country: string;
};

export type ViewTarget = { center: [number, number]; zoom: number; key: string };

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (char) =>
    char === "&" ? "&amp;" : char === "<" ? "&lt;" : char === ">" ? "&gt;" : char === '"' ? "&quot;" : "&#39;",
  );
}

// Globe view of the planet with crisp raster imagery; MapLibre renders it on the GPU so
// zooming is continuous instead of the stepped, scroll-heavy feel of a tiled 2D map.
const globeStyle: StyleSpecification = {
  version: 8,
  projection: { type: "globe" },
  light: { anchor: "map", position: [1.2, 200, 40], intensity: 0.8 },
  sky: {
    "sky-color": "#03050b",
    "sky-horizon-blend": 0,
    "horizon-color": "rgba(0, 0, 0, 0)",
    "horizon-fog-blend": 0,
    "fog-color": "rgba(0, 0, 0, 0)",
    "fog-ground-blend": 0,
    "atmosphere-blend": 0.14,
  },
  sources: {
    solarTexture: {
      type: "raster",
      tiles: ["solartexture://earth/{z}/{x}/{y}"],
      tileSize: 256,
      maxzoom: 3,
      attribution: 'Earth texture: <a href="https://www.solarsystemscope.com/textures/">Solar System Scope</a> &middot; <a href="https://creativecommons.org/licenses/by/4.0/">CC BY 4.0</a>',
    },
    earth: {
      type: "raster",
      tiles: [
        "https://services.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
      ],
      tileSize: 256,
      maxzoom: 19,
      attribution: 'Earth imagery &copy; <a href="https://www.esri.com/">Esri</a>, Maxar, Earthstar Geographics, and the GIS User Community',
    },
    osm: {
      type: "raster",
      tiles: ["https://tile.openstreetmap.org/{z}/{x}/{y}.png"],
      tileSize: 256,
      maxzoom: 19,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    },
  },
  layers: [
    {
      id: "solar-texture",
      type: "raster",
      source: "solarTexture",
      paint: { "raster-resampling": "linear", "raster-fade-duration": 0 },
    },
    {
      id: "earth-detail",
      type: "raster",
      source: "earth",
      paint: {
        "raster-resampling": "linear",
        "raster-fade-duration": 120,
        "raster-brightness-min": 0.08,
        "raster-brightness-max": 1,
        "raster-contrast": 0,
        "raster-saturation": 0,
        "raster-opacity": ["interpolate", ["linear"], ["zoom"], 2.4, 0, 3.6, 1],
      },
    },
    {
      id: "osm",
      type: "raster",
      source: "osm",
      minzoom: 4.5,
      paint: {
        "raster-resampling": "linear",
        "raster-fade-duration": 120,
        "raster-opacity": ["interpolate", ["linear"], ["zoom"], 4.5, 0, 7, 1],
      },
    },
  ],
};

function pinSize(zoom: number) {
  return Math.round(Math.min(48, Math.max(20, 18 + (zoom - 1) * 2)));
}

function buildPinElement(profile: MapProfile) {
  const element = document.createElement("div");
  const initial = escapeHtml((profile.full_name || profile.username || "?").slice(0, 1).toUpperCase());
  const fallback = `<span class="pin3d-person" aria-hidden="true"><span class="pin3d-head"></span><span class="pin3d-shoulders"></span><span class="pin3d-initial">${initial}</span></span>`;
  const photo = profile.avatar_url
    ? `<img class="pin3d-photo" src="${escapeHtml(profile.avatar_url)}" alt="" loading="eager" decoding="async" referrerpolicy="no-referrer" crossorigin="anonymous" onerror="this.style.display='none'" />`
    : "";
  element.className = "pin3d";
  element.title = `Open ${profile.full_name || profile.username}'s profile`;
  element.innerHTML = `<span class="pin3d-body"><span class="pin3d-face">${fallback}${photo}</span><span class="pin3d-status"></span></span><span class="pin3d-tail"></span><span class="pin3d-shadow"></span>`;
  return element;
}

function buildClusterElement(count: number, label: string) {
  const element = document.createElement("div");
  element.className = "pin-cluster";
  element.title = `${count} freelancers${label ? ` around ${label}` : ""} — zoom in to see them`;
  element.innerHTML = `<span class="pin-cluster-bubble"><span class="pin-cluster-count">${count}</span></span><span class="pin-cluster-pulse"></span>`;
  return element;
}

type Group = { key: string; lat: number; lng: number; members: MapProfile[] };

// Group nearby people into one counted bubble while the view is wide, so a busy
// region reads as "42 freelancers" instead of a pile of overlapping pins.
function groupProfiles(profiles: MapProfile[], zoom: number): Group[] {
  const placed = profiles.filter((profile) => profile.latitude != null && profile.longitude != null);
  if (zoom >= 9) {
    return placed.map((profile) => ({
      key: profile.id,
      lat: profile.latitude as number,
      lng: profile.longitude as number,
      members: [profile],
    }));
  }
  const cell = Math.max(0.05, 40 / Math.pow(2, zoom));
  const buckets = new Map<string, Group>();
  for (const profile of placed) {
    const lat = profile.latitude as number;
    const lng = profile.longitude as number;
    const key = `${Math.floor(lat / cell)}:${Math.floor(lng / cell)}`;
    const bucket = buckets.get(key);
    if (bucket) {
      bucket.members.push(profile);
      bucket.lat = (bucket.lat * (bucket.members.length - 1) + lat) / bucket.members.length;
      bucket.lng = (bucket.lng * (bucket.members.length - 1) + lng) / bucket.members.length;
    } else {
      buckets.set(key, { key, lat, lng, members: [profile] });
    }
  }
  return [...buckets.values()].map((group) =>
    group.members.length === 1 && group.members[0] ? { ...group, key: group.members[0].id } : group,
  );
}

export function FreelancerMap({
  profiles,
  selectedId,
  onSelect,
  pickLocation,
  pickedPoint,
  focusPoint,
  viewTarget,
}: {
  profiles: MapProfile[];
  selectedId: string | null;
  onSelect: (profile: MapProfile) => void;
  pickLocation: ((lat: number, lng: number) => void) | undefined;
  pickedPoint?: [number, number] | undefined;
  focusPoint?: [number, number] | undefined;
  viewTarget?: ViewTarget | undefined;
}) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const skyRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const markersRef = useRef(new Map<string, maplibregl.Marker>());
  const pickedRef = useRef<maplibregl.Marker | null>(null);
  const pickHandler = useRef(pickLocation);
  const selectHandler = useRef(onSelect);
  const spinningRef = useRef(true);
  const [zoomBucket, setZoomBucket] = useState(1);
  pickHandler.current = pickLocation;
  selectHandler.current = onSelect;

  // Hide anything sitting on the far side of the planet so pins never bleed
  // through the globe from the back.
  const applyOcclusion = useCallback(() => {
    const map = mapRef.current;
    if (!map) return;
    const transform = (map as unknown as { transform?: { isLocationOccluded?: (point: maplibregl.LngLat) => boolean } })
      .transform;
    const check = transform?.isLocationOccluded?.bind(transform);
    const hideIfBehind = (marker: maplibregl.Marker) => {
      const element = marker.getElement();
      const hidden = check ? check(marker.getLngLat()) : false;
      element.style.visibility = hidden ? "hidden" : "visible";
      element.style.pointerEvents = hidden ? "none" : "";
    };
    for (const marker of markersRef.current.values()) hideIfBehind(marker);
    if (pickedRef.current) hideIfBehind(pickedRef.current);
  }, []);

  useEffect(() => {
    const container = containerRef.current;
    const sky = skyRef.current;
    if (!container || !sky || mapRef.current) return;
    if (!earthProtocolRegistered) {
      maplibregl.addProtocol("solartexture", solarTextureProtocol);
      earthProtocolRegistered = true;
    }
    maplibregl.setWorkerUrl(workerUrl);
    const map = new maplibregl.Map({
      container,
      style: globeStyle,
      center: [0, 20],
      zoom: 1.4,
      minZoom: 0.6,
      maxZoom: 19,
      attributionControl: false,
      dragRotate: true,
      pitchWithRotate: true,
      maxPitch: 72,
      fadeDuration: 120,
    });
    map.on("error", (event) => console.error("MapLibre render error", event.error));
    mapRef.current = map;
    const skyRenderer = new THREE.WebGLRenderer({ alpha: true, antialias: true, powerPreference: "low-power" });
    skyRenderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
    skyRenderer.setClearColor(0x000000, 0);
    skyRenderer.outputColorSpace = THREE.SRGBColorSpace;
    const skyScene = new THREE.Scene();
    const skyCamera = new THREE.PerspectiveCamera(68, 1, 0.1, 120);
    const skyGeometry = new THREE.SphereGeometry(90, 96, 64);
    const skyMaterial = new THREE.MeshBasicMaterial({ side: THREE.BackSide, toneMapped: false });
    const skyGroup = new THREE.Group();
    const skySphere = new THREE.Mesh(skyGeometry, skyMaterial);
    skyGroup.add(skySphere);
    skyScene.add(skyGroup);
    sky.appendChild(skyRenderer.domElement);
    const renderSky = () => skyRenderer.render(skyScene, skyCamera);
    let skyDisposed = false;
    const textureLoader = new THREE.TextureLoader();
    const configureTexture = (texture: THREE.Texture) => {
      texture.colorSpace = THREE.SRGBColorSpace;
      texture.anisotropy = Math.min(8, skyRenderer.capabilities.getMaxAnisotropy());
      if (!skyDisposed) renderSky();
    };
    const galaxyTexture = textureLoader.load(spaceImage, configureTexture);
    galaxyTexture.colorSpace = THREE.SRGBColorSpace;
    skyMaterial.map = galaxyTexture;
    skyMaterial.color.setScalar(0.82);
    skyMaterial.needsUpdate = true;
    const resizeSky = () => {
      const width = sky.clientWidth;
      const height = sky.clientHeight;
      if (!width || !height) return;
      skyRenderer.setSize(width, height);
      skyCamera.aspect = width / height;
      skyCamera.updateProjectionMatrix();
      renderSky();
    };
    resizeSky();
    // Faster, smoother wheel/trackpad zoom: fewer scrolls per zoom level, GPU-interpolated.
    map.scrollZoom.setWheelZoomRate(1 / 160);
    map.scrollZoom.setZoomRate(1 / 60);
    map.addControl(new maplibregl.NavigationControl({ visualizePitch: true, showCompass: true }), "bottom-right");
    map.touchZoomRotate.enableRotation();

    // Sample the panorama like a celestial sphere at infinity. Camera yaw and
    // elevation move the sky in opposite directions, while zoom/position add
    // no parallax and there is no independent background animation.
    const initialCenter = map.getCenter();
    let previousSkyYaw = initialCenter.lng + map.getBearing();
    let unwrappedSkyYaw = previousSkyYaw;
    const initialSkyElevation = initialCenter.lat - map.getPitch();
    const syncSpaceBackdrop = () => {
      const sky = skyRef.current;
      if (!sky) return;
      const center = map.getCenter();
      const yaw = center.lng + map.getBearing();
      let yawDelta = yaw - previousSkyYaw;
      if (yawDelta > 180) yawDelta -= 360;
      if (yawDelta < -180) yawDelta += 360;
      unwrappedSkyYaw += yawDelta;
      previousSkyYaw = yaw;
      const elevation = center.lat - map.getPitch();
      const elevationDelta = elevation - initialSkyElevation;
      skyGroup.rotation.set(
        THREE.MathUtils.degToRad(-elevationDelta),
        THREE.MathUtils.degToRad(unwrappedSkyYaw),
        0,
        "YXZ",
      );
      renderSky();
    };

    const stopSpinning = () => { spinningRef.current = false; };
    map.on("mousedown", stopSpinning);
    map.on("touchstart", stopSpinning);
    map.on("wheel", stopSpinning);
    // Frame-rate independent idle spin (degrees per second), paused on interaction / reduced motion.
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let frame = 0;
    let last = 0;
    const spin = (time: number) => {
      const dt = last ? Math.min((time - last) / 1000, 0.05) : 0;
      last = time;
      if (spinningRef.current && !reduced && map.getZoom() <= 2.5 && !map.isMoving()) {
        const center = map.getCenter();
        center.lng -= 1.2 * dt;
        map.jumpTo({ center });
      }
      frame = requestAnimationFrame(spin);
    };
    map.once("load", () => { frame = requestAnimationFrame(spin); });

    const applySizes = () => {
      const size = pinSize(map.getZoom());
      for (const marker of markersRef.current.values()) {
        const element = marker.getElement();
        const body = element.querySelector<HTMLElement>(".pin3d-body");
        const scaled = element.classList.contains("pin3d-selected") ? Math.round(size * 1.18) : size;
        if (body) body.style.setProperty("--pin-size", `${scaled}px`);
      }
    };
    map.on("zoom", applySizes);
    map.on("render", applyOcclusion);
    map.on("render", syncSpaceBackdrop);
    map.on("resize", resizeSky);
    map.on("zoomend", () => {
      setZoomBucket(Math.round(map.getZoom() * 2) / 2);
      // Level out to a straight-on globe view when the user pulls back out to world scale.
      if (map.getZoom() < 5 && map.getPitch() > 1) map.easeTo({ pitch: 0, duration: 500 });
    });
    map.on("click", (event: MapMouseEvent) => pickHandler.current?.(event.lngLat.lat, event.lngLat.lng));
    map.once("load", () => {
      applySizes();
      syncSpaceBackdrop();
    });

    return () => {
      cancelAnimationFrame(frame);
      skyDisposed = true;
      galaxyTexture.dispose();
      skyGeometry.dispose();
      skyMaterial.dispose();
      skyRenderer.dispose();
      skyRenderer.domElement.remove();
      markersRef.current.clear();
      pickedRef.current = null;
      map.remove();
      mapRef.current = null;
    };
  }, [applyOcclusion]);

  // Sync markers (people and grouped bubbles) with the visible freelancers.
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const markers = markersRef.current;
    const groups = groupProfiles(profiles, zoomBucket);
    const seen = new Set<string>();
    const size = pinSize(map.getZoom());
    for (const group of groups) {
      seen.add(group.key);
      const single = group.members.length === 1 ? group.members[0] : null;
      const existing = markers.get(group.key);
      const isClusterMarker = existing?.getElement().classList.contains("pin-cluster");
      if (existing && Boolean(single) === !isClusterMarker) {
        existing.setLngLat([group.lng, group.lat]);
      } else {
        existing?.remove();
        const element = single
          ? buildPinElement(single)
          : buildClusterElement(group.members.length, group.members[0]?.location_name ?? "");
        element.addEventListener("click", (event) => {
          event.stopPropagation();
          if (single) {
            selectHandler.current(single);
            return;
          }
          map.flyTo({ center: [group.lng, group.lat], zoom: Math.max(map.getZoom() + 3, 6), essential: true });
        });
        const marker = new maplibregl.Marker({
          element,
          anchor: single ? "bottom" : "center",
          pitchAlignment: "viewport",
          rotationAlignment: "viewport",
        })
          .setLngLat([group.lng, group.lat])
          .addTo(map);
        markers.set(group.key, marker);
      }
      if (single) {
        const marker = markers.get(group.key);
        if (!marker) continue;
        const element = marker.getElement();
        element.classList.toggle("pin3d-selected", single.id === selectedId);
        element.classList.toggle("pin3d-available", single.is_available);
        const body = element.querySelector<HTMLElement>(".pin3d-body");
        if (body) body.style.setProperty("--pin-size", `${single.id === selectedId ? Math.round(size * 1.18) : size}px`);
      }
    }
    for (const [key, marker] of markers) {
      if (seen.has(key)) continue;
      marker.remove();
      markers.delete(key);
    }
    applyOcclusion();
  }, [profiles, selectedId, zoomBucket, applyOcclusion]);

  // Marker for the point being chosen while setting up a profile.
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    if (!pickedPoint) {
      pickedRef.current?.remove();
      pickedRef.current = null;
      return;
    }
    if (!pickedRef.current) {
      const element = document.createElement("div");
      element.className = "pin3d pin3d-picked";
      element.innerHTML =
        '<span class="pin3d-body" style="--pin-size:38px"><span class="pin3d-face"><span class="pin3d-person"><span class="pin3d-head"></span><span class="pin3d-shoulders"></span></span></span></span><span class="pin3d-tail"></span><span class="pin3d-shadow"></span>';
      pickedRef.current = new maplibregl.Marker({ element, anchor: "bottom", pitchAlignment: "viewport", rotationAlignment: "viewport" })
        .setLngLat([pickedPoint[1], pickedPoint[0]])
        .addTo(map);
    } else {
      pickedRef.current.setLngLat([pickedPoint[1], pickedPoint[0]]);
    }
  }, [pickedPoint]);

  // Google-Earth style swoop to a chosen country, favourite or the visitor's own city.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !viewTarget) return;
    spinningRef.current = false;
    map.flyTo({
      center: [viewTarget.center[1], viewTarget.center[0]],
      zoom: viewTarget.zoom,
      pitch: viewTarget.zoom > 6 ? 45 : 0,
      bearing: 0,
      curve: 1.5,
      speed: 0.85,
      essential: true,
    });
  }, [viewTarget?.key]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !focusPoint) return;
    map.easeTo({ center: [focusPoint[1], focusPoint[0]], zoom: Math.max(map.getZoom(), 12), duration: 900 });
  }, [focusPoint]);

  return (
    <div className="atlas-space h-full w-full">
      <div ref={skyRef} className="atlas-space-sky" aria-hidden="true" />
      <div ref={containerRef} className="atlas-map h-full w-full" />
      <div className="atlas-map-credits">
        <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">© OpenStreetMap</a>
        <span> · Earth imagery © Esri, Maxar, Earthstar Geographics</span>
        <span> · Earth and space textures © Solar System Scope, CC BY 4.0</span>
      </div>
    </div>
  );
}
