import { Sidebar } from "@/components/layout/sidebar";
import { Topbar } from "@/components/layout/topbar";
import { Card } from "@/components/ui/card";
import { createClient } from "@/lib/supabase/server";
import { Sparkles, Bookmark, MousePointer, Check } from "lucide-react";
import { BookmarkletBox } from "./bookmarklet-box";

export const dynamic = "force-dynamic";

export default async function GreennConfigPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const secret = process.env.GREENN_SYNC_SECRET ?? "default-change-me";
  const endpoint = "https://caixa.brunotropolis.com.br/api/greenn/sync";

  // Bookmarklet: lê cookie access_token + POSTa pro endpoint.
  // Precisa ser uma linha só pra funcionar como href.
  const bookmarklet = `javascript:(async()=>{try{const c=Object.fromEntries(document.cookie.split(';').map(x=>{const i=x.indexOf('=');return [x.slice(0,i).trim(),x.slice(i+1).trim()]}));const tok=decodeURIComponent(c.access_token||'');if(!tok){alert('Token não encontrado. Você precisa estar logado em adm.greenn.com.br');return}const r=await fetch('${endpoint}',{method:'POST',headers:{'Content-Type':'application/json','X-Sync-Secret':'${secret}'},body:JSON.stringify({token:tok})});const d=await r.json();if(d.ok){alert('✓ Saldo Greenn atualizado!\\n\\nEm caixa: R$ '+d.disponivel.toFixed(2)+'\\nA receber: R$ '+(d.disponivel+d.pendente).toFixed(2)+'\\nAntecipável: R$ '+d.antecipavel.toFixed(2))}else{alert('Erro: '+(d.error||JSON.stringify(d)))}}catch(e){alert('Erro: '+e.message)}})();`;

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

          {/* Como funciona */}
          <Card className="mb-4">
            <h2 className="text-sm font-semibold mb-3">Como funciona</h2>
            <p className="text-xs text-ink-soft mb-3 leading-relaxed">
              A API da Greenn bloqueia tentativas de login que vêm do servidor
              (anti-fraude detecta IP de datacenter). Mas se a gente já tiver
              um <em>token válido</em>, qualquer chamada autenticada passa normal.
            </p>
            <p className="text-xs text-ink-soft leading-relaxed">
              A solução: um <strong>bookmarklet</strong> (link salvo no Chrome) que
              roda dentro da página da Greenn (onde você já tá logado), pega seu
              token e manda pro nosso servidor. Você clica no favorito sempre que
              quiser sincronizar.
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

            <Step n={2} title="Arrasta o botão abaixo pra barra de favoritos">
              <BookmarkletBox href={bookmarklet} />
            </Step>

            <Step n={3} title="Pronto. Agora pra atualizar:">
              <ol className="text-xs text-ink-soft space-y-1.5 list-decimal list-inside">
                <li>
                  Abre{" "}
                  <a
                    href="https://adm.greenn.com.br/extrato"
                    target="_blank"
                    rel="noreferrer"
                    className="underline text-lime"
                  >
                    adm.greenn.com.br
                  </a>{" "}
                  (logado)
                </li>
                <li>Clica no favorito "Sync Greenn"</li>
                <li>
                  Aparece um alerta com os valores atualizados. Volta aqui e dá refresh
                  no dashboard pra ver no card.
                </li>
              </ol>
            </Step>
          </Card>

          {/* Plano B / detalhes */}
          <Card>
            <h2 className="text-sm font-semibold mb-2">Limitações</h2>
            <ul className="text-xs text-ink-soft space-y-1.5 list-disc list-inside">
              <li>
                O token Greenn dura ~30 min. Se você não tiver entrado na Greenn
                recentemente, abre o painel da Greenn antes (qualquer página dela
                renova o token automaticamente).
              </li>
              <li>
                Se quiser sincronizar manualmente, ainda dá pra usar o modal
                &quot;Atualizar saldo&quot; do dashboard (digitar os 3 valores
                ou colar print).
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
