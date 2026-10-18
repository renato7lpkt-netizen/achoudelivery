---
name: security-audit
description: Auditoria de segurança completa do site e do banco de dados (RLS, permissões de funções, chaves secretas, webhooks, dependências). Use quando o usuário pedir "Security Audit", auditoria ou verificação de vazamento de dados.
---

# Security Audit

Responda sempre em português, em linguagem simples (o usuário não é programador).

## Passos
1. Rodar o scan de segurança do projeto e ler os achados.
2. Rodar o linter do banco: tabelas sem RLS, políticas permissivas, funções security definer executáveis por visitantes sem login.
3. Conferir que chaves privadas (pagamento, notificações, service role) só são lidas no servidor e nunca aparecem no código do navegador.
4. Conferir que webhooks públicos verificam um token antes de agir.
5. Conferir que preços, taxas e totais são calculados só no servidor.
6. Conferir que arquivos privados (documentos) usam links temporários, nunca públicos.
7. Rodar o scan de dependências.
8. Corrigir o que for brecha real; explicar o que for intencional (ex.: vitrine pública).

## Relatório
- O que foi corrigido
- O que já estava seguro
- Avisos intencionais e por quê
