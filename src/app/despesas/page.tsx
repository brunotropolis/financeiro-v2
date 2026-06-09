import { Sidebar } from "@/components/layout/sidebar";
import { Topbar } from "@/components/layout/topbar";
import { Card } from "@/components/ui/card";
import { createClient } from "@/lib/supabase/server";
import { CONTAS_ATIVAS, CONTAS_ATIVAS_IDS } from "@/lib/constants";
import { getProjetos } from "@/lib/catalog";
import { formatBRL, formatDate } from "@/lib/formatters";
import { Repeat, Layers, PiggyBank, Power, ArrowDownToLine } from "lucide-react";
import { RecorrenteToggle } from "@/app/recorrentes/recorrente-toggle";
import { DespesasTabs } from "./tabs";
import { MesFilter } from "./mes-filter";

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
  projeto_id: string | null;
  data_inicio: string | null;
};

type AvulsaRow = {
  id: string;
  descricao: string;
  valor: number | string;
  data_competencia: string;
  data_pagamento: string | null;
  status: string;
  conta_id: string | null;
  categoria_id: string | null;
  projeto_id: string | null;
  parcelado: boolean | null;
  parcela_atual: number | null;
  parcela_total: number | null;
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

export default async function DespesasPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string; m?: string }>;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const params = await searchParams;
  const tab = params.tab === "recorrentes" ? "recorrentes" : "avulsas";
  const hoje = new Date();
  const mesAtual = `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, "0")}`;
  const mes = params.m ?? mesAtual;
  const { inicio, fim, label: mesLabel } = rangeFromMonth(mes);

  // Lookups
  const [projetos, catRes] = await Promise.all([
    getProjetos(),
    supabase.from("categorias").select("id, nome, cor_hex"),
  ]);
  const projMap = new Map(projetos.map((p) => [p.id, p]));
  const catList = (catRes.data ?? []) as Array<{
    id: string;
    nome: string;
    cor_hex: string | null;
  }>;
  const catMap = new Map(catList.map((c) => [c.id, c]));

  return (
    <div className="min-h-screen flex bg-bg">
      <Sidebar userEmail={user?.email} />

      <main className="flex-1 min-w-0">
        <Topbar breadcrumb={["Operação", "Despesas"]} />

        <div className="p-6 lg:p-8 max-w-5xl">
          <div className="flex items-start justify-between mb-6">
            <div>
              <h1 className="text-2xl font-semibold tracking-tight">Despesas</h1>
              <p className="text-xs text-ink-dim mt-1">
                Avulsas e recorrentes — referência: <strong>{mesLabel}</strong>
              </p>
            </div>
            <MesFilter mes={mes} tab={tab} />
          </div>

          <DespesasTabs current={tab} mes={mes} />

          <div className="mt-5">
            {tab === "avulsas" ? (
              <AvulsasTab
                supabase={supabase}
                inicio={inicio}
                fim={fim}
                catMap={catMap}
                projMap={projMap}
              />
            ) : (
              <RecorrentesTab
                supabase={supabase}
                inicio={inicio}
                fim={fim}
                catMap={catMap}
                projMap={projMap}
              />
            )}
          </div>
        </div>
      </main>
    </div>
  );
}

