# Apps do AchouDelivery (Cliente, Loja e Entregador)

O site já funciona como três apps separados. Cada área tem nome, ícone, cor e página inicial próprios:

| App | Abre em | Manifesto | Pacote Android sugerido |
|---|---|---|---|
| AchouDelivery (cliente) | `/` | `/manifest.webmanifest` | `br.com.achoudelivery.cliente` |
| AchouDelivery Loja | `/painel` | `/manifest-loja.webmanifest` | `br.com.achoudelivery.loja` |
| AchouDelivery Entregador | `/entregador` | `/manifest-entregador.webmanifest` | `br.com.achoudelivery.entregador` |

As configurações ficam em `src/lib/web-manifest.ts`, e os ícones em `public/icon-loja-*.png` e `public/icon-entregador-*.png`.

## 1. Instalar pelo navegador (já funciona, sem loja de apps)

- **Android (Chrome):** abra a página do app e use o menu ⋮, depois **Instalar app** ou **Adicionar à tela inicial**:
  - para o app do cliente, `achoudelivery.com.br`;
  - para o app da loja, `achoudelivery.com.br/painel`;
  - para o app do entregador, `achoudelivery.com.br/entregador`.
- **iPhone (Safari):** abra a mesma página e toque em **Compartilhar** e depois em **Adicionar à Tela de Início**. O nome e o ícone mudam conforme a página aberta.

## 2. Publicar na Play Store (um app por pacote)

1. Acesse https://www.pwabuilder.com, cole a URL do app (por exemplo `https://achoudelivery.com.br/painel`) e escolha **Package for stores**, depois **Android**.
2. Use o pacote da tabela acima. Em **Signing key**, escolha **Create new** e guarde o arquivo `.keystore` e as senhas. Elas são necessárias em todas as atualizações.
3. No Play Console, crie um app para cada pacote e envie o arquivo `.aab` gerado.
4. No Play Console, abra **Integridade do app** e depois **Assinatura de apps**, e copie a **impressão digital SHA-256** da chave de assinatura do app.
5. Na Hostinger, crie a variável `ANDROID_SHA256_FINGERPRINTS` com essas impressões (separe por vírgula se forem diferentes) e salve para refazer o build.
6. Confira em `https://achoudelivery.com.br/.well-known/assetlinks.json`, que deve listar os três pacotes. Com isso o app abre em tela cheia, sem a barra de endereço.

Repita os passos 1 a 3 para cada um dos três apps. Para o teste fechado, o Google exige 12 testadores por 14 dias em cada app novo.
