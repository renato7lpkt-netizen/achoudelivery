// Shared helpers (client + server safe)
export const CITY_CENTER = { lat: -19.4658, lng: -44.2467 }; // Sete Lagoas/MG

export const PLATFORM_RATE = 0.055; // comissão AchouDelivery
export const ASAAS_FEES = {
  PIX: { fixed: 1.99, rate: 0 },
  CREDIT_CARD: { fixed: 0.49, rate: 0.0299 },
} as const;
export type PayMethod = keyof typeof ASAAS_FEES;

// Cartão: 1x; acima de INSTALLMENT_MIN pode dividir em até MAX_INSTALLMENTS.
export const INSTALLMENT_MIN = 500;
export const MAX_INSTALLMENTS = 2;
export const maxInstallments = (total: number) => (total > INSTALLMENT_MIN ? MAX_INSTALLMENTS : 1);

const r2 = (n: number) => Math.round(n * 100) / 100;

export function splitFees(total: number, method: PayMethod) {
  const f = ASAAS_FEES[method];
  const gateway = r2(total * f.rate + f.fixed);
  const platform = r2(total * PLATFORM_RATE);
  const payout = r2(total - gateway - platform);
  return { gateway, platform, payout, retainedPct: total > 0 ? ((gateway + platform) / total) * 100 : 0 };
}

