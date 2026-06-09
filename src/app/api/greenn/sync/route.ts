import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, X-Sync-Secret",
};

export async function OPTIONS() {
  return new Response(null, { headers: CORS_HEADERS });
}

/**
 * Sync direto: bookmarklet no Chrome do Bruno → POSTa o Bearer token
 * → servidor chama Greenn /resume → salva snapshot.
 *
 * Autenticação: header `x-sync-secret` (não usa sessão Supabase porque
 * vem de fora-do-domínio via bookmarklet). Secret simples baseado em
 * env GREENN_SYNC_SECRET.
 */
export async function POST(req: NextRequest) {
  const expectedSecret = process.env.GREENN_SYNC_SECRET ?? "default-change-me";
  const givenSecret = req.headers.get("x-sync-secret");
  if (givenSecret !== expectedSecret) {
    return NextResponse.json(
      { error: "Sync secret inválido. Bookmarklet desatualizado?" },
      { status: 401, headers: CORS_HEADERS }
    );
  }

  let body: { token?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { error: "JSON inválido" },
      { status: 400, headers: CORS_HEADERS }
    );
  }

  if (!body.token) {
    return NextResponse.json(
      { error: "Token obrigatório" },
      { status: 400, headers: CORS_HEADERS }
    );
  }

  const auth = body.token.startsWith("Bearer ") ? body.token : `Bearer ${body.token}`;

  try {
    const r = await fetch(
      "https://apiadm.greenn.com.br/api/v2/financial-statement/resume?currency_id=1&saleAntecipation=false",
      {
        headers: {
          Authorization: auth,
          "X-Manual-Host": "adm.greenn.com.br",
          Accept: "application/json",
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/131.0.0.0",
          Origin: "https://adm.greenn.com.br",
          Referer: "https://adm.greenn.com.br/",
        },
      }
    );

    if (!r.ok) {
      const errBody = await r.text();
      return NextResponse.json(
        { error: `Greenn API ${r.status}`, detail: errBody.slice(0, 300) },
        { status: 502, headers: CORS_HEADERS }
      );
    }

    const data = (await r.json()) as {
      status: string;
      data: {
        available: number;
        blocked: number;
        available_to_antecipate: number;
        total?: number;
      };
    };

    if (data.status !== "SUCCESS" || !data.data) {
      return NextResponse.json(
        { error: "Resposta inesperada da Greenn", raw: JSON.stringify(data).slice(0, 200) },
        { status: 502, headers: CORS_HEADERS }
      );
    }

    const disponivel = Number(data.data.available) || 0;
    const pendente = Number(data.data.blocked) || 0;
    const antecipavel = Number(data.data.available_to_antecipate) || 0;

    // Insere snapshot via service role (vem de fora, sem sessão)
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const srk = process.env.SUPABASE_SERVICE_ROLE_KEY!;
    const ins = await fetch(`${url}/rest/v1/greenn_saldos`, {
      method: "POST",
      headers: {
        apikey: srk,
        Authorization: `Bearer ${srk}`,
        "Content-Type": "application/json",
        Prefer: "return=representation",
      },
      body: JSON.stringify({ disponivel, pendente, antecipavel }),
    });

    if (!ins.ok) {
      const e = await ins.text();
      return NextResponse.json(
        { error: "Falha ao gravar snapshot", detail: e.slice(0, 200) },
        { status: 500, headers: CORS_HEADERS }
      );
    }

    return NextResponse.json(
      {
        ok: true,
        disponivel,
        pendente,
        antecipavel,
        total: data.data.total,
        capturado_em: new Date().toISOString(),
      },
      { headers: CORS_HEADERS }
    );
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : String(e) },
      { status: 500, headers: CORS_HEADERS }
    );
  }
}
