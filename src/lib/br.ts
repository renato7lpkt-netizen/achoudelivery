/** Máscara de CPF: só dígitos, máximo 11, formato 000.000.000-00. */
export function maskCpf(v: string) {
  const d = v.replace(/\D/g, "").slice(0, 11);
  return d
    .replace(/^(\d{3})(\d)/, "$1.$2")
    .replace(/^(\d{3})\.(\d{3})(\d)/, "$1.$2.$3")
    .replace(/\.(\d{3})(\d{1,2})$/, ".$1-$2");
}

/** Valida CPF pelos dígitos verificadores. */
export function isValidCpf(v: string) {
  const d = v.replace(/\D/g, "");
  if (d.length !== 11 || /^(\d)\1{10}$/.test(d)) return false;
  const calc = (n: number) => {
    let s = 0;
    for (let i = 0; i < n; i++) s += Number(d[i]) * (n + 1 - i);
    const r = (s * 10) % 11;
    return r === 10 ? 0 : r;
  };
  return calc(9) === Number(d[9]) && calc(10) === Number(d[10]);
}

/** Máscara de celular: (31) 99999-9999. */
export function maskPhone(v: string) {
  const d = v.replace(/\D/g, "").slice(0, 11);
  if (d.length <= 2) return d;
  if (d.length <= 7) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  return `(${d.slice(0, 2)}) ${d.slice(2, d.length - 4)}-${d.slice(-4)}`;
}

/** Remove o número da casa do endereço ("Rua X, 358, Centro" -> "Rua X, Centro"). */
export function stripHouseNumber(address: string) {
  return address
    .split(",")
    .map((p) => p.trim())
    .filter((p) => p && !/^(n[º°o.]?\s*)?\d+[a-z]?$/i.test(p))
    .join(", ")
    .replace(/\s+\d+[a-z]?\b(?=,|$)/i, "")
    .trim();
}

export const findCep = (s: string) => s.match(/\b(\d{5})-?(\d{3})\b/)?.slice(1).join("") ?? null;
