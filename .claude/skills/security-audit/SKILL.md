---
name: security-audit
description: Auditoria de segurança do AchouDelivery (Supabase/PostgreSQL, TanStack Start na Hostinger, Asaas). Cobre RLS, grants, funções SECURITY DEFINER, triggers de proteção, SQL injection, exposição da service_role, XSS, CSRF, cabeçalhos HTTP (CORS/CSP/HSTS), rotas protegidas, webhooks e vazamento de segredos no .env e no histórico do Git. Use quando o usuário pedir "auditoria de segurança", "security audit", "verificar vazamento", "revisar RLS" ou antes de publicar mudanças em pedidos, pagamentos, repasses ou autenticação.
---

# Security Audit — AchouDelivery

Responda em português, em linguagem simples: o dono do projeto não é programador. Explique cada achado pelo impacto real ("uma loja conseguiria mudar o próprio repasse"), não pelo jargão.

## Regras da auditoria

- **Nunca imprima valores de segredos** (chaves, tokens, senhas). Mostre só o nome da variável, o arquivo/commit e no máximo os 4 primeiros caracteres.
- **Só leitura por padrão.** Não altere banco, código, painel da Hostinger nem Asaas sem o usuário aprovar. Mudança no banco de produção: escreva a migration em `drizzle/migrations/NNNN_*.sql`, teste dentro de um bloco `DO $t$ … RAISE EXCEPTION … $t$` (faz rollback sozinho), mostre o resultado e só então peça para aplicar.
- **Commit e push só quando o usuário pedir** (push em `main` publica o site na hora — deploy automático da Hostinger).
- Toda conclusão precisa de evidência: a consulta SQL, o `grep` ou o `curl` que a sustenta. Se não deu para verificar (ex.: tela que exige login), diga isso.
- Separe **brecha real** de **aviso intencional** (ex.: vitrine pública lida por `anon`; RPCs `SECURITY DEFINER` que conferem `auth.uid()` por dentro).

## Mapa do sistema (onde olhar)

| Área | Onde |
|---|---|
| Cliente Supabase do navegador | `src/integrations/supabase/client.ts` (só chave publishable) |
| Cliente admin (service_role) | `src/integrations/supabase/client.server.ts` — só via `await import(...)` dentro de handlers de server fn ou arquivos `*.server.ts` |
| Autenticação das server fns | `requireSupabaseAuth` em `src/integrations/supabase/auth-middleware.ts` |
| CSRF | `createCsrfMiddleware` em `src/start.ts` |
| Cabeçalhos HTTP | `routeRules` do Nitro em `vite.config.ts` (arquivos de `public/` saem do LiteSpeed **sem** esses cabeçalhos) |
| Valores do pedido | `createOrder` (`src/lib/orders.functions.ts`) + `splitOrder` (`src/lib/market.ts`) |
| Repasses | `src/lib/payouts.functions.ts` |
| Webhook público | `src/routes/api/public/asaas-webhook.ts` (token `ASAAS_WEBHOOK_TOKEN`) |
| Schema e políticas | `drizzle/migrations/*.sql` |
| Segredos | `.env` (local, fora do Git) e variáveis do app Node.js na Hostinger |

Projeto Supabase: `kuzsgkgtuvmfjfrnkrzj`. Use as ferramentas do conector Supabase (`execute_sql`, `get_advisors`, `list_tables`).

---

## 1. Banco de dados (Supabase / PostgreSQL)

### 1.1 RLS ligado em toda tabela exposta
```sql
select c.relname tabela, c.relrowsecurity rls, c.relforcerowsecurity forcado
from pg_class c join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public' and c.relkind = 'r' order by 1;
```
**Brecha:** qualquer tabela com `rls = false`.

