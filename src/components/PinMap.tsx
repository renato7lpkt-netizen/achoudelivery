import { useEffect, useRef } from "react";
import type * as Leaflet from "leaflet";
import { Hand } from "lucide-react";

type LatLng = { lat: number; lng: number };

const PIN = `<svg xmlns="http://www.w3.org/2000/svg" width="36" height="44" viewBox="0 0 36 44"><path d="M18 43C18 43 33 27.5 33 17A15 15 0 1 0 3 17C3 27.5 18 43 18 43Z" fill="#ea580c" stroke="#fff" stroke-width="2.5"/><circle cx="18" cy="17" r="5.5" fill="#fff"/></svg>`;

/**
 * Map with a draggable pin so the customer puts the delivery point on the door (OpenStreetMap tiles, free).
 * The confirmed pin is what the order saves, so the fee and the courier's route use the real spot.
 * Leaflet touches `window`, so it loads only in the browser.
 */
export function PinMap({ value, onChange }: { value: LatLng; onChange: (p: LatLng) => void }) {
  const el = useRef<HTMLDivElement>(null);
  const map = useRef<Leaflet.Map | null>(null);
  const marker = useRef<Leaflet.Marker | null>(null);
  const change = useRef(onChange);
  change.current = onChange;
  const start = useRef(value); // Leaflet loads async; open it where the pin is by then
  start.current = value;

  useEffect(() => {
    let gone = false;
    (async () => {
      const [{ default: L }] = await Promise.all([import("leaflet"), import("leaflet/dist/leaflet.css")]);
      if (gone || !el.current || map.current) return;
      const { lat, lng } = start.current;
      const m = L.map(el.current, { scrollWheelZoom: false }).setView([lat, lng], 17);
      L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", { maxZoom: 19, attribution: "© OpenStreetMap" }).addTo(m);
      const icon = L.divIcon({ className: "", html: PIN, iconSize: [36, 44], iconAnchor: [18, 42] });
      const mk = L.marker([lat, lng], { draggable: true, icon, autoPan: true }).addTo(m);
      const send = (p: Leaflet.LatLng) => change.current({ lat: p.lat, lng: p.lng });
      mk.on("dragend", () => send(mk.getLatLng()));
      m.on("click", (e: Leaflet.LeafletMouseEvent) => { mk.setLatLng(e.latlng); send(e.latlng); });
      map.current = m; marker.current = mk;
    })();
    return () => { gone = true; map.current?.remove(); map.current = null; marker.current = null; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // A new address was found elsewhere (typed, suggestion, GPS): move the pin there.
  useEffect(() => {
    const mk = marker.current, m = map.current;
    if (!mk || !m) return;
    const cur = mk.getLatLng();
    if (Math.abs(cur.lat - value.lat) < 1e-7 && Math.abs(cur.lng - value.lng) < 1e-7) return;
    mk.setLatLng([value.lat, value.lng]);
    m.setView([value.lat, value.lng], 17);
  }, [value.lat, value.lng]);

  return (
    // isolate: Leaflet panes use z-index up to 1000 and would cover the header and the pay bar.
    <div className="isolate mt-3 overflow-hidden rounded-xl border">
      <p className="flex items-center gap-1.5 bg-accent px-3 py-2 text-xs font-semibold"><Hand className="h-3.5 w-3.5 text-primary" />Arraste o alfinete até a sua porta (ou toque no mapa)</p>
      <div ref={el} className="h-56 w-full" />
    </div>
  );
}
