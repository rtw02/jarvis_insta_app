"use client";

import { useEffect, useRef, useState } from "react";
import type { CalendarEvent } from "@/lib/google";

interface RouteOption {
  durationMin: number;
  distanceMi: number;
  geometry: { type: string; coordinates: [number, number][] };
}

interface CommuteResult {
  eventName: string;
  location: string;
  startTime: string;
  transitEmbed: string;
  transitLink: string;
  walkRoute: RouteOption | null;
  carRoutes: RouteOption[];
  error?: string;
}

type Mode = "transit" | "walk" | "car";

// ── Geolocation ───────────────────────────────────────────────────────────────
async function getPosition(): Promise<GeolocationCoordinates> {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) { reject(new Error("Geolocation not supported")); return; }
    navigator.geolocation.getCurrentPosition(pos => resolve(pos.coords), reject, { timeout: 8000 });
  });
}

// ── Geocoding ─────────────────────────────────────────────────────────────────
async function geocodeQuery(q: string): Promise<{ lat: number; lon: number } | null> {
  const res = await fetch(
    `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(q)}&format=json&limit=1`,
    { headers: { "User-Agent": "ryan-ai-personal-dashboard/1.0" } }
  );
  if (!res.ok) return null;
  const data = await res.json();
  return data[0] ? { lat: parseFloat(data[0].lat), lon: parseFloat(data[0].lon) } : null;
}

async function geocode(address: string): Promise<{ lat: number; lon: number } | null> {
  const r = await geocodeQuery(address);
  if (r) return r;
  const idx = address.indexOf(",");
  if (idx > 0) return geocodeQuery(address.slice(idx + 1).trim());
  return null;
}

// ── OSRM routing ──────────────────────────────────────────────────────────────
async function osrmRoute(
  profile: "driving" | "walking",
  fromLat: number, fromLon: number,
  toLat: number, toLon: number,
  alternatives = false
): Promise<RouteOption[]> {
  const url =
    `https://router.project-osrm.org/route/v1/${profile}/` +
    `${fromLon},${fromLat};${toLon},${toLat}` +
    `?overview=full&geometries=geojson&alternatives=${alternatives}`;
  const res = await fetch(url);
  if (!res.ok) return [];
  const data = await res.json();
  if (data.code !== "Ok") return [];
  return (data.routes ?? []).map((r: { duration: number; distance: number; geometry: RouteOption["geometry"] }) => ({
    durationMin: Math.round(r.duration / 60),
    distanceMi: Math.round(r.distance / 1609.34 * 10) / 10,
    geometry: r.geometry,
  }));
}

function transitEmbedUrl(fromLat: number, fromLon: number, address: string): string {
  return (
    `https://maps.google.com/maps` +
    `?saddr=${fromLat},${fromLon}` +
    `&daddr=${encodeURIComponent(address)}` +
    `&dirflg=r&output=embed`
  );
}

function transitDeepLink(fromLat: number, fromLon: number, address: string): string {
  return (
    `https://www.google.com/maps/dir/?api=1` +
    `&origin=${fromLat},${fromLon}` +
    `&destination=${encodeURIComponent(address)}` +
    `&travelmode=transit`
  );
}

function formatTime(dt: string) {
  return new Date(dt).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
}

// ── Leaflet map ───────────────────────────────────────────────────────────────
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let leafletLoaded: Promise<any> | null = null;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function loadLeaflet(): Promise<any> {
  if (leafletLoaded) return leafletLoaded;
  leafletLoaded = new Promise(resolve => {
    if ((window as unknown as Record<string, unknown>)["L"]) { resolve((window as Record<string, unknown>)["L"]); return; }
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";
    document.head.appendChild(link);
    const script = document.createElement("script");
    script.src = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.js";
    script.onload = () => resolve((window as Record<string, unknown>)["L"]);
    document.head.appendChild(script);
  });
  return leafletLoaded;
}

