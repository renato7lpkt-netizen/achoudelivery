import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { CITY_CENTER, haversineKm, type GeoHit } from "./market";

/**
 * TomTom address search (Orbis Places), called from the server so the key stays private
 * (TOMTOM_API_KEY, free monthly tier). Every function answers null/[] when the key is missing
 * or TomTom fails, and the caller falls back to OpenStreetMap.
 * TomTom terms (11.4) forbid storing its results: suggestions are only shown, and the position the
 * order saves is the pin the customer confirms on the map (see PinMap).
 */
const key = () => process.env["TOMTOM_API_KEY"] ?? "";
const BASE = "https://api.tomtom.com/maps/orbis/places";
const CITY_RADIUS_M = 30000;
const inCity = (p: { lat: number; lng: number }) => haversineKm(CITY_CENTER, p) <= CITY_RADIUS_M / 1000;
const point = { type: "point", coordinates: [CITY_CENTER.lng, CITY_CENTER.lat] };
const cleanParts = (parts: (string | undefined | null)[]) => parts.filter((s): s is string => !!s && !/^(brasil|brazil)$/i.test(s.trim()));

export type AddressSuggestion = { label: string };

export const suggestAddress = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ q: z.string().trim().min(3).max(120) }).parse(d))
  .handler(async ({ data }): Promise<AddressSuggestion[]> => {
    if (!key()) return [];
    try {
      const res = await fetch(`${BASE}/suggest`, {
        method: "POST",
        headers: { "TomTom-Api-Key": key(), "TomTom-Api-Version": "3", Attributes: "results", "Content-Type": "application/json", "Accept-Language": "pt-BR" },
        body: JSON.stringify({
          query: data.q, maxResults: 6,
          // circle.center is a bare [lon, lat] array (unlike preferences.geometry, which is a GeoJSON point).
          filters: { types: ["address", "street", "poi"], countryCodesIso2: ["BR"], geometry: { type: "circle", center: point.coordinates, radiusInMeters: CITY_RADIUS_M } },
          preferences: { geometry: point },
        }),
      });
      if (!res.ok) { console.error("TomTom suggest", res.status, await res.text().catch(() => "")); return []; }
      const j = (await res.json()) as { results?: Array<{ type: string; title?: string; subtitles?: string[] }> };
      const seen = new Set<string>();
      return (j.results ?? [])
        .filter((r) => r.type !== "discoverAction" && r.title)
        .map((r) => ({ label: cleanParts([r.title, ...(r.subtitles ?? []).slice(0, 2)]).join(", ") }))
        .filter((s) => !seen.has(s.label) && seen.add(s.label));
    } catch (e) {
      console.error("TomTom suggest failed", e);
      return [];
    }
  });

/** Address text → starting point for the pin. Not stored as is: the customer confirms it on the map. */
export const geocodeAddress = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ text: z.string().trim().min(3).max(300) }).parse(d))
  .handler(async ({ data }): Promise<GeoHit | null> => {
    if (!key()) return null;
    try {
      const q = encodeURIComponent(/sete lagoas/i.test(data.text) ? data.text : `${data.text}, Sete Lagoas, MG`);
      const url = `${BASE}/geocode/${q}.json?key=${key()}&apiVersion=1&countrySet=BR&limit=1&language=pt-BR&lat=${CITY_CENTER.lat}&lon=${CITY_CENTER.lng}&radius=${CITY_RADIUS_M}`;
      const res = await fetch(url);
      if (!res.ok) { console.error("TomTom geocode", res.status); return null; }
      const r = ((await res.json()) as { results?: Array<{ type?: string; position: { lat: number; lon: number }; address?: { streetName?: string; streetNumber?: string; municipalitySubdivision?: string; freeformAddress?: string } }> }).results?.[0];
      if (!r) return null;
      const p = { lat: r.position.lat, lng: r.position.lon };
      if (!inCity(p)) return null;
      const a = r.address ?? {};
      const label = cleanParts([a.streetName, a.streetNumber, a.municipalitySubdivision]).join(", ") || a.freeformAddress || data.text;
      // "Geography" = a neighbourhood/city centroid, not the street.
      return { ...p, label, approx: r.type === "Geography" || !a.streetName };
    } catch (e) {
      console.error("TomTom geocode failed", e);
      return null;
    }
  });

/** GPS position → "Rua X, 123, Bairro" to prefill the address field. */
export const reverseAddress = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ lat: z.number().min(-90).max(90), lng: z.number().min(-180).max(180) }).parse(d))
  .handler(async ({ data }): Promise<string | null> => {
    if (!key()) return null;
    try {
      const res = await fetch(`${BASE}/reverseGeocode/${data.lat},${data.lng}.json?key=${key()}&apiVersion=1&language=pt-BR&radius=100`);
      if (!res.ok) { console.error("TomTom reverse", res.status); return null; }
      const a = ((await res.json()) as { addresses?: Array<{ address?: { streetName?: string; streetNumber?: string; municipalitySubdivision?: string } }> }).addresses?.[0]?.address;
      return a?.streetName ? cleanParts([a.streetName, a.streetNumber, a.municipalitySubdivision]).join(", ") : null;
    } catch (e) {
      console.error("TomTom reverse failed", e);
      return null;
    }
  });
