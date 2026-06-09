import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  let body: { disponivel?: number; pendente?: number; antecipavel?: number };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }

  const disponivel = Number(body.disponivel) || 0;
  const pendente = Number(body.pendente) || 0;
  const antecipavel = Number(body.antecipavel) || 0;

  if (disponivel < 0 || pendente < 0 || antecipavel < 0) {
    return NextResponse.json({ error: "Valores não podem ser negativos" }, { status: 400 });
  }
  if (disponivel === 0 && pendente === 0 && antecipavel === 0) {
    return NextResponse.json({ error: "Pelo menos um valor precisa ser > 0" }, { status: 400 });
  }

  const db = supabase as unknown as {
    from: (t: string) => {
      insert: (rows: unknown) => Promise<{ error: { message: string } | null }>;
    };
  };

  const { error } = await db.from("greenn_saldos").insert([
    { disponivel, pendente, antecipavel, created_by: user.id },
  ]);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, disponivel, pendente, antecipavel });
}
