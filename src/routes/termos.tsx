import { createFileRoute, Link } from "@tanstack/react-router";
import { FileText } from "lucide-react";

export const Route = createFileRoute("/termos")({
  head: () => ({
    meta: [
      { title: "Termos de Uso — AchouDelivery" },
      { name: "description", content: "Termos Gerais de Uso e Contrato de Intermediação do AchouDelivery para clientes, lojistas e entregadores de Sete Lagoas/MG." },
      { property: "og:title", content: "Termos de Uso — AchouDelivery" },
      { property: "og:description", content: "Regras de uso da plataforma AchouDelivery para clientes, lojistas e entregadores." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Termos,
});

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-8">
      <h2 className="text-xl font-bold">{title}</h2>
      <div className="mt-3 space-y-2 text-sm leading-relaxed text-muted-foreground">{children}</div>
    </section>
  );
}

function Termos() {
  return (
    <main className="mx-auto max-w-3xl px-4 py-10">
      <div className="flex items-center gap-3">
        <FileText className="h-8 w-8 text-primary" />
        <h1 className="text-3xl font-extrabold">Termos de Uso e Contrato de Intermediação</h1>
      </div>
      <p className="mt-2 text-sm text-muted-foreground">
        AchouDelivery — marketplace local de Sete Lagoas/MG (site e aplicativo). Última atualização: outubro de 2026.
        Ao criar uma conta ou usar a plataforma, você concorda com estes termos.
      </p>

      <Section title="1. Regras para o Cliente">
        <p><strong className="text-foreground">Endereço:</strong> o cliente é responsável por informar o endereço de entrega completo e correto. Pedidos enviados para endereços errados por falta de informação não geram reembolso.</p>
        <p><strong className="text-foreground">Cancelamento:</strong> o pedido pode ser cancelado sem custo apenas antes de a loja iniciar o preparo. Depois do preparo iniciado, o cancelamento fica sujeito à cobrança integral.</p>
        <p><strong className="text-foreground">Recebimento:</strong> a entrega é confirmada mediante o código PIN de 4 dígitos gerado no pedido. Informe o PIN apenas ao entregador no momento do recebimento. A confirmação do PIN comprova a entrega.</p>
        <p><strong className="text-foreground">Pagamento:</strong> feito no checkout via Pix ou cartão (processado pelo Asaas). Cartão: à vista em 1x; compras acima de R$ 500 podem ser divididas em até 2x.</p>
      </Section>

      <Section title="2. Regras para o Lojista">
        <p><strong className="text-foreground">Responsabilidade:</strong> a loja é a única responsável pela qualidade, preparo, higiene, validade e entrega correta dos produtos anunciados, bem como pelo cumprimento das normas sanitárias e fiscais aplicáveis.</p>
        <p><strong className="text-foreground">Comissão:</strong> o AchouDelivery retém comissão de 5,5% sobre o total de cada pedido, somada às taxas de processamento do Asaas (Pix: taxa fixa por transação; cartão: percentual + taxa fixa), descontadas antes do repasse.</p>
        <p><strong className="text-foreground">Repasse:</strong> os valores líquidos são repassados via Pix para a chave cadastrada pela loja, em ciclo semanal, após a confirmação das entregas. A loja é responsável por manter a chave Pix atualizada.</p>
        <p><strong className="text-foreground">Cardápio e horários:</strong> a loja deve manter preços, disponibilidade e horários de funcionamento atualizados na plataforma.</p>
      </Section>

      <Section title="3. Regras para o Entregador">
        <p><strong className="text-foreground">Cadastro:</strong> o cadastro de entregador passa por verificação de documentos (CNH/CRLV) e só é liberado após aprovação da administração.</p>
        <p><strong className="text-foreground">Remuneração:</strong> o entregador da plataforma recebe o valor integral da corrida (R$ 2 por km), sem descontos de comissão do AchouDelivery ou taxas do Asaas.</p>
        <p><strong className="text-foreground">Conduta:</strong> o entregador deve cumprir as leis de trânsito, tratar clientes com respeito e zelar pelos produtos transportados.</p>
        <p><strong className="text-foreground">Confirmação de entrega:</strong> é obrigatório solicitar o PIN de 4 dígitos ao cliente e confirmá-lo no aplicativo para concluir a entrega. Entregas sem confirmação de PIN podem não ser remuneradas.</p>
      </Section>

      <Section title="4. Papel do AchouDelivery (Intermediação)">
        <p>O AchouDelivery é uma plataforma de tecnologia que conecta clientes, lojas e entregadores. O AchouDelivery <strong className="text-foreground">não fabrica, prepara ou vende</strong> os produtos anunciados e <strong className="text-foreground">não mantém vínculo empregatício</strong> com lojistas ou entregadores.</p>
        <p>Problemas com a qualidade ou o conteúdo dos produtos são de responsabilidade da loja; problemas com a condução da entrega são de responsabilidade do entregador. O AchouDelivery atua para mediar e ajudar na solução de conflitos, podendo reter repasses em caso de disputa comprovada.</p>
        <p>O pagamento é processado pelo Asaas; o AchouDelivery não armazena dados de cartão.</p>
      </Section>

      <Section title="5. Cancelamento de Conta e Foro">
        <p><strong className="text-foreground">Suspensão e banimento:</strong> contas que descumprirem estes termos — incluindo fraude, uso de cartões de terceiros, adulteração de pedidos, desrespeito a clientes ou descumprimento reiterado de obrigações — podem ser suspensas ou excluídas, com retenção de valores pendentes até a apuração.</p>
        <p><strong className="text-foreground">Exclusão voluntária:</strong> qualquer usuário pode pedir a exclusão da conta e dos dados pessoais, conforme a Política de Privacidade (LGPD).</p>
        <p><strong className="text-foreground">Foro:</strong> fica eleita a Comarca de <strong className="text-foreground">Sete Lagoas — Minas Gerais</strong> para dirimir quaisquer controvérsias decorrentes destes termos, com renúncia a qualquer outro, por mais privilegiado que seja.</p>
      </Section>

      <div className="mt-10 border-t pt-6">
        <Link to="/" className="text-sm font-semibold text-primary hover:underline">← Voltar para a vitrine</Link>
      </div>
    </main>
  );
}
