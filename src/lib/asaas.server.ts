function base() {
  const key = process.env["ASAAS_API_KEY"] ?? "";
  const url = key.includes("_prod_") ? "https://api.asaas.com/v3" : "https://api-sandbox.asaas.com/v3";
  return { key, url };
}

export async function asaas<T = any>(path: string, init?: { method?: string; body?: unknown }): Promise<T> {
  const { key, url } = base();
  if (!key) throw new Error("Pagamento indisponível: chave Asaas ausente.");
  const res = await fetch(url + path, {
    method: init?.method ?? "GET",
    headers: { "Content-Type": "application/json", access_token: key, "User-Agent": "AchouDelivery" },
    body: init?.body ? JSON.stringify(init.body) : null,
  });
  const json = (await res.json().catch(() => ({}))) as any;
  if (!res.ok) {
    console.error("Asaas error", path, res.status, JSON.stringify(json));
    const msg = json?.errors?.[0]?.description ?? "Erro ao comunicar com o Asaas";
    throw new Error(msg);
  }
  return json as T;
}
