import { Sidebar } from "@/components/layout/sidebar";
import { Topbar } from "@/components/layout/topbar";
import { Card } from "@/components/ui/card";
import { createClient } from "@/lib/supabase/server";
import { CONTAS_ATIVAS, CONTAS_ATIVAS_IDS } from "@/lib/constants";
import { formatBRL, formatDate } from "@/lib/formatters";
import { getCategorias, getProjetos } from "@/lib/catalog";
import { LancamentosFiltros } from "./filtros";

export const dynamic = "force-dynamic";

type Tx = {
  id: string;
  descricao: string;
  valor: number | string;
  tipo: string;
  data_competencia: string;
  data_pagamento: string | null;
  status: string;
  conta_id: string | null;
  categoria_id: string | null;
  parcelado: boolean | null;
  parcela_atual: number | null;
  parcela_total: number | null;
  projeto_id: string | null;
};

function rangeFrom(periodo: string): { inicio: string; fim: string; label: string } {
  const hoje = new Date();
  const y = hoje.getFullYear();
  const m = hoje.getMonth();
  if (periodo === "mes") {
    return {
      inicio: new Date(y, m, 1).toISOString().slice(0, 10),
      fim: new Date(y, m + 1, 0).toISOString().slice(0, 10),
      label: "Mês atual",
    };
  }
  if (periodo === "3m") {
    return {
      inicio: new Date(y, m - 2, 1).toISOString().slice(0, 10),
      fim: new Date(y, m + 1, 0).toISOString().slice(0, 10),
      label: "Últimos 3 meses",
    };
  }
  if (periodo === "futuro") {
    return {
      inicio: hoje.toISOString().slice(0, 10),
      fim: new Date(y, m + 6, 0).toISOString().slice(0, 10),
      label: "Próximos meses",
    };
  }
  // tudo (90 dias passados a 6 meses futuros)
  return {
    inicio: new Date(y, m - 3, 1).toISOString().slice(0, 10),
    fim: new Date(y, m + 7, 0).toISOString().slice(0, 10),
    label: "Tudo",
  };
}

