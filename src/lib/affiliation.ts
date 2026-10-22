import type { Json } from "@/integrations/supabase/types";

/** How long a courier works for a store after the owner types the courier's 6-digit code (migration 0016). */
export const LINK_UNITS = {
  horas: { label: "Horas", minutes: 60, max: 24 },
  dias: { label: "Dias", minutes: 1440, max: 30 },
  semanas: { label: "Semanas", minutes: 10080, max: 8 },
} as const;
export type LinkUnit = keyof typeof LINK_UNITS;

/** Minutes for link_code_redeem, clamped to what the server accepts (1 hour to 8 weeks). */
export function linkMinutes(amount: number, unit: LinkUnit) {
  const u = LINK_UNITS[unit];
  const n = Math.min(Math.max(Math.round(amount) || 1, 1), u.max);
  return n * u.minutes;
}

export function isLinkActive(l: { ends_at: string; ended_at: string | null }, now = new Date()) {
  return !l.ended_at && new Date(l.ends_at) > now;
}

/** "2 d 5 h", "3 h 10 min", "8 min" — time left until `iso`. */
export function timeLeft(iso: string, now = new Date()) {
  const min = Math.max(0, Math.ceil((new Date(iso).getTime() - now.getTime()) / 60000));
  const d = Math.floor(min / 1440), h = Math.floor((min % 1440) / 60), m = min % 60;
  if (d > 0) return h > 0 ? `${d} d ${h} h` : `${d} d`;
  if (h > 0) return m > 0 ? `${h} h ${m} min` : `${h} h`;
  return `${m} min`;
}

/** The link RPCs answer `{ error }` on a refusal the store should read, or the result fields. */
export function linkResult<T extends object>(data: Json | null): { error: string } | T {
  const o = (data && typeof data === "object" && !Array.isArray(data) ? data : {}) as Record<string, unknown>;
  return typeof o["error"] === "string" ? { error: o["error"] } : (o as T);
}
