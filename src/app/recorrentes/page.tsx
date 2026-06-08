import { Sidebar } from "@/components/layout/sidebar";
import { Topbar } from "@/components/layout/topbar";
import { Card } from "@/components/ui/card";
import { createClient } from "@/lib/supabase/server";
import { CONTAS_ATIVAS, CONTAS_ATIVAS_IDS } from "@/lib/constants";
import { formatBRL } from "@/lib/formatters";
import { Repeat, Layers, Power } from "lucide-react";
import { RecorrenteToggle } from "./recorrente-toggle";

export const dynamic = "force-dynamic";

type RecorrenciaRow = {
  id: string;
  nome: string;
  valor_padrao: number | string;
  frequencia: string;
  dia_vencimento: number | null;
  conta_id: string | null;
  categoria_id: string | null;
  tipo_valor: string | null;
  ativo: boolean;
};

type ParceladaGroup = {
  pai_id: string | null;
  descricao: string;
  parcela_total: number | null;
  parcelas: Array<{
    id: string;
    parcela_atual: number | null;
    valor: number | string;
    data_competencia: string;
    status: string;
    conta_id: string | null;
  }>;
};

export default async function RecorrentesPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // 1. Recorrências ativas das 3 contas
  const recRes = await supabase
    .from("recorrencias")
    .select("id, nome, valor_padrao, frequencia, dia_vencimento, conta_id, categoria_id, tipo_valor, ativo")
    .in("conta_id", [...CONTAS_ATIVAS_IDS])
    .eq("tipo", "despesa")
    .order("nome");
  const recorrencias = ((recRes.data ?? []) as RecorrenciaRow[]).filter((r) => r.ativo);

  // 2. Parceladas em aberto (status=prevista) das 3 contas
  const hoje = new Date().toISOString().slice(0, 10);
  const parRes = await supabase
    .from("transacoes")
    .select("id, descricao, valor, data_competencia, status, conta_id, parcela_atual, parcela_total, transacao_pai_id")
    .in("conta_id", [...CONTAS_ATIVAS_IDS])
    .eq("parcelado", true)
    .eq("status", "prevista")
    .gte("data_competencia", hoje)
    .order("data_competencia");

  const parceladasRaw = (parRes.data ?? []) as Array<{
    id: string;
    descricao: string;
    valor: number | string;
    data_competencia: string;
    status: string;
    conta_id: string | null;
    parcela_atual: number | null;
    parcela_total: number | null;
    transacao_pai_id: string | null;
  }>;

  // Agrupa por descrição base (remove "(X/N)") + parcela_total
  const groups = new Map<string, ParceladaGroup>();
  for (const t of parceladasRaw) {
    const baseDesc = t.descricao.replace(/\s*\(\d+\/\d+\)\s*$/, "").trim();
    const key = `${baseDesc}__${t.parcela_total ?? "?"}`;
    if (!groups.has(key)) {
      groups.set(key, {
        pai_id: t.transacao_pai_id,
        descricao: baseDesc,
        parcela_total: t.parcela_total,
        parcelas: [],
      });
    }
    groups.get(key)!.parcelas.push(t);
  }
  const parceladas = [...groups.values()];

  return (
    <div className="min-h-screen flex bg-bg">
      <Sidebar userEmail={user?.email} />

      <main className="flex-1 min-w-0">
        <Topbar breadcrumb={["Operação", "Recorrentes"]} />

        <div className="p-6 lg:p-8 max-w-5xl">
          <h1 className="text-2xl font-semibold tracking-tight mb-1">Recorrentes</h1>
          <p className="text-xs text-ink-dim mb-6">
            Despesas que repetem todo mês + compras parceladas em aberto.
          </p>

          {/* Recorrências fixas */}
          <section className="mb-8">
            <div className="flex items-center gap-2 mb-3">
              <Repeat className="h-4 w-4 text-lime" />
              <h2 className="text-sm font-semibold">
                Fixas
                <span className="ml-2 text-ink-dim font-normal">({recorrencias.length})</span>
              </h2>
            </div>

            {recorrencias.length === 0 ? (
              <EmptyState
                texto="Nenhuma recorrência cadastrada nas 3 contas."
                cta="Cadastrar em /lancar"
              />
            ) : (
              <Card className="!p-0 overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-line/60 text-[11px] text-ink-dim uppercase tracking-wider">
                      <th className="text-left px-4 py-2.5 font-medium">Nome</th>
                      <th className="text-left px-4 py-2.5 font-medium">Conta</th>
                      <th className="text-left px-4 py-2.5 font-medium">Freq.</th>
                      <th className="text-right px-4 py-2.5 font-medium">Valor</th>
                      <th className="text-right px-4 py-2.5 font-medium">Ações</th>
                    </tr>
                  </thead>
                  <tbody>
                    {recorrencias.map((r) => {
                      const conta = CONTAS_ATIVAS.find((c) => c.id === r.conta_id);
                      const freq =
                        r.frequencia === "mensal"
                          ? `dia ${r.dia_vencimento ?? "?"}`
                          : r.frequencia;
                      return (
                        <tr key={r.id} className="border-b border-line/40 last:border-0">
                          <td className="px-4 py-3">
                            <div className="font-medium">{r.nome}</div>
                            {r.tipo_valor && r.tipo_valor !== "fixo" && (
                              <div className="text-[10px] text-ink-dim mt-0.5 uppercase">
                                {r.tipo_valor}
                              </div>
                            )}
                          </td>
                          <td className="px-4 py-3 text-ink-soft">
                            <span className="inline-flex items-center gap-1.5">
                              <span
                                className="h-2 w-2 rounded-full"
                                style={{ background: conta?.cor }}
                              />
                              {conta?.nome ?? "—"}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-ink-soft">{freq}</td>
                          <td className="px-4 py-3 text-right font-medium">
                            {formatBRL(Number(r.valor_padrao))}
                          </td>
                          <td className="px-4 py-3 text-right">
                            <RecorrenteToggle id={r.id} ativo={r.ativo} />
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </Card>
            )}
          </section>

          {/* Parceladas */}
          <section>
            <div className="flex items-center gap-2 mb-3">
              <Layers className="h-4 w-4 text-lime" />
              <h2 className="text-sm font-semibold">
                Parceladas em aberto
                <span className="ml-2 text-ink-dim font-normal">({parceladas.length})</span>
              </h2>
            </div>

            {parceladas.length === 0 ? (
              <EmptyState texto="Nenhuma compra parcelada com parcelas futuras." />
            ) : (
              <div className="space-y-3">
                {parceladas.map((g, i) => {
                  const total = g.parcelas.reduce((s, p) => s + Number(p.valor), 0);
                  const primeira = g.parcelas[0];
                  const conta = CONTAS_ATIVAS.find((c) => c.id === primeira?.conta_id);
                  return (
                    <Card key={i}>
                      <div className="flex items-start justify-between mb-2">
                        <div>
                          <div className="font-medium">{g.descricao}</div>
                          <div className="text-[11px] text-ink-dim mt-0.5">
                            {conta && (
                              <>
                                <span
                                  className="inline-block h-1.5 w-1.5 rounded-full mr-1.5"
                                  style={{ background: conta.cor }}
                                />
                                {conta.nome} · {conta.apelido}
                              </>
                            )}
                          </div>
                        </div>
                        <span className="text-[10px] bg-elevated border border-line rounded px-2 py-0.5 text-ink-soft">
                          {g.parcelas.length} de {g.parcela_total ?? g.parcelas.length} restantes
                        </span>
                      </div>
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-ink-dim">
                          próxima: {new Date(primeira.data_competencia).toLocaleDateString("pt-BR")}
                        </span>
                        <span className="font-semibold">{formatBRL(total)} a pagar</span>
                      </div>
                    </Card>
                  );
                })}
              </div>
            )}
          </section>
        </div>
      </main>
    </div>
  );
}

function EmptyState({ texto, cta }: { texto: string; cta?: string }) {
  return (
    <div className="rounded-xl border border-dashed border-line/60 px-6 py-10 text-center">
      <Power className="h-5 w-5 text-ink-dim mx-auto mb-2" />
      <div className="text-sm text-ink-soft">{texto}</div>
      {cta && <div className="text-[11px] text-ink-dim mt-1">{cta}</div>}
    </div>
  );
}
