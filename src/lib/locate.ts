import { addressFromGps } from "./address";

/** Beyond this error radius the position is a Wi-Fi/IP guess (typical on computers) and would price delivery wrong. */
export const MAX_ACCURACY_M = 150;
/** Good enough to stop waiting: the GPS has settled on the house. */
const GOOD_ACCURACY_M = 25;
/** How long to let the GPS settle, keeping the most precise reading (like the shrinking blue dot in Google Maps). */
const SETTLE_MS = 8000;

/**
 * Reads the phone's GPS and turns it into a street address.
 * Rejects with a message the customer can act on: how to allow location on iPhone/Android,
 * or to type the address when the device only gives a rough guess.
 */
export function locateMe(): Promise<{ lat: number; lng: number; address: string | null }> {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) { reject(new Error("Seu aparelho não permite localização. Digite o endereço.")); return; }
    let best: GeolocationPosition | null = null;
    let done = false;
    const finish = async () => {
      if (done) return;
      done = true;
      navigator.geolocation.clearWatch(watch);
      clearTimeout(timer);
      if (!best) { reject(new Error("O GPS demorou para responder. Tente de novo ou digite o endereço.")); return; }
      if (best.coords.accuracy > MAX_ACCURACY_M) {
        const acc = best.coords.accuracy;
        const km = acc >= 1000 ? `${(acc / 1000).toFixed(1)} km` : `${Math.round(acc)} m`;
        reject(new Error(`Sua localização veio aproximada (margem de ${km}), comum no computador. Digite o endereço para o frete sair certo.`));
        return;
      }
      const here = { lat: best.coords.latitude, lng: best.coords.longitude };
      resolve({ ...here, address: await addressFromGps(here) });
    };
    const watch = navigator.geolocation.watchPosition(
      (p) => {
        if (!best || p.coords.accuracy < best.coords.accuracy) best = p;
        if (p.coords.accuracy <= GOOD_ACCURACY_M || settled) void finish();
      },
      (err) => {
        if (best) { void finish(); return; } // keep the reading we already have
        done = true;
        navigator.geolocation.clearWatch(watch);
        clearTimeout(timer);
        const ios = /iPhone|iPad|iPod/.test(navigator.userAgent);
        if (err.code === err.PERMISSION_DENIED) {
          reject(new Error(ios
            ? "Localização bloqueada. No iPhone: Ajustes › Privacidade e Segurança › Serviços de Localização › Sites do Safari › Durante o Uso. Ou digite o endereço."
            : "Localização bloqueada. Toque no cadeado ao lado do endereço do site › Permissões › Localização › Permitir. Ou digite o endereço."));
        } else if (err.code === err.TIMEOUT) {
          reject(new Error("O GPS demorou para responder. Tente de novo ou digite o endereço."));
        } else {
          reject(new Error("Não conseguimos sua localização agora. Digite o endereço."));
        }
      },
      // maximumAge 0: a cached Wi-Fi fix from earlier must not be reused.
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 },
    );
    // After SETTLE_MS use the best reading so far; with none yet, take the first one that arrives (or the 15 s timeout).
    let settled = false;
    const timer = setTimeout(() => { settled = true; if (best) void finish(); }, SETTLE_MS);
  });
}
