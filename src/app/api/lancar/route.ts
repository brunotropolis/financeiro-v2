import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { entidadeDeConta } from "@/lib/constants";

type Payload = {
  tipo:
    | "despesa_avulsa"
    | "despesa_recorrente"
    | "despesa_parcelada"
    | "despesa_bucket"
    | "receita_avulsa"
    | "receita_greenn";
  valor: number;
  descricao?: string;
  conta_id: string;
  categoria_id?: string | null;
  projeto_id?: string | null;
  data_competencia?: string;
  status?: string;
  frequencia?: string;
  dia_vencimento?: number;
  parcelas?: number;
  origem_id?: string | null;
  produto_nome?: string | null;
  data_venda?: string;
  data_recebimento?: string;
};

function addMonths(isoDate: string, n: number): string {
  const [y, m, d] = isoDate.split("-").map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  date.setUTCMonth(date.getUTCMonth() + n);
  return date.toISOString().slice(0, 10);
}

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
    error: authErr,
  } = await supabase.auth.getUser();

  if (authErr || !user) {
    return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  }

  let body: Payload;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }

  const { tipo, valor, conta_id } = body;

  if (!tipo || !valor || valor <= 0 || !conta_id) {
    return NextResponse.json(
      { error: "Campos obrigatórios faltando (tipo/valor/conta_id)" },
      { status: 400 }
    );
  }

  const entidade_id = entidadeDeConta(conta_id);
  if (!entidade_id) {
    return NextResponse.json({ error: "Conta inválida" }, { status: 400 });
  }

  const db = supabase as unknown as {
    from: (t: string) => {
      insert: (rows: unknown) => Promise<{ data: unknown; error: { message: string } | null }>;
    };
  };

  const audit = { created_by: user.id, updated_by: user.id };

  try {
    if (tipo === "despesa_avulsa") {
      const { error } = await db.from("transacoes").insert([
        {
          tipo: "despesa",
          descricao: body.descricao ?? "(sem descrição)",
          valor,
          data_competencia: body.data_competencia,
          data_pagamento: body.status === "paga" ? body.data_competencia : null,
          entidade_id,
          categoria_id: body.categoria_id ?? null,
          conta_id,
          projeto_id: body.projeto_id ?? null,
          parcelado: false,
          status: body.status ?? "prevista",
          origem: "manual",
          ...audit,
        },
      ]);
      if (error) throw new Error(error.message);
      return NextResponse.json({ ok: true, message: "Despesa criada." });
    }

    if (tipo === "despesa_bucket") {
      if (!body.categoria_id) {
        return NextResponse.json(
          { error: "Bucket precisa de categoria" },
          { status: 400 }
        );
      }
      const freqBucket = body.frequencia ?? "mensal";
      if (!["semanal", "mensal", "bimestral"].includes(freqBucket)) {
        return NextResponse.json(
          { error: "Frequência inválida pro bucket" },
          { status: 400 }
        );
      }
      const dataInicio =
        body.data_competencia ?? new Date().toISOString().slice(0, 10);
      // bucket não tem vencimento próprio — usa o dia do data_inicio só pra
      // satisfazer NOT NULL no schema (campo é ignorado na lógica de bucket)
      const diaDoMes = Number(dataInicio.slice(8, 10)) || 1;

      const { error } = await db.from("recorrencias").insert([
        {
          nome: body.descricao ?? "(bucket sem nome)",
          tipo: "despesa",
          valor_padrao: valor,
          frequencia: freqBucket,
          dia_vencimento: diaDoMes,
          tipo_valor: "bucket",
          entidade_id,
          categoria_id: body.categoria_id,
          conta_id,
          projeto_id: body.projeto_id ?? null,
          data_inicio: dataInicio,
          ativo: true,
          ...audit,
        },
      ]);
      if (error) throw new Error(error.message);
      return NextResponse.json({
        ok: true,
        message: `Bucket criado: teto ${freqBucket} R$ ${valor.toFixed(2)}.`,
      });
    }

    if (tipo === "despesa_recorrente") {
      const { error } = await db.from("recorrencias").insert([
        {
          nome: body.descricao ?? "(sem nome)",
          tipo: "despesa",
          valor_padrao: valor,
          frequencia: body.frequencia ?? "mensal",
          dia_vencimento: body.dia_vencimento ?? null,
          tipo_valor: "fixo",
          entidade_id,
          categoria_id: body.categoria_id ?? null,
          conta_id,
          projeto_id: body.projeto_id ?? null,
          data_inicio: body.data_competencia ?? new Date().toISOString().slice(0, 10),
          ativo: true,
          ...audit,
        },
      ]);
      if (error) throw new Error(error.message);
      return NextResponse.json({ ok: true, message: "Recorrência criada." });
    }

    if (tipo === "despesa_parcelada") {
      const n = Math.max(2, Math.min(48, body.parcelas ?? 2));
      const valorParcela = Math.round((valor / n) * 100) / 100;
      const dataBase = body.data_competencia ?? new Date().toISOString().slice(0, 10);

      // Cria a primeira como pai e as demais filhas — padrão do v1
      const rows: Record<string, unknown>[] = [];
      for (let i = 0; i < n; i++) {
        rows.push({
          tipo: "despesa",
          descricao: `${body.descricao ?? "(sem descrição)"} (${i + 1}/${n})`,
          valor: valorParcela,
          valor_parcela: valorParcela,
          data_competencia: addMonths(dataBase, i),
          entidade_id,
          categoria_id: body.categoria_id ?? null,
          conta_id,
          projeto_id: body.projeto_id ?? null,
          parcelado: true,
          parcela_atual: i + 1,
          parcela_total: n,
          status: "prevista",
          origem: "parcela",
          ...audit,
        });
      }
      const { error } = await db.from("transacoes").insert(rows);
      if (error) throw new Error(error.message);
      return NextResponse.json({
        ok: true,
        message: `${n} parcelas de R$ ${valorParcela.toFixed(2)} criadas.`,
      });
    }

    if (tipo === "receita_avulsa" || tipo === "receita_greenn") {
      const { error } = await db.from("receitas_brutas").insert([
        {
          origem: tipo === "receita_greenn" ? "greenn" : "manual",
          origem_id: body.origem_id ?? null,
          entidade_id,
          projeto_id: body.projeto_id ?? null,
          produto_nome: body.produto_nome ?? null,
          valor_bruto: valor,
          taxas: 0,
          valor_liquido: valor,
          data_venda: body.data_venda ?? new Date().toISOString().slice(0, 10),
          data_recebimento: body.data_recebimento ?? null,
          status: body.data_recebimento ? "recebido" : (body.status ?? "previsto"),
          parcelas: 1,
          ...audit,
        },
      ]);
      if (error) throw new Error(error.message);
      return NextResponse.json({ ok: true, message: "Receita criada." });
    }

    return NextResponse.json({ error: "Tipo desconhecido" }, { status: 400 });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : String(e) },
      { status: 500 }
    );
  }
}
