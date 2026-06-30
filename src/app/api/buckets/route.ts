import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// Lista buckets ativos vigentes (pro seletor de vínculo no modal de edição de despesa).
export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  const { data } = await supabase
    .from("recorrencias")
    .select("id, nome, data_inicio, data_fim")
    .eq("tipo", "despesa")
    .eq("tipo_valor", "bucket")
    .eq("ativo", true)
    .order("nome");

  const hoje = new Date().toISOString().slice(0, 10);
  const buckets = ((data ?? []) as Array<{
    id: string;
    nome: string;
    data_inicio: string | null;
    data_fim: string | null;
  }>)
    .filter((b) => (!b.data_fim || b.data_fim >= hoje))
    .map((b) => ({ id: b.id, nome: b.nome }));

  return NextResponse.json({ buckets });
}
