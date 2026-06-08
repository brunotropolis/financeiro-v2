import { createClient } from "@/lib/supabase/server";
import { CONTAS_ATIVAS, CONTAS_ATIVAS_IDS } from "@/lib/constants";

export type ProjecaoMes = {
  mesIso: string; // "2026-07"
  label: string; // "jul/26"
  porConta: Record<string, number>; // saldo final por conta_id
  totalSaldo: number;
  totalDespesas: number;
  totalReceitas: number;
};

function monthKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function monthLabel(d: Date): string {
  const m = d.toLocaleDateString("pt-BR", { month: "short" }).replace(".", "");
  const y = String(d.getFullYear()).slice(-2);
  return `${m}/${y}`;
}

function lastDayOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth() + 1, 0);
}

/**
 * Projeção simples: saldo_atual − despesas_previstas_mês + receitas_a_receber_mês.
 *
 * Usa o que JÁ tá no banco (transações previstas geradas pelas recorrências do v1
 * + receitas com data_prevista_pagamento). Não inventa nada — se um mês não tem
 * recorrência materializada, projeta zero pra ele (conservador).
 */
export async function projetar6Meses(): Promise<ProjecaoMes[]> {
  const supabase = await createClient();
  const hoje = new Date();
  const inicio = new Date(hoje.getFullYear(), hoje.getMonth(), 1);
  const fim = new Date(hoje.getFullYear(), hoje.getMonth() + 6, 0);
  const inicioIso = inicio.toISOString().slice(0, 10);
  const fimIso = fim.toISOString().slice(0, 10);

  // Saldos atuais
  const contasRes = await supabase
    .from("contas_bancarias")
    .select("id, saldo_atual")
    .in("id", [...CONTAS_ATIVAS_IDS]);
  const contasRows = (contasRes.data ?? []) as Array<{ id: string; saldo_atual: number | string }>;
  const saldoAtual = new Map(contasRows.map((c) => [c.id, Number(c.saldo_atual) || 0]));

  // Despesas previstas no período (status != pago)
  const despRes = await supabase
    .from("transacoes")
    .select("conta_id, valor, data_competencia, status")
    .in("conta_id", [...CONTAS_ATIVAS_IDS])
    .eq("tipo", "despesa")
    .neq("status", "paga")
    .gte("data_competencia", inicioIso)
    .lte("data_competencia", fimIso);
  const despRows = (despRes.data ?? []) as Array<{
    conta_id: string;
    valor: number | string;
    data_competencia: string;
  }>;

  // Receitas a receber no período
  const receRes = await supabase
    .from("receitas_brutas")
    .select("valor_liquido, data_prevista_pagamento, status")
    .neq("status", "recebido")
    .gte("data_prevista_pagamento", inicioIso)
    .lte("data_prevista_pagamento", fimIso);
  const receRows = (receRes.data ?? []) as Array<{
    valor_liquido: number | string;
    data_prevista_pagamento: string | null;
  }>;

  const meses: ProjecaoMes[] = [];
  const acum = new Map(saldoAtual);

  for (let i = 0; i < 6; i++) {
    const mesDate = new Date(hoje.getFullYear(), hoje.getMonth() + i, 1);
    const mesEnd = lastDayOfMonth(mesDate);

    const porConta: Record<string, number> = {};
    let totalDesp = 0;

    const receMes = receRows
      .filter((r) => {
        if (!r.data_prevista_pagamento) return false;
        const dt = new Date(r.data_prevista_pagamento);
        return dt >= mesDate && dt <= mesEnd;
      })
      .reduce((s, r) => s + Number(r.valor_liquido), 0);

    for (const c of CONTAS_ATIVAS) {
      const despMes = despRows
        .filter((d) => {
          const dt = new Date(d.data_competencia);
          return d.conta_id === c.id && dt >= mesDate && dt <= mesEnd;
        })
        .reduce((s, d) => s + Number(d.valor), 0);

      const saldoAnt = acum.get(c.id) ?? 0;
      const saldoNovo = saldoAnt - despMes;
      porConta[c.id] = saldoNovo;
      acum.set(c.id, saldoNovo);
      totalDesp += despMes;
    }

    const totalSaldo = [...acum.values()].reduce((a, b) => a + b, 0) + receMes;

    meses.push({
      mesIso: monthKey(mesDate),
      label: monthLabel(mesDate),
      porConta,
      totalSaldo,
      totalDespesas: totalDesp,
      totalReceitas: receMes,
    });
  }

  return meses;
}
