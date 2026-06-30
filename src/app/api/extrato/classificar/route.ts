import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { entidadeDeConta } from "@/lib/constants";

// Classifica uma linha do extrato (movimentacoes_bancarias, conciliado=false):
// - acao "ignorar"      -> marca conciliada, não cria lançamento
// - acao "classificar"  -> cria a transação (saída=despesa) ou receita (entrada),
//                          vincula projeto + bucket, e concilia a movimentação.
export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  const body = (await request.json().catch(() => ({}))) as {
    id?: string;
    acao?: "classificar" | "ignorar";
    projeto_id?: string | null;
    bucket_id?: string | null;
    origem_id?: string | null;
  };
  if (!body.id) return NextResponse.json({ error: "id faltando" }, { status: 400 });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = supabase as any;

  const { data: mov, error: fErr } = await db
    .from("movimentacoes_bancarias")
    .select("id, tipo, valor, data, descricao, conta_id, conciliado")
    .eq("id", body.id)
    .single();
  if (fErr || !mov) return NextResponse.json({ error: "Movimentação não encontrada" }, { status: 404 });

  if (body.acao === "ignorar") {
    const { error } = await db
      .from("movimentacoes_bancarias")
      .update({ conciliado: true, notas: "ignorado no extrato", updated_by: user.id })
      .eq("id", mov.id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true, acao: "ignorado" });
  }

  // classificar
  if (mov.tipo === "saida") {
    const novo = {
      tipo: "despesa",
      descricao: mov.descricao,
      valor: mov.valor,
      data_competencia: mov.data,
      data_pagamento: mov.data,
      conta_id: mov.conta_id,
      entidade_id: entidadeDeConta(mov.conta_id),
      status: "paga",
      projeto_id: body.projeto_id || null,
      recorrencia_id: body.bucket_id || null,
      origem: "importacao_csv",
      created_by: user.id,
      updated_by: user.id,
    };
    const { data: t, error: insErr } = await db
      .from("transacoes")
      .insert(novo)
      .select("id")
      .single();
    if (insErr) return NextResponse.json({ error: insErr.message }, { status: 500 });
    const { error: upErr } = await db
      .from("movimentacoes_bancarias")
      .update({ conciliado: true, transacao_id: t.id, updated_by: user.id })
      .eq("id", mov.id);
    if (upErr) return NextResponse.json({ error: upErr.message }, { status: 500 });
    return NextResponse.json({ ok: true, tipo: "despesa", transacao_id: t.id });
  }

  // entrada -> receita
  if (!body.origem_id) {
    return NextResponse.json({ error: "Escolha a origem da receita" }, { status: 400 });
  }
  const entidade_id = entidadeDeConta(mov.conta_id);
  const nova = {
    origem: "manual",
    entidade_id,
    produto_nome: mov.descricao,
    valor_bruto: mov.valor,
    valor_liquido: mov.valor,
    taxas: 0,
    parcelas: 1,
    data_venda: mov.data,
    data_prevista_pagamento: mov.data,
    data_recebimento: mov.data,
    status: "recebido",
    projeto_id: body.projeto_id || null,
    origem_id: body.origem_id,
    created_by: user.id,
    updated_by: user.id,
  };
  const { data: r, error: rErr } = await db
    .from("receitas_brutas")
    .insert(nova)
    .select("id")
    .single();
  if (rErr) return NextResponse.json({ error: rErr.message }, { status: 500 });
  const { error: up2 } = await db
    .from("movimentacoes_bancarias")
    .update({ conciliado: true, receita_id: r.id, updated_by: user.id })
    .eq("id", mov.id);
  if (up2) return NextResponse.json({ error: up2.message }, { status: 500 });
  return NextResponse.json({ ok: true, tipo: "receita", receita_id: r.id });
}
