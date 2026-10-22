import { createFileRoute, Link } from "@tanstack/react-router";
import { Mail, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SUPPORT_EMAIL, deletionMailto } from "@/lib/contact";

// Public page the Play Store data-safety form links to: how to ask for account and data deletion.
export const Route = createFileRoute("/excluir-conta")({
  head: () => ({
    meta: [
      { title: "Excluir conta — AchouDelivery" },
      { name: "description", content: "Como pedir a exclusão da sua conta e dos seus dados no AchouDelivery (clientes, lojistas e entregadores)." },
      { property: "og:title", content: "Excluir conta — AchouDelivery" },
      { property: "og:description", content: "Peça a exclusão da sua conta e dos seus dados no AchouDelivery." },
    ],
  }),
  component: ExcluirConta,
});

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-8">
      <h2 className="text-xl font-bold">{title}</h2>
      <div className="mt-3 space-y-2 text-sm leading-relaxed text-muted-foreground">{children}</div>
    </section>
  );
}

function ExcluirConta() {
  return (
    <main className="mx-auto max-w-3xl px-4 py-10">
      <div className="flex items-center gap-3">
        <Trash2 className="h-8 w-8 text-primary" />
        <h1 className="text-3xl font-extrabold">Excluir sua conta</h1>
      </div>
      <p className="mt-2 text-sm text-muted-foreground">
        Vale para os apps AchouDelivery (cliente), AchouDelivery Loja e AchouDelivery Entregador, e para o site achoudelivery.com.br.
      </p>

      <Section title="Como pedir a exclusão">
        <ol className="list-decimal space-y-2 pl-5">
          <li>Envie um e-mail para <a href={`mailto:${SUPPORT_EMAIL}`} className="font-semibold text-primary underline">{SUPPORT_EMAIL}</a> com o assunto <strong className="text-foreground">"Excluir minha conta do AchouDelivery"</strong>.</li>
          <li>Envie a partir do e-mail cadastrado na conta (ou informe esse e-mail na mensagem) e diga se você é cliente, lojista ou entregador.</li>
          <li>Confirmamos o pedido por e-mail e excluímos a conta em até 15 dias.</li>
        </ol>
        <Button asChild className="mt-4"><a href={deletionMailto}><Mail className="mr-1 h-4 w-4" />Pedir exclusão por e-mail</a></Button>
      </Section>

      <Section title="O que é apagado">
        <p>Seu login, nome, telefone, e-mail, endereços salvos e avisos no celular. Para lojistas: a loja, os produtos, os horários e a chave Pix. Para entregadores: o cadastro, a chave Pix e o documento enviado.</p>
      </Section>

      <Section title="O que guardamos e por quanto tempo">
        <p>Os registros de pedidos e repasses já pagos são guardados por até 5 anos, sem ligação com o seu login, porque a lei fiscal exige. As mensagens do chat de pedidos são apagadas junto com a conta.</p>
        <p>Pedidos em andamento e repasses pendentes são concluídos antes da exclusão.</p>
      </Section>

      <div className="mt-10 border-t pt-6 text-sm">
        <Link to="/privacidade" className="font-semibold text-primary hover:underline">Política de Privacidade</Link>
        <span className="mx-2 text-muted-foreground">·</span>
        <Link to="/" className="font-semibold text-primary hover:underline">Voltar para a vitrine</Link>
      </div>
    </main>
  );
}
