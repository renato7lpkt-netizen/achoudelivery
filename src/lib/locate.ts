import { reverseGeocode } from "./market";

/** Beyond this error radius the position is a Wi-Fi/IP guess (typical on computers) and would price delivery wrong. */
export const MAX_ACCURACY_M = 150;

/**
 * Reads the phone's GPS and turns it into a street address.
 * Rejects with a message the customer can act on: how to allow location on iPhone/Android,
 * or to type the address when the device only gives a rough guess.
 */
export function locateMe(): Promise<{ lat: number; lng: number; address: string | null }> {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) { reject(new Error("Seu aparelho não permite localização. Digite o endereço.")); return; }
    navigator.geolocation.getCurrentPosition(
      async (p) => {
        if (p.coords.accuracy > MAX_ACCURACY_M) {
          const km = p.coords.accuracy >= 1000 ? `${(p.coords.accuracy / 1000).toFixed(1)} km` : `${Math.round(p.coords.accuracy)} m`;
          reject(new Error(`Sua localização veio aproximada (margem de ${km}), comum no computador. Digite o endereço para o frete sair certo.`));
          return;
        }
        const here = { lat: p.coords.latitude, lng: p.coords.longitude };
        resolve({ ...here, address: await reverseGeocode(here).catch(() => null) });
      },
      (err) => {
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
  });
}
