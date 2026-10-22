import { geocode, reverseGeocode, type GeoHit } from "./market";
import { geocodeAddress, reverseAddress } from "./places.functions";

/** Address text → map point: TomTom first, then the OpenStreetMap chain (`geocode`) when TomTom misses or is off. */
export async function findAddress(text: string): Promise<GeoHit | null> {
  const t = text.trim().length >= 3 ? await geocodeAddress({ data: { text } }).catch(() => null) : null;
  if (t && !t.approx) return t;
  return (await geocode(text).catch(() => null)) ?? t;
}

/** GPS point → "Rua X, 123, Bairro": TomTom first, then OpenStreetMap. */
export async function addressFromGps(p: { lat: number; lng: number }): Promise<string | null> {
  return (await reverseAddress({ data: p }).catch(() => null)) ?? (await reverseGeocode(p).catch(() => null));
}
