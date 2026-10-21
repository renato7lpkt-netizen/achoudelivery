import { reverseGeocode } from "./market";

/**
 * Reads the phone's GPS and turns it into a street address.
 * Rejects with a message the customer can act on (how to allow location on iPhone/Android, or to type it).
 */
export function locateMe(): Promise<{ lat: number; lng: number; address: string | null }> {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) { reject(new Error("Seu aparelho não permite localização. Digite o endereço.")); return; }
    navigator.geolocation.getCurrentPosition(
      async (p) => {
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
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 60000 },
    );
  });
}
