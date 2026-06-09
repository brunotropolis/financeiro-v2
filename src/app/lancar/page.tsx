import { Sidebar } from "@/components/layout/sidebar";
import { Topbar } from "@/components/layout/topbar";
import { createClient } from "@/lib/supabase/server";
import { getCategorias, getOrigens, getProjetos, getBuckets } from "@/lib/catalog";
import { LancarForm } from "./lancar-form";

export const dynamic = "force-dynamic";

type TipoQuery =
  | "despesa_avulsa"
  | "despesa_recorrente"
  | "despesa_parcelada"
  | "despesa_bucket"
  | "receita_avulsa";

const TIPOS_VALIDOS: TipoQuery[] = [
  "despesa_avulsa",
  "despesa_recorrente",
  "despesa_parcelada",
  "despesa_bucket",
  "receita_avulsa",
];

export default async function LancarPage({
  searchParams,
}: {
  searchParams: Promise<{ tipo?: string }>;
}) {
  const params = await searchParams;
  const tipoInicial: TipoQuery = TIPOS_VALIDOS.includes(params.tipo as TipoQuery)
    ? (params.tipo as TipoQuery)
    : "despesa_avulsa";
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const [categoriasDespesa, categoriasReceita, origens, projetos, buckets] =
    await Promise.all([
      getCategorias("despesa"),
      getCategorias("receita"),
      getOrigens(),
      getProjetos(),
      getBuckets(),
    ]);

  return (
    <div className="min-h-screen flex bg-bg">
      <Sidebar userEmail={user?.email} />

      <main className="flex-1 min-w-0">
        <Topbar breadcrumb={["Operação", "Lançar"]} />

        <div className="p-6 lg:p-8 max-w-3xl">
          <div className="mb-6">
            <h1 className="text-2xl font-semibold tracking-tight">Lançar</h1>
            <p className="text-xs text-ink-dim mt-1">
              Despesas avulsas, recorrentes, parceladas ou receitas — escolha o tipo no topo.
            </p>
          </div>

          <LancarForm
            categoriasDespesa={categoriasDespesa}
            categoriasReceita={categoriasReceita}
            origens={origens}
            projetos={projetos}
            buckets={buckets}
            tipoInicial={tipoInicial}
          />
        </div>
      </main>
    </div>
  );
}
