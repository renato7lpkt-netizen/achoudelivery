import { useEffect, useRef } from "react";
import type * as Leaflet from "leaflet";

type LatLng = { lat: number; lng: number };

const badge = (emoji: string, bg: string) =>
  `<div style="display:grid;place-items:center;width:38px;height:38px;border-radius:9999px;background:${bg};border:3px solid #fff;box-shadow:0 2px 8px rgba(0,0,0,.3);font-size:20px">${emoji}</div>`;
const HOME = `<svg xmlns="http://www.w3.org/2000/svg" width="34" height="42" viewBox="0 0 36 44"><path d="M18 43C18 43 33 27.5 33 17A15 15 0 1 0 3 17C3 27.5 18 43 18 43Z" fill="#ea580c" stroke="#fff" stroke-width="2.5"/><circle cx="18" cy="17" r="5.5" fill="#fff"/></svg>`;

/**
 * Order tracking map (OpenStreetMap tiles, free): the store, the delivery point and, once on the way with the
 * courier sharing GPS, the courier moving. Fits all points; `minutesLeft` shows as a chip like "9 min".
 * Leaflet touches `window`, so it loads only in the browser.
 */
export function OrderMap({ store, home, courier, minutesLeft }: { store: LatLng | null; home: LatLng; courier: LatLng | null; minutesLeft: number | null }) {
  const el = useRef<HTMLDivElement>(null);
  const L = useRef<typeof Leaflet | null>(null);
  const map = useRef<Leaflet.Map | null>(null);
  const courierMk = useRef<Leaflet.Marker | null>(null);
  const pts = useRef({ store, home, courier });
  pts.current = { store, home, courier };

  const fit = () => {
    const m = map.current, { store: s, home: h, courier: c } = pts.current;
    if (!m) return;
    const all = [h, s, c].filter((p): p is LatLng => !!p).map((p) => [p.lat, p.lng] as [number, number]);
    if (all.length === 1) m.setView(all[0]!, 16);
    else m.fitBounds(all, { padding: [40, 40], maxZoom: 17 });
  };

  useEffect(() => {
    let gone = false;
    (async () => {
      const [{ default: lib }] = await Promise.all([import("leaflet"), import("leaflet/dist/leaflet.css")]);
      if (gone || !el.current || map.current) return;
      L.current = lib;
      const m = lib.map(el.current, { scrollWheelZoom: false, zoomControl: false, attributionControl: true });
      lib.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", { maxZoom: 19, attribution: "© OpenStreetMap" }).addTo(m);
      const { store: s, home: h } = pts.current;
      lib.marker([h.lat, h.lng], { icon: lib.divIcon({ className: "", html: HOME, iconSize: [34, 42], iconAnchor: [17, 40] }), title: "Entrega" }).addTo(m);
      if (s) lib.marker([s.lat, s.lng], { icon: lib.divIcon({ className: "", html: badge("🏪", "#fde68a"), iconSize: [38, 38], iconAnchor: [19, 19] }), title: "Loja" }).addTo(m);
      map.current = m;
      const c = pts.current.courier;
      if (c) courierMk.current = lib.marker([c.lat, c.lng], { icon: lib.divIcon({ className: "", html: badge("🛵", "#facc15"), iconSize: [38, 38], iconAnchor: [19, 19] }), title: "Entregador", zIndexOffset: 1000 }).addTo(m);
      fit();
    })();
    return () => { gone = true; map.current?.remove(); map.current = null; courierMk.current = null; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // The courier moves: add the marker the first time, then slide it and keep everything in view.
  useEffect(() => {
    const lib = L.current, m = map.current;
    if (!lib || !m) return;
    if (!courier) { courierMk.current?.remove(); courierMk.current = null; fit(); return; }
    if (!courierMk.current) {
      courierMk.current = lib.marker([courier.lat, courier.lng], { icon: lib.divIcon({ className: "", html: badge("🛵", "#facc15"), iconSize: [38, 38], iconAnchor: [19, 19] }), title: "Entregador", zIndexOffset: 1000 }).addTo(m);
    } else courierMk.current.setLatLng([courier.lat, courier.lng]);
    fit();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [courier?.lat, courier?.lng]);

  return (
    // isolate: Leaflet panes use z-index up to 1000 and would cover the header.
    <div className="relative isolate mt-4 overflow-hidden rounded-2xl border">
      <div ref={el} className="h-64 w-full" />
      {minutesLeft != null && (
        <span className="pointer-events-none absolute left-3 top-3 z-[1000] rounded-full bg-background px-3 py-1 text-sm font-extrabold shadow">{minutesLeft} min</span>
      )}
    </div>
  );
}
