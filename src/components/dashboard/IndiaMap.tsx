import { useEffect, useRef, useState } from "react";
import * as maplibregl from "maplibre-gl";
import type { Map as MapInstance } from "maplibre-gl";
import { Bot, Check, ChevronRight, Layers3, LocateFixed, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { mapLayers } from "@/data/dashboard";

const INDIA_CENTER: [number, number] = [79.1, 22.8];
const DEMO_POINTS = {
  type: "FeatureCollection",
  features: [
    [73.85, 18.52, "Pune", "agriculture"], [77.59, 12.97, "Bengaluru", "land"],
    [78.48, 17.38, "Hyderabad", "disputes"], [75.79, 26.91, "Jaipur", "climate"],
    [85.31, 23.34, "Ranchi", "forest"], [88.36, 22.57, "Kolkata", "water"],
    [72.57, 23.02, "Ahmedabad", "infrastructure"], [80.27, 13.08, "Chennai", "policy"],
    [76.27, 9.93, "Kochi", "protected"], [81.63, 21.25, "Raipur", "socio"],
  ].map(([lng, lat, name, kind], i) => ({
    type: "Feature", id: i, properties: { name, kind },
    geometry: { type: "Point", coordinates: [lng as number, lat as number] },
  })),
};

export function IndiaMap() {
  const container = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapInstance | null>(null);
  const [activeLayers, setActiveLayers] = useState<Set<string>>(() => new Set(mapLayers.filter((l) => l.default).map((l) => l.id)));
  const [mapMode, setMapMode] = useState("Map");
  const [query, setQuery] = useState("");
  const [layerOpen, setLayerOpen] = useState(true);

  useEffect(() => {
    if (!container.current || mapRef.current) return;
    const map = new maplibregl.Map({
      container: container.current,
      center: INDIA_CENTER,
      zoom: 3.75,
      minZoom: 3,
      maxZoom: 12,
      attributionControl: false,
      style: {
        version: 8,
        sources: {
          osm: { type: "raster", tiles: ["https://tile.openstreetmap.org/{z}/{x}/{y}.png"], tileSize: 256, attribution: "© OpenStreetMap contributors" },
        },
        layers: [{ id: "osm", type: "raster", source: "osm", paint: { "raster-saturation": -0.55, "raster-opacity": 0.76, "raster-contrast": -0.05 } }],
      },
    });
    map.addControl(new maplibregl.NavigationControl({ showCompass: false }), "top-right");
    map.addControl(new maplibregl.ScaleControl({ maxWidth: 100, unit: "metric" }), "bottom-left");
    map.on("load", () => {
      map.addSource("demo", { type: "geojson", data: DEMO_POINTS as maplibregl.GeoJSONSourceSpecification["data"] });
      map.addLayer({ id: "demo-heat", type: "circle", source: "demo", paint: {
        "circle-radius": ["interpolate", ["linear"], ["zoom"], 3, 20, 8, 45],
        "circle-color": ["match", ["get", "kind"], "forest", "#28785d", "water", "#3b82a0", "agriculture", "#d9a62e", "disputes", "#b95842", "climate", "#df7e3d", "#5f8f62"],
        "circle-opacity": 0.52, "circle-blur": 0.45, "circle-stroke-width": 1, "circle-stroke-color": "#ffffff",
      }});
    });
    mapRef.current = map;
    return () => { map.remove(); mapRef.current = null; };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map?.getLayer("demo-heat")) return;
    const visibleKinds = [...activeLayers];
    map.setFilter("demo-heat", ["in", ["get", "kind"], ["literal", visibleKinds]]);
  }, [activeLayers]);

  const toggleLayer = (id: string) => setActiveLayers((current) => {
    const next = new Set(current); next.has(id) ? next.delete(id) : next.add(id); return next;
  });

  const handleSearch = (event: React.FormEvent) => {
    event.preventDefault();
    if (!query.trim()) return;
    const locations: Record<string, [number, number]> = { pune: [73.8567, 18.5204], delhi: [77.209, 28.6139], mumbai: [72.8777, 19.076], bengaluru: [77.5946, 12.9716], jaipur: [75.7873, 26.9124] };
    const match = Object.entries(locations).find(([name]) => query.toLowerCase().includes(name));
    mapRef.current?.flyTo({ center: match?.[1] ?? INDIA_CENTER, zoom: match ? 9 : 4.2, duration: 900 });
  };

  return (
    <section className="map-shell" aria-label="Interactive India land intelligence map">
      <div ref={container} className="map-canvas" />
      <div className="map-title"><span>DEMO INTELLIGENCE VIEW</span><strong>India’s Land<br />in Perspective</strong><p>Explore. Analyse. Act.</p></div>
      <form className="map-search" onSubmit={handleSearch}><Search aria-hidden="true" /><input value={query} onChange={(e) => setQuery(e.target.value)} aria-label="Search map location" placeholder="Search location e.g. Pune, 411001" /></form>
      <Button className="map-locate" size="icon" variant="outline" aria-label="Return map to India" onClick={() => mapRef.current?.flyTo({ center: INDIA_CENTER, zoom: 3.75 })}><LocateFixed /></Button>
      <button className="layer-toggle" aria-label="Toggle map layers" onClick={() => setLayerOpen((v) => !v)}><Layers3 /> Layers</button>
      {layerOpen && <div className="layers-panel" aria-label="Map layers"><div><strong>Layers</strong><button onClick={() => setActiveLayers(new Set())}>Clear all</button></div>{mapLayers.map((layer) => <label key={layer.id}><input type="checkbox" checked={activeLayers.has(layer.id)} onChange={() => toggleLayer(layer.id)} /><span className={`layer-check ${layer.color}`}>{activeLayers.has(layer.id) && <Check />}</span>{layer.label}</label>)}</div>}
      <button className="ai-map"><Bot /><span><strong>AI Map Assistant</strong><small>Ask about any location</small></span><ChevronRight /></button>
      <div className="map-modes" role="group" aria-label="Map style">{["Map", "Satellite", "Hybrid"].map((mode) => <button className={mapMode === mode ? "active" : ""} key={mode} onClick={() => setMapMode(mode)}>{mode}</button>)}</div>
      <div className="demo-label">Demo layers · Not official government data</div>
    </section>
  );
}
