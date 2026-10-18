# AchouDelivery

Marketplace de delivery (TanStack Start + React 19 + Tailwind v4 + Supabase + Asaas).

## Desenvolvimento

```bash
npm install
cp .env.example .env   # preencha os valores
npm run dev            # http://localhost:8080
```

## Produção (Node.js — ex.: Hostinger)

```bash
npm run build          # gera .output/ (preset nitro node-server)
npm start              # node .output/server/index.mjs  (usa PORT, padrão 3000)
```

As variáveis `VITE_*` são embutidas no build: precisam existir no ambiente **antes** do `npm run build`.
As demais são lidas em tempo de execução pelo servidor. Veja `.env.example`.

Outros scripts: `npm run lint`, `npm test`, `npm run format`.
