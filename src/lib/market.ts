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

/**
 * Who gets what from one order. A platform courier (store without own couriers) earns the whole
 * delivery fee, and the commission is then charged on products only; the store pays the gateway fee.
 */
export function splitOrder(subtotal: number, fee: number, method: PayMethod, ownCouriers: boolean) {
  const total = r2(subtotal + fee);
  const f = ASAAS_FEES[method];
  const gateway = r2(total * f.rate + f.fixed);
  const courier = ownCouriers ? 0 : r2(fee);
  const platform = r2((ownCouriers ? total : subtotal) * PLATFORM_RATE);
  const payout = r2(total - gateway - platform - courier);
  return { gateway, platform, payout, courier };
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

/** City ride incl. stops and the road being longer than the straight line (≈ 20 km/h). */
export const RIDE_MIN_PER_KM = 3;
/** Courier reaching the store and taking the bag. */
export const PICKUP_MIN = 5;
/** Edits to the delivery point after ordering stay within this distance, so the fee already paid still holds. */
export const ADDRESS_EDIT_MAX_KM = 0.5;

/**
 * Delivery window shown on the order page (like "20:25–20:40").
 * Before the courier leaves: order time + prep (+ rain) + pickup + ride, as a 15-min window.
 * On the way with live courier GPS: minutes left from the courier to the door, as a 5-min window.
 * A window already in the past is pushed forward (`late`), never shown as passed.
 */
export function deliveryWindow(
  o: { created_at: string; distance_km: number | null; status: string },
  store: { prep_time_min: number; rain_mode?: boolean } | null,
  kmLeft: number | null = null,
  now = new Date(),
): { from: Date; to: Date; minutesLeft: number | null; late: boolean } {
  const at = (min: number) => new Date(now.getTime() + min * 60000);
  if (o.status === "saiu_entrega" && kmLeft != null) {
    const left = Math.max(1, Math.ceil(kmLeft * RIDE_MIN_PER_KM));
    return { from: at(left), to: at(left + 5), minutesLeft: left, late: false };
  }
  const ride = Math.ceil(Number(o.distance_km ?? 3) * RIDE_MIN_PER_KM);
  const prep = store ? etaMin(store) : 30;
  const from = new Date(new Date(o.created_at).getTime() + (prep + PICKUP_MIN + ride) * 60000);
  const to = new Date(from.getTime() + 15 * 60000);
  if (to > now) return { from, to, minutesLeft: null, late: false };
  const soon = o.status === "saiu_entrega" ? ride : PICKUP_MIN + ride;
  return { from: at(soon), to: at(soon + 10), minutesLeft: null, late: true };
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

/** The customer may cancel (with automatic refund) only before the store starts preparing — see /termos. */
export const CUSTOMER_CANCELLABLE = ["aguardando_pagamento", "pago"];

type LatLng = { lat: number; lng: number };
/** A geocoding result plus what it matched, so the UI can show "Rua X, Bairro" and flag neighbourhood-only hits. */
export type GeoHit = LatLng & { label: string; approx: boolean };

/** Only accept hits inside the delivery city, so a same-named street elsewhere is never used. */
const inCity = (p: LatLng) => haversineKm(CITY_CENTER, p) <= 30;

async function nominatim(text: string): Promise<GeoHit | null> {
  const q = encodeURIComponent(`${text}, Sete Lagoas, MG, Brasil`);
  const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&limit=1&addressdetails=1&countrycodes=br&q=${q}`);
  const j = (await res.json()) as Array<{ lat: string; lon: string; class: string; address?: { road?: string; house_number?: string; suburb?: string; neighbourhood?: string } }>;
  const r = j[0];
  if (!r) return null;
  const p = { lat: Number(r.lat), lng: Number(r.lon) };
  if (!inCity(p)) return null;
  const a = r.address ?? {};
  const bairro = a.suburb ?? a.neighbourhood;
  // A street or building is precise enough; a bare neighbourhood/city centroid is not.
  const street = r.class === "highway" || r.class === "building" || !!a.road;
  return { ...p, label: [a.road, a.house_number, bairro].filter(Boolean).join(", ") || text, approx: !street };
}

// Typo-tolerant search: finds "Rua Claudionor de Castro Bahia" when the map says "Rua Doutor Claudionor de Castro Bahia".
async function photon(text: string): Promise<GeoHit | null> {
  const q = encodeURIComponent(`${text} Sete Lagoas`);
  const res = await fetch(`https://photon.komoot.io/api/?q=${q}&limit=5&lat=${CITY_CENTER.lat}&lon=${CITY_CENTER.lng}`);
  const j = (await res.json()) as { features: Array<{ geometry: { coordinates: [number, number] }; properties: { city?: string; name?: string; street?: string; housenumber?: string; district?: string; type?: string } }> };
  for (const f of j.features ?? []) {
    const p = { lat: f.geometry.coordinates[1], lng: f.geometry.coordinates[0] };
    const pr = f.properties;
    if (pr.city !== "Sete Lagoas" || !inCity(p)) continue;
    const street = pr.type === "street" || pr.type === "house" || !!pr.street;
    return { ...p, label: [pr.street ?? pr.name, pr.housenumber, pr.district].filter(Boolean).join(", "), approx: !street };
  }
  return null;
}

const STOP = new Set(["rua", "avenida", "av", "travessa", "alameda", "praca", "doutor", "dr", "dona", "professor", "prof", "santo", "santa", "sao", "dos", "das", "de", "da", "do"]);
const words = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().split(/[^a-z0-9]+/).filter((w) => w.length > 2 && !STOP.has(w) && !/^\d+$/.test(w));

/** True when the matched road shares a meaningful word with the typed street (or nothing street-like was typed). */
export function sameStreet(typed: string, label: string) {
  const want = words(typed.split(",")[0] ?? typed);
  if (want.length === 0) return true;
  const got = new Set(words(label.split(",")[0] ?? label));
  return want.some((w) => got.has(w));
}

/** Correios street lookup: returns the neighbourhood so we can at least place the customer in the right bairro. */
async function viacepBairro(street: string): Promise<string | null> {
  const name = street.replace(/^(rua|r\.|avenida|av\.?|travessa|tv\.?|alameda|praça|pç\.?)\s+/i, "").trim();
  if (name.length < 3) return null;
  const res = await fetch(`https://viacep.com.br/ws/MG/Sete%20Lagoas/${encodeURIComponent(name)}/json/`);
  const j = (await res.json()) as Array<{ bairro?: string }> | { erro?: boolean };
  return Array.isArray(j) ? (j[0]?.bairro || null) : null;
}

/**
 * Busca o endereço: completo → rua do CEP → sem número da casa → busca tolerante → bairro.
 * A street-level hit always wins over a neighbourhood centroid; the latter comes back with approx=true.
 */
export async function geocode(address: string): Promise<GeoHit | null> {
  const { findCep, stripHouseNumber } = await import("./br");
  // The raw CEP is never sent to the map: OSM matched "35702-062" to an unrelated house 4 km away.
  const withoutCep = address.replace(/\b\d{5}-?\d{3}\b/, "").replace(/\s*,\s*,/g, ",").replace(/^[\s,]+|[\s,]+$/g, "");
  const tries: string[] = [];
  let cepBairro: string | null = null;
  let typedStreet = withoutCep;
  const cep = findCep(address);
  if (cep) {
    try {
      const v = (await (await fetch(`https://viacep.com.br/ws/${cep}/json/`)).json()) as { logradouro?: string; bairro?: string; erro?: boolean };
      if (!v.erro) {
        if (v.logradouro) { tries.push([v.logradouro, v.bairro].filter(Boolean).join(", ")); if (!withoutCep) typedStreet = v.logradouro; }
        cepBairro = v.bairro ?? null;
      }
    } catch { /* ignora */ }
  }
  if (withoutCep) tries.push(withoutCep);
  const noNum = stripHouseNumber(withoutCep);
  tries.push(noNum);
  const unique = [...new Set(tries.filter((t) => t.trim().length > 2))];
  let rough: GeoHit | null = null;
  // A street hit only counts when its road matches what was typed; anything else is kept as a rough guess.
  const keep = (g: GeoHit | null) => {
    if (g && !g.approx && sameStreet(typedStreet, g.label)) return g;
    if (g && !rough) rough = { ...g, approx: true };
    return null;
  };
  for (const t of unique) {
    try { const g = keep(await nominatim(t)); if (g) return g; } catch { /* tenta o próximo */ }
  }
  for (const t of [...new Set([withoutCep || tries[0] || "", noNum].filter((t) => t.trim().length > 2))]) {
    try { const g = keep(await photon(t)); if (g) return g; } catch { /* tenta o próximo */ }
  }
  if (rough) return rough;
  // Street not on the map: fall back to the neighbourhood (from the CEP, the street's CEP record, or the text).
  const parts = noNum.split(",").map((s) => s.trim()).filter(Boolean);
  try {
    const bairro = cepBairro ?? (await viacepBairro(parts[0] ?? noNum)) ?? (parts.length > 1 ? parts[parts.length - 1]! : null);
    if (bairro) {
      const g = (await nominatim(bairro).catch(() => null)) ?? (await photon(bairro).catch(() => null));
      if (g) return { ...g, label: `Bairro ${bairro}`, approx: true };
    }
  } catch { /* ignora */ }
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