export function haversineKm(a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
  const R = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((a.lat * Math.PI) / 180) * Math.cos((b.lat * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
}

export const FREE_KM_OWN = 1;

// Loja com entregador próprio: grátis até FREE_KM_OWN km, depois R$/km só no excedente.
// Entregador da plataforma: R$/km em qualquer distância.
export function deliveryFee(
  store: { delivery_base_fee: number; delivery_fee_per_km: number; own_couriers?: boolean },
  km: number,
) {
  const perKm = Number(store.delivery_fee_per_km);
  if (store.own_couriers) return r2(Math.max(0, km - FREE_KM_OWN) * perKm);
  return r2(Number(store.delivery_base_fee) + perKm * km);
}

export function isStorePaused(store: { is_paused: boolean; paused_until?: string | null }) {
  return store.is_paused || (!!store.paused_until && new Date(store.paused_until).getTime() > Date.now());
}

export const RAIN_EXTRA_MIN = 20;
export function etaMin(store: { prep_time_min: number; rain_mode?: boolean }) {
  return Number(store.prep_time_min) + (store.rain_mode ? RAIN_EXTRA_MIN : 0);
}

export function todayWeekday() { return nowInSP().wd; }

// Preço promocional vale se não houver dias definidos ou se hoje estiver na lista
export function effectivePrice(p: { price: number; promo_price?: number | null; promo_days?: number[] | null }) {
  const promo = p.promo_price != null ? Number(p.promo_price) : null;
  if (promo == null || promo <= 0 || promo >= Number(p.price)) return Number(p.price);
  const days = p.promo_days ?? [];
  return days.length === 0 || days.includes(nowInSP().wd) ? promo : Number(p.price);
}

export const brl = (n: number) => Number(n).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export type Hour = { weekday: number; opens: string; closes: string };

function nowInSP() {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Sao_Paulo",
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(new Date());
  const wd = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(parts.find((p) => p.type === "weekday")!.value);
  const hh = parts.find((p) => p.type === "hour")!.value.replace("24", "00");
  const mm = parts.find((p) => p.type === "minute")!.value;
  return { wd, time: `${hh}:${mm}` };
}

export function isOpenNow(hours: Hour[], paused: boolean) {
  if (paused) return false;
  const { wd, time } = nowInSP();
  return hours.some((h) => {
    if (h.weekday !== wd) return false;
    const o = h.opens.slice(0, 5), c = h.closes.slice(0, 5);
    return c > o ? time >= o && time < c : time >= o || time < c;
  });
}

export function todayHours(hours: Hour[]) {
  const { wd } = nowInSP();
  const h = hours.filter((x) => x.weekday === wd);
  if (!h.length) return "Fechado hoje";
  return h.map((x) => `${x.opens.slice(0, 5)}–${x.closes.slice(0, 5)}`).join(", ");
}

export const WEEKDAYS = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"];
export const CATEGORIES = ["Lanches", "Pizza", "Mercado", "Doces", "Bebidas", "Farmácia", "Pet", "Outros"];

export const ORDER_STATUS: Record<string, string> = {
  aguardando_pagamento: "Aguardando pagamento",
  pago: "Pago — aguardando loja",
  preparando: "Em preparo",
  saiu_entrega: "Saiu para entrega",
  pronto_retirada: "Pronto para retirada",
  concluido: "Concluído",
  cancelado: "Cancelado",
};

type LatLng = { lat: number; lng: number };

/** Only accept hits inside the delivery city, so a same-named street elsewhere is never used. */
const inCity = (p: LatLng) => haversineKm(CITY_CENTER, p) <= 30;

async function nominatim(text: string): Promise<LatLng | null> {
  const q = encodeURIComponent(`${text}, Sete Lagoas, MG, Brasil`);
  const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&limit=1&countrycodes=br&q=${q}`);
  const j = (await res.json()) as Array<{ lat: string; lon: string }>;
  const p = j[0] ? { lat: Number(j[0].lat), lng: Number(j[0].lon) } : null;
  return p && inCity(p) ? p : null;
}

// Typo-tolerant search: finds "Rua Claudionor de Castro Bahia" when the map says "Rua Doutor Claudionor de Castro Bahia".
async function photon(text: string): Promise<LatLng | null> {
  const q = encodeURIComponent(`${text} Sete Lagoas`);
  const res = await fetch(`https://photon.komoot.io/api/?q=${q}&limit=5&lat=${CITY_CENTER.lat}&lon=${CITY_CENTER.lng}`);
  const j = (await res.json()) as { features: Array<{ geometry: { coordinates: [number, number] }; properties: { city?: string } }> };
  for (const f of j.features ?? []) {
    const p = { lat: f.geometry.coordinates[1], lng: f.geometry.coordinates[0] };
    if (f.properties.city === "Sete Lagoas" && inCity(p)) return p;
  }
  return null;
}

/** Correios street lookup: returns the neighbourhood so we can at least place the customer in the right bairro. */
async function viacepBairro(street: string): Promise<string | null> {
  const name = street.replace(/^(rua|r\.|avenida|av\.?|travessa|tv\.?|alameda|praça|pç\.?)\s+/i, "").trim();
  if (name.length < 3) return null;
  const res = await fetch(`https://viacep.com.br/ws/MG/Sete%20Lagoas/${encodeURIComponent(name)}/json/`);
  const j = (await res.json()) as Array<{ bairro?: string }> | { erro?: boolean };
  return Array.isArray(j) ? (j[0]?.bairro || null) : null;
}

/** Busca o endereço: completo → por CEP (ViaCEP) → sem número da casa → busca tolerante → bairro pela rua → só bairro. */
export async function geocode(address: string): Promise<LatLng | null> {
  const { findCep, stripHouseNumber } = await import("./br");
  const tries: string[] = [address];
  const cep = findCep(address);
  if (cep) {
    try {
      const v = (await (await fetch(`https://viacep.com.br/ws/${cep}/json/`)).json()) as { logradouro?: string; bairro?: string; erro?: boolean };
      if (!v.erro) tries.push([v.logradouro, v.bairro].filter(Boolean).join(", "), v.bairro ?? "");
    } catch { /* ignora */ }
  }
  const noNum = stripHouseNumber(address.replace(/\b\d{5}-?\d{3}\b/, ""));
  tries.push(noNum);
  const unique = [...new Set(tries.filter((t) => t.trim().length > 2))];
  for (const t of unique) {
    try { const g = await nominatim(t); if (g) return g; } catch { /* tenta o próximo */ }
  }
  for (const t of [address, noNum]) {
    try { const g = await photon(t); if (g) return g; } catch { /* tenta o próximo */ }
  }
  const parts = noNum.split(",").map((s) => s.trim()).filter(Boolean);
  try {
    const bairro = await viacepBairro(parts[0] ?? noNum);
    if (bairro) { const g = (await nominatim(bairro)) ?? (await photon(bairro)); if (g) return g; }
  } catch { /* ignora */ }
  if (parts.length > 1) {
    try { const g = await nominatim(parts[parts.length - 1]!); if (g) return g; } catch { /* ignora */ }
  }
  return null;
}

/** GPS position → "Rua X, 123, Bairro" to prefill the delivery address (Nominatim, then Photon as fallback). */
export async function reverseGeocode(p: LatLng): Promise<string | null> {
  try {
    const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&zoom=18&addressdetails=1&lat=${p.lat}&lon=${p.lng}`);
    const a = ((await res.json()) as { address?: { road?: string; house_number?: string; suburb?: string; neighbourhood?: string } }).address;
    if (a?.road) return [a.road, a.house_number, a.suburb ?? a.neighbourhood].filter(Boolean).join(", ");
  } catch { /* tenta o Photon */ }
  try {
    const res = await fetch(`https://photon.komoot.io/reverse?lat=${p.lat}&lon=${p.lng}&limit=1`);
    const f = ((await res.json()) as { features?: Array<{ properties: { street?: string; name?: string; housenumber?: string; district?: string } }> }).features?.[0]?.properties;
    const road = f?.street ?? f?.name;
    if (road) return [road, f?.housenumber, f?.district].filter(Boolean).join(", ");
  } catch { /* ignora */ }
  return null;
}
