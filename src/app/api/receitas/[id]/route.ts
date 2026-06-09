import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

type DbHelper = {
  from: (t: string) => {
    update: (v: unknown) => {
      eq: (c: string, v: string) => Promise<{ error: { message: string } | null }>;
    };
    delete: () => {
      eq: (c: string, v: string) => Promise<{ error: { message: string } | null }>;
    };
  };
};

const ALLOWED_FIELDS = new Set([
  "produto_nome",
  "valor_bruto",
  "valor_liquido",
  "taxas",
  "data_venda",
  "data_prevista_pagamento",
  "data_recebimento",
  "status",
  "origem",
  "origem_id",
  "projeto_id",
  "notas",
  "metodo_pagamento",
]);

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  const { id } = await params;
  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;

  const updates: Record<string, unknown> = { updated_by: user.id };
  for (const [k, v] of Object.entries(body)) {
    if (ALLOWED_FIELDS.has(k)) updates[k] = v;
  }

  // Coerência: se valor_bruto vier sem valor_liquido, espelha
  if (updates.valor_bruto !== undefined && updates.valor_liquido === undefined) {
    const taxas = Number(updates.taxas ?? 0) || 0;
    updates.valor_liquido = Number(updates.valor_bruto) - taxas;
  }
  // Coerência: se status=recebido e não tem data_recebimento, usa hoje
  if (updates.status === "recebido" && !updates.data_recebimento) {
    updates.data_recebimento = new Date().toISOString().slice(0, 10);
  }

  if (Object.keys(updates).length === 1) {
    return NextResponse.json(
      { error: "Nenhum campo válido pra atualizar" },
      { status: 400 }
    );
  }

  const db = supabase as unknown as DbHelper;
  const { error } = await db.from("receitas_brutas").update(updates).eq("id", id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  const { id } = await params;
  const db = supabase as unknown as DbHelper;
  const { error } = await db.from("receitas_brutas").delete().eq("id", id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
