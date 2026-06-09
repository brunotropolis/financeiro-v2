import { NextResponse, type NextRequest } from "next/server";

export const runtime = "nodejs";

/**
 * TESTE: tentar refresh do JWT via /oauth/token Laravel Passport.
 * Recebe refresh_token, tenta múltiplas variantes (client_id, etc).
 */
export async function POST(req: NextRequest) {
  const body = (await req.json()) as {
    refresh_token: string;
    client_id?: string;
    client_secret?: string;
  };

  const candidates = [
    // V1: só refresh_token (Laravel Passport sem client)
    { grant_type: "refresh_token", refresh_token: body.refresh_token },
    // V2: com client_id 1
    {
      grant_type: "refresh_token",
      refresh_token: body.refresh_token,
      client_id: body.client_id ?? "1",
    },
    // V3: com client_id 2 (audience aud=2 do JWT)
    {
      grant_type: "refresh_token",
      refresh_token: body.refresh_token,
      client_id: body.client_id ?? "2",
    },
  ];

  const results = [];
  for (const payload of candidates) {
    try {
      const r = await fetch("https://apiadm.greenn.com.br/oauth/token", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
          Origin: "https://adm.greenn.com.br",
          Referer: "https://adm.greenn.com.br/",
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/131.0.0.0 Safari/537.36",
        },
        body: JSON.stringify(payload),
      });
      results.push({
        payload_keys: Object.keys(payload),
        status: r.status,
        body: (await r.text()).slice(0, 500),
      });
    } catch (e) {
      results.push({
        payload_keys: Object.keys(payload),
        error: e instanceof Error ? e.message : String(e),
      });
    }
  }

  return NextResponse.json(
    { results },
    {
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type",
      },
    }
  );
}

export async function OPTIONS() {
  return new Response(null, {
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    },
  });
}
