"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowDownToLine,
  ArrowUpToLine,
  Repeat,
  Layers,
  PiggyBank,
  Check,
  AlertCircle,
} from "lucide-react";
import { CONTAS_ATIVAS } from "@/lib/constants";
import type { CategoriaItem, OrigemItem, ProjetoItem, BucketItem } from "@/lib/catalog";
import { parseBRLInput, formatBRL } from "@/lib/formatters";
import { cn } from "@/lib/utils";

type Tipo =
  | "despesa_avulsa"
  | "despesa_recorrente"
  | "despesa_parcelada"
  | "despesa_bucket"
  | "receita_avulsa";

const TIPOS: Array<{
  id: Tipo;
  label: string;
  desc: string;
  icon: React.ElementType;
  side: "despesa" | "receita";
}> = [
  {
    id: "despesa_avulsa",
    label: "Despesa avulsa",
    desc: "Um gasto único",
    icon: ArrowDownToLine,
    side: "despesa",
  },
  {
    id: "despesa_recorrente",
    label: "Despesa recorrente",
    desc: "Repete todo mês/semana",
    icon: Repeat,
    side: "despesa",
  },
  {
    id: "despesa_parcelada",
    label: "Despesa parcelada",
    desc: "Gerar N parcelas",
    icon: Layers,
    side: "despesa",
  },
  {
    id: "despesa_bucket",
    label: "Bucket",
    desc: "Teto por período",
    icon: PiggyBank,
    side: "despesa",
  },
  {
    id: "receita_avulsa",
    label: "Receita avulsa",
    desc: "Entrada manual",
    icon: ArrowUpToLine,
    side: "receita",
  },
];

