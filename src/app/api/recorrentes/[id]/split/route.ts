import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

// Edita o teto de um bucket "pra frente" preservando o histórico:
// encerra o bucket atual no último dia do mês ANTES de `from_month` (data_fim)
// e cria um bucket novo a partir de `from_month` com o teto/atributos novos.
// Meses passados continuam apontando pro bucket antigo (teto antigo intacto).
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  const { id } = await params;
  const body = (await request.json().catch(() => ({}))) as {
    from_month?: string;
    updates?: Record<string, unknown>;
  };

  const fromMonth = String(body.from_month ?? "");
  if (!/^\d{4}-\d{2}$/.test(fromMonth)) {
    return NextResponse.json(
      { error: "from_month inválido (use YYYY-MM)" },
      { status: 400 }
    );
  }
  const updates = body.updates ?? {};

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = supabase as any;

  const { data: old, error: fErr } = await db
    .from("recorrencias")
    .select("*")
    .eq("id", id)
    .single();
  if (fErr || !old) {
    return NextResponse.json({ error: fErr?.message || "Bucket não encontrado" }, { status: 404 });
  }
  if (old.tipo_valor !== "bucket") {
    return NextResponse.json({ error: "Só buckets podem ser editados pra frente" }, { status: 400 });
  }

  const pick = <T,>(k: string, fb: T): T =>
    updates[k] !== undefined && updates[k] !== null ? (updates[k] as T) : fb;

  const oldStartMonth = (old.data_inicio ?? "0000-00").slice(0, 7);

  // Se o mês escolhido é <= o início do bucket, não há histórico pra preservar:
  // vira edição retroativa simples (atualiza no lugar).
  if (fromMonth <= oldStartMonth) {
    const { error: uErr } = await db
      .from("recorrencias")
      .update({
        nome: pick("nome", old.nome),
        valor_padrao: pick("valor_padrao", old.valor_padrao),
        frequencia: pick("frequencia", old.frequencia),
        categoria_id: pick("categoria_id", old.categoria_id),
        conta_id: pick("conta_id", old.conta_id),
        projeto_id: pick("projeto_id", old.projeto_id),
        updated_by: user.id,
      })
      .eq("id", id);
    if (uErr) return NextResponse.json({ error: uErr.message }, { status: 500 });
    return NextResponse.json({ ok: true, split: false });
  }

  // Limites do split
  const [fy, fm] = fromMonth.split("-").map(Number);
  const splitStart = `${fromMonth}-01`;
  const prev = new Date(fy, fm - 1, 0); // último dia do mês anterior a from_month
  const prevLast = `${prev.getFullYear()}-${String(prev.getMonth() + 1).padStart(2, "0")}-${String(
    prev.getDate()
  ).padStart(2, "0")}`;

  // 1. Encerra o bucket antigo no fim do mês anterior
  const { error: closeErr } = await db
    .from("recorrencias")
    .update({ data_fim: prevLast, updated_by: user.id })
    .eq("id", id);
  if (closeErr) return NextResponse.json({ error: closeErr.message }, { status: 500 });

  // 2. Cria o bucket novo vigente a partir de from_month
  const novo = {
    nome: pick("nome", old.nome),
    tipo: old.tipo,
    tipo_valor: "bucket",
    valor_padrao: pick("valor_padrao", old.valor_padrao),
    frequencia: pick("frequencia", old.frequencia),
    dia_vencimento: 1,
    entidade_id: old.entidade_id,
    categoria_id: pick("categoria_id", old.categoria_id),
    conta_id: pick("conta_id", old.conta_id),
    projeto_id: pick("projeto_id", old.projeto_id),
    data_inicio: splitStart,
    data_fim: null,
    ativo: true,
    notas: old.notas ?? null,
    created_by: user.id,
    updated_by: user.id,
  };

  const { data: created, error: insErr } = await db
    .from("recorrencias")
    .insert(novo)
    .select("id")
    .single();
  if (insErr) {
    // rollback do data_fim pra não deixar o bucket antigo encerrado sem substituto
    await db.from("recorrencias").update({ data_fim: old.data_fim ?? null }).eq("id", id);
    return NextResponse.json({ error: insErr.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, split: true, novo_id: created?.id, encerrado_em: prevLast });
}