async function AvulsasTab({
  supabase,
  inicio,
  fim,
  catMap,
  projMap,
}: {
  supabase: Awaited<ReturnType<typeof createClient>>;
  inicio: string;
  fim: string;
  catMap: Map<string, { id: string; nome: string; cor_hex: string | null }>;
  projMap: Map<string, { id: string; nome: string; cor: string | null }>;
}) {
  const res = await supabase
    .from("transacoes")
    .select(
      "id, descricao, valor, data_competencia, data_pagamento, status, conta_id, categoria_id, projeto_id, parcelado, parcela_atual, parcela_total, recorrencia_id"
    )
    .in("conta_id", [...CONTAS_ATIVAS_IDS])
    .eq("tipo", "despesa")
    .is("recorrencia_id", null)
    .gte("data_competencia", inicio)
    .lte("data_competencia", fim)
    .order("data_competencia", { ascending: false });

  const avulsas = (res.data ?? []) as AvulsaRow[];

  const totalPago = avulsas
    .filter((t) => t.status === "paga" || t.status === "confirmada")
    .reduce((s, t) => s + Number(t.valor), 0);
  const totalPrevisto = avulsas
    .filter((t) => t.status === "prevista" || t.status === "atrasada")
    .reduce((s, t) => s + Number(t.valor), 0);

  return (
    <>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-5">
        <Card className="!p-4">
          <div className="text-xs text-ink-soft">Lançamentos</div>
          <div className="text-xl font-bold mt-0.5">{avulsas.length}</div>
        </Card>
        <Card className="!p-4">
          <div className="text-xs text-ink-soft">Já pago</div>
          <div className="text-xl font-bold text-positive mt-0.5">{formatBRL(totalPago)}</div>
        </Card>
        <Card className="!p-4">
          <div className="text-xs text-ink-soft">Previsto</div>
          <div className="text-xl font-bold text-negative mt-0.5">
            {formatBRL(totalPrevisto)}
          </div>
        </Card>
      </div>

      {avulsas.length === 0 ? (
        <Card>
          <div className="text-sm text-ink-soft text-center py-8 flex flex-col items-center gap-2">
            <ArrowDownToLine className="h-6 w-6 text-ink-dim" />
            <span>Nenhuma despesa avulsa nesse mês.</span>
            <a href="/lancar" className="text-lime text-xs underline">
              Lançar uma agora
            </a>
          </div>
        </Card>
      ) : (
        <Card className="!p-0 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[700px]">
              <thead>
                <tr className="border-b border-line/60 text-[11px] text-ink-dim uppercase tracking-wider bg-surface/40">
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
                {avulsas.map((t) => {
                  const conta = CONTAS_ATIVAS.find((c) => c.id === t.conta_id);
                  const cat = t.categoria_id ? catMap.get(t.categoria_id) : null;
                  const proj = t.projeto_id ? projMap.get(t.projeto_id) : null;
                  return (
                    <tr key={t.id} className="border-b border-line/40 last:border-0">
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
                      <td className="px-4 py-3 text-xs text-ink-soft">
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
                      <td className="px-4 py-3 text-xs text-ink-soft">{cat?.nome ?? "—"}</td>
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
                            t.status === "paga" || t.status === "confirmada"
                              ? "bg-positive/15 text-positive"
                              : "bg-elevated text-ink-soft border border-line"
                          }`}
                        >
                          {t.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right font-semibold text-negative whitespace-nowrap">
                        −{formatBRL(Number(t.valor))}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </>
  );
}

async function RecorrentesTab({
  supabase,
  inicio,
  fim,
  catMap,
  projMap,
}: {
  supabase: Awaited<ReturnType<typeof createClient>>;
  inicio: string;
  fim: string;
  catMap: Map<string, { id: string; nome: string; cor_hex: string | null }>;
  projMap: Map<string, { id: string; nome: string; cor: string | null }>;
}) {
  const recRes = await supabase
    .from("recorrencias")
    .select(
      "id, nome, valor_padrao, frequencia, dia_vencimento, conta_id, categoria_id, tipo_valor, ativo, projeto_id, data_inicio"
    )
    .in("conta_id", [...CONTAS_ATIVAS_IDS])
    .eq("tipo", "despesa")
    .order("nome");
  const todasAtivas = ((recRes.data ?? []) as RecorrenciaRow[]).filter((r) => r.ativo);
  const fixas = todasAtivas.filter((r) => r.tipo_valor !== "bucket");
  const buckets = todasAtivas.filter((r) => r.tipo_valor === "bucket");

  // Parceladas futuras
  const parRes = await supabase
    .from("transacoes")
    .select(
      "id, descricao, valor, data_competencia, status, conta_id, parcela_atual, parcela_total, transacao_pai_id"
    )
    .in("conta_id", [...CONTAS_ATIVAS_IDS])
    .eq("parcelado", true)
    .eq("status", "prevista")
    .gte("data_competencia", inicio)
    .lte("data_competencia", fim)
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
    <>
      {/* Fixas */}
      <section className="mb-8">
        <div className="flex items-center gap-2 mb-3">
          <Repeat className="h-4 w-4 text-lime" />
          <h2 className="text-sm font-semibold">
            Fixas
            <span className="ml-2 text-ink-dim font-normal">({fixas.length})</span>
          </h2>
        </div>

        {fixas.length === 0 ? (
          <EmptyState texto="Nenhuma recorrência fixa cadastrada." cta="Cadastrar em /lancar" />
        ) : (
          <Card className="!p-0 overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-line/60 text-[11px] text-ink-dim uppercase tracking-wider">
                  <th className="text-left px-4 py-2.5 font-medium">Nome</th>
                  <th className="text-left px-4 py-2.5 font-medium">Conta</th>
                  <th className="text-left px-4 py-2.5 font-medium">Projeto</th>
                  <th className="text-left px-4 py-2.5 font-medium">Freq.</th>
                  <th className="text-right px-4 py-2.5 font-medium">Valor</th>
                  <th className="text-right px-4 py-2.5 font-medium">Ações</th>
                </tr>
              </thead>
              <tbody>
                {fixas.map((r) => {
                  const conta = CONTAS_ATIVAS.find((c) => c.id === r.conta_id);
                  const proj = r.projeto_id ? projMap.get(r.projeto_id) : null;
                  const freq =
                    r.frequencia === "mensal"
                      ? `dia ${r.dia_vencimento ?? "?"}`
                      : r.frequencia;
                  return (
                    <tr key={r.id} className="border-b border-line/40 last:border-0">
                      <td className="px-4 py-3">
                        <div className="font-medium">{r.nome}</div>
                      </td>
                      <td className="px-4 py-3 text-ink-soft text-xs">
                        {conta && (
                          <span className="inline-flex items-center gap-1.5">
                            <span
                              className="h-2 w-2 rounded-full"
                              style={{ background: conta.cor }}
                            />
                            {conta.nome}
                          </span>
                        )}
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
                      <td className="px-4 py-3 text-ink-soft text-xs">{freq}</td>
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

      {/* Buckets */}
      <section className="mb-8">
        <div className="flex items-center gap-2 mb-3">
          <PiggyBank className="h-4 w-4 text-lime" />
          <h2 className="text-sm font-semibold">
            Buckets
            <span className="ml-2 text-ink-dim font-normal">({buckets.length})</span>
          </h2>
        </div>

        {buckets.length === 0 ? (
          <EmptyState texto="Nenhum bucket cadastrado." cta="Cria em /lancar → 'Bucket'" />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {buckets.map((b) => {
              const cat = b.categoria_id ? catMap.get(b.categoria_id) : null;
              const proj = b.projeto_id ? projMap.get(b.projeto_id) : null;
              return (
                <Card key={b.id}>
                  <div className="flex items-start justify-between mb-2">
                    <div className="min-w-0">
                      <div className="font-medium truncate">{b.nome}</div>
                      {cat && (
                        <div className="text-[10px] text-ink-dim mt-0.5">
                          categoria: {cat.nome}
                        </div>
                      )}
                    </div>
                    <span className="text-[10px] uppercase tracking-wider bg-lime/15 text-lime border border-lime/30 rounded px-1.5 py-0.5">
                      bucket
                    </span>
                  </div>
                  <div className="flex items-end justify-between mt-3">
                    <div>
                      <div className="text-[10px] text-ink-dim">
                        Teto {b.frequencia ?? "mensal"}
                      </div>
                      <div className="text-lg font-bold">{formatBRL(Number(b.valor_padrao))}</div>
                    </div>
                    {proj && (
                      <span className="inline-flex items-center gap-1.5 text-[11px] text-ink-soft">
                        <span
                          className="h-1.5 w-1.5 rounded-full"
                          style={{ background: proj.cor ?? "#71717a" }}
                        />
                        {proj.nome}
                      </span>
                    )}
                  </div>
                  {b.data_inicio && (
                    <div className="text-[10px] text-ink-dim mt-2 pt-2 border-t border-line/40">
                      começa em {formatDate(b.data_inicio)}
                    </div>
                  )}
                </Card>
              );
            })}
          </div>
        )}
      </section>

      {/* Parceladas */}
      <section>
        <div className="flex items-center gap-2 mb-3">
          <Layers className="h-4 w-4 text-lime" />
          <h2 className="text-sm font-semibold">
            Parceladas em aberto (no mês)
            <span className="ml-2 text-ink-dim font-normal">({parceladas.length})</span>
          </h2>
        </div>

        {parceladas.length === 0 ? (
          <EmptyState texto="Nenhuma parcela em aberto nesse mês." />
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
                      {g.parcelas.length} parc. no mês de {g.parcela_total ?? "?"}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-ink-dim">
                      próxima: {formatDate(primeira.data_competencia)}
                    </span>
                    <span className="font-semibold">{formatBRL(total)} a pagar no mês</span>
                  </div>
                </Card>
              );
            })}
          </div>
        )}
      </section>
    </>
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
