import { CITY_CENTER, geocode, haversineKm, reverseGeocode, type GeoHit } from "./market";
import { geocodeAddress, reverseAddress } from "./places.functions";

/** Where to look for an address: near a point (the order's store, the customer's saved spot), optionally within a radius. */
export type SearchArea = { near?: { lat: number; lng: number }; radiusKm?: number };

/** At checkout the address must be close to the store; a bit beyond its delivery range so "fora da área" can still show. */
export const storeArea = (store: { lat: number; lng: number; delivery_max_km: number | string }): SearchArea =>
  ({ near: { lat: store.lat, lng: store.lng }, radiusKm: Math.max(30, Number(store.delivery_max_km) * 2) });

/**
 * Address text → map point: TomTom first (any city in Brazil), then the OpenStreetMap chain in `market.ts`,
 * which only knows Sete Lagoas — so it runs only when the search is around there.
 */
export async function findAddress(text: string, area: SearchArea = {}): Promise<GeoHit | null> {
  const t = text.trim().length >= 3 ? await geocodeAddress({ data: { text, ...area } }).catch(() => null) : null;
  if (t && !t.approx) return t;
  const aroundSeteLagoas = haversineKm(CITY_CENTER, area.near ?? CITY_CENTER) <= 30;
  return (aroundSeteLagoas ? await geocode(text).catch(() => null) : null) ?? t;
}

/** GPS point → "Rua X, 123, Bairro": TomTom first, then OpenStreetMap. */
export async function addressFromGps(p: { lat: number; lng: number }): Promise<string | null> {
  return (await reverseAddress({ data: p }).catch(() => null)) ?? (await reverseGeocode(p).catch(() => null));
}
