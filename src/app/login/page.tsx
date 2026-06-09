"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { LogIn } from "lucide-react";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErro(null);
    setLoading(true);
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithPassword({ email, password: senha });
    setLoading(false);
    if (error) {
      setErro(error.message);
      return;
    }
    router.push("/");
    router.refresh();
  }

  return (
    <div className="min-h-screen grid place-items-center bg-bg p-6">
      <div className="w-full max-w-sm">
        <div className="flex items-center gap-2 mb-8 justify-center">
          <div className="h-8 w-8 rounded-lg bg-lime grid place-items-center">
            <span className="text-bg font-bold text-sm">●</span>
          </div>
          <span className="text-base font-semibold tracking-wide">
            Controle Financeiro
            <span className="text-ink-dim font-normal"> | brunotropolis</span>
          </span>
        </div>

        <div className="bg-surface border border-line/60 rounded-2xl p-6">
          <h1 className="text-lg font-semibold mb-1">Entrar</h1>
          <p className="text-xs text-ink-dim mb-5">Acesso ao painel financeiro v2</p>

          <form onSubmit={handleSubmit} className="space-y-3">
            <div>
              <label className="text-xs text-ink-soft block mb-1">Email</label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full bg-bg border border-line rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-lime"
              />
            </div>
            <div>
              <label className="text-xs text-ink-soft block mb-1">Senha</label>
              <input
                type="password"
                required
                value={senha}
                onChange={(e) => setSenha(e.target.value)}
                className="w-full bg-bg border border-line rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-lime"
              />
            </div>

            {erro && <div className="text-xs text-negative">{erro}</div>}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-lime text-bg font-semibold rounded-lg py-2.5 text-sm flex items-center justify-center gap-2 hover:bg-lime-glow disabled:opacity-60"
            >
              <LogIn className="h-4 w-4" />
              {loading ? "Entrando..." : "Entrar"}
            </button>
          </form>
        </div>

        <div className="text-center mt-4 text-[11px] text-ink-dim">
          Usa os mesmos usuários do financeiro v1
        </div>
      </div>
    </div>
  );
}
