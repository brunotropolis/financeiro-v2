"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { X, Loader2, Trash2, Check, AlertCircle } from "lucide-react";
import { CONTAS_ATIVAS } from "@/lib/constants";
import { parseBRLInput } from "@/lib/formatters";

function formatBRLEditable(n: number): string {
  if (!Number.isFinite(n) || n === 0) return "";
  return n.toLocaleString("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}
import { cn } from "@/lib/utils";

type Categoria = { id: string; nome: string };
type Projeto = { id: string; nome: string; cor: string | null };

export type EditableEntry = {
  kind: "transacao" | "recorrencia" | "bucket" | "receita";
  id: string;
  // Common
  descricao: string; // ou nome se recorrencia / produto_nome se receita
  valor: number;
  conta_id: string | null;
  categoria_id: string | null;
  projeto_id: string | null;
  // Transação
  data_competencia?: string;
  status?: string;
  // Recorrencia
  dia_vencimento?: number | null;
  frequencia?: string;
  data_inicio?: string;
  // Receita
  origem_id?: string | null;
  data_venda?: string;
  data_prevista_pagamento?: string | null;
  data_recebimento?: string | null;
};

export type OrigemOpt = { id: string; nome: string };

export function EditEntryModal({
  entry,
  categorias,
  projetos,
  origens,
  onClose,
}: {
  entry: EditableEntry;
  categorias: Categoria[];
  projetos: Projeto[];
  origens?: OrigemOpt[];
  onClose: () => void;
}) {
  const router = useRouter();
  const isTrans = entry.kind === "transacao";
  const isRec = entry.kind === "recorrencia";
  const isBucket = entry.kind === "bucket";
  const isReceita = entry.kind === "receita";

  const [descricao, setDescricao] = useState(entry.descricao);
  const [valor, setValor] = useState(formatBRLEditable(entry.valor));
  const [contaId, setContaId] = useState(entry.conta_id ?? "");
  const [categoriaId, setCategoriaId] = useState(entry.categoria_id ?? "");
  const [projetoId, setProjetoId] = useState(entry.projeto_id ?? "");
  const [dataCompetencia, setDataCompetencia] = useState(entry.data_competencia ?? "");
  const [status, setStatus] = useState(entry.status ?? "prevista");
  const [dataInicio, setDataInicio] = useState(entry.data_inicio ?? "");
  const [diaVencimento, setDiaVencimento] = useState<number>(entry.dia_vencimento ?? 1);
  const [frequencia, setFrequencia] = useState(entry.frequencia ?? "mensal");
  const [origemId, setOrigemId] = useState(entry.origem_id ?? "");
  const [dataVenda, setDataVenda] = useState(entry.data_venda ?? "");
  const [dataPrevista, setDataPrevista] = useState(entry.data_prevista_pagamento ?? "");
  const [dataRecebimento, setDataRecebimento] = useState(entry.data_recebimento ?? "");
  const [statusReceita, setStatusReceita] = useState(entry.status ?? "previsto");
  // Bucket: "forward" preserva histórico e aplica o teto novo a partir de um mês;
  // "retro" corrige o teto em todos os meses (comportamento antigo).
  const [bucketMode, setBucketMode] = useState<"forward" | "retro">("forward");
  const [bucketFromMonth, setBucketFromMonth] = useState<string>(() => {
    const d = new Date();
    const nextIdx = d.getMonth() + 1; // 1..12 (mês seguinte, base 0+1)
    const y = nextIdx > 11 ? d.getFullYear() + 1 : d.getFullYear();
    const mm = (nextIdx % 12) + 1; // 1..12
    return `${y}-${String(mm).padStart(2, "0")}`;
  });

  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function handleSave() {
    setErro(null);
    const valorNum = parseBRLInput(valor);
    if (valorNum <= 0) {
      setErro("Valor precisa ser > 0");
      return;
    }
    setSaving(true);
    try {
      // Bucket "daqui pra frente": encerra o atual e cria um novo a partir do mês escolhido.
      if (isBucket && bucketMode === "forward") {
        const res = await fetch(`/api/recorrentes/${entry.id}/split`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            from_month: bucketFromMonth,
            updates: {
              nome: descricao,
              valor_padrao: valorNum,
              frequencia,
              categoria_id: categoriaId || null,
              conta_id: contaId || null,
              projeto_id: projetoId || null,
            },
          }),
        });
        const out = await res.json();
        if (!res.ok || out.error) throw new Error(out.error || `Erro ${res.status}`);
        onClose();
        router.refresh();
        return;
      }

      const path = isReceita
        ? `/api/receitas/${entry.id}`
        : isTrans
          ? `/api/transacoes/${entry.id}`
          : `/api/recorrentes/${entry.id}`;
      const payload: Record<string, unknown> = isReceita
        ? { projeto_id: projetoId || null }
        : {
            conta_id: contaId || null,
            categoria_id: categoriaId || null,
            projeto_id: projetoId || null,
          };

      if (isReceita) {
        payload.produto_nome = descricao;
        payload.valor_bruto = valorNum;
        payload.valor_liquido = valorNum;
        payload.taxas = 0;
        payload.data_venda = dataVenda;
        payload.status = statusReceita;
        payload.origem_id = origemId || null;
        payload.data_prevista_pagamento = dataPrevista || null;
        if (statusReceita === "recebido") {
          payload.data_recebimento =
            dataRecebimento || new Date().toISOString().slice(0, 10);
        } else {
          payload.data_recebimento = null;
        }
      } else if (isTrans) {
        payload.descricao = descricao;
        payload.valor = valorNum;
        payload.data_competencia = dataCompetencia;
        payload.status = status;
        if (status === "paga") {
          payload.data_pagamento = dataCompetencia;
        } else {
          payload.data_pagamento = null;
        }
      } else {
        payload.nome = descricao;
        payload.valor_padrao = valorNum;
        payload.frequencia = frequencia;
        payload.dia_vencimento = isBucket
          ? Number((dataInicio || new Date().toISOString().slice(0, 10)).slice(8, 10)) || 1
          : diaVencimento;
        payload.data_inicio = dataInicio;
      }

      const res = await fetch(path, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const out = await res.json();
      if (!res.ok || out.error) throw new Error(out.error || `Erro ${res.status}`);
      onClose();
      router.refresh();
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Erro");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!confirm("Excluir esse lançamento? Não dá pra desfazer.")) return;
    setDeleting(true);
    setErro(null);
    try {
      const path = isReceita
        ? `/api/receitas/${entry.id}`
        : isTrans
          ? `/api/transacoes/${entry.id}`
          : `/api/recorrentes/${entry.id}`;
      const res = await fetch(path, { method: "DELETE" });
      const out = await res.json().catch(() => ({}));
      if (!res.ok || out.error) throw new Error(out.error || `Erro ${res.status}`);
      onClose();
      router.refresh();
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Erro");
    } finally {
      setDeleting(false);
    }
  }

  const titulo = isBucket
    ? "Editar bucket"
    : isReceita
      ? "Editar receita"
      : isRec
        ? "Editar recorrência"
        : "Editar despesa";

  return (
    <div
      className="fixed inset-0 z-50 grid place-items-center bg-black/60 backdrop-blur-sm p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg bg-surface border border-line/60 rounded-2xl p-5 max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between mb-4">
          <h3 className="text-base font-semibold">{titulo}</h3>
          <button onClick={onClose} className="text-ink-dim hover:text-ink">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="space-y-3">
          <Field label={isTrans ? "Descrição" : isReceita ? "Produto/Cliente" : "Nome"}>
            <input
              value={descricao}
              onChange={(e) => setDescricao(e.target.value)}
              className="w-full bg-bg border border-line rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-lime"
            />
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label={isBucket ? "Teto" : isReceita ? "Faturamento (R$)" : "Valor (R$)"}>
              <input
                value={valor}
                onChange={(e) => setValor(e.target.value)}
                inputMode="decimal"
                placeholder="0,00"
                className="w-full bg-bg border border-line rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-lime"
              />
            </Field>
            {isReceita ? (
              <Field label="Origem">
                <select
                  value={origemId}
                  onChange={(e) => setOrigemId(e.target.value)}
                  className="w-full bg-bg border border-line rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-lime"
                >
                  <option value="">— escolha —</option>
                  {(origens ?? []).map((o) => (
                    <option key={o.id} value={o.id}>
                      {o.nome}
                    </option>
                  ))}
                </select>
              </Field>
            ) : (
              <Field label="Conta">
                <select
                  value={contaId}
                  onChange={(e) => setContaId(e.target.value)}
                  className="w-full bg-bg border border-line rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-lime"
                >
                  {CONTAS_ATIVAS.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.nome} ({c.apelido})
                    </option>
                  ))}
                </select>
              </Field>
            )}
          </div>

          {isReceita ? (
            <div className="grid grid-cols-2 gap-3">
              <Field label="Data da venda">
                <input
                  type="date"
                  value={dataVenda}
                  onChange={(e) => setDataVenda(e.target.value)}
                  className="w-full bg-bg border border-line rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-lime"
                />
              </Field>
              <Field label="Status">
                <select
                  value={statusReceita}
                  onChange={(e) => setStatusReceita(e.target.value)}
                  className="w-full bg-bg border border-line rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-lime"
                >
                  <option value="previsto">A receber</option>
                  <option value="recebido">Já em caixa</option>
                </select>
              </Field>
              {statusReceita === "previsto" && (
                <Field label="Data prevista do pagamento">
                  <input
                    type="date"
                    value={dataPrevista}
                    onChange={(e) => setDataPrevista(e.target.value)}
                    className="w-full bg-bg border border-line rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-lime"
                  />
                </Field>
              )}
              {statusReceita === "recebido" && (
                <Field label="Data do recebimento">
                  <input
                    type="date"
                    value={dataRecebimento}
                    onChange={(e) => setDataRecebimento(e.target.value)}
                    className="w-full bg-bg border border-line rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-lime"
                  />
                </Field>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              <Field label="Categoria">
                <select
                  value={categoriaId}
                  onChange={(e) => setCategoriaId(e.target.value)}
                  className="w-full bg-bg border border-line rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-lime"
                >
                  <option value="">— sem categoria —</option>
                  {categorias.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.nome}
                    </option>
                  ))}
                </select>
              </Field>

              {isTrans ? (
                <Field label="Data">
                  <input
                    type="date"
                    value={dataCompetencia}
                    onChange={(e) => setDataCompetencia(e.target.value)}
                    className="w-full bg-bg border border-line rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-lime"
                  />
                </Field>
              ) : (
                <Field label={isBucket ? "Começa em" : "Início"}>
                  <input
                    type="date"
                    value={dataInicio}
                    onChange={(e) => setDataInicio(e.target.value)}
                    className="w-full bg-bg border border-line rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-lime"
                  />
                </Field>
              )}
            </div>
          )}

          <Field label="Projeto">
            <div className="flex flex-wrap gap-2">
              {projetos.map((p) => {
                const active = projetoId === p.id;
                return (
                  <button
                    type="button"
                    key={p.id}
                    onClick={() => setProjetoId(p.id)}
                    className={cn(
                      "inline-flex items-center gap-1.5 text-xs rounded-lg px-2.5 py-1.5 border transition-colors",
                      active
                        ? "border-lime/60 bg-lime/15 text-ink"
                        : "border-line bg-bg text-ink-soft hover:bg-elevated"
                    )}
                  >
                    <span
                      className="h-1.5 w-1.5 rounded-full"
                      style={{ background: p.cor ?? "#71717a" }}
                    />
                    {p.nome}
                  </button>
                );
              })}
              <button
                type="button"
                onClick={() => setProjetoId("")}
                className={cn(
                  "text-[11px] rounded-lg px-2 py-1.5 border transition-colors",
                  projetoId === ""
                    ? "border-line bg-elevated text-ink"
                    : "border-line/40 text-ink-dim hover:bg-elevated"
                )}
              >
                — nenhum —
              </button>
            </div>
          </Field>

          {isTrans && (
            <Field label="Status">
              <div className="flex gap-2">
                {(["prevista", "paga", "atrasada"] as const).map((s) => (
                  <button
                    type="button"
                    key={s}
                    onClick={() => setStatus(s)}
                    className={cn(
                      "text-xs rounded-lg px-3 py-1.5 border transition-colors",
                      status === s
                        ? "border-lime bg-lime text-bg font-semibold"
                        : "border-line text-ink-soft hover:bg-elevated"
                    )}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </Field>
          )}

          {isRec && !isBucket && (
            <div className="grid grid-cols-2 gap-3">
              <Field label="Frequência">
                <select
                  value={frequencia}
                  onChange={(e) => setFrequencia(e.target.value)}
                  className="w-full bg-bg border border-line rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-lime"
                >
                  <option value="mensal">Mensal</option>
                  <option value="semanal">Semanal</option>
                  <option value="quinzenal">Quinzenal</option>
                  <option value="bimestral">Bimestral</option>
                </select>
              </Field>
              {frequencia === "mensal" && (
                <Field label="Dia do vencimento">
                  <input
                    type="number"
                    min={1}
                    max={31}
                    value={diaVencimento}
                    onChange={(e) => setDiaVencimento(Number(e.target.value))}
                    className="w-full bg-bg border border-line rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-lime"
                  />
                </Field>
              )}
            </div>
          )}

          {isBucket && (
            <Field label="Frequência do teto">
              <select
                value={frequencia}
                onChange={(e) => setFrequencia(e.target.value)}
                className="w-full bg-bg border border-line rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-lime"
              >
                <option value="semanal">Semanal</option>
                <option value="mensal">Mensal</option>
                <option value="bimestral">Bimestral</option>
              </select>
            </Field>
          )}

          {isBucket && (
            <Field label="Aplicar alteração">
              <div className="flex gap-2 mb-2">
                <button
                  type="button"
                  onClick={() => setBucketMode("forward")}
                  className={cn(
                    "text-xs rounded-lg px-3 py-1.5 border transition-colors",
                    bucketMode === "forward"
                      ? "border-lime bg-lime text-bg font-semibold"
                      : "border-line text-ink-soft hover:bg-elevated"
                  )}
                >
                  Daqui pra frente
                </button>
                <button
                  type="button"
                  onClick={() => setBucketMode("retro")}
                  className={cn(
                    "text-xs rounded-lg px-3 py-1.5 border transition-colors",
                    bucketMode === "retro"
                      ? "border-lime bg-lime text-bg font-semibold"
                      : "border-line text-ink-soft hover:bg-elevated"
                  )}
                >
                  Retroativo
                </button>
              </div>
              {bucketMode === "forward" ? (
                <>
                  <input
                    type="month"
                    value={bucketFromMonth}
                    onChange={(e) => setBucketFromMonth(e.target.value)}
                    className="w-full bg-bg border border-line rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-lime"
                  />
                  <p className="text-[11px] text-ink-dim mt-1">
                    O histórico antes desse mês fica intacto. A partir dele vale o teto novo.
                  </p>
                </>
              ) : (
                <p className="text-[11px] text-amber-400 mt-1">
                  Corrige o teto em todos os meses (passado e futuro).
                </p>
              )}
            </Field>
          )}
        </div>

        {erro && (
          <div className="mt-3 flex items-start gap-2 text-xs text-negative bg-negative/10 border border-negative/30 rounded-lg p-2.5">
            <AlertCircle className="h-3.5 w-3.5 mt-0.5" />
            {erro}
          </div>
        )}

        <div className="mt-4 flex items-center justify-between">
          <button
            onClick={handleDelete}
            disabled={deleting || saving}
            className="inline-flex items-center gap-1.5 text-xs px-3 py-2 rounded-lg border border-negative/40 text-negative hover:bg-negative/10 disabled:opacity-60"
          >
            {deleting ? <Loader2 className="h-3 w-3 animate-spin" /> : <Trash2 className="h-3 w-3" />}
            Excluir
          </button>
          <div className="flex gap-2">
            <button
              onClick={onClose}
              className="text-xs px-3 py-2 rounded-lg border border-line text-ink-soft hover:bg-elevated"
            >
              Cancelar
            </button>
            <button
              onClick={handleSave}
              disabled={saving || deleting}
              className="inline-flex items-center gap-1.5 text-xs bg-lime text-bg font-semibold rounded-lg px-4 py-2 hover:bg-lime-glow disabled:opacity-60"
            >
              {saving ? <Loader2 className="h-3 w-3 animate-spin" /> : <Check className="h-3 w-3" />}
              Salvar
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="text-[11px] text-ink-soft block mb-1">{label}</label>
      {children}
    </div>
  );
}
