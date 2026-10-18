import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/auth")({
  validateSearch: (s) => z.object({ redirect: z.string().optional() }).parse(s),
  head: () => ({
    meta: [
      { title: "Entrar — AchouDelivery" },
      { name: "description", content: "Entre ou crie sua conta no AchouDelivery para pedir ou vender." },
      { property: "og:title", content: "Entrar — AchouDelivery" },
      { property: "og:description", content: "Acesse sua conta no marketplace de Sete Lagoas." },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const { redirect } = Route.useSearch();
  const navigate = useNavigate();
  const [mode, setMode] = useState<"in" | "up">("in");
  const [role, setRole] = useState<"cliente" | "lojista" | "entregador">(redirect?.startsWith("/painel") ? "lojista" : redirect?.startsWith("/entregador") ? "entregador" : "cliente");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [address, setAddress] = useState("");
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [resending, setResending] = useState(false);

  const safe = redirect?.startsWith("/") && !redirect.startsWith("//") ? redirect : null;
  const dest = safe ?? (role === "lojista" ? "/painel" : role === "entregador" ? "/entregador" : "/");

  async function google() {
    localStorage.setItem("achadao_after_login", dest);
    // Redirects to Google; on return, __root's SIGNED_IN handler sends the user to `dest`.
    const { error } = await supabase.auth.signInWithOAuth({ provider: "google", options: { redirectTo: window.location.origin } });
    if (error) { localStorage.removeItem("achadao_after_login"); toast.error("Não foi possível entrar com Google"); }
  }

  async function forgot() {
    if (!email) { toast.error("Digite seu e-mail acima primeiro"); return; }
    const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: window.location.origin + "/redefinir-senha" });
    if (error) { toast.error("Não foi possível enviar. Tente de novo."); return; }
    toast.success("Enviamos um link para seu e-mail para criar uma nova senha.");
  }

  async function resend() {
    if (!email || resending) return;
    setResending(true);
    await supabase.auth.resend({ type: "signup", email, options: { emailRedirectTo: window.location.origin + dest } });
    setResending(false);
    toast.success("Reenviamos o link. Confira também a caixa de spam.");
  }


  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    if (mode === "in") {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      setBusy(false);
      if (error) {
        if (error.code === "email_not_confirmed" || /not confirmed/i.test(error.message)) {
          await supabase.auth.resend({ type: "signup", email, options: { emailRedirectTo: window.location.origin + dest } });
          toast.error("Seu e-mail ainda não foi confirmado. Reenviamos o link: abra seu e-mail (veja também o spam) e clique em confirmar.", { duration: 10000 });
          return;
        }
        toast.error("E-mail ou senha incorretos");
        return;
      }
      navigate({ to: dest });
    } else {
      const { error } = await supabase.auth.signUp({ email, password, options: { emailRedirectTo: window.location.origin + dest } });
      setBusy(false);
      if (error) { toast.error(error.message); return; }
      if (role === "cliente" && address.trim()) localStorage.setItem("achadao_address", address.trim());
      setSent(true);
    }
  }

  if (sent) {
    return (
      <main className="mx-auto max-w-sm px-4 py-16 text-center">
        <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-full bg-primary/10 text-primary">
          <svg viewBox="0 0 24 24" className="h-8 w-8" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
            <rect x="2.5" y="5" width="19" height="14" rx="2.5" />
            <path d="m3.5 7 8.5 6 8.5-6" />
          </svg>
        </div>
        <h1 className="text-2xl font-extrabold">Confira seu e-mail</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Um link de confirmação foi enviado para <span className="font-semibold text-foreground">{email}</span>.
        </p>
        <p className="mt-3 text-xs text-muted-foreground">
          Abra sua caixa de entrada (veja também a caixa de spam) e clique no link para ativar sua conta.
        </p>
        <div className="mt-6 space-y-2">
          <Button className="w-full" onClick={() => { setSent(false); setMode("in"); }}>
            Já confirmei, quero entrar
          </Button>
          <Button variant="outline" className="w-full" disabled={resending} onClick={resend}>
            {resending ? "Reenviando..." : "Reenviar o link"}
          </Button>
        </div>
        <button className="mt-4 text-sm text-primary underline" onClick={() => { setSent(false); setMode("up"); }}>
          Cadastrar com outro e-mail
        </button>
      </main>
    );
  }


  return (
    <main className="mx-auto max-w-sm px-4 py-16">
      <div className="mb-6 grid grid-cols-3 gap-1 rounded-full bg-muted p-1 text-sm font-semibold">
        {(["cliente", "lojista", "entregador"] as const).map((r) => (
          <button key={r} type="button" onClick={() => setRole(r)} className={`rounded-full py-2 ${role === r ? "bg-card shadow-sm" : "text-muted-foreground"}`}>
            {r === "cliente" ? "Sou cliente" : r === "lojista" ? "Sou lojista" : "Entregador"}
          </button>
        ))}
      </div>
      <h1 className="text-3xl font-extrabold">{role === "cliente" ? "Peça em segundos" : role === "entregador" ? (mode === "in" ? "Entrar como entregador" : "Seja entregador") : mode === "in" ? "Entrar na sua loja" : "Cadastre sua loja"}</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        {role === "cliente" ? "Entre com sua conta Google e comece a pedir." : role === "entregador" ? "Crie sua conta e, em seguida, envie seus dados, chave Pix e documentos do veículo (CNH/CRLV) para análise." : "Entre com Google e, em seguida, preencha os dados da sua loja e a chave Pix."}
      </p>
      {(
        <>
          <Button type="button" size="lg" className="mt-6 w-full shadow-pop" onClick={google}>
            <svg viewBox="0 0 24 24" className="mr-2 h-5 w-5" aria-hidden="true"><path fill="currentColor" d="M21.35 11.1H12v2.98h5.36c-.23 1.4-1.66 4.1-5.36 4.1-3.23 0-5.86-2.67-5.86-5.96S8.77 6.26 12 6.26c1.84 0 3.07.78 3.78 1.46l2.58-2.48C16.7 3.7 14.56 2.75 12 2.75 6.9 2.75 2.77 6.9 2.77 12S6.9 21.25 12 21.25c5.33 0 8.86-3.74 8.86-9.02 0-.6-.07-1.06-.15-1.13Z"/></svg>
            Continuar com Google
          </Button>
          <p className="my-5 text-center text-xs text-muted-foreground">ou use seu e-mail</p>
        </>
      )}
      <form onSubmit={submit} className="space-y-4">
        <div><Label htmlFor="email">E-mail</Label><Input id="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} /></div>
        <div><Label htmlFor="pw">Senha</Label><Input id="pw" type="password" required minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} /></div>
        {role === "cliente" && mode === "up" && (
          <div><Label htmlFor="addr">Seu endereço (para calcular o frete)</Label><Input id="addr" value={address} onChange={(e) => setAddress(e.target.value)} placeholder="Rua, número, bairro" /></div>
        )}
        {mode === "in" && <button type="button" onClick={forgot} className="text-sm text-primary underline">Esqueci minha senha</button>}
        <Button type="submit" className="w-full" disabled={busy}>{mode === "in" ? "Entrar" : "Criar conta"}</Button>
      </form>
      <button className="mt-4 text-sm text-primary underline" onClick={() => setMode(mode === "in" ? "up" : "in")}>
        {mode === "in" ? "Não tem conta? Cadastre-se" : "Já tem conta? Entrar"}
      </button>
      <p className="mt-6 text-center text-xs text-muted-foreground">
        Ao continuar, você concorda com a{" "}
        <Link to="/privacidade" className="font-semibold text-primary hover:underline">Política de Privacidade</Link> (LGPD).
      </p>
    </main>
  );
}
