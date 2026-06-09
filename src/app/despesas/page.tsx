import { Sidebar } from "@/components/layout/sidebar";
import { Topbar } from "@/components/layout/topbar";
import { Card } from "@/components/ui/card";
import { createClient } from "@/lib/supabase/server";
import { CONTAS_ATIVAS, CONTAS_ATIVAS_IDS } from "@/lib/constants";
import { getProjetos } from "@/lib/catalog";
import { formatBRL, formatDate } from "@/lib/formatters";
import { Repeat, Layers, PiggyBank, Power, ArrowDownToLine } from "lucide-react";
import { RecorrenteToggle } from "@/app/recorrentes/recorrente-toggle";
import { EditButton } from "@/components/edit-button";
import { DespesasTabs } from "./tabs";
import { MesFilter } from "@/components/mes-filter";

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
  const tab =
    params.tab === "recorrentes" || params.tab === "buckets"
      ? params.tab
      : "avulsas";
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
            <MesFilter mes={mes} basePath={`/despesas?tab=${tab}`} />
          </div>

          <DespesasTabs current={tab} mes={mes} />

          <div className="mt-5">
            {tab === "avulsas" && (
              <AvulsasTab
                supabase={supabase}
                inicio={inicio}
                fim={fim}
                catMap={catMap}
                projMap={projMap}
                catList={catList}
                projetos={projetos}
              />
            )}
            {tab === "recorrentes" && (
              <RecorrentesTab
                supabase={supabase}
                inicio={inicio}
                fim={fim}
                catMap={catMap}
                projMap={projMap}
                catList={catList}
                projetos={projetos}
              />
            )}
            {tab === "buckets" && (
              <BucketsTab
                supabase={supabase}
                inicio={inicio}
                fim={fim}
                catMap={catMap}
                projMap={projMap}
                catList={catList}
                projetos={projetos}
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
  catList,
  projetos,
}: {
  supabase: Awaited<ReturnType<typeof createClient>>;
  inicio: string;
  fim: string;
  catMap: Map<string, { id: string; nome: string; cor_hex: string | null }>;
  projMap: Map<string, { id: string; nome: string; cor: string | null }>;
  catList: Array<{ id: string; nome: string }>;
  projetos: Array<{ id: string; nome: string; cor: string | null }>;
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
                  <th className="text-right px-4 py-2.5 font-medium">Ações</th>
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
                      <td className="px-4 py-3 text-right">
                        <EditButton
                          compact
                          entry={{
                            kind: "transacao",
                            id: t.id,
                            descricao: t.descricao,
                            valor: Number(t.valor),
                            conta_id: t.conta_id,
                            categoria_id: t.categoria_id,
                            projeto_id: t.projeto_id,
                            data_competencia: t.data_competencia,
                            status: t.status,
                          }}
                          categorias={catList}
                          projetos={projetos}
                        />
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

function ocorrenciasNoMes(
  rec: { frequencia: string; data_inicio: string | null; dia_vencimento: number | null },
  inicioStr: string
): number {
  if (!rec.data_inicio) return 1;
  const [iy, im] = inicioStr.split("-").map(Number);
  const mesInicio = new Date(iy, im - 1, 1);
  const di = new Date(rec.data_inicio);
  if (di > mesInicio) return 0;
  switch (rec.frequencia) {
    case "mensal":
      return 1;
    case "semanal":
      return 4;
    case "quinzenal":
      return 2;
    case "bimestral": {
      const diff =
        (mesInicio.getFullYear() - di.getFullYear()) * 12 +
        (mesInicio.getMonth() - di.getMonth());
      return diff >= 0 && diff % 2 === 0 ? 1 : 0;
    }
    default:
      return 1;
  }
}

function ocorrenciasBucketNoMes(
  bucket: { frequencia: string; data_inicio: string | null },
  inicioStr: string
): number {
  return ocorrenciasNoMes(
    { frequencia: bucket.frequencia, data_inicio: bucket.data_inicio, dia_vencimento: null },
    inicioStr
  );
}

async function RecorrentesTab({
  supabase,
  inicio,
  fim,
  catMap,
  projMap,
  catList,
  projetos,
}: {
  supabase: Awaited<ReturnType<typeof createClient>>;
  inicio: string;
  fim: string;
  catMap: Map<string, { id: string; nome: string; cor_hex: string | null }>;
  projMap: Map<string, { id: string; nome: string; cor: string | null }>;
  catList: Array<{ id: string; nome: string }>;
  projetos: Array<{ id: string; nome: string; cor: string | null }>;
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

  // Filtra pelo mês: ocorrências > 0 (significa data_inicio <= mesAtual e bate na frequência)
  const fixas = todasAtivas
    .filter((r) => r.tipo_valor !== "bucket")
    .filter((r) => ocorrenciasNoMes(r, inicio) > 0);

  // Parceladas futuras
  const parRes = await supabase
    .from("transacoes")
    .select(
      "id, descricao, valor, data_competencia, status, conta_id, parcela_atual, parcela_total, transacao_pai_id"
    )
    .in("conta_id", [...CONTAS_ATIVAS_IDS])
    .eq("parcelado", true)
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

  // Transações materializadas no mês com recorrencia_id (pra calcular pago/previsto)
  const txMatRes = await supabase
    .from("transacoes")
    .select("recorrencia_id, valor, status")
    .in("conta_id", [...CONTAS_ATIVAS_IDS])
    .eq("tipo", "despesa")
    .not("recorrencia_id", "is", null)
    .gte("data_competencia", inicio)
    .lte("data_competencia", fim);
  const txMat = (txMatRes.data ?? []) as Array<{
    recorrencia_id: string;
    valor: number | string;
    status: string;
  }>;
  const recsMaterializadas = new Set(txMat.map((t) => t.recorrencia_id));

  // Stats do mês
  let pagoMes = 0;
  let previstoMes = 0;

  // 1. Transações já materializadas (recorrentes ou parceladas) no mês
  for (const t of txMat) {
    const v = Number(t.valor);
    if (t.status === "paga" || t.status === "confirmada") pagoMes += v;
    else previstoMes += v;
  }
  // 2. Parceladas (já vêm com status no parceladasRaw)
  for (const p of parceladasRaw) {
    const v = Number(p.valor);
    if (p.status === "paga" || p.status === "confirmada") pagoMes += v;
    else previstoMes += v;
  }
  // 3. Fixas que ainda não materializaram no mês — soma valor_padrao × ocorrências
  for (const f of fixas) {
    if (recsMaterializadas.has(f.id)) continue;
    const oc = ocorrenciasNoMes(f, inicio);
    previstoMes += Number(f.valor_padrao) * oc;
  }

  const totalLancamentos = fixas.length + parceladas.length;

  return (
    <>
      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-5">
        <Card className="!p-4">
          <div className="text-xs text-ink-soft">Lançamentos</div>
          <div className="text-xl font-bold mt-0.5">{totalLancamentos}</div>
          <div className="text-[10px] text-ink-dim mt-0.5">
            {fixas.length} fixas · {parceladas.length} parceladas
          </div>
        </Card>
        <Card className="!p-4">
          <div className="text-xs text-ink-soft">Já pago</div>
          <div className="text-xl font-bold text-positive mt-0.5">{formatBRL(pagoMes)}</div>
        </Card>
        <Card className="!p-4">
          <div className="text-xs text-ink-soft">Previsto</div>
          <div className="text-xl font-bold text-negative mt-0.5">{formatBRL(previstoMes)}</div>
        </Card>
      </div>

      {/* Fixas */}
      <section className="mb-8">
        <div className="flex items-center gap-2 mb-3">
          <Repeat className="h-4 w-4 text-lime" />
          <h2 className="text-sm font-semibold">
            Fixas no mês
            <span className="ml-2 text-ink-dim font-normal">({fixas.length})</span>
          </h2>
        </div>

        {fixas.length === 0 ? (
          <EmptyState texto="Nenhuma recorrência fixa nesse mês." cta="Cadastrar em /lancar" />
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
                        <div className="inline-flex items-center gap-1">
                          <EditButton
                            compact
                            entry={{
                              kind: "recorrencia",
                              id: r.id,
                              descricao: r.nome,
                              valor: Number(r.valor_padrao),
                              conta_id: r.conta_id,
                              categoria_id: r.categoria_id,
                              projeto_id: r.projeto_id,
                              dia_vencimento: r.dia_vencimento,
                              frequencia: r.frequencia,
                              data_inicio: r.data_inicio ?? undefined,
                            }}
                            categorias={catList}
                            projetos={projetos}
                          />
                          <RecorrenteToggle id={r.id} ativo={r.ativo} />
                        </div>
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

async function BucketsTab({
  supabase,
  inicio,
  fim,
  catMap,
  projMap,
  catList,
  projetos,
}: {
  supabase: Awaited<ReturnType<typeof createClient>>;
  inicio: string;
  fim: string;
  catMap: Map<string, { id: string; nome: string; cor_hex: string | null }>;
  projMap: Map<string, { id: string; nome: string; cor: string | null }>;
  catList: Array<{ id: string; nome: string }>;
  projetos: Array<{ id: string; nome: string; cor: string | null }>;
}) {
  // Todos buckets cadastrados, filtra pelos ativos no mês
  const recRes = await supabase
    .from("recorrencias")
    .select(
      "id, nome, valor_padrao, frequencia, dia_vencimento, conta_id, categoria_id, tipo_valor, ativo, projeto_id, data_inicio"
    )
    .in("conta_id", [...CONTAS_ATIVAS_IDS])
    .eq("tipo", "despesa")
    .eq("tipo_valor", "bucket")
    .order("nome");
  const buckets = ((recRes.data ?? []) as RecorrenciaRow[])
    .filter((r) => r.ativo)
    .filter((r) => ocorrenciasBucketNoMes(r, inicio) > 0);

  // Despesas avulsas no mês — usadas pra calcular "utilizado" por categoria
  const txRes = await supabase
    .from("transacoes")
    .select("categoria_id, valor")
    .in("conta_id", [...CONTAS_ATIVAS_IDS])
    .eq("tipo", "despesa")
    .is("recorrencia_id", null)
    .gte("data_competencia", inicio)
    .lte("data_competencia", fim);
  const txs = (txRes.data ?? []) as Array<{
    categoria_id: string | null;
    valor: number | string;
  }>;

  // Map categoria_id → total gasto avulso no mês
  const usoPorCategoria = new Map<string, number>();
  for (const t of txs) {
    if (!t.categoria_id) continue;
    usoPorCategoria.set(
      t.categoria_id,
      (usoPorCategoria.get(t.categoria_id) ?? 0) + Number(t.valor)
    );
  }

  // Stats agregados
  const totalTeto = buckets.reduce((s, b) => s + Number(b.valor_padrao), 0);
  const totalUtilizado = buckets.reduce(
    (s, b) => s + (b.categoria_id ? usoPorCategoria.get(b.categoria_id) ?? 0 : 0),
    0
  );
  const totalRestante = Math.max(0, totalTeto - totalUtilizado);
  const pctTotal = totalTeto > 0 ? Math.min(150, (totalUtilizado / totalTeto) * 100) : 0;

  return (
    <>
      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-3 mb-5">
        <Card className="!p-4">
          <div className="text-xs text-ink-soft">Buckets ativos</div>
          <div className="text-xl font-bold mt-0.5">{buckets.length}</div>
        </Card>
        <Card className="!p-4">
          <div className="text-xs text-ink-soft">Teto total</div>
          <div className="text-xl font-bold mt-0.5">{formatBRL(totalTeto)}</div>
        </Card>
        <Card className="!p-4">
          <div className="text-xs text-ink-soft">Utilizado</div>
          <div
            className={`text-xl font-bold mt-0.5 ${
              pctTotal > 100 ? "text-negative" : pctTotal > 70 ? "text-amber-400" : "text-positive"
            }`}
          >
            {formatBRL(totalUtilizado)}
          </div>
          <div className="text-[10px] text-ink-dim mt-0.5">{pctTotal.toFixed(0)}% do teto</div>
        </Card>
        <Card className="!p-4">
          <div className="text-xs text-ink-soft">Restante</div>
          <div className="text-xl font-bold mt-0.5">{formatBRL(totalRestante)}</div>
        </Card>
      </div>

      {/* Cards */}
      {buckets.length === 0 ? (
        <Card>
          <div className="text-sm text-ink-soft text-center py-8 flex flex-col items-center gap-2">
            <PiggyBank className="h-6 w-6 text-ink-dim" />
            <span>Nenhum bucket ativo nesse mês.</span>
            <a href="/lancar" className="text-lime text-xs underline">
              Cadastrar em /lancar → Bucket
            </a>
          </div>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {buckets.map((b) => {
            const cat = b.categoria_id ? catMap.get(b.categoria_id) : null;
            const proj = b.projeto_id ? projMap.get(b.projeto_id) : null;
            const teto = Number(b.valor_padrao);
            const usado = b.categoria_id ? usoPorCategoria.get(b.categoria_id) ?? 0 : 0;
            const restante = Math.max(0, teto - usado);
            const pct = teto > 0 ? Math.min(150, (usado / teto) * 100) : 0;
            const barColor =
              pct > 100 ? "bg-negative" : pct > 70 ? "bg-amber-400" : "bg-lime";
            const barWidth = Math.min(100, pct);

            return (
              <Card key={b.id}>
                <div className="flex items-start justify-between mb-3">
                  <div className="min-w-0">
                    <div className="font-medium truncate">{b.nome}</div>
                    <div className="text-[10px] text-ink-dim mt-0.5 flex items-center gap-2 flex-wrap">
                      {cat && <span>{cat.nome}</span>}
                      <span className="opacity-50">·</span>
                      <span>teto {b.frequencia ?? "mensal"}</span>
                      {proj && (
                        <>
                          <span className="opacity-50">·</span>
                          <span className="inline-flex items-center gap-1">
                            <span
                              className="h-1.5 w-1.5 rounded-full"
                              style={{ background: proj.cor ?? "#71717a" }}
                            />
                            {proj.nome}
                          </span>
                        </>
                      )}
                    </div>
                  </div>
                  <EditButton
                    compact
                    entry={{
                      kind: "bucket",
                      id: b.id,
                      descricao: b.nome,
                      valor: teto,
                      conta_id: b.conta_id,
                      categoria_id: b.categoria_id,
                      projeto_id: b.projeto_id,
                      frequencia: b.frequencia,
                      data_inicio: b.data_inicio ?? undefined,
                    }}
                    categorias={catList}
                    projetos={projetos}
                  />
                </div>

                {/* Barra de progresso */}
                <div className="w-full h-2 bg-bg/80 rounded-full overflow-hidden border border-line/40 mb-2">
                  <div
                    className={`h-full ${barColor} transition-all`}
                    style={{ width: `${barWidth}%` }}
                  />
                </div>

                <div className="flex items-end justify-between text-xs">
                  <div>
                    <div className="text-[10px] text-ink-dim">Utilizado</div>
                    <div
                      className={`font-semibold ${
                        pct > 100 ? "text-negative" : pct > 70 ? "text-amber-400" : "text-positive"
                      }`}
                    >
                      {formatBRL(usado)} <span className="text-ink-dim font-normal">/ {formatBRL(teto)}</span>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-[10px] text-ink-dim">{restante > 0 ? "Resta" : "Estourou"}</div>
                    <div
                      className={`font-semibold ${
                        pct > 100 ? "text-negative" : "text-ink"
                      }`}
                    >
                      {formatBRL(pct > 100 ? usado - teto : restante)}
                    </div>
                  </div>
                </div>

                {b.data_inicio && (
                  <div className="text-[10px] text-ink-dim mt-2 pt-2 border-t border-line/40">
                    começa em {formatDate(b.data_inicio)} · {pct.toFixed(0)}% do teto
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      )}
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
