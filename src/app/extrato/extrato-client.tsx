"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Check, X, AlertCircle } from "lucide-react";
import { CONTAS_ATIVAS } from "@/lib/constants";
import { cn } from "@/lib/utils";

export type ExtratoLinha = {
  id: string;
  tipo: "saida" | "entrada";
  valor: number;
  data: string;
  descricao: string;
  conta_id: string;
  contraparte: string;
};
type Projeto = { id: string; slug: string; nome: string; cor: string | null };
type Bucket = { id: string; nome: string; categoria_id: string | null };
type Categoria = { id: string; nome: string };
type Origem = { id: string; slug: string; nome: string };

function brl(n: number) {
  return n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}
function ddmm(iso: string) {
  const [, m, d] = iso.split("-");
  return `${d}/${m}`;
}
function contaNome(id: string) {
  const c = CONTAS_ATIVAS.find((x) => x.id === id);
  return c ? `${c.nome}` : "";
}

type Sel = { projeto_id?: string; categoria_id?: string; bucket_id?: string; origem_id?: string };

export function ExtratoClient({
  linhas,
  projetos,
  buckets,
  categorias,
  origens,
  jaTratadas,
}: {
  linhas: ExtratoLinha[];
  projetos: Projeto[];
  buckets: Bucket[];
  categorias: Categoria[];
  origens: Origem[];
  jaTratadas: number;
}) {
  const router = useRouter();
  const [rows, setRows] = useState<ExtratoLinha[]>(linhas);
  const [sel, setSel] = useState<Record<string, Sel>>({});
  const [busy, setBusy] = useState<Record<string, string>>({});
  const [bulk, setBulk] = useState(false);

  const pessoal = useMemo(
    () => projetos.find((p) => p.slug === "pessoal" || p.nome.toLowerCase() === "pessoal"),
    [projetos]
  );
  const catPessoais = useMemo(
    () => categorias.find((c) => c.nome.toLowerCase().startsWith("pessoa")),
    [categorias]
  );
  const saidas = rows.filter((r) => r.tipo === "saida");
  const entradas = rows.filter((r) => r.tipo === "entrada");

  function setField(id: string, patch: Sel) {
    setSel((s) => ({ ...s, [id]: { ...s[id], ...patch } }));
  }

  async function classificar(
    row: ExtratoLinha,
    payload: {
      projeto_id?: string | null;
      categoria_id?: string | null;
      bucket_id?: string | null;
      origem_id?: string | null;
    }
  ) {
    setBusy((b) => ({ ...b, [row.id]: "saving" }));
    try {
      const res = await fetch("/api/extrato/classificar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: row.id, acao: "classificar", ...payload }),
      });
      const out = await res.json();
      if (!res.ok || out.error) throw new Error(out.error || `Erro ${res.status}`);
      setRows((rs) => rs.filter((r) => r.id !== row.id));
    } catch (e) {
      setBusy((b) => ({ ...b, [row.id]: e instanceof Error ? e.message : "erro" }));
    }
  }

  async function ignorar(row: ExtratoLinha) {
    setBusy((b) => ({ ...b, [row.id]: "saving" }));
    try {
      const res = await fetch("/api/extrato/classificar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: row.id, acao: "ignorar" }),
      });
      const out = await res.json();
      if (!res.ok || out.error) throw new Error(out.error || `Erro ${res.status}`);
      setRows((rs) => rs.filter((r) => r.id !== row.id));
    } catch (e) {
      setBusy((b) => ({ ...b, [row.id]: e instanceof Error ? e.message : "erro" }));
    }
  }

  async function classificarRestantesPessoal() {
    if (!pessoal) return;
    if (!confirm(`Mandar as ${saidas.length} saídas restantes como Pessoal · avulso?`)) return;
    setBulk(true);
    const alvo = [...saidas];
    for (const row of alvo) {
      // sequencial pra não estourar o banco; cada uma some da lista ao concluir
      // eslint-disable-next-line no-await-in-loop
      await classificar(row, {
        projeto_id: pessoal.id,
        categoria_id: catPessoais?.id ?? null,
        bucket_id: null,
      });
    }
    setBulk(false);
    router.refresh();
  }

  function ProjetoChips({ row }: { row: ExtratoLinha }) {
    const cur = sel[row.id]?.projeto_id;
    return (
      <div className="flex flex-wrap gap-1.5">
        {projetos.map((p) => {
          const active = cur === p.id;
          return (
            <button
              key={p.id}
              type="button"
              onClick={() => setField(row.id, { projeto_id: p.id })}
              className={cn(
                "inline-flex items-center gap-1 text-[11px] rounded-lg px-2 py-1 border transition-colors",
                active ? "border-lime/70 bg-lime/15 text-ink" : "border-line bg-bg text-ink-soft hover:bg-elevated"
              )}
            >
              <span className="h-1.5 w-1.5 rounded-full" style={{ background: p.cor ?? "#71717a" }} />
              {p.nome}
            </button>
          );
        })}
      </div>
    );
  }

  const total = saidas.length + entradas.length;

  return (
    <div>
      <div className="flex flex-wrap items-center gap-3 mb-5 text-sm">
        <span className="px-3 py-1.5 rounded-lg bg-surface border border-line/60">
          <span className="font-semibold text-ink">{total}</span> <span className="text-ink-soft">pra direcionar</span>
        </span>
        <span className="text-ink-dim text-xs">{jaTratadas} já tratadas (internas/Greenn)</span>
        {saidas.length > 0 && pessoal && (
          <button
            onClick={classificarRestantesPessoal}
            disabled={bulk}
            className="ml-auto inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border border-line text-ink-soft hover:bg-elevated disabled:opacity-60"
          >
            {bulk ? <Loader2 className="h-3 w-3 animate-spin" /> : null}
            Restantes → Pessoal · avulso
          </button>
        )}
      </div>

      {total === 0 && (
        <div className="text-sm text-ink-soft bg-surface border border-line/60 rounded-xl p-6 text-center">
          <Check className="h-5 w-5 mx-auto mb-2 text-positive" />
          Tudo classificado. Manda o próximo extrato quando quiser.
        </div>
      )}

      {saidas.length > 0 && (
        <Section titulo={`Saídas · gastos (${saidas.length})`}>
          {saidas.map((row) => (
            <Row key={row.id} row={row} accent="negative">
              <ProjetoChips row={row} />
              <div className="flex items-center gap-2 mt-2 flex-wrap">
                <select
                  value={sel[row.id]?.categoria_id ?? ""}
                  onChange={(e) => setField(row.id, { categoria_id: e.target.value || undefined })}
                  className="text-[11px] bg-bg border border-line rounded-lg px-2 py-1 focus:outline-none focus:border-lime max-w-[150px]"
                >
                  <option value="">categoria…</option>
                  {categorias.map((c) => (
                    <option key={c.id} value={c.id}>{c.nome}</option>
                  ))}
                </select>
                <select
                  value={sel[row.id]?.bucket_id ?? ""}
                  onChange={(e) => {
                    const bid = e.target.value || undefined;
                    const b = buckets.find((x) => x.id === bid);
                    const patch: Sel = { bucket_id: bid };
                    if (b?.categoria_id && !sel[row.id]?.categoria_id) patch.categoria_id = b.categoria_id;
                    setField(row.id, patch);
                  }}
                  className="text-[11px] bg-bg border border-line rounded-lg px-2 py-1 focus:outline-none focus:border-lime max-w-[150px]"
                >
                  <option value="">avulso</option>
                  {buckets.map((b) => (
                    <option key={b.id} value={b.id}>bucket: {b.nome}</option>
                  ))}
                </select>
                <SaveIgnore
                  busy={busy[row.id]}
                  canSave={!!sel[row.id]?.projeto_id}
                  onSave={() =>
                    classificar(row, {
                      projeto_id: sel[row.id]?.projeto_id,
                      categoria_id: sel[row.id]?.categoria_id || null,
                      bucket_id: sel[row.id]?.bucket_id || null,
                    })
                  }
                  onIgnore={() => ignorar(row)}
                />
              </div>
            </Row>
          ))}
        </Section>
      )}

      {entradas.length > 0 && (
        <Section titulo={`Entradas · recebimentos (${entradas.length})`}>
          {entradas.map((row) => (
            <Row key={row.id} row={row} accent="positive">
              <ProjetoChips row={row} />
              <div className="flex items-center gap-2 mt-2">
                <select
                  value={sel[row.id]?.origem_id ?? ""}
                  onChange={(e) => setField(row.id, { origem_id: e.target.value || undefined })}
                  className="text-[11px] bg-bg border border-line rounded-lg px-2 py-1 focus:outline-none focus:border-lime max-w-[180px]"
                >
                  <option value="">— origem —</option>
                  {origens.map((o) => (
                    <option key={o.id} value={o.id}>{o.nome}</option>
                  ))}
                </select>
                <SaveIgnore
                  busy={busy[row.id]}
                  canSave={!!sel[row.id]?.projeto_id && !!sel[row.id]?.origem_id}
                  onSave={() => classificar(row, { projeto_id: sel[row.id]?.projeto_id, origem_id: sel[row.id]?.origem_id })}
                  onIgnore={() => ignorar(row)}
                />
              </div>
            </Row>
          ))}
        </Section>
      )}
    </div>
  );
}

