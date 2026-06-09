import { createClient } from "@/lib/supabase/server";
import { Sidebar } from "@/components/layout/sidebar";
import { Topbar } from "@/components/layout/topbar";
import { Card } from "@/components/ui/card";
import { MesFilter } from "@/components/mes-filter";
import { projetar6Meses } from "@/lib/projecao";
import { getMetaAdsMes } from "@/lib/meta-ads";
import { CONTAS_ATIVAS, CONTAS_ATIVAS_IDS } from "@/lib/constants";
import { formatBRL, formatBRLCompact } from "@/lib/formatters";
import { cn } from "@/lib/utils";
import {
  TrendingUp,
  TrendingDown,
  Clock,
  CheckCircle,
} from "lucide-react";

export const dynamic = "force-dynamic";

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

function ocorrenciasMensal(rec: { frequencia: string; data_inicio: string | null }, inicioStr: string): number {
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

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ m?: string }>;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const params = await searchParams;
  const hoje = new Date();
  const mesAtual = `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, "0")}`;
  const mes = params.m ?? mesAtual;
  const { inicio, fim, label: mesLabel } = rangeFromMonth(mes);

  // 1. Receitas do mês — Caixa (recebidas + previstas) — lógica = tab Caixa de /receitas
  const orFilter = `and(data_recebimento.gte.${inicio},data_recebimento.lte.${fim}),and(data_prevista_pagamento.gte.${inicio},data_prevista_pagamento.lte.${fim},status.neq.recebido)`;
  const receRes = await supabase
    .from("receitas_brutas")
    .select("id, valor_liquido, data_recebimento, data_prevista_pagamento, status")
    .or(orFilter);
  const receitas = (receRes.data ?? []) as Array<{
    valor_liquido: number | string;
    data_recebimento: string | null;
    data_prevista_pagamento: string | null;
    status: string;
  }>;
  const entradasMes = receitas.reduce((s, r) => s + Number(r.valor_liquido), 0);
  const jaEntrou = receitas
    .filter((r) => r.status === "recebido")
    .reduce((s, r) => s + Number(r.valor_liquido), 0);
  const vaiEntrar = entradasMes - jaEntrou;

  // 3. Despesas do mês — replicando lógica da tab Geral de /despesas
  // 3a. Avulsas (sem recorrencia_id, não parceladas)
  const avulsasRes = await supabase
    .from("transacoes")
    .select("valor, status")
    .in("conta_id", [...CONTAS_ATIVAS_IDS])
    .eq("tipo", "despesa")
    .is("recorrencia_id", null)
    .eq("parcelado", false)
    .gte("data_competencia", inicio)
    .lte("data_competencia", fim);
  const avulsas = (avulsasRes.data ?? []) as Array<{
    valor: number | string;
    status: string;
  }>;
  let avulsasPago = 0;
  let avulsasPrevisto = 0;
  for (const t of avulsas) {
    const v = Number(t.valor);
    if (t.status === "paga" || t.status === "confirmada") avulsasPago += v;
    else avulsasPrevisto += v;
  }

  // 3b. Transações vinculadas (recorrência ou parcela)
  const recTxRes = await supabase
    .from("transacoes")
    .select("valor, status, parcelado, recorrencia_id")
    .in("conta_id", [...CONTAS_ATIVAS_IDS])
    .eq("tipo", "despesa")
    .gte("data_competencia", inicio)
    .lte("data_competencia", fim);
  const recTx = (recTxRes.data ?? []) as Array<{
    valor: number | string;
    status: string;
    parcelado: boolean | null;
    recorrencia_id: string | null;
  }>;
  const recsMat = new Set(
    recTx.filter((t) => t.recorrencia_id).map((t) => t.recorrencia_id!)
  );
  let recPago = 0;
  let recPrevisto = 0;
  let bucketsUsado = 0;
  for (const t of recTx) {
    if (!t.recorrencia_id && !t.parcelado) continue;
    const v = Number(t.valor);
    // Se está vinculada a bucket, conta como "usado de bucket"
    // (precisamos saber qual recorrencia é bucket — vamos buscar abaixo)
    if (t.status === "paga" || t.status === "confirmada") recPago += v;
    else recPrevisto += v;
  }

  // 3c. Recorrências ativas (fixas + buckets)
  const recAtivasRes = await supabase
    .from("recorrencias")
    .select("id, valor_padrao, frequencia, data_inicio, tipo_valor, ativo")
    .in("conta_id", [...CONTAS_ATIVAS_IDS])
    .eq("tipo", "despesa")
    .eq("ativo", true);
  const recAtivas = (recAtivasRes.data ?? []) as Array<{
    id: string;
    valor_padrao: number | string;
    frequencia: string;
    data_inicio: string | null;
    tipo_valor: string | null;
  }>;
  const fixas = recAtivas.filter((r) => r.tipo_valor !== "bucket");
  const buckets = recAtivas.filter((r) => r.tipo_valor === "bucket");
  const bucketIds = new Set(buckets.map((b) => b.id));

  // Re-calcula recPago/recPrevisto separando bucket
  recPago = 0;
  recPrevisto = 0;
  bucketsUsado = 0;
  for (const t of recTx) {
    if (!t.recorrencia_id && !t.parcelado) continue;
    const v = Number(t.valor);
    if (t.recorrencia_id && bucketIds.has(t.recorrencia_id)) {
      // Tudo que é vinculado a bucket conta como "bucketsUsado" (independente do status)
      bucketsUsado += v;
    } else if (t.status === "paga" || t.status === "confirmada") {
      recPago += v;
    } else {
      recPrevisto += v;
    }
  }

  // Fixas que ainda não materializaram no mês — soma valor_padrao × ocorrências
  const fixasNaoMatTotal = fixas
    .filter((r) => !recsMat.has(r.id))
    .filter((r) => ocorrenciasMensal(r, inicio) > 0)
    .reduce((s, r) => s + Number(r.valor_padrao) * ocorrenciasMensal(r, inicio), 0);

  // Buckets ativos no mês — teto total
  const bucketsTeto = buckets
    .filter((b) => ocorrenciasMensal(b, inicio) > 0)
    .reduce((s, b) => s + Number(b.valor_padrao), 0);

  // 4. Meta Ads (sempre conta como pago — já saiu)
  const meta = await getMetaAdsMes(mes);

  // 5. Totais finais
  // Despesas previstas = Tudo previsto pra cair (incluindo tetos cheios buckets + Meta)
  const despesasPrevistas =
    avulsasPrevisto + recPrevisto + fixasNaoMatTotal + bucketsTeto + meta.gastoTotal;

  // Despesas reais = lançado/realizado:
  // - Avulsas (pago + previsto)
  // - Recorrentes/parcelas
  // - Buckets USADO
  // - Meta Ads (já saiu)
  const despesasReais =
    avulsasPago + avulsasPrevisto + recPago + recPrevisto + bucketsUsado + meta.gastoTotal;

  // Resultado = entradas - despesas reais
  const resultadoMes = entradasMes - despesasReais;

  // 5. Projeção 6 meses (continua igual)
  const projecao = await projetar6Meses();

  return (
    <div className="min-h-screen flex bg-bg">
      <Sidebar userEmail={user?.email} />

      <main className="flex-1 min-w-0">
        <Topbar breadcrumb={["Painéis", "Visão geral"]} />

        <div className="p-6 lg:p-8 max-w-[1400px]">
          {/* Header */}
          <div className="flex items-start justify-between mb-6 flex-wrap gap-3">
            <div>
              <h1 className="text-2xl font-semibold tracking-tight">Visão geral</h1>
              <p className="text-xs text-ink-dim mt-1">
                Referência: <strong>{mesLabel}</strong>
              </p>
            </div>
            <MesFilter mes={mes} basePath={`/`} />
          </div>

          {/* 4 KPIs principais */}
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4 mb-5">
            <Card>
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs text-ink-soft">Entradas do mês</span>
                <TrendingUp className="h-4 w-4 text-positive" />
              </div>
              <div className="text-2xl font-bold tracking-tight text-positive">
                {formatBRL(entradasMes)}
              </div>
              <div className="text-[11px] text-ink-dim mt-1">
                <span className="text-positive">{formatBRLCompact(jaEntrou)}</span> recebido ·{" "}
                <span className="text-amber-400">{formatBRLCompact(vaiEntrar)}</span> a receber
              </div>
            </Card>

            <Card>
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs text-ink-soft">Despesas previstas</span>
                <Clock className="h-4 w-4 text-amber-400" />
              </div>
              <div className="text-2xl font-bold tracking-tight">
                {formatBRL(despesasPrevistas)}
              </div>
              <div className="text-[11px] text-ink-dim mt-1">
                a pagar + tetos de bucket
              </div>
            </Card>

            <Card>
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs text-ink-soft">Despesas reais</span>
                <TrendingDown className="h-4 w-4 text-negative" />
              </div>
              <div className="text-2xl font-bold tracking-tight text-negative">
                {formatBRL(despesasReais)}
              </div>
              <div className="text-[11px] text-ink-dim mt-1">
                lançado (avulsas + recorrentes + bucket usado)
              </div>
            </Card>

            <Card>
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs text-ink-soft">Resultado do mês</span>
                <CheckCircle className={cn("h-4 w-4", resultadoMes >= 0 ? "text-positive" : "text-negative")} />
              </div>
              <div className={cn(
                "text-2xl font-bold tracking-tight",
                resultadoMes >= 0 ? "text-positive" : "text-negative"
              )}>
                {formatBRL(resultadoMes)}
              </div>
              <div className="text-[11px] text-ink-dim mt-1">
                entradas − despesas reais
              </div>
            </Card>
          </div>

          {/* Próximos vencimentos (Greenn foi pra /receitas tab Faturamento) */}
          <div className="grid grid-cols-1 gap-4 mb-5">
            <Card>
              <div className="flex items-center justify-between mb-3">
                <span className="text-sm font-semibold">Próximos vencimentos</span>
                <Clock className="h-4 w-4 text-ink-dim" />
              </div>
              <div className="text-sm text-ink-dim">
                Sprint futura vai listar recorrências e parcelas com vencimento próximo.
              </div>
            </Card>
          </div>

          {/* Projeção 6 meses */}
          <Card className="!p-0 overflow-hidden">
            <div className="px-5 pt-5 pb-3">
              <h2 className="text-sm font-semibold">Projeção de caixa — 6 meses</h2>
              <p className="text-xs text-ink-dim mt-0.5">
                Saldo no fim de cada mês = saldo anterior − despesas previstas + receitas a receber
              </p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm min-w-[700px]">
                <thead>
                  <tr className="border-y border-line/60 bg-surface/50 text-[11px] text-ink-dim uppercase tracking-wider">
                    <th className="text-left px-5 py-2 font-medium">Conta</th>
                    {projecao.map((m) => (
                      <th
                        key={m.mesIso}
                        className="text-right px-3 py-2 font-medium whitespace-nowrap"
                      >
                        {m.label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {CONTAS_ATIVAS.map((c) => (
                    <tr key={c.id} className="border-b border-line/40 last:border-0">
                      <td className="px-5 py-3">
                        <span className="inline-flex items-center gap-2 text-sm">
                          <span
                            className="h-2 w-2 rounded-full"
                            style={{ background: c.cor }}
                          />
                          {c.nome}
                        </span>
                      </td>
                      {projecao.map((m) => {
                        const v = m.porConta[c.id] ?? 0;
                        return (
                          <td
                            key={m.mesIso}
                            className={cn(
                              "px-3 py-3 text-right whitespace-nowrap font-medium",
                              v < 0 ? "text-negative" : v === 0 ? "text-ink-dim" : "text-ink"
                            )}
                          >
                            {formatBRLCompact(v)}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                  <tr className="bg-lime/[0.05]">
                    <td className="px-5 py-3 text-sm font-semibold text-lime">
                      Total (com receitas)
                    </td>
                    {projecao.map((m) => (
                      <td
                        key={m.mesIso}
                        className={cn(
                          "px-3 py-3 text-right whitespace-nowrap font-bold",
                          m.totalSaldo < 0 ? "text-negative" : "text-lime"
                        )}
                      >
                        {formatBRLCompact(m.totalSaldo)}
                      </td>
                    ))}
                  </tr>
                </tbody>
              </table>
            </div>
            <div className="px-5 py-3 border-t border-line/60 grid grid-cols-2 gap-4 text-xs text-ink-soft">
              <div>
                <span className="text-ink-dim">Despesas previstas (6m):</span>{" "}
                <span className="text-negative font-medium">
                  {formatBRL(projecao.reduce((s, m) => s + m.totalDespesas, 0))}
                </span>
              </div>
              <div className="text-right">
                <span className="text-ink-dim">Receitas a receber (6m):</span>{" "}
                <span className="text-positive font-medium">
                  {formatBRL(projecao.reduce((s, m) => s + m.totalReceitas, 0))}
                </span>
              </div>
            </div>
          </Card>
        </div>
      </main>
    </div>
  );
}

