import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/redefinir-senha")({
  head: () => ({
    meta: [
      { title: "Nova senha — AchouDelivery" },
      { name: "description", content: "Cadastre uma nova senha para sua conta no AchouDelivery." },
      { property: "og:title", content: "Nova senha — AchouDelivery" },
      { property: "og:description", content: "Recupere o acesso à sua conta no AchouDelivery." },
    ],
  }),
  component: ResetPassword,
});

function ResetPassword() {
  const navigate = useNavigate();
  const [pw, setPw] = useState("");
  const [pw2, setPw2] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (pw !== pw2) { toast.error("As senhas não conferem"); return; }
    setBusy(true);
    const { error } = await supabase.auth.updateUser({ password: pw });
    setBusy(false);
    if (error) { toast.error("Link expirado ou inválido. Peça um novo em Entrar → Esqueci minha senha."); return; }
    toast.success("Senha alterada! Você já está conectado.");
    navigate({ to: "/" });
  }

  return (
    <main className="mx-auto max-w-sm px-4 py-16">
      <h1 className="text-3xl font-extrabold">Criar nova senha</h1>
      <form onSubmit={submit} className="mt-6 space-y-4">
        <div><Label htmlFor="pw">Nova senha</Label><Input id="pw" type="password" required minLength={6} value={pw} onChange={(e) => setPw(e.target.value)} /></div>
        <div><Label htmlFor="pw2">Repita a senha</Label><Input id="pw2" type="password" required minLength={6} value={pw2} onChange={(e) => setPw2(e.target.value)} /></div>
        <Button type="submit" className="w-full" disabled={busy}>Salvar nova senha</Button>
      </form>
    </main>
  );
}
