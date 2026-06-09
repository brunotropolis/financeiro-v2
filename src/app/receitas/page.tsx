import Link from "next/link";
import { Sidebar } from "@/components/layout/sidebar";
import { Topbar } from "@/components/layout/topbar";
import { Card } from "@/components/ui/card";
import { createClient } from "@/lib/supabase/server";
import { getSaldoGreenn } from "@/lib/queries";
import { getProjetos, getOrigens } from "@/lib/catalog";
import { formatBRL, formatDate } from "@/lib/formatters";
import { GreennLine } from "./greenn-line";
import { ReceitasTabs } from "./tabs";
import { MesFilter } from "@/components/mes-filter";
import { EditButton } from "@/components/edit-button";
import { Sparkles, PlusCircle, TrendingUp, Wallet } from "lucide-react";

export const dynamic = "force-dynamic";

type Receita = {
  id: string;
  produto_nome: string | null;
  origem: string | null;
  origem_id: string | null;
  valor_liquido: number | string;
  data_venda: string;
  data_prevista_pagamento: string | null;
  data_recebimento: string | null;
  status: string;
  projeto_id: string | null;
};

function rangeFromMonth(mesIso: string): { inicio: string; fim: string; label: string } {
  const [y, m] = mesIso.split("-").map(Number);
  const inicio = new Date(y, m - 1, 1);
  const fim = new Date(y, m, 0);
  const label = inicio
    .toLocaleDateString("pt-BR", { month: "long", year: "numeric" })
    .replace(/^./, (c) => c.toUpperCase());
  return {
    inicio: inicio.toISOString().slice(0, 10),
    fim: fim.toISOString().slice(0, 10),
    label,
  };
}