### 1.2 Políticas: cada usuário só vê/altera o que é dele
```sql
select tablename, policyname, cmd, roles, qual, with_check
from pg_policies where schemaname = 'public' order by tablename, cmd;
```
Confira, uma a uma:
- `USING (true)` ou `WITH CHECK (true)` só em leitura pública intencional (`stores`, `products`, `store_hours`, `product_options`). Em `orders`, `order_items`, `profiles`, `couriers`, `store_private`, `payouts`, `courier_payouts`, `push_tokens`, `order_messages`, `user_roles` é **brecha**.
- `UPDATE` precisa de `USING` **e** `WITH CHECK` limitando ao dono (`auth.uid()`, `owns_store()`, `my_courier_id()`, `has_role(...,'admin')`).
- `INSERT` em `orders` e `order_items` **não pode existir** para `authenticated` (pedido só nasce em `createOrder`).
- Política que usa `auth.uid()` sem tratar `NULL` em tabela legível por `anon` é suspeita.

### 1.3 Grants (permissão antes do RLS)
```sql
select table_name, grantee, string_agg(privilege_type, ',' order by privilege_type) privs
from information_schema.role_table_grants
where table_schema = 'public' and grantee in ('anon', 'authenticated')
group by 1, 2 order by 1, 2;
```
Esperado (migration 0012): `anon` só `SELECT` em `stores, store_hours, products, product_options`. **Brecha:** `TRUNCATE`, `DELETE` ou `INSERT` inesperados; qualquer grant a `anon` em tabela privada. Também confira `ALTER DEFAULT PRIVILEGES` (tabelas novas não podem nascer com `ALL` para `anon`).

### 1.4 Triggers de proteção precisam disparar
```sql
select p.proname, p.prosecdef as security_definer
from pg_proc p join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public' and p.proname like '%_guard';
```
`orders_guard` e `stores_guard` **têm que ser `security_definer = false`**: dentro de SECURITY DEFINER, `current_user` é o dono da função e o teste `current_user = 'authenticated'` nunca é verdadeiro (foi o bug corrigido na 0013). Teste de fumaça (rollback automático):
```sql
DO $t$ DECLARE r json; BEGIN
  -- crie um pedido de teste, então:
  PERFORM set_config('request.jwt.claims', '{"sub":"<uuid do dono da loja>","role":"authenticated"}', true);
  EXECUTE 'SET LOCAL ROLE authenticated';
  UPDATE public.orders SET total = 1, store_payout = 999, payment_status = 'X', status = 'concluido' WHERE id = '<id>';
  SELECT row_to_json(o) INTO r FROM public.orders o WHERE id = '<id>';
  RAISE EXCEPTION 'RESULTADO %', r;  -- desfaz tudo
END $t$;
```
Valores precisam voltar intactos.

### 1.5 Funções SECURITY DEFINER (RPC)
```sql
select p.proname, pg_get_function_identity_arguments(p.oid) args, p.prosecdef,
       has_function_privilege('anon', p.oid, 'EXECUTE') anon_exec,
       has_function_privilege('authenticated', p.oid, 'EXECUTE') auth_exec,
       p.proconfig
from pg_proc p join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public' and p.prosecdef order by 1;
```
Para cada uma: (a) tem `SET search_path`? (b) confere `auth.uid()`/dono por dentro antes de ler ou alterar? (c) `anon_exec` só onde é público de propósito (`top_products`). Leia o corpo com `select pg_get_functiondef('public.<nome>'::regproc);`. Rode também `get_advisors(type: "security")` e classifique cada aviso.

### 1.6 Tabelas críticas: pedidos, pagamentos, usuários
- `orders`: totais, `delivery_pin`, `payment_status`, `payout_id`, `courier_payout*`, `delivered_at` só mudam por server fn (service_role) ou RPC (`confirm_delivery`, `rate_order`, `courier_update_order`, `accept_delivery`). Status pela loja: só `pago → preparando → saiu_entrega` ou cancelar.
- Repasses (`payouts`, `courier_payouts`): só leitura para dono/admin; nenhuma escrita pelo navegador. Server fns de repasse chamam `assertAdmin` e só somam pedidos com `payment_status` pago.
- Colunas sensíveis (RLS não esconde coluna): `orders.delivery_pin` e `stores.pix_key`, `pix_key_type`, `asaas_wallet_id` não podem ter SELECT para `anon`/`authenticated`. Confira com `select has_column_privilege('anon','public.stores','pix_key','SELECT'), has_column_privilege('authenticated','public.orders','delivery_pin','SELECT');` (esperado: `false`, `false`) e se a publicação `supabase_realtime` não inclui essas colunas (`select tablename, attnames from pg_publication_tables where pubname = 'supabase_realtime';`). Coluna nova nessas tabelas precisa entrar no GRANT e em `src/lib/columns.ts`.
- Dados pessoais: CPF/telefone/endereço do cliente não podem aparecer em RPCs públicas (`open_deliveries` não devolve dados do cliente). `store_private` só para o dono.
- `user_roles`: sem `INSERT/UPDATE` para `authenticated` (ninguém se promove a admin).
- Storage: `select id, public from storage.buckets;` → `courier-docs` **privado**; acesso só por URL assinada (`courierDocUrl`).

