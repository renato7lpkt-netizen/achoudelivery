import { createFileRoute, Link } from "@tanstack/react-router";
import { ShieldCheck } from "lucide-react";
import { SUPPORT_EMAIL } from "@/lib/contact";

export const Route = createFileRoute("/privacidade")({
  head: () => ({
    meta: [
      { title: "Política de Privacidade — AchouDelivery" },
      { name: "description", content: "Como o AchouDelivery coleta, usa e protege os dados pessoais de clientes, lojistas e entregadores, conforme a LGPD (Lei 13.709/2018)." },
      { property: "og:title", content: "Política de Privacidade — AchouDelivery" },
      { property: "og:description", content: "Saiba como seus dados são tratados no AchouDelivery, conforme a LGPD." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Privacidade,
});

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-8">
      <h2 className="text-xl font-bold">{title}</h2>
      <div className="mt-3 space-y-2 text-sm leading-relaxed text-muted-foreground">{children}</div>
    </section>
  );
}

function Privacidade() {
  return (
    <main className="mx-auto max-w-3xl px-4 py-10">
      <div className="flex items-center gap-3">
        <ShieldCheck className="h-8 w-8 text-primary" />
        <h1 className="text-3xl font-extrabold">Política de Privacidade</h1>
      </div>
      <p className="mt-2 text-sm text-muted-foreground">
        AchouDelivery — marketplace local de Sete Lagoas/MG. Última atualização: outubro de 2026.
        Esta política segue a Lei Geral de Proteção de Dados (LGPD — Lei nº 13.709/2018).
      </p>

      <Section title="1. Quais dados coletamos">
        <p><strong className="text-foreground">Clientes:</strong> nome, telefone, e-mail, endereço de entrega e localização aproximada (para calcular o frete).</p>
        <p><strong className="text-foreground">Lojistas:</strong> nome da loja, razão social, CNPJ/CPF, e-mail, WhatsApp, endereço e chave Pix para receber os repasses.</p>
        <p><strong className="text-foreground">Entregadores:</strong> nome, telefone, CPF, veículo, placa, chave Pix e documento do veículo (CNH/CRLV) para verificação.</p>
        <p>Dados de pagamento (cartão) são processados diretamente pelo Asaas e não ficam armazenados no AchouDelivery.</p>
      </Section>

      <Section title="2. Para que usamos">
        <p>Usamos os dados apenas para: processar e entregar pedidos; calcular o frete pela distância; repassar os valores às lojas via Pix; verificar entregadores; enviar avisos sobre o andamento dos pedidos; e cumprir obrigações legais e fiscais.</p>
        <p>Não vendemos nem compartilhamos dados pessoais com terceiros para publicidade.</p>
      </Section>

      <Section title="3. Quem pode ver seus dados">
        <p>Cada pessoa só vê os próprios dados. O lojista vê somente os pedidos da sua loja; o entregador vê somente as entregas designadas a ele; o cliente vê somente os próprios pedidos. Documentos de entregadores ficam em área privada, acessível apenas ao entregador e à administração.</p>
        <p>O cardápio, os horários e as informações públicas das lojas são visíveis a todos os visitantes, pois fazem parte da vitrine.</p>
      </Section>

      <Section title="4. Compartilhamento necessário">
        <p>Compartilhamos o mínimo necessário para o serviço funcionar: o endereço e o telefone do cliente são mostrados à loja e ao entregador do pedido; os dados de pagamento trafegam com o Asaas (processador de pagamentos); notificações usam o serviço do Google Firebase.</p>
      </Section>

      <Section title="5. Segurança">
        <p>Aplicamos controle de acesso rigoroso no banco de dados: cada registro só pode ser lido ou alterado pelo seu dono. Senhas e chaves de pagamento ficam no servidor e nunca no navegador. Totais e taxas são calculados no servidor para impedir adulterações.</p>
      </Section>

      <Section title="6. Seus direitos (LGPD)">
        <p>Você pode, a qualquer momento: confirmar quais dados temos sobre você; corrigir dados incompletos ou desatualizados; pedir a exclusão dos seus dados e da sua conta; revogar consentimentos; e pedir a portabilidade dos dados.</p>
        <p>Para exercer esses direitos, escreva para <a href={`mailto:${SUPPORT_EMAIL}`} className="font-semibold text-primary underline">{SUPPORT_EMAIL}</a>. Responderemos em até 15 dias. Para excluir a conta, veja o passo a passo em <Link to="/excluir-conta" className="font-semibold text-primary underline">Excluir conta</Link>.</p>
      </Section>

      <Section title="7. Retenção e exclusão">
        <p>Guardamos os dados enquanto a conta estiver ativa e pelo prazo exigido por obrigações fiscais e legais. Pedidos concluídos podem ser mantidos de forma anonimizada para estatísticas. Ao pedir a exclusão, apagamos os dados pessoais que não precisamos reter por lei.</p>
      </Section>

      <Section title="8. Encarregado de dados (DPO)">
        <p>O responsável pelo tratamento de dados pessoais no AchouDelivery é a administração da plataforma. Dúvidas sobre esta política podem ser enviadas para <a href={`mailto:${SUPPORT_EMAIL}`} className="font-semibold text-primary underline">{SUPPORT_EMAIL}</a>.</p>
      </Section>

      <div className="mt-10 border-t pt-6">
        <Link to="/" className="text-sm font-semibold text-primary hover:underline">← Voltar para a vitrine</Link>
      </div>
    </main>
  );
}
