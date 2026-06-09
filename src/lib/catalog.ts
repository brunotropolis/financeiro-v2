import { createClient } from "@/lib/supabase/server";

export type CategoriaItem = {
  id: string;
  nome: string;
  tipo: string;
  cor: string | null;
};

export type OrigemItem = {
  id: string;
  slug: string;
  nome: string;
};

export async function getCategorias(tipo?: "despesa" | "receita"): Promise<CategoriaItem[]> {
  const supabase = await createClient();
  let q = supabase
    .from("categorias")
    .select("id, nome, tipo, cor_hex")
    .eq("ativo", true)
    .order("nome");
  if (tipo) q = q.eq("tipo", tipo);
  const { data } = await q;
  const rows = (data ?? []) as Array<{
    id: string;
    nome: string;
    tipo: string;
    cor_hex: string | null;
  }>;
  return rows.map((r) => ({ id: r.id, nome: r.nome, tipo: r.tipo, cor: r.cor_hex }));
}

export type ProjetoItem = {
  id: string;
  slug: string;
  nome: string;
  cor: string | null;
};

export async function getProjetos(): Promise<ProjetoItem[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("projetos")
    .select("id, slug, nome, cor_hex")
    .eq("ativo", true)
    .order("ordem");
  return ((data ?? []) as Array<{ id: string; slug: string; nome: string; cor_hex: string | null }>).map(
    (r) => ({ id: r.id, slug: r.slug, nome: r.nome, cor: r.cor_hex })
  );
}

export type BucketItem = {
  id: string;
  nome: string;
  categoria_id: string | null;
  conta_id: string | null;
  valor_padrao: number;
  frequencia: string;
};

export async function getBuckets(): Promise<BucketItem[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("recorrencias")
    .select("id, nome, categoria_id, conta_id, valor_padrao, frequencia, tipo_valor, ativo")
    .eq("tipo", "despesa")
    .eq("tipo_valor", "bucket")
    .eq("ativo", true)
    .order("nome");
  return ((data ?? []) as Array<{
    id: string;
    nome: string;
    categoria_id: string | null;
    conta_id: string | null;
    valor_padrao: number | string;
    frequencia: string;
  }>).map((r) => ({
    id: r.id,
    nome: r.nome,
    categoria_id: r.categoria_id,
    conta_id: r.conta_id,
    valor_padrao: Number(r.valor_padrao),
    frequencia: r.frequencia,
  }));
}

export async function getOrigens(): Promise<OrigemItem[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("origens_receita")
    .select("id, slug, nome")
    .eq("ativo", true)
    .order("nome");
  return ((data ?? []) as OrigemItem[]).map((r) => ({
    id: r.id,
    slug: r.slug,
    nome: r.nome,
  }));
}
