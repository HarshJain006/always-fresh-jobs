import { useEffect, useRef } from "react";
import * as maplibregl from "maplibre-gl";
import type { Map as MapLibreMap, Marker } from "maplibre-gl";
import workerUrl from "maplibre-gl/dist/maplibre-gl-worker.mjs?url";
import "maplibre-gl/dist/maplibre-gl.css";
import type { Destination } from "./GlobeScene";

const STYLE = "https://tiles.openfreemap.org/styles/liberty";
maplibregl.setWorkerUrl(workerUrl);

export function DetailMap({ destination, zoomCommand, onCenter }: { destination: Destination | null; zoomCommand: { direction: number; id: number } | null; onCenter: (lat: number, lon: number) => void }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const markerRef = useRef<Marker | null>(null);
  const callbackRef = useRef(onCenter);
  callbackRef.current = onCenter;

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const map = new maplibregl.Map({
      container,
      style: STYLE,
      center: destination ? [destination.lon, destination.lat] : [0, 20],
      zoom: destination ? 11 : 2,
      minZoom: 1,
      maxZoom: 19,
      attributionControl: false,
    });
    map.addControl(new maplibregl.AttributionControl({ compact: true }), "bottom-right");
    map.on("moveend", () => {
      const center = map.getCenter();
      callbackRef.current(center.lat, center.lng);
    });
    mapRef.current = map;
    const resize = new ResizeObserver(() => map.resize());
    resize.observe(container);
    return () => {
      resize.disconnect();
      markerRef.current?.remove();
      markerRef.current = null;
      mapRef.current = null;
      map.remove();
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    markerRef.current?.remove();
    markerRef.current = null;
    if (destination) {
      const markerColor = getComputedStyle(document.documentElement).getPropertyValue("--destructive").trim();
      markerRef.current = new maplibregl.Marker({ color: markerColor }).setLngLat([destination.lon, destination.lat]).addTo(map);
      map.flyTo({ center: [destination.lon, destination.lat], zoom: 11, duration: 1100 });
    }
  }, [destination]);

  useEffect(() => {
    if (!zoomCommand) return;
    if (zoomCommand.direction > 0) mapRef.current?.zoomIn();
    else mapRef.current?.zoomOut();
  }, [zoomCommand]);

  return <div ref={containerRef} className="earth-detail-map" aria-label="Interactive detailed map" />;
}
