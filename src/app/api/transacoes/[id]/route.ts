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
  "descricao",
  "valor",
  "data_competencia",
  "data_pagamento",
  "categoria_id",
  "projeto_id",
  "conta_id",
  "recorrencia_id",
  "status",
  "notas",
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

  if (Object.keys(updates).length === 1) {
    return NextResponse.json(
      { error: "Nenhum campo válido pra atualizar" },
      { status: 400 }
    );
  }

  // Coerência: se status=paga e não tem data_pagamento, seta como data_competencia
  if (
    updates.status === "paga" &&
    !updates.data_pagamento &&
    updates.data_competencia
  ) {
    updates.data_pagamento = updates.data_competencia;
  }

  const db = supabase as unknown as DbHelper;
  const { error } = await db.from("transacoes").update(updates).eq("id", id);

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
  const { error } = await db.from("transacoes").delete().eq("id", id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