export function LancarForm({
  categoriasDespesa,
  categoriasReceita,
  origens,
  projetos,
  buckets,
  tipoInicial,
}: {
  categoriasDespesa: CategoriaItem[];
  categoriasReceita: CategoriaItem[];
  origens: OrigemItem[];
  projetos: ProjetoItem[];
  buckets: BucketItem[];
  tipoInicial?: Tipo;
}) {
  const router = useRouter();
  const [tipo, setTipo] = useState<Tipo>(tipoInicial ?? "despesa_avulsa");
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [sucesso, setSucesso] = useState<string | null>(null);

  // estado do form (campos comuns)
  const [valor, setValor] = useState("");
  const [descricao, setDescricao] = useState("");
  const [contaId, setContaId] = useState<string>(CONTAS_ATIVAS[0].id);
  const [categoriaId, setCategoriaId] = useState("");
  const [bucketId, setBucketId] = useState<string>("");
  const [projetoId, setProjetoId] = useState<string>(projetos[0]?.id ?? "");
  const [data, setData] = useState(() => new Date().toISOString().slice(0, 10));
  const [status, setStatus] = useState<"prevista" | "paga">("prevista");

  // específicos recorrente
  const [frequencia, setFrequencia] = useState<
    "mensal" | "semanal" | "quinzenal" | "bimestral"
  >("mensal");
  const [diaVencimento, setDiaVencimento] = useState<number>(10);

  // específicos parcelada
  const [parcelas, setParcelas] = useState<number>(2);

  // específicos bucket
  const [freqBucket, setFreqBucket] = useState<"semanal" | "mensal" | "bimestral">("mensal");

  // específicos receita
  const [origemId, setOrigemId] = useState("");
  const [competencia, setCompetencia] = useState(() => new Date().toISOString().slice(0, 7));
  const [dataRecebimento, setDataRecebimento] = useState("");
  const [dataPrevista, setDataPrevista] = useState("");
  const [statusReceita, setStatusReceita] = useState<"previsto" | "recebido">("previsto");

  const isDespesa = tipo.startsWith("despesa");
  const isReceita = tipo.startsWith("receita");
  const isParcelada = tipo === "despesa_parcelada";
  const isRecorrente = tipo === "despesa_recorrente";
  const isBucket = tipo === "despesa_bucket";

  const categorias = isDespesa ? categoriasDespesa : categoriasReceita;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErro(null);
    setSucesso(null);

    const valorNum = parseBRLInput(valor);
    if (!valorNum || valorNum <= 0) {
      setErro("Informe um valor maior que zero.");
      return;
    }

    setEnviando(true);
    try {
      const payload: Record<string, unknown> = {
        tipo,
        valor: valorNum,
        conta_id: contaId,
        categoria_id: categoriaId || null,
        projeto_id: projetoId || null,
      };

      if (isBucket) {
        if (!categoriaId) {
          setErro("Bucket precisa de categoria (ex: Alimentação, Mercado…)");
          setEnviando(false);
          return;
        }
        payload.descricao = descricao || "(bucket sem nome)";
        payload.data_competencia = data;
        payload.frequencia = freqBucket;
      } else if (isDespesa) {
        payload.descricao = descricao || "(sem descrição)";
        payload.data_competencia = data;
        payload.status = status;
        if (isRecorrente) {
          payload.frequencia = frequencia;
          payload.dia_vencimento = diaVencimento;
        }
        if (isParcelada) {
          payload.parcelas = parcelas;
        }
        // Avulsa vinculada a bucket → manda bucket_id (vira recorrencia_id no insert)
        if (tipo === "despesa_avulsa" && bucketId) {
          payload.bucket_id = bucketId;
        }
      } else {
        payload.origem_id =
          origemId || origens.find((o) => o.slug === "manual")?.id || null;
        payload.produto_nome = descricao || null;
        payload.data_venda = `${competencia}-01`;
        payload.status = statusReceita;
        if (statusReceita === "recebido" || dataRecebimento) {
          payload.data_recebimento = dataRecebimento || data;
        }
        if (dataPrevista) {
          payload.data_prevista_pagamento = dataPrevista;
        }
      }

      const res = await fetch("/api/lancar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const out = await res.json();
      if (!res.ok || out.error) {
        throw new Error(out.error || `Erro ${res.status}`);
      }

      setSucesso(out.message ?? `Lançamento de ${formatBRL(valorNum)} criado.`);
      // reset valor + descricao mas mantém contexto
      setValor("");
      setDescricao("");
      router.refresh();
    } catch (err) {
      setErro(err instanceof Error ? err.message : "Erro desconhecido");
    } finally {
      setEnviando(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {/* Tipo selector */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-2">
        {TIPOS.map((t) => {
          const Icon = t.icon;
          const active = tipo === t.id;
          return (
            <button
              type="button"
              key={t.id}
              onClick={() => {
                setTipo(t.id);
                setCategoriaId("");
                setErro(null);
                setSucesso(null);
              }}
              className={cn(
                "text-left rounded-xl border p-3 transition-colors",
                active
                  ? t.side === "despesa"
                    ? "border-negative/60 bg-negative/10"
                    : "border-positive/60 bg-positive/10"
                  : "border-line/60 bg-surface hover:bg-elevated"
              )}
            >
              <Icon
                className={cn(
                  "h-4 w-4 mb-2",
                  t.side === "despesa" ? "text-negative" : "text-positive"
                )}
              />
              <div className="text-sm font-medium">{t.label}</div>
              <div className="text-[11px] text-ink-dim mt-0.5">{t.desc}</div>
            </button>
          );
        })}
      </div>

      {/* Campos comuns */}
      <div className="bg-surface border border-line/60 rounded-2xl p-5 space-y-4">
        <Row label={isDespesa ? "Descrição" : "Produto / cliente (opcional)"}>
          <input
            value={descricao}
            onChange={(e) => setDescricao(e.target.value)}
            placeholder={isDespesa ? "Ex: Aluguel, Spotify, Mercado..." : "Ex: Combo Amamentação"}
            className="w-full bg-bg border border-line rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-lime"
          />
        </Row>

        <div className="grid grid-cols-2 gap-3">
          <Row label={isParcelada ? "Valor total" : "Valor (R$)"}>
            <input
              value={valor}
              onChange={(e) => setValor(e.target.value)}
              inputMode="decimal"
              placeholder="0,00"
              className="w-full bg-bg border border-line rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-lime"
              required
            />
            {isParcelada && parseBRLInput(valor) > 0 && parcelas > 1 && (
              <div className="text-[11px] text-ink-dim mt-1">
                = {parcelas}× {formatBRL(parseBRLInput(valor) / parcelas)}
              </div>
            )}
          </Row>

          <Row label="Conta">
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
          </Row>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Row label="Categoria">
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
          </Row>

          {isDespesa ? (
            <Row
              label={
                isBucket
                  ? "Começa em"
                  : isRecorrente
                    ? "Início"
                    : "Data"
              }
            >
              <input
                type="date"
                value={data}
                onChange={(e) => setData(e.target.value)}
                className="w-full bg-bg border border-line rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-lime"
              />
            </Row>
          ) : (
            <Row label="Competência (mês)">
              <input
                type="month"
                value={competencia}
                onChange={(e) => setCompetencia(e.target.value)}
                className="w-full bg-bg border border-line rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-lime"
              />
            </Row>
          )}
        </div>

        {/* Bucket vinculado (só pra despesa avulsa) */}
        {tipo === "despesa_avulsa" && buckets.length > 0 && (
          <Row label="Vincular a bucket?">
            <div className="space-y-2">
              <select
                value={bucketId}
                onChange={(e) => {
                  const newId = e.target.value;
                  setBucketId(newId);
                  if (newId) {
                    const b = buckets.find((x) => x.id === newId);
                    if (b?.categoria_id) setCategoriaId(b.categoria_id);
                    if (b?.conta_id) setContaId(b.conta_id);
                  }
                }}
                className="w-full bg-bg border border-line rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-lime"
              >
                <option value="">— não vincular —</option>
                {buckets.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.nome} (teto {b.frequencia} R$ {b.valor_padrao.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })})
                  </option>
                ))}
              </select>
              {bucketId && (
                <div className="text-[11px] text-lime bg-lime/10 border border-lime/30 rounded-md px-3 py-2">
                  Esse gasto vai abater do teto do bucket — categoria e conta foram
                  preenchidas automaticamente. Não vai aparecer em duplicidade na lista de
                  avulsas.
                </div>
              )}
            </div>
          </Row>
        )}

        {/* Projeto (central de custo) */}
        <Row label="Projeto (central de custo)">
          <div className="flex flex-wrap gap-2">
            {projetos.map((p) => {
              const active = projetoId === p.id;
              return (
                <button
                  type="button"
                  key={p.id}
                  onClick={() => setProjetoId(p.id)}
                  className={cn(
                    "inline-flex items-center gap-2 text-xs rounded-lg px-3 py-2 border transition-colors",
                    active
                      ? "border-lime/60 bg-lime/15 text-ink"
                      : "border-line bg-bg text-ink-soft hover:bg-elevated"
                  )}
                >
                  <span
                    className="h-2 w-2 rounded-full"
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
                "text-[11px] rounded-lg px-2.5 py-2 border transition-colors",
                projetoId === ""
                  ? "border-line bg-elevated text-ink"
                  : "border-line/40 text-ink-dim hover:bg-elevated"
              )}
              title="Lançamento sem projeto"
            >
              — nenhum —
            </button>
          </div>
        </Row>

        {/* Específicos por tipo */}
        {isRecorrente && (
          <div className="grid grid-cols-2 gap-3">
            <Row label="Frequência">
              <select
                value={frequencia}
                onChange={(e) =>
                  setFrequencia(e.target.value as "mensal" | "semanal" | "quinzenal")
                }
                className="w-full bg-bg border border-line rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-lime"
              >
                <option value="mensal">Mensal</option>
                <option value="quinzenal">Quinzenal</option>
                <option value="semanal">Semanal</option>
              </select>
            </Row>
            {frequencia === "mensal" && (
              <Row label="Dia do vencimento">
                <input
                  type="number"
                  min={1}
                  max={31}
                  value={diaVencimento}
                  onChange={(e) => setDiaVencimento(Number(e.target.value))}
                  className="w-full bg-bg border border-line rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-lime"
                />
              </Row>
            )}
          </div>
        )}

        {isParcelada && (
          <Row label="Número de parcelas">
            <input
              type="number"
              min={2}
              max={48}
              value={parcelas}
              onChange={(e) => setParcelas(Number(e.target.value))}
              className="w-full bg-bg border border-line rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-lime"
            />
          </Row>
        )}

        {isReceita && (
          <div className="grid grid-cols-2 gap-3">
            <Row label="Origem">
              <select
                value={origemId}
                onChange={(e) => setOrigemId(e.target.value)}
                className="w-full bg-bg border border-line rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-lime"
              >
                <option value="">— escolha —</option>
                {origens.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.nome}
                  </option>
                ))}
              </select>
            </Row>
            <Row label="Status">
              <select
                value={statusReceita}
                onChange={(e) =>
                  setStatusReceita(e.target.value as "previsto" | "recebido")
                }
                className="w-full bg-bg border border-line rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-lime"
              >
                <option value="previsto">A receber</option>
                <option value="recebido">Já em caixa</option>
              </select>
            </Row>
            {statusReceita === "previsto" && (
              <Row label="Data prevista do pagamento">
                <input
                  type="date"
                  value={dataPrevista}
                  onChange={(e) => setDataPrevista(e.target.value)}
                  className="w-full bg-bg border border-line rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-lime"
                />
              </Row>
            )}
            {statusReceita === "recebido" && (
              <Row label="Data do recebimento">
                <input
                  type="date"
                  value={dataRecebimento || data}
                  onChange={(e) => setDataRecebimento(e.target.value)}
                  className="w-full bg-bg border border-line rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-lime"
                />
              </Row>
            )}
          </div>
        )}

        {isDespesa && !isRecorrente && !isBucket && (
          <Row label="Status">
            <div className="flex gap-2">
              <Toggle
                active={status === "prevista"}
                label="A pagar"
                onClick={() => setStatus("prevista")}
              />
              <Toggle
                active={status === "paga"}
                label="Já paguei"
                onClick={() => setStatus("paga")}
              />
            </div>
          </Row>
        )}

        {isBucket && (
          <>
            <Row label="Frequência do teto">
              <div className="flex gap-2">
                {(["semanal", "mensal", "bimestral"] as const).map((f) => (
                  <Toggle
                    key={f}
                    active={freqBucket === f}
                    label={f[0].toUpperCase() + f.slice(1)}
                    onClick={() => setFreqBucket(f)}
                  />
                ))}
              </div>
            </Row>

            <div className="text-[11px] text-ink-dim leading-relaxed border border-line/40 rounded-lg p-3 bg-bg/40">
              <strong className="text-lime">Bucket</strong> = teto de gasto por categoria
              num período (semanal, mensal ou bimestral). Não materializa transação — só
              serve de referência. Cada despesa avulsa que você lançar nessa categoria
              conta contra o teto.
            </div>
          </>
        )}
      </div>

      {erro && (
        <div className="flex items-start gap-2 text-sm text-negative bg-negative/10 border border-negative/30 rounded-lg p-3">
          <AlertCircle className="h-4 w-4 mt-0.5" />
          <div>{erro}</div>
        </div>
      )}

      {sucesso && (
        <div className="flex items-start gap-2 text-sm text-positive bg-positive/10 border border-positive/30 rounded-lg p-3">
          <Check className="h-4 w-4 mt-0.5" />
          <div>{sucesso}</div>
        </div>
      )}

      <div className="flex justify-end">
        <button
          type="submit"
          disabled={enviando}
          className="bg-lime text-bg font-semibold rounded-lg px-5 py-2.5 text-sm hover:bg-lime-glow disabled:opacity-60"
        >
          {enviando ? "Salvando..." : "Salvar lançamento"}
        </button>
      </div>
    </form>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="text-[11px] text-ink-soft block mb-1">{label}</label>
      {children}
    </div>
  );
}

function Toggle({
  active,
  label,
  onClick,
}: {
  active: boolean;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "px-3 py-1.5 rounded-lg text-xs border transition-colors",
        active
          ? "bg-lime text-bg border-lime font-semibold"
          : "border-line text-ink-soft hover:bg-elevated"
      )}
    >
      {label}
    </button>
  );
}