### 1.7 SQL injection
Supabase-js parametriza `.eq/.in/.ilike`, mas **texto do usuário dentro de filtros montados por string** é injetável no PostgREST:
```bash
rg -n '\.or\(|\.filter\(|\.textSearch\(|\.rpc\(' src
rg -n '`[^`]*\$\{[^}]+\}[^`]*`' src --glob '*.ts*' | rg -i 'or\(|filter\(|select\(|ilike|like'
rg -n 'execute\s+format|EXECUTE\s' drizzle/migrations
```
**Brecha:** `.or(\`name.ilike.%${q}%\`)` com `q` do usuário sem remover `,()%_`. Em SQL dinâmico (`EXECUTE`), só `format('%I')`/`%L` ou parâmetros `USING`. Entradas de server fn sempre validadas com `zod` (`inputValidator`).

### 1.8 service_role nunca no frontend
```bash
rg -n 'SERVICE_ROLE|service_role|client\.server' src --glob '!*.server.ts'
rg -n 'VITE_.*(SECRET|SERVICE|ASAAS|TOKEN)' -g '!node_modules' .
npm run build && rg -l 'sb_secret_|service_role|\$aact_|whsec_|GOCSPX-' .output/public
```
`client.server` só pode aparecer em `await import("@/integrations/supabase/client.server")` dentro de handlers. Nenhuma variável secreta pode começar com `VITE_` (vai para o JS do navegador). O build público não pode conter nenhum desses padrões. Confira também o site no ar: baixe os `/assets/*.js` e procure os mesmos padrões.

---

## 2. Aplicação (frontend e backend)

### 2.1 XSS
```bash
rg -n 'dangerouslySetInnerHTML|innerHTML|outerHTML|document\.write|insertAdjacentHTML|eval\(|new Function' src
rg -n 'href=\{[^}]*\}' src | rg -v 'https?://|"/|`/|`https'
```
- React escapa texto por padrão; brecha é HTML montado à mão. `printTicket` (`src/lib/order-tools.ts`) usa `document.write` — todo campo do usuário precisa passar por `esc()`.
- Links com dado do usuário (`href`, `window.open`) não podem aceitar `javascript:`; só `https:` ou caminhos internos.
- Imagens enviadas viram `data:image/jpeg` (canvas) — não aceite `data:text/html` nem SVG cru.

### 2.2 CSRF
- `src/start.ts` registra `createCsrfMiddleware` para `serverFn`. Teste:
```bash
curl -s -o /dev/null -w '%{http_code}\n' -X POST -H 'Origin: https://evil.example' -H 'Sec-Fetch-Site: cross-site' https://achoudelivery.com.br/_serverFn/<id>   # esperado 403
```
- Rotas `api/public/*` não usam cookie de sessão; precisam de outro segredo (o webhook exige `asaas-access-token`, comparado em tempo constante).

### 2.3 Cabeçalhos HTTP (CORS, CSP, HSTS)
```bash
curl -sI https://achoudelivery.com.br/ | rg -i 'strict-transport|content-security|x-frame|x-content-type|referrer-policy|permissions-policy|access-control'
curl -sI -H 'Origin: https://evil.example' https://achoudelivery.com.br/api/public/asaas-webhook | rg -i 'access-control'
```
Esperado: HSTS, `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY` + `frame-ancestors 'none'`, `Referrer-Policy`, `Permissions-Policy` (só `geolocation=(self)`). **Nunca** `Access-Control-Allow-Origin: *` com credenciais em rotas do app. Uma CSP completa (`script-src`) ainda não existe: se for adicionar, liste Supabase, Asaas, Firebase, Google Fonts, Nominatim/Photon/ViaCEP e teste o site inteiro antes.

