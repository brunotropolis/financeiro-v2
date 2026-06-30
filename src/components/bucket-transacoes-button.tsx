"use client";

import { useState } from "react";
import { Eye, X } from "lucide-react";
import { formatBRL, formatDate } from "@/lib/formatters";
import { EditButton } from "@/components/edit-button";

type Categoria = { id: string; nome: string };
type Projeto = { id: string; nome: string; cor: string | null };

type TxDoBucket = {
  id: string;
  descricao: string;
  valor: number;
  data_competencia: string;
  status: string;
  conta_id: string | null;
  categoria_id: string | null;
  projeto_id: string | null;
};

export function BucketTransacoesButton({
  bucketId,
  bucketNome,
  transacoes,
  categorias,
  projetos,
}: {
  bucketId: string;
  bucketNome: string;
  transacoes: TxDoBucket[];
  categorias: Categoria[];
  projetos: Projeto[];
}) {
  const [open, setOpen] = useState(false);
  const count = transacoes.length;

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="text-[11px] text-lime hover:text-lime-glow inline-flex items-center gap-1"
      >
        <Eye className="h-3 w-3" />
        Ver {count} {count === 1 ? "lançamento" : "lançamentos"}
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 grid place-items-center bg-black/60 backdrop-blur-sm p-4"
          onClick={() => setOpen(false)}
        >
          <div
            className="w-full max-w-2xl bg-surface border border-line/60 rounded-2xl p-5 max-h-[85vh] flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between mb-4">
              <div>
                <h3 className="text-base font-semibold">Lançamentos no bucket</h3>
                <p className="text-xs text-ink-dim mt-1">
                  <strong>{bucketNome}</strong> · {count} despesa{count !== 1 ? "s" : ""} vinculada{count !== 1 ? "s" : ""} no mês
                </p>
              </div>
              <button onClick={() => setOpen(false)} className="text-ink-dim hover:text-ink">
                <X className="h-4 w-4" />
              </button>
            </div>

            {transacoes.length === 0 ? (
              <div className="text-sm text-ink-dim text-center py-8">
                Nenhum lançamento vinculado a esse bucket ainda. Vai em <strong>/lancar</strong> →
                Despesa avulsa → seleciona esse bucket no &quot;Vincular a bucket?&quot;.
              </div>
            ) : (
              <div className="overflow-y-auto flex-1 -mx-5 px-5">
                <table className="w-full text-sm">
                  <thead className="sticky top-0 bg-surface">
                    <tr className="border-b border-line/60 text-[11px] text-ink-dim uppercase tracking-wider">
                      <th className="text-left py-2 font-medium">Data</th>
                      <th className="text-left py-2 font-medium">Descrição</th>
                      <th className="text-left py-2 font-medium">Status</th>
                      <th className="text-right py-2 font-medium">Valor</th>
                      <th className="text-right py-2 font-medium">Ações</th>
                    </tr>
                  </thead>
                  <tbody>
                    {transacoes.map((t) => (
                      <tr key={t.id} className="border-b border-line/40 last:border-0">
                        <td className="py-3 text-ink-soft whitespace-nowrap">
                          {formatDate(t.data_competencia)}
                        </td>
                        <td className="py-3">
                          <div className="font-medium">{t.descricao}</div>
                        </td>
                        <td className="py-3">
                          <span
                            className={`text-[10px] uppercase tracking-wider rounded px-1.5 py-0.5 ${
                              t.status === "paga" || t.status === "confirmada"
                                ? "bg-positive/15 text-positive"
                                : "bg-elevated text-ink-soft border border-line"
                            }`}
                          >
                            {t.status}
                          </span>
                        </td>
                        <td className="py-3 text-right font-semibold text-negative whitespace-nowrap">
                          −{formatBRL(t.valor)}
                        </td>
                        <td className="py-3 text-right">
                          <EditButton
                            compact
                            entry={{
                              kind: "transacao",
                              id: t.id,
                              descricao: t.descricao,
                              valor: t.valor,
                              conta_id: t.conta_id,
                              categoria_id: t.categoria_id,
                              projeto_id: t.projeto_id,
                              data_competencia: t.data_competencia,
                              status: t.status,
                              recorrencia_id: bucketId,
                            }}
                            categorias={categorias}
                            projetos={projetos}
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot className="sticky bottom-0 bg-surface">
                    <tr className="border-t-2 border-line/60">
                      <td colSpan={3} className="py-3 text-sm font-medium text-ink-soft">
                        Total utilizado
                      </td>
                      <td className="py-3 text-right text-base font-bold text-lime">
                        {formatBRL(transacoes.reduce((s, t) => s + t.valor, 0))}
                      </td>
                      <td></td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}

            <div className="flex justify-end mt-4 pt-3 border-t border-line/40">
              <button
                onClick={() => setOpen(false)}
                className="text-xs px-3 py-2 rounded-lg border border-line text-ink-soft hover:bg-elevated"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
