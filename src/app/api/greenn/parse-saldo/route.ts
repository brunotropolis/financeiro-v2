import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const maxDuration = 30;

const PROMPT = `Você está analisando um print do painel admin da Greenn.
Procure pela seção "Minha carteira" / "Extrato" mostrando 3 valores em BRL:

1. **Saldo disponível** — liberado pra saque imediato (ex: "R$ 37,44")
2. **Saldo pendente** — provisionado/em aberto (ex: "R$ 8.475,45")
3. **Antecipável** ou **Antecipação** — pode ser antecipado (ex: "R$ 3.989,45")

Regras:
- Valores SEMPRE em BRL positivos
- Use ponto decimal (37.44 e não 37,44)
- Se algum não estiver visível, retorne 0
- Ignore "Total de transações"

Responda APENAS com JSON neste formato:
{"disponivel": 37.44, "pendente": 8475.45, "antecipavel": 3989.45}`;

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: userResp } = await supabase.auth.getUser();
    if (!userResp.user) {
      return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
    }

    const body = (await req.json()) as { image?: string; media_type?: string };
    if (!body.image) {
      return NextResponse.json({ error: "Imagem ausente" }, { status: 400 });
    }

    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: "ANTHROPIC_API_KEY não configurada no servidor" },
        { status: 500 }
      );
    }

    const mediaType = body.media_type || "image/png";
    const base64 = body.image.replace(/^data:image\/\w+;base64,/, "");

    const claudeRes = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: "claude-haiku-4-5",
        max_tokens: 500,
        messages: [
          {
            role: "user",
            content: [
              {
                type: "image",
                source: { type: "base64", media_type: mediaType, data: base64 },
              },
              { type: "text", text: PROMPT },
            ],
          },
        ],
      }),
    });

    if (!claudeRes.ok) {
      const errText = await claudeRes.text();
      return NextResponse.json(
        { error: `Claude API ${claudeRes.status}: ${errText.slice(0, 200)}` },
        { status: 500 }
      );
    }

    const data = (await claudeRes.json()) as {
      content: Array<{ type: string; text?: string }>;
    };

    const text = data.content
      .filter((c) => c.type === "text")
      .map((c) => c.text ?? "")
      .join("");

    const cleaned = text.replace(/^[\s\S]*?(\{[\s\S]*\})[\s\S]*$/, "$1");
    let parsed: { disponivel: number; pendente: number; antecipavel: number };
    try {
      parsed = JSON.parse(cleaned);
    } catch {
      return NextResponse.json(
        { error: "IA não retornou JSON válido", raw: text.slice(0, 300) },
        { status: 500 }
      );
    }

    const disponivel = Number(parsed.disponivel) || 0;
    const pendente = Number(parsed.pendente) || 0;
    const antecipavel = Number(parsed.antecipavel) || 0;

    if (disponivel === 0 && pendente === 0 && antecipavel === 0) {
      return NextResponse.json(
        { error: "Não consegui identificar os valores. Confirma que é o print da carteira Greenn?" },
        { status: 400 }
      );
    }

    const db = supabase as unknown as {
      from: (t: string) => {
        insert: (rows: unknown) => Promise<{ error: { message: string } | null }>;
      };
    };

    const { error: insertErr } = await db.from("greenn_saldos").insert([
      {
        disponivel,
        pendente,
        antecipavel,
        created_by: userResp.user.id,
      },
    ]);

    if (insertErr) {
      return NextResponse.json({ error: insertErr.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true, disponivel, pendente, antecipavel });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Erro desconhecido";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
