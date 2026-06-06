import { createClient } from "@/lib/supabase/server";
import { Sidebar } from "@/components/layout/sidebar";
import { Topbar } from "@/components/layout/topbar";
import { Card } from "@/components/ui/card";
import { getSaldosContas, getSaldoGreenn, getResumoMes } from "@/lib/queries";
import { formatBRL, formatBRLCompact } from "@/lib/formatters";
import {
  ArrowUpRight,
  ArrowDownRight,
  Wallet,
  TrendingUp,
  TrendingDown,
  Clock,
  Sparkles,
} from "lucide-react";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const [contas, greenn, resumo] = await Promise.all([
    getSaldosContas(),
    getSaldoGreenn(),
    getResumoMes(),
  ]);

  const saldoTotal = contas.reduce((s, c) => s + c.saldo, 0);
  const aReceberGreenn = greenn.disponivel + greenn.pendente;
  const resultadoMes =
    resumo.faturamento - resumo.despesasPagas - resumo.despesasPrevistas;

  return (
    <div className="min-h-screen flex bg-bg">
      <Sidebar userEmail={user?.email} />

      <main className="flex-1 min-w-0">
        <Topbar breadcrumb={["Painéis", "Visão geral"]} />

        <div className="p-6 lg:p-8 max-w-[1400px]">
          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <h1 className="text-2xl font-semibold tracking-tight">Visão geral</h1>
            <button className="text-sm text-ink-soft border border-line/60 rounded-lg px-3 py-1.5 hover:bg-surface">
              Hoje ▾
            </button>
          </div>

          {/* KPIs row */}
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4 mb-5">
            <Kpi
              label="Saldo total"
              valor={formatBRL(saldoTotal)}
              delta={null}
              icon={<Wallet className="h-4 w-4" />}
            />
            <Kpi
              label="Faturamento do mês"
              valor={formatBRL(resumo.faturamento)}
              delta={{ pos: true, txt: "Greenn + manual" }}
              icon={<TrendingUp className="h-4 w-4" />}
            />
            <Kpi
              label="Despesas do mês"
              valor={formatBRL(resumo.despesasPagas + resumo.despesasPrevistas)}
              hint={`pago ${formatBRLCompact(resumo.despesasPagas)} · previsto ${formatBRLCompact(resumo.despesasPrevistas)}`}
              icon={<TrendingDown className="h-4 w-4" />}
            />
            <Kpi
              label="Resultado do mês"
              valor={formatBRL(resultadoMes)}
              delta={resultadoMes >= 0 ? { pos: true, txt: "Positivo" } : { pos: false, txt: "Negativo" }}
              icon={<Sparkles className="h-4 w-4" />}
            />
          </div>

          {/* Contas grid */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-5">
            {contas.map((c) => (
              <Card key={c.id}>
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <div className="text-sm text-ink-soft">{c.nome}</div>
                    <div className="text-[11px] text-ink-dim">{c.apelido}</div>
                  </div>
                  <span
                    className="h-2.5 w-2.5 rounded-full"
                    style={{ background: c.cor, boxShadow: `0 0 12px ${c.cor}66` }}
                  />
                </div>
                <div className="text-2xl font-bold tracking-tight">{formatBRL(c.saldo)}</div>
                <div className="text-[11px] text-ink-dim mt-1">Saldo atual</div>
              </Card>
            ))}
          </div>

          {/* Greenn + Recente */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {/* Greenn card destaque */}
            <Card variant="lime" className="lg:col-span-2 relative overflow-hidden">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <div className="h-6 w-6 rounded-md bg-bg/10 grid place-items-center">
                    <Sparkles className="h-3.5 w-3.5" />
                  </div>
                  <span className="text-sm font-semibold">Saldo Greenn</span>
                </div>
                <span className="text-[11px] bg-bg/15 rounded px-2 py-0.5">
                  {greenn.capturado_em
                    ? `atualizado ${new Date(greenn.capturado_em).toLocaleDateString("pt-BR")}`
                    : "sem snapshot"}
                </span>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <GreennCol label="Em caixa" valor={greenn.disponivel} />
                <GreennCol label="A receber" valor={aReceberGreenn} />
                <GreennCol label="Antecipável" valor={greenn.antecipavel} dim />
              </div>

              <div className="mt-5 text-xs">
                <button className="bg-bg text-lime rounded-lg px-3 py-1.5 font-semibold">
                  Atualizar saldo
                </button>
              </div>
            </Card>

            {/* Próxima movimentação placeholder */}
            <Card>
              <div className="flex items-center justify-between mb-3">
                <span className="text-sm font-semibold">Próximos vencimentos</span>
                <Clock className="h-4 w-4 text-ink-dim" />
              </div>
              <div className="text-sm text-ink-dim">
                Sprint 2 vai listar recorrências e parcelas com vencimento próximo.
              </div>
            </Card>
          </div>

          {/* Projeção placeholder */}
          <div className="mt-5">
            <Card>
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h2 className="text-sm font-semibold">Projeção de caixa — 6 meses</h2>
                  <p className="text-xs text-ink-dim mt-0.5">
                    Saldo projetado por conta no fim de cada mês
                  </p>
                </div>
                <span className="text-[10px] text-ink-dim border border-line/60 rounded px-2 py-0.5">
                  Sprint 3
                </span>
              </div>
              <div className="h-32 rounded-xl border border-dashed border-line/60 grid place-items-center text-xs text-ink-dim">
                Em construção
              </div>
            </Card>
          </div>
        </div>
      </main>
    </div>
  );
}

function Kpi({
  label,
  valor,
  delta,
  hint,
  icon,
}: {
  label: string;
  valor: string;
  delta?: { pos: boolean; txt: string } | null;
  hint?: string;
  icon?: React.ReactNode;
}) {
  return (
    <Card>
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs text-ink-soft">{label}</span>
        <span className="text-ink-dim">{icon}</span>
      </div>
      <div className="text-2xl font-bold tracking-tight">{valor}</div>
      {delta && (
        <div className="flex items-center gap-1 mt-1 text-[11px]">
          {delta.pos ? (
            <ArrowUpRight className="h-3 w-3 text-positive" />
          ) : (
            <ArrowDownRight className="h-3 w-3 text-negative" />
          )}
          <span className={delta.pos ? "text-positive" : "text-negative"}>{delta.txt}</span>
        </div>
      )}
      {hint && <div className="text-[11px] text-ink-dim mt-1">{hint}</div>}
    </Card>
  );
}

function GreennCol({ label, valor, dim }: { label: string; valor: number; dim?: boolean }) {
  return (
    <div>
      <div className="text-[11px] text-bg/70">{label}</div>
      <div className={`text-xl font-bold ${dim ? "text-bg/60" : ""}`}>{formatBRL(valor)}</div>
    </div>
  );
}
