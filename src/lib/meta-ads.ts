/**
 * Busca dados do Meta Ads do mês via Dashboard API do n8n.
 * Endpoint público (sem auth). Cache de 1h pra não pesar.
 */

const META_DASHBOARD_API = "https://n8n-n8n.xktssy.easypanel.host/webhook/meta-dashboard-api";

function num(v: unknown): number {
  if (v === null || v === undefined) return 0;
  if (typeof v === "number") return v;
  if (typeof v === "string") {
    const n = parseFloat(v);
    return Number.isFinite(n) ? n : 0;
  }
  return 0;
}

export type MetaMesData = {
  gastoTotal: number;
  faturamentoLiquido: number;
  roasReal: number;
  numCampanhas: number;
};

/**
 * Busca gastos Meta do mês. O endpoint suporta `periodo=mes` (mês corrente)
 * ou `periodo=personalizado&inicio=YYYY-MM-DD&fim=YYYY-MM-DD`.
 *
 * Pra meses passados/futuros usa o personalizado.
 */
export async function getMetaAdsMes(mesIso: string): Promise<MetaMesData> {
  const [y, m] = mesIso.split("-").map(Number);
  const hoje = new Date();
  const mesAtualIso = `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, "0")}`;

  let url: string;
  if (mesIso === mesAtualIso) {
    url = `${META_DASHBOARD_API}?periodo=mes`;
  } else {
    const inicio = new Date(y, m - 1, 1).toISOString().slice(0, 10);
    const fim = new Date(y, m, 0).toISOString().slice(0, 10);
    url = `${META_DASHBOARD_API}?periodo=personalizado&inicio=${inicio}&fim=${fim}`;
  }

  try {
    const r = await fetch(url, { next: { revalidate: 3600 } });
    if (!r.ok) {
      return { gastoTotal: 0, faturamentoLiquido: 0, roasReal: 0, numCampanhas: 0 };
    }
    const data = (await r.json()) as {
      resumo?: {
        roas_real?: string | number;
      };
      campanhas?: Array<{ spend?: string | number }>;
      vendas?: {
        hoje?: Array<{ tipo: string; valor: string | number }>;
      };
    };

    const gastoTotal = (data.campanhas ?? []).reduce((s, c) => s + num(c.spend), 0);
    const vendasArr = data.vendas?.hoje ?? [];
    const vendas = vendasArr.filter((v) => v.tipo === "VENDA").reduce((s, v) => s + num(v.valor), 0);
    const reembolsos = vendasArr.filter((v) => v.tipo === "REEMBOLSO").reduce((s, v) => s + num(v.valor), 0);
    const faturamentoLiquido = vendas - reembolsos;
    const roasReal = gastoTotal > 0 ? faturamentoLiquido / gastoTotal : 0;

    return {
      gastoTotal,
      faturamentoLiquido,
      roasReal,
      numCampanhas: (data.campanhas ?? []).length,
    };
  } catch (e) {
    console.error("[meta-ads] erro:", e);
    return { gastoTotal: 0, faturamentoLiquido: 0, roasReal: 0, numCampanhas: 0 };
  }
}
