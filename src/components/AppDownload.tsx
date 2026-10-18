import { Smartphone, Download } from "lucide-react";
import apk from "@/assets/achadao.apk.asset.json";

export function AppDownload({ compact = false }: { compact?: boolean }) {
  return (
    <div className="mb-6 flex flex-wrap items-center gap-3 rounded-xl border bg-card p-4">
      <Smartphone className="h-8 w-8 text-primary" />
      <div className="min-w-0 flex-1">
        <p className="font-bold">Baixe o app do AchouDelivery para Android</p>
        {!compact && (
          <p className="text-sm text-muted-foreground">
            Para clientes, lojas e entregadores. Ao instalar, permita "instalar apps desta fonte".
          </p>
        )}
      </div>
      <a
        href={apk.url}
        download="achadao.apk"
        className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:opacity-90"
      >
        <Download className="h-4 w-4" /> Baixar app
      </a>
    </div>
  );
}
