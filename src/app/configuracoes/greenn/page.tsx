import { Sidebar } from "@/components/layout/sidebar";
import { Topbar } from "@/components/layout/topbar";
import { Card } from "@/components/ui/card";
import { createClient } from "@/lib/supabase/server";
import { Sparkles, AlertTriangle, ExternalLink } from "lucide-react";
import { BookmarkletBox } from "./bookmarklet-box";

export const dynamic = "force-dynamic";

export default async function GreennConfigPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const secret = process.env.GREENN_SYNC_SECRET ?? "default-change-me";
  const endpoint = "https://caixa.brunotropolis.com.br/api/greenn/sync";

  // Bookmarklet: uma linha só, com javascript: prefix
  const bookmarklet = `javascript:(async()=>{try{const c=Object.fromEntries(document.cookie.split(';').map(x=>{const i=x.indexOf('=');return [x.slice(0,i).trim(),x.slice(i+1).trim()]}));const tok=decodeURIComponent(c.access_token||'');if(!tok){alert('Token não encontrado. Confira se você está logado em adm.greenn.com.br');return}const r=await fetch('${endpoint}',{method:'POST',headers:{'Content-Type':'application/json','X-Sync-Secret':'${secret}'},body:JSON.stringify({token:tok})});const d=await r.json();if(d.ok){alert('✓ Saldo Greenn atualizado!\\n\\nEm caixa: R$ '+d.disponivel.toFixed(2)+'\\nA receber: R$ '+(d.disponivel+d.pendente).toFixed(2)+'\\nAntecipável: R$ '+d.antecipavel.toFixed(2))}else{alert('Erro: '+(d.error||JSON.stringify(d)))}}catch(e){alert('Erro: '+e.message)}})();`;

  return (
    <div className="min-h-screen flex bg-bg">
      <Sidebar userEmail={user?.email} />

      <main className="flex-1 min-w-0">
        <Topbar breadcrumb={["Ajustes", "Greenn auto-sync"]} />

        <div className="p-6 lg:p-8 max-w-3xl">
          <div className="mb-6">
            <h1 className="text-2xl font-semibold tracking-tight flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-lime" />
              Greenn auto-sync
            </h1>
            <p className="text-xs text-ink-dim mt-1">
              1 clique pra atualizar o saldo Greenn — sem print, sem digitar.
            </p>
          </div>

          {/* Aviso Chrome strip-javascript */}
          <div className="mb-4 rounded-xl border border-amber-400/30 bg-amber-400/[0.06] p-4">
            <div className="flex items-start gap-2">
              <AlertTriangle className="h-4 w-4 text-amber-400 mt-0.5 shrink-0" />
              <div className="text-xs leading-relaxed">
                <strong className="text-amber-400">
                  Importante: arrastar não funciona no Chrome moderno.
                </strong>{" "}
                Desde 2021, o Chrome remove o prefixo{" "}
                <code className="bg-bg/60 rounded px-1">javascript:</code> de favoritos
                arrastados (proteção anti-phishing). Por isso o favorito que você arrastou
                não faz nada quando clica.{" "}
                <strong>Use o passo 2 abaixo (copiar URL + criar manual).</strong>
              </div>
            </div>
          </div>

          {/* Como funciona */}
          <Card className="mb-4">
            <h2 className="text-sm font-semibold mb-3">Como funciona</h2>
            <p className="text-xs text-ink-soft leading-relaxed">
              A API da Greenn bloqueia logins vindos do servidor. Mas qualquer chamada
              autenticada passa se a gente tiver um <em>token válido</em>. Esse favorito
              roda no contexto da Greenn (cookies dela), pega o seu token, e manda pro
              nosso servidor — que aí chama a API e atualiza o saldo.
            </p>
          </Card>

          {/* Setup */}
          <Card className="mb-4">
            <h2 className="text-sm font-semibold mb-4">Setup (1 minuto, só uma vez)</h2>

            <Step n={1} title="Mostra a barra de favoritos do Chrome">
              <p className="text-xs text-ink-soft">
                <kbd className="bg-elevated border border-line rounded px-1.5 py-0.5 text-[10px]">
                  Ctrl
                </kbd>{" "}
                +{" "}
                <kbd className="bg-elevated border border-line rounded px-1.5 py-0.5 text-[10px]">
                  Shift
                </kbd>{" "}
                +{" "}
                <kbd className="bg-elevated border border-line rounded px-1.5 py-0.5 text-[10px]">
                  B
                </kbd>
              </p>
            </Step>

            <Step n={2} title="Copia o código do favorito">
              <BookmarkletBox href={bookmarklet} />
            </Step>

            <Step n={3} title="Cria o favorito MANUAL (não arrasta)">
              <ol className="text-xs text-ink-soft space-y-2 list-decimal list-inside leading-relaxed">
                <li>
                  Clica com <strong>botão direito</strong> em qualquer espaço vazio da barra
                  de favoritos
                </li>
                <li>
                  Escolhe{" "}
                  <strong>&quot;Adicionar página…&quot;</strong> (ou &quot;Add page&quot;)
                </li>
                <li>
                  <strong>Nome:</strong>{" "}
                  <span className="bg-elevated border border-line rounded px-1.5 py-0.5">
                    Sync Greenn
                  </span>
                </li>
                <li>
                  <strong>URL:</strong> cola o código copiado do passo 2 (tem que começar com{" "}
                  <code className="bg-bg/60 rounded px-1">javascript:</code>)
                </li>
                <li>Salvar</li>
              </ol>
            </Step>

            <Step n={4} title="Pronto. Agora pra atualizar:">
              <ol className="text-xs text-ink-soft space-y-1.5 list-decimal list-inside leading-relaxed">
                <li>
                  Abre{" "}
                  <a
                    href="https://adm.greenn.com.br/extrato"
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 underline text-lime"
                  >
                    adm.greenn.com.br/extrato
                    <ExternalLink className="h-3 w-3" />
                  </a>
                </li>
                <li>Clica no favorito &quot;Sync Greenn&quot;</li>
                <li>
                  Aparece um alerta com os 3 valores. Volta no painel e dá refresh pra ver no
                  card lime.
                </li>
              </ol>
            </Step>
          </Card>

          {/* Limitações */}
          <Card>
            <h2 className="text-sm font-semibold mb-2">Detalhes</h2>
            <ul className="text-xs text-ink-soft space-y-1.5 list-disc list-inside leading-relaxed">
              <li>
                O token Greenn dura ~30 min. Se você não tá no painel da Greenn há mais que
                isso, abre a Greenn antes (qualquer página dela renova o token) e depois
                clica no favorito.
              </li>
              <li>
                Se quiser sincronizar manualmente sem usar o favorito, ainda dá pra usar o
                botão &quot;Atualizar saldo&quot; do dashboard (digitar os 3 valores ou colar
                print).
              </li>
              <li>
                O favorito só funciona quando você está numa aba da Greenn. Em outras páginas
                ele avisa &quot;Token não encontrado&quot;.
              </li>
            </ul>
          </Card>
        </div>
      </main>
    </div>
  );
}

function Step({
  n,
  title,
  children,
}: {
  n: number;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex gap-3 mb-4 last:mb-0">
      <div className="h-6 w-6 shrink-0 rounded-full bg-lime/15 text-lime grid place-items-center text-xs font-bold">
        {n}
      </div>
      <div className="flex-1">
        <div className="text-sm font-medium mb-1.5">{title}</div>
        {children}
      </div>
    </div>
  );
}