export default async function ReceitasPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string; m?: string }>;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const params = await searchParams;
  const tab = params.tab === "faturamento" ? "faturamento" : "caixa";
  const hoje = new Date();
  const mesAtual = `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, "0")}`;
  const mes = params.m ?? mesAtual;
  const { inicio, fim, label: mesLabel } = rangeFromMonth(mes);

  const [greenn, projetos, origens] = await Promise.all([
    getSaldoGreenn(),
    getProjetos(),
    getOrigens(),
  ]);
  const projMap = new Map(projetos.map((p) => [p.id, p]));
  const origensList = origens.map((o) => ({ id: o.id, nome: o.nome }));

  // Receitas:
  // - Faturamento = data_venda no mês (visão por competência)
  // - Caixa = data_recebimento OR data_prevista_pagamento no mês (fluxo do mês)
  let receitas: Receita[] = [];

  if (tab === "faturamento") {
    const recRes = await supabase
      .from("receitas_brutas")
      .select(
        "id, produto_nome, origem, origem_id, valor_liquido, data_venda, data_prevista_pagamento, data_recebimento, status, projeto_id"
      )
      .gte("data_venda", inicio)
      .lte("data_venda", fim)
      .order("data_venda", { ascending: false });
    receitas = (recRes.data ?? []) as Receita[];
  } else {
    // Caixa: OR de recebidas (data_recebimento) + previstas (data_prevista_pagamento)
    const orFilter = `and(data_recebimento.gte.${inicio},data_recebimento.lte.${fim}),and(data_prevista_pagamento.gte.${inicio},data_prevista_pagamento.lte.${fim},status.neq.recebido)`;
    const recRes = await supabase
      .from("receitas_brutas")
      .select(
        "id, produto_nome, origem, origem_id, valor_liquido, data_venda, data_prevista_pagamento, data_recebimento, status, projeto_id"
      )
      .or(orFilter);
    receitas = ((recRes.data ?? []) as Receita[]).sort((a, b) => {
      const da = a.status === "recebido" ? a.data_recebimento : a.data_prevista_pagamento;
      const db = b.status === "recebido" ? b.data_recebimento : b.data_prevista_pagamento;
      return (db ?? "").localeCompare(da ?? "");
    });
  }

  const totalFaturamento = receitas.reduce((s, r) => s + Number(r.valor_liquido), 0);
  const jaCaiuMes = receitas
    .filter((r) => r.status === "recebido" && r.data_recebimento && r.data_recebimento >= inicio && r.data_recebimento <= fim)
    .reduce((s, r) => s + Number(r.valor_liquido), 0);
  const vaiCairMes = receitas
    .filter((r) => r.status !== "recebido" && r.data_prevista_pagamento && r.data_prevista_pagamento >= inicio && r.data_prevista_pagamento <= fim)
    .reduce((s, r) => s + Number(r.valor_liquido), 0);
  const totalCaixaMes = jaCaiuMes + vaiCairMes;
  const totalRecebido = jaCaiuMes;
  const totalAReceber = totalFaturamento - totalRecebido;

  return (
    <div className="min-h-screen flex bg-bg">
      <Sidebar userEmail={user?.email} />

      <main className="flex-1 min-w-0">
        <Topbar breadcrumb={["Operação", "Receitas"]} />

        <div className="p-6 lg:p-8 max-w-6xl">
          {/* Header */}
          <div className="flex items-start justify-between mb-6 flex-wrap gap-3">
            <div>
              <h1 className="text-2xl font-semibold tracking-tight">Receitas</h1>
              <p className="text-xs text-ink-dim mt-1">
                {tab === "caixa"
                  ? "Fluxo de caixa do mês (já entrou + vai entrar) — referência:"
                  : "Total faturado por competência — referência:"}{" "}
                <strong>{mesLabel}</strong>
              </p>
            </div>
            <div className="flex items-center gap-3 flex-wrap">
              <MesFilter mes={mes} basePath={`/receitas?tab=${tab}`} />
              <Link
                href="/lancar?tipo=receita_avulsa"
                className="inline-flex items-center gap-1.5 text-xs bg-lime text-bg font-semibold rounded-lg px-3 py-2 hover:bg-lime-glow h-10"
              >
                <PlusCircle className="h-3.5 w-3.5" />
                Nova receita
              </Link>
            </div>
          </div>

          <ReceitasTabs current={tab} mes={mes} />

          {/* Stats */}
          {tab === "faturamento" ? (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mt-5 mb-5">
              <Card className="!p-4">
                <div className="text-xs text-ink-soft flex items-center gap-1.5">
                  <TrendingUp className="h-3 w-3" /> Faturamento do mês
                </div>
                <div className="text-xl font-bold mt-0.5">{formatBRL(totalFaturamento)}</div>
                <div className="text-[10px] text-ink-dim mt-0.5">{receitas.length} lançamentos</div>
              </Card>
              <Card className="!p-4">
                <div className="text-xs text-ink-soft">Já em caixa</div>
                <div className="text-xl font-bold text-positive mt-0.5">
                  {formatBRL(totalRecebido)}
                </div>
              </Card>
              <Card className="!p-4">
                <div className="text-xs text-ink-soft">A receber</div>
                <div className="text-xl font-bold text-amber-400 mt-0.5">
                  {formatBRL(totalAReceber)}
                </div>
              </Card>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-4 gap-3 mt-5 mb-5">
              <Card className="!p-4">
                <div className="text-xs text-ink-soft flex items-center gap-1.5">
                  <Wallet className="h-3 w-3" /> Já entrou no mês
                </div>
                <div className="text-xl font-bold text-positive mt-0.5">
                  {formatBRL(jaCaiuMes)}
                </div>
                <div className="text-[10px] text-ink-dim mt-0.5">
                  recebidas nesse mês
                </div>
              </Card>
              <Card className="!p-4">
                <div className="text-xs text-ink-soft">Vai entrar no mês</div>
                <div className="text-xl font-bold text-amber-400 mt-0.5">
                  {formatBRL(vaiCairMes)}
                </div>
                <div className="text-[10px] text-ink-dim mt-0.5">
                  previstas pra cair
                </div>
              </Card>
              <Card className="!p-4">
                <div className="text-xs text-ink-soft">Total do mês</div>
                <div className="text-xl font-bold text-lime mt-0.5">
                  {formatBRL(totalCaixaMes)}
                </div>
                <div className="text-[10px] text-ink-dim mt-0.5">
                  já + previsto
                </div>
              </Card>
              <Card className="!p-4">
                <div className="text-xs text-ink-soft">Greenn na plataforma</div>
                <div className="text-xl font-bold text-lime mt-0.5">
                  {formatBRL(greenn.disponivel + greenn.pendente)}
                </div>
                <div className="text-[10px] text-ink-dim mt-0.5">
                  {greenn.capturado_em
                    ? `snap ${formatDate(greenn.capturado_em)}`
                    : "sem snapshot"}
                </div>
              </Card>
            </div>
          )}

          {/* Tabela */}
          <Card className="!p-0 overflow-hidden">
            <div className="border-b border-line/60 px-4 py-2.5 grid grid-cols-12 gap-2 text-[11px] text-ink-dim uppercase tracking-wider bg-surface/50">
              <div className="col-span-3">Origem / Produto</div>
              <div className="col-span-2">
                {tab === "caixa" ? "Cai em" : "Data venda"}
              </div>
              <div className="col-span-2 text-right">Valor</div>
              <div className="col-span-2 text-right">
                {tab === "caixa" ? "Situação" : "Recebido"}
              </div>
              <div className="col-span-2">Status</div>
              <div className="col-span-1 text-right">Ações</div>
            </div>

            {tab === "faturamento" && (
              <GreennLine
                disponivel={greenn.disponivel}
                pendente={greenn.pendente}
                antecipavel={greenn.antecipavel}
                capturadoEm={greenn.capturado_em}
              />
            )}

            {receitas.length === 0 ? (
              <div className="text-sm text-ink-dim text-center py-8">
                {tab === "caixa"
                  ? "Nenhuma entrada em caixa nesse mês."
                  : "Nenhuma receita lançada nesse mês."}
              </div>
            ) : (
              receitas.map((r) => {
                const proj = r.projeto_id ? projMap.get(r.projeto_id) : null;
                const dataExibir =
                  tab === "caixa"
                    ? r.status === "recebido"
                      ? r.data_recebimento
                      : r.data_prevista_pagamento
                    : r.data_venda;
                const previsto = tab === "caixa" && r.status !== "recebido";
                return (
                  <div
                    key={r.id}
                    className="border-b border-line/40 last:border-0 px-4 py-3 grid grid-cols-12 gap-2 text-sm hover:bg-elevated/30"
                  >
                    <div className="col-span-3 min-w-0">
                      <div className="font-medium truncate">
                        {r.produto_nome ?? "(sem descrição)"}
                      </div>
                      <div className="text-[10px] text-ink-dim mt-0.5 uppercase flex items-center gap-2">
                        <span>{r.origem ?? "—"}</span>
                        {proj && (
                          <span className="inline-flex items-center gap-1 normal-case text-ink-soft">
                            <span
                              className="h-1.5 w-1.5 rounded-full"
                              style={{ background: proj.cor ?? "#71717a" }}
                            />
                            {proj.nome}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className={`col-span-2 text-xs ${previsto ? "text-amber-400" : "text-ink-soft"}`}>
                      {dataExibir ? formatDate(dataExibir) : "—"}
                    </div>
                    <div className="col-span-2 text-right font-medium">
                      {formatBRL(Number(r.valor_liquido))}
                    </div>
                    <div className="col-span-2 text-right">
                      {tab === "caixa" ? (
                        previsto ? (
                          <span className="text-amber-400 text-xs">vai entrar</span>
                        ) : (
                          <span className="text-positive font-medium">
                            {formatBRL(Number(r.valor_liquido))}
                          </span>
                        )
                      ) : r.status === "recebido" ? (
                        <span className="text-positive font-medium">
                          {formatBRL(Number(r.valor_liquido))}
                        </span>
                      ) : (
                        <span className="text-ink-dim">—</span>
                      )}
                    </div>
                    <div className="col-span-2">
                      <span
                        className={`text-[10px] uppercase tracking-wider rounded px-1.5 py-0.5 ${
                          r.status === "recebido"
                            ? "bg-positive/15 text-positive"
                            : "bg-amber-400/15 text-amber-400 border border-amber-400/30"
                        }`}
                      >
                        {r.status}
                      </span>
                      {r.data_recebimento && tab === "faturamento" && (
                        <span className="block text-[10px] text-ink-dim mt-0.5">
                          em {formatDate(r.data_recebimento)}
                        </span>
                      )}
                    </div>
                    <div className="col-span-1 text-right">
                      <EditButton
                        compact
                        entry={{
                          kind: "receita",
                          id: r.id,
                          descricao: r.produto_nome ?? "",
                          valor: Number(r.valor_liquido),
                          conta_id: null,
                          categoria_id: null,
                          projeto_id: r.projeto_id,
                          origem_id: r.origem_id,
                          data_venda: r.data_venda,
                          data_prevista_pagamento: r.data_prevista_pagamento,
                          data_recebimento: r.data_recebimento,
                          status: r.status,
                        }}
                        categorias={[]}
                        projetos={projetos}
                        origens={origensList}
                      />
                    </div>
                  </div>
                );
              })
            )}
          </Card>

          <div className="mt-4 flex items-center gap-2 text-[11px] text-ink-dim">
            <Sparkles className="h-3 w-3" />
            {tab === "caixa"
              ? "Caixa = o que cai/caiu no mês. Já recebidas (data_recebimento) + previstas (data_prevista_pagamento)."
              : "Faturamento = receitas por competência (data da venda), independente de quando cai."}
          </div>
        </div>
      </main>
    </div>
  );
}
