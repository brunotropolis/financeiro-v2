import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getMetaAdsMes } from "@/lib/meta-ads";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, X-Cron-Secret",
};

export async function OPTIONS() {
  return new Response(null, { headers: CORS_HEADERS });
}

/**
 * Fecha o mês fazendo snapshot do faturamento por fonte na tabela
 * `faturamento_snapshots`. Idempotente: se rodar 2x, ON CONFLICT (mes,fonte)
 * atualiza os valores.
 *
 * Body: { mes_referencia: 'YYYY-MM' }
 *
 * Auth: 2 modos —
 *   - Usuário logado (sessão Supabase) → sempre permitido
 *   - Header `X-Cron-Secret` = env CRON_SECRET → permitido (pra n8n)
 */
export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const cronSecret = req.headers.get("x-cron-secret");
  const expectedCron = process.env.CRON_SECRET;
  const isCron = !!expectedCron && cronSecret === expectedCron;

  if (!user && !isCron) {
    return NextResponse.json(
      { error: "Não autenticado" },
      { status: 401, headers: CORS_HEADERS }
    );
  }

  const body = (await req.json().catch(() => ({}))) as { mes_referencia?: string };
  const mes = body.mes_referencia;
  if (!mes || !/^\d{4}-\d{2}$/.test(mes)) {
    return NextResponse.json(
      { error: "mes_referencia deve ser 'YYYY-MM'" },
      { status: 400, headers: CORS_HEADERS }
    );
  }

  // 1. Pega Meta API
  const meta = await getMetaAdsMes(mes);

  // 2. Pega receitas manuais agrupadas por origem
  const [y, m] = mes.split("-").map(Number);
  const inicio = new Date(y, m - 1, 1).toISOString().slice(0, 10);
  const fim = new Date(y, m, 0).toISOString().slice(0, 10);
  const recRes = await supabase
    .from("receitas_brutas")
    .select("origem, origem_id, valor_liquido")
    .gte("data_venda", inicio)
    .lte("data_venda", fim);
  const receitas = (recRes.data ?? []) as Array<{
    origem: string | null;
    origem_id: string | null;
    valor_liquido: number | string;
  }>;

  // Lookup origens pra ter nome legível
  const origRes = await supabase.from("origens_receita").select("id, slug, nome");
  const origens = (origRes.data ?? []) as Array<{ id: string; slug: string; nome: string }>;
  const origemNome = new Map(origens.map((o) => [o.id, o.nome]));
  const origemPorSlug = new Map(origens.map((o) => [o.slug, o.nome]));

  const manualPorFonte = new Map<string, { label: string; bruto: number; liquido: number }>();
  for (const r of receitas) {
    const slug = r.origem ?? "outro";
    const key = `manual:${slug}`;
    const label = (r.origem_id && origemNome.get(r.origem_id)) ?? origemPorSlug.get(slug) ?? slug;
    const v = Number(r.valor_liquido);
    if (!manualPorFonte.has(key)) {
      manualPorFonte.set(key, { label, bruto: 0, liquido: 0 });
    }
    const row = manualPorFonte.get(key)!;
    row.bruto += v;
    row.liquido += v;
  }

  // 3. Monta payload pra upsert
  const userId = user?.id ?? null;
  const rows: Array<Record<string, unknown>> = [
    {
      mes_referencia: mes,
      fonte: "greenn_meta",
      fonte_label: "Greenn (via Meta)",
      valor_bruto: meta.faturamentoLiquido,
      valor_liquido: meta.faturamentoLiquido,
      snap_por: userId,
      metadata: { roas_real: meta.roasReal, gasto: meta.gastoTotal, num_campanhas: meta.numCampanhas, fonte_dados: "meta_dashboard_api" },
    },
    ...[...manualPorFonte.entries()].map(([fonte, v]) => ({
      mes_referencia: mes,
      fonte,
      fonte_label: v.label,
      valor_bruto: v.bruto,
      valor_liquido: v.liquido,
      snap_por: userId,
      metadata: { fonte_dados: "receitas_brutas" },
    })),
  ];

  // Upsert via REST direto (PostgREST aceita on_conflict)
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const srk = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  const upsertRes = await fetch(
    `${url}/rest/v1/faturamento_snapshots?on_conflict=mes_referencia,fonte`,
    {
      method: "POST",
      headers: {
        apikey: srk,
        Authorization: `Bearer ${srk}`,
        "Content-Type": "application/json",
        Prefer: "resolution=merge-duplicates,return=representation",
      },
      body: JSON.stringify(
        rows.map((r) => ({ ...r, snap_em: new Date().toISOString() }))
      ),
    }
  );

  if (!upsertRes.ok) {
    const detail = await upsertRes.text();
    return NextResponse.json(
      { error: "Falha ao gravar snapshot", detail: detail.slice(0, 400) },
      { status: 500, headers: CORS_HEADERS }
    );
  }

  const saved = await upsertRes.json();
  return NextResponse.json(
    {
      ok: true,
      mes_referencia: mes,
      fontes_gravadas: Array.isArray(saved) ? saved.length : 0,
      meta_faturamento_liquido: meta.faturamentoLiquido,
      manual_total: [...manualPorFonte.values()].reduce((s, v) => s + v.liquido, 0),
    },
    { headers: CORS_HEADERS }
  );
}