### 2.4 Autenticação e rotas protegidas
```bash
rg -n 'createServerFn' src/lib                       # toda server fn
rg -n -A2 'createServerFn' src/lib | rg -n 'middleware'
```
- Toda server fn que lê/escreve dado de usuário usa `.middleware([requireSupabaseAuth])`; as de admin chamam `assertAdmin`; as da loja/entregador conferem o dono (`owner_id === context.userId`).
- Rotas em `src/routes/_authenticated/*` redirecionam sem login — mas **a segurança real é o RLS/servidor**, não o redirecionamento. Teste chamando a server fn/REST direto sem token (esperado: erro de autorização).
- O site no ar: `curl -X POST -H 'Origin: https://achoudelivery.com.br' -H 'Sec-Fetch-Site: same-origin' https://achoudelivery.com.br/_serverFn/<id>` sem token → "Unauthorized".
- Webhook: sem token e com token errado → 401; com token certo e referência inexistente → 200 sem efeito.
- Preços, frete, split e PIN só no servidor (`createOrder`); nada vindo do navegador entra em valor cobrado.

---

## 3. Chaves e segredos

```bash
git ls-files | rg -i '(^|/)\.env($|\.)' | rg -v '\.env\.example$'        # esperado: vazio
git check-ignore -v .env                                                    # esperado: ignorado
git log --all -p | rg -n -i 'sb_secret_|service_role.{0,5}=|\$aact_|whsec_|GOCSPX-|eyJhbGciOi[^"]{60,}|-----BEGIN [A-Z ]*PRIVATE KEY' | cut -c1-120
rg -n -i 'sb_secret_|\$aact_|whsec_|GOCSPX-|PRIVATE KEY' -g '!node_modules' -g '!.git' -g '!.env' .
```
- `.env` fora do Git e listado no `.gitignore`; `.env.example` só com nomes, sem valores.
- O repositório `renato7lpkt-netizen/achoudelivery` é **público**: qualquer segredo que já passou por um commit deve ser **trocado**, mesmo que removido depois (o histórico continua público).
- Na Hostinger, conferir pelos nomes (valores ficam mascarados): `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`, `ASAAS_API_KEY`, `ASAAS_WEBHOOK_TOKEN`. Só as `VITE_*` são públicas.
- Segredos colados em conversa, print ou chat contam como vazados → recomendar rotação (Supabase: nova secret key e apagar a antiga; Asaas: nova chave de API e novo token do webhook; Google: nova client secret).
- Arquivos que não deveriam estar públicos no site: `curl -o /dev/null -w '%{http_code}'` em `/.env`, `/package.json`, `/.git/HEAD`, `/AGENTS.md`, `/src/lib/asaas.server.ts` → esperado 403/404.

---

## Severidade

| Nível | Quando |
|---|---|
| **Crítica** | Vazamento de segredo ativo; qualquer usuário lê/altera dados de outros; mexer em valores, pagamentos ou repasses |
| **Alta** | Escalada de privilégio (virar admin/loja); dados pessoais expostos; webhook sem verificação |
| **Média** | Defesa em profundidade faltando (grant largo com RLS ainda segurando, cabeçalho ausente, rota sem rate limit) |
| **Baixa / Info** | Boas práticas, avisos intencionais, dependência só de desenvolvimento |

## Relatório (formato)

1. **Resumo**: quantos achados por severidade e se há algo urgente.
2. **Achados**: para cada um — severidade, o que é (em linguagem simples), evidência (comando/consulta e resultado, sem valores secretos), impacto, correção proposta.
3. **O que já está seguro** (com a evidência).
4. **Avisos intencionais** e por que podem ficar.
5. **Não verificado** e o motivo (ex.: exige login, painel de terceiros).
6. **Próximos passos**: o que o usuário precisa fazer e o que você pode corrigir com aprovação.
