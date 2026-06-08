import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  const { id } = await params;
  const body = (await request.json().catch(() => ({}))) as { ativo?: boolean };

  const db = supabase as unknown as {
    from: (t: string) => {
      update: (v: unknown) => { eq: (c: string, v: string) => Promise<{ error: { message: string } | null }> };
    };
  };

  const { error } = await db
    .from("recorrencias")
    .update({ ativo: !!body.ativo, updated_by: user.id })
    .eq("id", id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
