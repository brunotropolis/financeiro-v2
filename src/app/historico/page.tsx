import { Sidebar } from "@/components/layout/sidebar";
import { Topbar } from "@/components/layout/topbar";
import { Card } from "@/components/ui/card";
import { createClient } from "@/lib/supabase/server";
import { getMetaAdsMes } from "@/lib/meta-ads";
import { formatBRL } from "@/lib/formatters";
import { HistoricoNav } from "./nav";
import { Sparkles, TrendingUp, ShoppingBag, ArrowUpToLine } from "lucide-react";

export const dynamic = "force-dynamic";

type Receita = {
  origem: string | null;
  valor_liquido: number | string;
  data_venda: string;
};

type MesAggregado = {
  mesIso: string;
  label: string;
  metaFaturamento: number; // vendas líquidas Greenn via Meta API
  manualPorOrigem: Map<string, number>; // receitas lançadas manualmente agrupadas por origem
  totalManual: number;
  total: number; // meta + manual
};

function mesIsoFromOffset(baseIso: string, offset: number): string {
  const [y, m] = baseIso.split("-").map(Number);
  const d = new Date(y, m - 1 + offset, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function rangeFromMonth(mesIso: string): { inicio: string; fim: string; label: string } {
  const [y, m] = mesIso.split("-").map(Number);
  const inicio = new Date(y, m - 1, 1);
  const fim = new Date(y, m, 0);
  const label = inicio
    .toLocaleDateString("pt-BR", { month: "short", year: "2-digit" })
    .replace(".", "")
    .replace(/^./, (c) => c.toUpperCase());
  return {
    inicio: inicio.toISOString().slice(0, 10),
    fim: fim.toISOString().slice(0, 10),
    label,
  };
}

// Não buscar dados pré-abril/2026 (decisão Bruno — começa controle dali)
function isAntesDeAbril(mesIso: string): boolean {
  const [y, m] = mesIso.split("-").map(Number);
  return y < 2026 || (y === 2026 && m < 4);
}

export default async function HistoricoPage({
  searchParams,
}: {
  searchParams: Promise<{ ate?: string }>;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const params = await searchParams;
  const hoje = new Date();
  const mesAtualIso = `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, "0")}`;

  // Mês "até" — o mais recente da janela de 4 meses (default = mês atual)
  const ateMes = params.ate ?? mesAtualIso;

  // Gera 4 meses: ate-3, ate-2, ate-1, ate (ordem cronológica)
  const mesesDaJanela = [3, 2, 1, 0].map((off) => mesIsoFromOffset(ateMes, -off));

  // Calcula cada mês em paralelo
  const meses = await Promise.all(
    mesesDaJanela.map(async (mesIso): Promise<MesAggregado> => {
      const { inicio, fim, label } = rangeFromMonth(mesIso);

      if (isAntesDeAbril(mesIso)) {
        return {
          mesIso,
          label,
          metaFaturamento: 0,
          manualPorOrigem: new Map(),
          totalManual: 0,
          total: 0,
        };
      }

      const [meta, receitasRes] = await Promise.all([
        getMetaAdsMes(mesIso),
        supabase
          .from("receitas_brutas")
          .select("origem, valor_liquido, data_venda")
          .gte("data_venda", inicio)
          .lte("data_venda", fim),
      ]);

      const receitas = (receitasRes.data ?? []) as Receita[];
      const manualPorOrigem = new Map<string, number>();
      for (const r of receitas) {
        const origem = r.origem ?? "outro";
        manualPorOrigem.set(origem, (manualPorOrigem.get(origem) ?? 0) + Number(r.valor_liquido));
      }
      const totalManual = [...manualPorOrigem.values()].reduce((s, v) => s + v, 0);

      return {
        mesIso,
        label,
        metaFaturamento: meta.faturamentoLiquido,
        manualPorOrigem,
        totalManual,
        total: meta.faturamentoLiquido + totalManual,
      };
    })
  );

  // Origens únicas que aparecem em qualquer mês (pra montar colunas dinâmicas)
  const todasOrigens = new Set<string>();
  for (const m of meses) {
    for (const o of m.manualPorOrigem.keys()) todasOrigens.add(o);
  }
  const origensOrdenadas = [...todasOrigens].sort();

  // Totais agregados da janela
  const totalJanela = meses.reduce((s, m) => s + m.total, 0);
  const metaJanela = meses.reduce((s, m) => s + m.metaFaturamento, 0);
  const manualJanela = meses.reduce((s, m) => s + m.totalManual, 0);
  const mediaMensal = totalJanela / meses.length;

  return (
    <div className="min-h-screen flex bg-bg">
      <Sidebar userEmail={user?.email} />

      <main className="flex-1 min-w-0">
        <Topbar breadcrumb={["Análise", "Histórico"]} />

        <div className="p-6 lg:p-8 max-w-6xl">
          <div className="flex items-start justify-between mb-6 flex-wrap gap-3">
            <div>
              <h1 className="text-2xl font-semibold tracking-tight">Histórico de faturamento</h1>
              <p className="text-xs text-ink-dim mt-1">
                Janela de 4 meses: <strong>{meses[0]?.label}</strong> → <strong>{meses[3]?.label}</strong> · controle a partir de Abr/26
              </p>
            </div>
            <HistoricoNav ate={ateMes} />
          </div>

          {/* Stats da janela */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3 mb-5">
            <Card className="!p-4">
              <div className="text-xs text-ink-soft">Total janela (4m)</div>
              <div className="text-xl font-bold text-positive mt-0.5">{formatBRL(totalJanela)}</div>
            </Card>
            <Card className="!p-4">
              <div className="text-xs text-ink-soft flex items-center gap-1.5">
                <Sparkles className="h-3 w-3 text-lime" /> Greenn / Meta
              </div>
              <div className="text-xl font-bold mt-0.5">{formatBRL(metaJanela)}</div>
              <div className="text-[10px] text-ink-dim mt-0.5">faturamento líquido</div>
            </Card>
            <Card className="!p-4">
              <div className="text-xs text-ink-soft flex items-center gap-1.5">
                <ArrowUpToLine className="h-3 w-3" /> Manual / Afiliados
              </div>
              <div className="text-xl font-bold mt-0.5">{formatBRL(manualJanela)}</div>
              <div className="text-[10px] text-ink-dim mt-0.5">receitas lançadas</div>
            </Card>
            <Card className="!p-4">
              <div className="text-xs text-ink-soft">Média mensal</div>
              <div className="text-xl font-bold text-lime mt-0.5">{formatBRL(mediaMensal)}</div>
            </Card>
          </div>

          {/* Tabela de 4 meses */}
          <Card className="!p-0 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm min-w-[700px]">
                <thead>
                  <tr className="border-b border-line/60 bg-surface/50 text-[11px] text-ink-dim uppercase tracking-wider">
                    <th className="text-left px-4 py-2.5 font-medium">Origem</th>
                    {meses.map((m) => (
                      <th
                        key={m.mesIso}
                        className="text-right px-4 py-2.5 font-medium whitespace-nowrap"
                      >
                        {m.label}
                      </th>
                    ))}
                    <th className="text-right px-4 py-2.5 font-medium whitespace-nowrap bg-surface">
                      Total
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {/* Greenn / Meta — sempre 1ª linha */}
                  <tr className="border-b border-line/40 bg-lime/[0.04]">
                    <td className="px-4 py-3">
                      <span className="inline-flex items-center gap-2 font-medium">
                        <Sparkles className="h-3.5 w-3.5 text-lime" />
                        Greenn (via Meta)
                      </span>
                    </td>
                    {meses.map((m) => (
                      <td key={m.mesIso} className="px-4 py-3 text-right">
                        {m.metaFaturamento > 0 ? formatBRL(m.metaFaturamento) : <span className="text-ink-dim">—</span>}
                      </td>
                    ))}
                    <td className="px-4 py-3 text-right font-semibold text-lime">
                      {formatBRL(metaJanela)}
                    </td>
                  </tr>

                  {/* Origens manuais */}
                  {origensOrdenadas.map((origem) => {
                    const totalLinha = meses.reduce(
                      (s, m) => s + (m.manualPorOrigem.get(origem) ?? 0),
                      0
                    );
                    return (
                      <tr key={origem} className="border-b border-line/40 last:border-0">
                        <td className="px-4 py-3 text-ink-soft text-xs uppercase tracking-wider">
                          {origem}
                        </td>
                        {meses.map((m) => {
                          const v = m.manualPorOrigem.get(origem) ?? 0;
                          return (
                            <td key={m.mesIso} className="px-4 py-3 text-right">
                              {v > 0 ? formatBRL(v) : <span className="text-ink-dim">—</span>}
                            </td>
                          );
                        })}
                        <td className="px-4 py-3 text-right font-medium">
                          {formatBRL(totalLinha)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot>
                  <tr className="border-t-2 border-line/60 bg-surface">
                    <td className="px-4 py-3 text-sm font-semibold">Total</td>
                    {meses.map((m) => (
                      <td
                        key={m.mesIso}
                        className="px-4 py-3 text-right font-bold whitespace-nowrap"
                      >
                        {formatBRL(m.total)}
                      </td>
                    ))}
                    <td className="px-4 py-3 text-right font-bold text-lime whitespace-nowrap">
                      {formatBRL(totalJanela)}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </Card>

          <div className="mt-4 flex items-center gap-2 text-[11px] text-ink-dim">
            <TrendingUp className="h-3 w-3" />
            <strong>Greenn (via Meta):</strong> faturamento líquido (vendas − reembolsos) do Dashboard Meta Ads, atualizado a cada 1h.
            <span className="opacity-50">·</span>
            <strong>Manual / Afiliados:</strong> receitas lançadas em /lancar, agrupadas pela origem cadastrada.
          </div>

          <div className="mt-4 flex items-center gap-2 text-[10px] text-ink-dim">
            <ShoppingBag className="h-3 w-3 opacity-50" />
            Controle começa em Abr/2026. Meses anteriores ficam zerados.
          </div>
        </div>
      </main>
    </div>
  );
}