interface MapProps {
  fromLat: number; fromLon: number;
  toLat: number; toLon: number;
  routes: RouteOption[];
  selectedIdx: number;
  color: string;
}

function RouteMap({ fromLat, fromLon, toLat, toLon, routes, selectedIdx, color }: MapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const mapRef = useRef<any>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const layersRef = useRef<any[]>([]);

  useEffect(() => {
    if (!containerRef.current || routes.length === 0) return;
    let cancelled = false;

    loadLeaflet().then(L => {
      if (cancelled || !containerRef.current) return;

      if (!mapRef.current) {
        mapRef.current = L.map(containerRef.current, { zoomControl: false, attributionControl: false });
        L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png").addTo(mapRef.current);
        L.circleMarker([fromLat, fromLon], { radius: 7, color: "#00D4FF", fillColor: "#00D4FF", fillOpacity: 1 }).addTo(mapRef.current);
        L.circleMarker([toLat, toLon], { radius: 7, color: "#FF6B35", fillColor: "#FF6B35", fillOpacity: 1 }).addTo(mapRef.current);
      }

      layersRef.current.forEach(l => l.remove());
      layersRef.current = [];

      routes.forEach((r, i) => {
        const isSelected = i === selectedIdx;
        const layer = L.geoJSON(r.geometry, {
          style: { color: isSelected ? color : "rgba(255,255,255,0.12)", weight: isSelected ? 4 : 2 },
        }).addTo(mapRef.current);
        layersRef.current.push(layer);
      });

      const sel = layersRef.current[selectedIdx];
      if (sel) mapRef.current.fitBounds(sel.getBounds(), { padding: [20, 20] });
    });

    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [routes, selectedIdx, color]);

  useEffect(() => () => { if (mapRef.current) { mapRef.current.remove(); mapRef.current = null; } }, []);

  return (
    <div ref={containerRef} style={{ height: "200px", borderRadius: "6px", overflow: "hidden", filter: "invert(0.9) hue-rotate(180deg) saturate(0.7)" }} />
  );
}

// ── Main widget ───────────────────────────────────────────────────────────────
const MODE_CONFIG: Record<Mode, { label: string; icon: string; color: string }> = {
  transit: { label: "TRANSIT", icon: "◎", color: "#00FF88" },
  walk:    { label: "WALK",    icon: "◇", color: "#00D4FF" },
  car:     { label: "CAR",     icon: "◈", color: "#FF6B35" },
};
const MODES: Mode[] = ["transit", "walk", "car"];

export default function CommuteWidget({ events }: { events: CalendarEvent[] }) {
  const [results, setResults] = useState<CommuteResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [geoError, setGeoError] = useState("");
  const [selectedEvent, setSelectedEvent] = useState(0);
  const [mode, setMode] = useState<Mode>("transit");
  const [selectedCarRoute, setSelectedCarRoute] = useState(0);
  const [coords, setCoords] = useState<{ lat: number; lon: number } | null>(null);
  const [destCoords, setDestCoords] = useState<Record<number, { lat: number; lon: number }>>({});

  const eventsWithLocation = events.filter(e => e.location && e.start?.dateTime);

  useEffect(() => {
    if (eventsWithLocation.length === 0) { setLoading(false); return; }
    let cancelled = false;

    (async () => {
      let pos: GeolocationCoordinates;
      try { pos = await getPosition(); }
      catch { setGeoError("Enable location access to see commute times"); setLoading(false); return; }

      const origin = { lat: pos.latitude, lon: pos.longitude };
      if (!cancelled) setCoords(origin);

      const out: CommuteResult[] = [];
      const dests: Record<number, { lat: number; lon: number }> = {};

      for (let i = 0; i < eventsWithLocation.length; i++) {
        if (cancelled) break;
        const evt = eventsWithLocation[i];
        try {
          const dest = await geocode(evt.location!);
          if (!dest) {
            out.push({ eventName: evt.summary, location: evt.location!, startTime: evt.start!.dateTime!, transitEmbed: "", transitLink: "", walkRoute: null, carRoutes: [], error: "Location not found" });
          } else {
            dests[i] = dest;
            await new Promise(r => setTimeout(r, 1100)); // Nominatim ToS: 1 req/sec
            const [carRoutes, walkRoutes] = await Promise.all([
              osrmRoute("driving", origin.lat, origin.lon, dest.lat, dest.lon, true),
              osrmRoute("walking", origin.lat, origin.lon, dest.lat, dest.lon, false),
            ]);
            out.push({
              eventName: evt.summary,
              location: evt.location!,
              startTime: evt.start!.dateTime!,
              transitEmbed: transitEmbedUrl(origin.lat, origin.lon, evt.location!),
              transitLink: transitDeepLink(origin.lat, origin.lon, evt.location!),
              walkRoute: walkRoutes[0] ?? null,
              carRoutes,
            });
          }
        } catch {
          out.push({ eventName: evt.summary, location: evt.location!, startTime: evt.start!.dateTime!, transitEmbed: "", transitLink: "", walkRoute: null, carRoutes: [], error: "Routing failed" });
        }
      }

      if (!cancelled) { setResults(out); setDestCoords(dests); setLoading(false); }
    })();

    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [events]);

  if (eventsWithLocation.length === 0) return null;

  const current = results[selectedEvent];
  const currentDest = destCoords[selectedEvent];
  const cfg = MODE_CONFIG[mode];

  return (
    <div className="border-glow rounded-lg p-4 font-mono text-xs" style={{ background: "rgba(0,212,255,0.02)" }}>
      <div className="text-cyan-jarvis opacity-40 tracking-widest mb-3">// COMMUTE</div>

      {geoError && <p className="text-jarvis-text opacity-40">{geoError}</p>}
      {loading && !geoError && (
        <div className="flex items-center gap-2 text-jarvis-text opacity-40">
          <span className="animate-pulse">◌</span>
          <span className="tracking-widest">CALCULATING ROUTES...</span>
        </div>
      )}

      {/* Event tabs (if multiple) */}
      {results.length > 1 && (
        <div className="flex gap-2 mb-3 flex-wrap">
          {results.map((r, i) => (
            <button key={i} onClick={() => { setSelectedEvent(i); setSelectedCarRoute(0); }}
              className="px-2 py-1 rounded tracking-widest transition-all"
              style={{
                border: `1px solid ${selectedEvent === i ? "rgba(0,212,255,0.5)" : "rgba(255,255,255,0.1)"}`,
                color: selectedEvent === i ? "#00D4FF" : "rgba(255,255,255,0.3)",
                background: selectedEvent === i ? "rgba(0,212,255,0.06)" : "transparent",
              }}>
              {r.eventName}
            </button>
          ))}
        </div>
      )}

      {current && (
        <>
          <div className="mb-4 space-y-0.5">
            <div className="text-jarvis-text opacity-70">{current.eventName}</div>
            <div className="text-jarvis-text opacity-30 truncate">{current.location}</div>
            <div className="text-jarvis-text opacity-30">{formatTime(current.startTime)}</div>
          </div>

          {current.error && <div className="text-jarvis-text opacity-30 mb-3">{current.error}</div>}

          {/* Mode selector */}
          {!current.error && (
            <div className="flex gap-2 mb-4">
              {MODES.map(m => {
                const c = MODE_CONFIG[m];
                const active = mode === m;
                let timeLabel: string | null = null;
                if (m === "walk" && current.walkRoute) timeLabel = `${current.walkRoute.durationMin} MIN`;
                if (m === "car" && current.carRoutes[0]) timeLabel = `${current.carRoutes[0].durationMin} MIN`;
                return (
                  <button key={m} onClick={() => setMode(m)}
                    className="flex-1 py-2 rounded tracking-widest transition-all text-center"
                    style={{
                      border: `1px solid ${active ? c.color + "80" : "rgba(255,255,255,0.08)"}`,
                      background: active ? c.color + "12" : "transparent",
                      color: active ? c.color : "rgba(255,255,255,0.3)",
                    }}>
                    <div className="text-base mb-0.5">{c.icon}</div>
                    <div>{c.label}</div>
                    {timeLabel && (
                      <div className="text-xs mt-0.5" style={{ opacity: active ? 0.9 : 0.5 }}>{timeLabel}</div>
                    )}
                  </button>
                );
              })}
            </div>
          )}

          {/* Transit panel */}
          {mode === "transit" && !current.error && (
            <div className="space-y-2">
              {current.transitEmbed ? (
                <iframe
                  src={current.transitEmbed}
                  width="100%"
                  height="260"
                  style={{ border: "none", borderRadius: "6px", display: "block" }}
                  loading="lazy"
                  referrerPolicy="no-referrer-when-downgrade"
                />
              ) : (
                <div className="text-jarvis-text opacity-30 tracking-widest py-4 text-center">LOCATION NOT GEOCODED</div>
              )}
              <a href={current.transitLink} target="_blank" rel="noopener noreferrer"
                className="block text-center tracking-widest opacity-40 hover:opacity-70 transition-opacity text-xs"
                style={{ color: "#00FF88" }}>
                OPEN IN GOOGLE MAPS →
              </a>
            </div>
          )}

          {/* Walk panel */}
          {mode === "walk" && !current.error && (
            <>
              {current.walkRoute ? (
                <div className="flex items-center gap-3 mb-4 px-3 py-2 rounded" style={{ background: "rgba(0,212,255,0.06)", border: "1px solid rgba(0,212,255,0.2)" }}>
                  <span className="text-2xl font-bold" style={{ color: "#00D4FF" }}>{current.walkRoute.durationMin}</span>
                  <div>
                    <div style={{ color: "#00D4FF" }} className="font-bold tracking-widest">MIN WALK</div>
                    <div className="text-jarvis-text opacity-30">{current.walkRoute.distanceMi} mi</div>
                  </div>
                </div>
              ) : (
                <div className="text-jarvis-text opacity-30 mb-4">Walk route unavailable</div>
              )}
              {coords && currentDest && current.walkRoute && (
                <RouteMap
                  fromLat={coords.lat} fromLon={coords.lon}
                  toLat={currentDest.lat} toLon={currentDest.lon}
                  routes={[current.walkRoute]}
                  selectedIdx={0}
                  color="#00D4FF"
                />
              )}
            </>
          )}

          {/* Car panel */}
          {mode === "car" && !current.error && (
            <>
              {current.carRoutes.length > 0 ? (
                <>
                  <div className="flex gap-2 mb-4 flex-wrap">
                    {current.carRoutes.map((r, i) => (
                      <button key={i} onClick={() => setSelectedCarRoute(i)}
                        className="flex items-center gap-2 px-3 py-2 rounded transition-all"
                        style={{
                          border: `1px solid ${selectedCarRoute === i ? "rgba(255,107,53,0.5)" : "rgba(255,255,255,0.08)"}`,
                          background: selectedCarRoute === i ? "rgba(255,107,53,0.1)" : "transparent",
                        }}>
                        <span className="font-bold text-sm" style={{ color: "#FF6B35" }}>{r.durationMin} min</span>
                        <span className="text-jarvis-text opacity-40">{r.distanceMi} mi</span>
                        {i === 0 && <span className="text-jarvis-text opacity-30">FASTEST</span>}
                      </button>
                    ))}
                  </div>
                  {coords && currentDest && (
                    <RouteMap
                      fromLat={coords.lat} fromLon={coords.lon}
                      toLat={currentDest.lat} toLon={currentDest.lon}
                      routes={current.carRoutes}
                      selectedIdx={selectedCarRoute}
                      color="#FF6B35"
                    />
                  )}
                </>
              ) : (
                <div className="text-jarvis-text opacity-30">Car route unavailable</div>
              )}
            </>
          )}
        </>
      )}
    </div>
  );
}
