import { AlertTriangle, MapPin } from "lucide-react";

/** Shows which street the map matched, so a wrong pin (and a wrong delivery fee) is visible before saving or paying. */
export function GeoNote({ label, approx }: { label: string | null | undefined; approx?: boolean | undefined }) {
  if (!label) return null;
  return approx ? (
    <p className="mt-1 flex items-start gap-1.5 text-xs font-medium text-destructive">
      <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
      <span>Não achamos a rua exata no mapa; usamos {label}. Confira o nome da rua para o frete sair certo.</span>
    </p>
  ) : (
    <p className="mt-1 flex items-start gap-1.5 text-xs font-medium text-success">
      <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0" />
      <span>No mapa: {label}</span>
    </p>
  );
}
