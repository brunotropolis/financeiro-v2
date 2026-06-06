import { createClient } from "@/lib/supabase/server";
import { CONTAS_ATIVAS, CONTAS_ATIVAS_IDS } from "@/lib/constants";

export type ContaSaldo = {
  id: string;
  nome: string;
  apelido: string;
  cor: string;
  saldo: number;
};

export async function getSaldosContas(): Promise<ContaSaldo[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("contas_bancarias")
    .select("id, saldo_atual")
    .in("id", [...CONTAS_ATIVAS_IDS]);

  if (error) {
    console.error("[queries] getSaldosContas:", error);
    return CONTAS_ATIVAS.map((c) => ({ ...c, saldo: 0 }));
  }

  const rows = (data ?? []) as Array<{ id: string; saldo_atual: number | string }>;
  const map = new Map(rows.map((r) => [r.id, Number(r.saldo_atual) || 0]));
  return CONTAS_ATIVAS.map((c) => ({ ...c, saldo: map.get(c.id) ?? 0 }));
}

export type SaldoGreenn = {
  disponivel: number;
  pendente: number;
  antecipavel: number;
  capturado_em: string | null;
};

export async function getSaldoGreenn(): Promise<SaldoGreenn> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("greenn_saldos")
    .select("disponivel, pendente, antecipavel, capturado_em")
    .order("capturado_em", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error || !data) {
    return { disponivel: 0, pendente: 0, antecipavel: 0, capturado_em: null };
  }

  const row = data as {
    disponivel: number | string;
    pendente: number | string;
    antecipavel: number | string;
    capturado_em: string;
  };

  return {
    disponivel: Number(row.disponivel) || 0,
    pendente: Number(row.pendente) || 0,
    antecipavel: Number(row.antecipavel) || 0,
    capturado_em: row.capturado_em,
  };
}

export type ResumoMes = {
  faturamento: number;
  despesasPagas: number;
  despesasPrevistas: number;
};

export async function getResumoMes(): Promise<ResumoMes> {
  const supabase = await createClient();
  const hoje = new Date();
  const inicio = new Date(hoje.getFullYear(), hoje.getMonth(), 1).toISOString().slice(0, 10);
  const fim = new Date(hoje.getFullYear(), hoje.getMonth() + 1, 0).toISOString().slice(0, 10);

  const [receitasRes, despesasRes] = await Promise.all([
    supabase
      .from("receitas_brutas")
      .select("valor_liquido")
      .gte("data_venda", inicio)
      .lte("data_venda", fim),
    supabase
      .from("transacoes")
      .select("valor, status")
      .eq("tipo", "despesa")
      .gte("data", inicio)
      .lte("data", fim),
  ]);

  const receitas = (receitasRes.data ?? []) as Array<{ valor_liquido: number | string }>;
  const despesas = (despesasRes.data ?? []) as Array<{ valor: number | string; status: string }>;

  const faturamento = receitas.reduce((s, r) => s + (Number(r.valor_liquido) || 0), 0);

  let pagas = 0;
  let previstas = 0;
  for (const t of despesas) {
    const v = Number(t.valor) || 0;
    if (t.status === "pago" || t.status === "recebido") pagas += v;
    else previstas += v;
  }

  return { faturamento, despesasPagas: pagas, despesasPrevistas: previstas };
}
