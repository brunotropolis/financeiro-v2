import { createClient } from "@/lib/supabase/server";
import { Sidebar } from "@/components/layout/sidebar";
import { Topbar } from "@/components/layout/topbar";
import { getProjetos, getBuckets, getOrigens, getCategorias } from "@/lib/catalog";
import { ExtratoClient, type ExtratoLinha } from "./extrato-client";

export const dynamic = "force-dynamic";

export default async function ExtratoPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const [movRes, projetos, buckets, origens, categorias] = await Promise.all([
    supabase
      .from("movimentacoes_bancarias")
      .select("id, tipo, valor, data, descricao, conta_id, bruto")
      .eq("origem", "importacao_csv")
      .eq("conciliado", false)
      .order("data", { ascending: true }),
    getProjetos(),
    getBuckets(),
    getOrigens(),
    getCategorias("despesa"),
  ]);

  const linhas: ExtratoLinha[] = ((movRes.data ?? []) as Array<{
    id: string;
    tipo: string;
    valor: number | string;
    data: string;
    descricao: string;
    conta_id: string;
    bruto: { contraparte?: string } | null;
  }>).map((m) => ({
    id: m.id,
    tipo: m.tipo as "saida" | "entrada",
    valor: Number(m.valor),
    data: m.data,
    descricao: m.descricao,
    conta_id: m.conta_id,
    contraparte: m.bruto?.contraparte || m.descricao,
  }));

  const { count: jaTratadas } = await supabase
    .from("movimentacoes_bancarias")
    .select("id", { count: "exact", head: true })
    .eq("origem", "importacao_csv")
    .eq("conciliado", true);

  return (
    <div className="min-h-screen flex bg-bg">
      <Sidebar userEmail={user?.email} />
      <main className="flex-1 min-w-0">
        <Topbar breadcrumb={["Operação", "Extrato"]} />
        <div className="p-6 lg:p-8 max-w-4xl">
          <div className="mb-6">
            <h1 className="text-2xl font-semibold tracking-tight">Extrato</h1>
            <p className="text-xs text-ink-dim mt-1">
              Direcione cada gasto: projeto e se é avulso ou bucket. Transferências entre
              suas contas e Greenn já saíram daqui automaticamente.
            </p>
          </div>
          <ExtratoClient
            linhas={linhas}
            projetos={projetos}
            buckets={buckets.map((b) => ({ id: b.id, nome: b.nome, categoria_id: b.categoria_id }))}
            categorias={categorias.map((c) => ({ id: c.id, nome: c.nome }))}
            origens={origens}
            jaTratadas={jaTratadas ?? 0}
          />
        </div>
      </main>
    </div>
  );
}
