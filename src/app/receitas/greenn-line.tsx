"use client";

import { useState } from "react";
import { RefreshCw } from "lucide-react";
import { formatBRL } from "@/lib/formatters";
import { GreennModal } from "@/components/greenn-modal";

export function GreennLine({
  disponivel,
  pendente,
  antecipavel,
  capturadoEm,
}: {
  disponivel: number;
  pendente: number;
  antecipavel: number;
  capturadoEm: string | null;
}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <div className="border-b border-line/40 px-4 py-3 grid grid-cols-12 gap-2 text-sm bg-lime/[0.04] hover:bg-lime/[0.08]">
        <div className="col-span-3 min-w-0">
          <div className="flex items-center gap-1.5">
            <span className="h-1.5 w-1.5 rounded-full bg-lime shadow-[0_0_8px_#c5f02c]" />
            <span className="font-semibold text-lime">Saldo Greenn</span>
            <span className="text-[9px] bg-lime/15 text-lime border border-lime/30 rounded px-1.5 py-0.5 uppercase tracking-wider">
              fixo
            </span>
          </div>
          <div className="text-[10px] text-ink-dim mt-0.5">
            {capturadoEm
              ? `snapshot ${new Date(capturadoEm).toLocaleDateString("pt-BR")}`
              : "sem snapshot ainda"}
          </div>
        </div>
        <div className="col-span-2 text-ink-soft text-xs flex items-center">—</div>
        <div className="col-span-2 text-right">
          <div className="text-[10px] text-ink-dim">A receber</div>
          <div className="font-semibold text-amber-400">{formatBRL(disponivel + pendente)}</div>
        </div>
        <div className="col-span-2 text-right">
          <div className="text-[10px] text-ink-dim">Em caixa</div>
          <div className="font-semibold text-positive">{formatBRL(disponivel)}</div>
        </div>
        <div className="col-span-3 flex items-center gap-2">
          <span className="text-[10px] text-ink-dim">
            antecipável {formatBRL(antecipavel)}
          </span>
          <button
            onClick={() => setOpen(true)}
            className="ml-auto text-[11px] text-bg bg-lime rounded-md px-2 py-1 inline-flex items-center gap-1 hover:bg-lime-glow font-semibold"
          >
            <RefreshCw className="h-3 w-3" /> Atualizar
          </button>
        </div>
      </div>

      {open && <GreennModal onClose={() => setOpen(false)} />}
    </>
  );
}