export default async function LancamentosPage({
  searchParams,
}: {
  searchParams: Promise<{ p?: string; conta?: string; tipo?: string }>;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const params = await searchParams;
  const periodo = params.p ?? "mes";
  const contaFilter = params.conta ?? "todas";
  const tipoFilter = params.tipo ?? "todos";
  const { inicio, fim, label } = rangeFrom(periodo);

  const contasFiltradas =
    contaFilter !== "todas" && CONTAS_ATIVAS_IDS.includes(contaFilter as (typeof CONTAS_ATIVAS_IDS)[number])
      ? [contaFilter]
      : [...CONTAS_ATIVAS_IDS];

  let q = supabase
    .from("transacoes")
    .select(
      "id, descricao, valor, tipo, data_competencia, data_pagamento, status, conta_id, categoria_id, parcelado, parcela_atual, parcela_total, projeto_id"
    )
    .in("conta_id", contasFiltradas)
    .gte("data_competencia", inicio)
    .lte("data_competencia", fim)
    .order("data_competencia", { ascending: false })
    .limit(500);
  if (tipoFilter !== "todos") q = q.eq("tipo", tipoFilter);

  const txRes = await q;
  const transacoes = (txRes.data ?? []) as Tx[];

  const [categorias, projetos] = await Promise.all([getCategorias(), getProjetos()]);
  const catMap = new Map(categorias.map((c) => [c.id, c]));
  const projMap = new Map(projetos.map((p) => [p.id, p]));

  const totalDespesas = transacoes
    .filter((t) => t.tipo === "despesa")
    .reduce((s, t) => s + Number(t.valor), 0);
  const totalReceitas = transacoes
    .filter((t) => t.tipo === "receita")
    .reduce((s, t) => s + Number(t.valor), 0);

  return (
    <div className="min-h-screen flex bg-bg">
      <Sidebar userEmail={user?.email} />

      <main className="flex-1 min-w-0">
        <Topbar breadcrumb={["Operação", "Lançamentos"]} />

        <div className="p-6 lg:p-8 max-w-6xl">
          <div className="flex items-start justify-between mb-6">
            <div>
              <h1 className="text-2xl font-semibold tracking-tight">Lançamentos</h1>
              <p className="text-xs text-ink-dim mt-1">
                Histórico de transações nas 3 contas — {label}.
              </p>
            </div>
            <LancamentosFiltros
              periodo={periodo}
              conta={contaFilter}
              tipo={tipoFilter}
            />
          </div>

          {/* Totais */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-5">
            <Card className="!p-4">
              <div className="text-xs text-ink-soft">Lançamentos</div>
              <div className="text-xl font-bold mt-0.5">{transacoes.length}</div>
            </Card>
            <Card className="!p-4">
              <div className="text-xs text-ink-soft">Despesas</div>
              <div className="text-xl font-bold text-negative mt-0.5">
                {formatBRL(totalDespesas)}
              </div>
            </Card>
            <Card className="!p-4">
              <div className="text-xs text-ink-soft">Receitas</div>
              <div className="text-xl font-bold text-positive mt-0.5">
                {formatBRL(totalReceitas)}
              </div>
            </Card>
          </div>

          {transacoes.length === 0 ? (
            <Card>
              <div className="text-sm text-ink-soft text-center py-8">
                Nenhum lançamento no período.
              </div>
            </Card>
          ) : (
            <Card className="!p-0 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm min-w-[700px]">
                  <thead>
                    <tr className="border-b border-line/60 text-[11px] text-ink-dim uppercase tracking-wider bg-surface/50">
                      <th className="text-left px-4 py-2.5 font-medium">Data</th>
                      <th className="text-left px-4 py-2.5 font-medium">Descrição</th>
                      <th className="text-left px-4 py-2.5 font-medium">Conta</th>
                      <th className="text-left px-4 py-2.5 font-medium">Categoria</th>
                      <th className="text-left px-4 py-2.5 font-medium">Projeto</th>
                      <th className="text-left px-4 py-2.5 font-medium">Status</th>
                      <th className="text-right px-4 py-2.5 font-medium">Valor</th>
                    </tr>
                  </thead>
                  <tbody>
                    {transacoes.map((t) => {
                      const conta = CONTAS_ATIVAS.find((c) => c.id === t.conta_id);
                      const cat = t.categoria_id ? catMap.get(t.categoria_id) : null;
                      const proj = t.projeto_id ? projMap.get(t.projeto_id) : null;
                      const isDespesa = t.tipo === "despesa";
                      return (
                        <tr key={t.id} className="border-b border-line/40 last:border-0 hover:bg-elevated/30">
                          <td className="px-4 py-3 text-ink-soft whitespace-nowrap">
                            {formatDate(t.data_competencia)}
                          </td>
                          <td className="px-4 py-3">
                            <div className="font-medium">{t.descricao}</div>
                            {t.parcelado && t.parcela_atual && t.parcela_total && (
                              <div className="text-[10px] text-ink-dim mt-0.5">
                                parcela {t.parcela_atual}/{t.parcela_total}
                              </div>
                            )}
                          </td>
                          <td className="px-4 py-3 text-ink-soft text-xs">
                            {conta && (
                              <span className="inline-flex items-center gap-1.5">
                                <span
                                  className="h-1.5 w-1.5 rounded-full"
                                  style={{ background: conta.cor }}
                                />
                                {conta.nome}
                              </span>
                            )}
                          </td>
                          <td className="px-4 py-3 text-ink-soft text-xs">
                            {cat?.nome ?? "—"}
                          </td>
                          <td className="px-4 py-3 text-xs">
                            {proj ? (
                              <span className="inline-flex items-center gap-1.5">
                                <span
                                  className="h-1.5 w-1.5 rounded-full"
                                  style={{ background: proj.cor ?? "#71717a" }}
                                />
                                <span className="text-ink-soft">{proj.nome}</span>
                              </span>
                            ) : (
                              <span className="text-ink-dim">—</span>
                            )}
                          </td>
                          <td className="px-4 py-3">
                            <span
                              className={`text-[10px] uppercase tracking-wider rounded px-1.5 py-0.5 ${
                                t.status === "paga" || t.status === "confirmada" || t.status === "recebido"
                                  ? "bg-positive/15 text-positive"
                                  : "bg-elevated text-ink-soft border border-line"
                              }`}
                            >
                              {t.status}
                            </span>
                          </td>
                          <td
                            className={`px-4 py-3 text-right font-semibold whitespace-nowrap ${
                              isDespesa ? "text-negative" : "text-positive"
                            }`}
                          >
                            {isDespesa ? "−" : "+"}
                            {formatBRL(Number(t.valor))}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </Card>
          )}
        </div>
      </main>
    </div>
  );
}
