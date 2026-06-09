import { NextResponse, type NextRequest } from "next/server";

export const runtime = "nodejs";

/**
 * TESTE TEMPORÁRIO: chama Greenn /resume do servidor EasyPanel pra ver se
 * o anti-fraude bloqueia ou se passa quando tem token válido.
 * Remover depois do teste.
 */
export async function POST(req: NextRequest) {
  const { token } = (await req.json()) as { token?: string };
  if (!token) return NextResponse.json({ error: "token obrigatório" }, { status: 400 });

  const auth = token.startsWith("Bearer ") ? token : `Bearer ${token}`;
  const t0 = Date.now();

  try {
    const r = await fetch(
      "https://apiadm.greenn.com.br/api/v2/financial-statement/resume?currency_id=1&saleAntecipation=false",
      {
        headers: {
          Authorization: auth,
          "X-Manual-Host": "adm.greenn.com.br",
          Accept: "application/json, text/plain, */*",
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
          Origin: "https://adm.greenn.com.br",
          Referer: "https://adm.greenn.com.br/",
        },
      }
    );
    const elapsed = Date.now() - t0;
    const body = await r.text();
    return NextResponse.json({
      status: r.status,
      elapsed_ms: elapsed,
      body: body.slice(0, 1000),
      headers: Object.fromEntries(r.headers.entries()),
    });
  } catch (e) {
    return NextResponse.json({
      error: e instanceof Error ? e.message : "Erro",
      elapsed_ms: Date.now() - t0,
    });
  }
}
