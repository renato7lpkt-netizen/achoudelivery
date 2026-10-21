import { useEffect, useState } from "react";
import { useLocation } from "@tanstack/react-router";
import { Compass, Share, SquarePlus, X } from "lucide-react";
import { bottomNavVisible } from "@/components/BottomNav";

const DISMISS_KEY = "achou_ios_hint_dismissed_at";
const SNOOZE_MS = 14 * 24 * 60 * 60 * 1000;

type IosBrowser = "safari" | "chrome" | "inapp";

/** iPhone/iPad only: returns which browser, or null on any other device or when already installed. */
export function detectIos(): IosBrowser | null {
  const ua = navigator.userAgent;
  // iPadOS reports itself as a Mac; touch support tells them apart.
  const ios = /iPhone|iPad|iPod/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1);
  if (!ios) return null;
  const standalone = (navigator as Navigator & { standalone?: boolean }).standalone === true || matchMedia("(display-mode: standalone)").matches;
  if (standalone) return null;
  if (/FBAN|FBAV|Instagram|Line\/|WhatsApp|TikTok|Snapchat|GSA\//.test(ua)) return "inapp";
  if (/CriOS/.test(ua)) return "chrome";
  if (/FxiOS|EdgiOS|OPiOS/.test(ua)) return "inapp";
  return "safari";
}

function snoozed() {
  try {
    const at = Number(localStorage.getItem(DISMISS_KEY));
    return at > 0 && Date.now() - at < SNOOZE_MS;
  } catch {
    return false;
  }
}

/** Bottom sheet teaching iPhone users to add the site to the Home Screen (iOS has no install prompt). */
export function IosInstallHint() {
  const { pathname } = useLocation();
  const [browser, setBrowser] = useState<IosBrowser | null>(null);

  useEffect(() => {
    const kind = detectIos();
    if (!kind || snoozed()) return;
    const t = setTimeout(() => setBrowser(kind), 4000);
    return () => clearTimeout(t);
  }, []);

  if (!browser || !bottomNavVisible(pathname)) return null;

  function close() {
    try { localStorage.setItem(DISMISS_KEY, String(Date.now())); } catch { /* private mode: just hide */ }
    setBrowser(null);
  }

  return (
    <div role="dialog" aria-modal="false" aria-labelledby="ios-hint-title" className="fixed inset-x-3 bottom-20 z-50 animate-in slide-in-from-bottom-4 rounded-2xl border bg-card p-4 shadow-pop md:hidden">
      <button onClick={close} aria-label="Fechar" className="absolute right-2 top-2 grid h-9 w-9 place-items-center rounded-full text-muted-foreground hover:bg-muted">
        <X className="h-5 w-5" />
      </button>
      <div className="flex items-center gap-3 pr-8">
        <img src="/apple-touch-icon.png" alt="" className="h-12 w-12 shrink-0 rounded-xl" />
        <div>
          <p id="ios-hint-title" className="font-bold">Instale o AchouDelivery no seu iPhone</p>
          <p className="text-sm text-muted-foreground">Abra direto da tela de início, como um app.</p>
        </div>
      </div>

      {browser === "inapp" ? (
        <p className="mt-3 flex items-start gap-2 rounded-xl bg-accent p-3 text-sm text-accent-foreground">
          <Compass className="mt-0.5 h-5 w-5 shrink-0" />
          <span>Por aqui não dá para instalar. Toque nos <b>três pontinhos</b> e escolha <b>Abrir no Safari</b>, depois volte a este aviso.</span>
        </p>
      ) : (
        <ol className="mt-3 space-y-2 text-sm">
          <li className="flex items-center gap-3 rounded-xl bg-accent p-3 text-accent-foreground">
            <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-primary text-xs font-bold text-primary-foreground">1</span>
            <span className="flex-1">Toque em <b>Compartilhar</b> {browser === "chrome" ? "no topo, na barra de endereço" : "na barra do Safari"}</span>
            <Share className="h-5 w-5 shrink-0 text-primary" />
          </li>
          <li className="flex items-center gap-3 rounded-xl bg-accent p-3 text-accent-foreground">
            <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-primary text-xs font-bold text-primary-foreground">2</span>
            <span className="flex-1">Role e escolha <b>Adicionar à Tela de Início</b></span>
            <SquarePlus className="h-5 w-5 shrink-0 text-primary" />
          </li>
          <li className="flex items-center gap-3 rounded-xl bg-accent p-3 text-accent-foreground">
            <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-primary text-xs font-bold text-primary-foreground">3</span>
            <span className="flex-1">Toque em <b>Adicionar</b> no canto superior direito</span>
          </li>
        </ol>
      )}
      <button onClick={close} className="mt-3 w-full rounded-xl py-2 text-sm font-semibold text-muted-foreground hover:bg-muted">Agora não</button>
    </div>
  );
}