function Section({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <div className="mb-6">
      <div className="text-[11px] uppercase tracking-wide text-ink-dim mb-2">{titulo}</div>
      <div className="space-y-2">{children}</div>
    </div>
  );
}

function Row({
  row,
  accent,
  children,
}: {
  row: ExtratoLinha;
  accent: "negative" | "positive";
  children: React.ReactNode;
}) {
  return (
    <div className="bg-surface border border-line/60 rounded-xl p-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-sm text-ink truncate">{row.contraparte}</div>
          <div className="text-[11px] text-ink-dim">
            {ddmm(row.data)} · {contaNome(row.conta_id)}
          </div>
        </div>
        <div
          className={cn(
            "text-sm font-semibold whitespace-nowrap",
            accent === "negative" ? "text-negative" : "text-positive"
          )}
        >
          {accent === "negative" ? "−" : "+"}
          {brl(row.valor)}
        </div>
      </div>
      <div className="mt-2">{children}</div>
    </div>
  );
}

function SaveIgnore({
  busy,
  canSave,
  onSave,
  onIgnore,
}: {
  busy?: string;
  canSave: boolean;
  onSave: () => void;
  onIgnore: () => void;
}) {
  const erro = busy && busy !== "saving" ? busy : null;
  return (
    <div className="flex items-center gap-2 ml-auto">
      {erro && (
        <span className="inline-flex items-center gap-1 text-[11px] text-negative">
          <AlertCircle className="h-3 w-3" /> {erro.slice(0, 40)}
        </span>
      )}
      <button
        type="button"
        onClick={onIgnore}
        disabled={busy === "saving"}
        title="Ignorar (não vira lançamento)"
        className="inline-flex items-center justify-center h-7 w-7 rounded-lg border border-line text-ink-dim hover:bg-elevated disabled:opacity-50"
      >
        <X className="h-3.5 w-3.5" />
      </button>
      <button
        type="button"
        onClick={onSave}
        disabled={!canSave || busy === "saving"}
        className="inline-flex items-center gap-1.5 text-xs bg-lime text-bg font-semibold rounded-lg px-3 py-1.5 hover:bg-lime-glow disabled:opacity-40"
      >
        {busy === "saving" ? <Loader2 className="h-3 w-3 animate-spin" /> : <Check className="h-3 w-3" />}
        Salvar
      </button>
    </div>
  );
}
