import { afterEach, describe, expect, it, vi } from "vitest";
import { detectIos } from "./IosInstallHint";

const UA = {
  iphoneSafari: "Mozilla/5.0 (iPhone; CPU iPhone OS 18_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.5 Mobile/15E148 Safari/604.1",
  iphoneChrome: "Mozilla/5.0 (iPhone; CPU iPhone OS 18_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/138.0 Mobile/15E148 Safari/604.1",
  iphoneInstagram: "Mozilla/5.0 (iPhone; CPU iPhone OS 18_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 Instagram 390.0.0",
  ipad: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.5 Safari/605.1.15",
  android: "Mozilla/5.0 (Linux; Android 14; SM-A546E) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0 Mobile Safari/537.36",
};

function setDevice(ua: string, { touch = 5, standalone = false } = {}) {
  vi.spyOn(navigator, "userAgent", "get").mockReturnValue(ua);
  // jsdom has no maxTouchPoints, so define it instead of spying.
  Object.defineProperty(navigator, "maxTouchPoints", { value: touch, configurable: true });
  Object.defineProperty(navigator, "standalone", { value: standalone, configurable: true });
  window.matchMedia = ((q: string) => ({ matches: standalone && q.includes("standalone") })) as unknown as typeof window.matchMedia;
}

afterEach(() => vi.restoreAllMocks());

describe("aviso de instalação no iPhone", () => {
  it("Safari no iPhone mostra o passo a passo", () => { setDevice(UA.iphoneSafari); expect(detectIos()).toBe("safari"); });
  it("Chrome no iPhone também instala", () => { setDevice(UA.iphoneChrome); expect(detectIos()).toBe("chrome"); });
  it("navegador do Instagram pede para abrir no Safari", () => { setDevice(UA.iphoneInstagram); expect(detectIos()).toBe("inapp"); });
  it("iPad (que se diz Mac) é reconhecido pelo toque", () => { setDevice(UA.ipad, { touch: 5 }); expect(detectIos()).toBe("safari"); });
  it("Mac de verdade não mostra", () => { setDevice(UA.ipad, { touch: 0 }); expect(detectIos()).toBeNull(); });
  it("Android não mostra", () => { setDevice(UA.android); expect(detectIos()).toBeNull(); });
  it("já instalado na tela de início não mostra", () => { setDevice(UA.iphoneSafari, { standalone: true }); expect(detectIos()).toBeNull(); });
});
