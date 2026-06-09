"use client";

import { useRouter } from "next/navigation";
import { ChevronLeft, ChevronRight } from "lucide-react";

function shiftMonth(mesIso: string, delta: number): string {
  const [y, m] = mesIso.split("-").map(Number);
  const d = new Date(y, m - 1 + delta, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function fmt(mesIso: string): string {
  const [y, m] = mesIso.split("-").map(Number);
  const d = new Date(y, m - 1, 1);
  return d
    .toLocaleDateString("pt-BR", { month: "short", year: "2-digit" })
    .replace(".", "")
    .replace(/^./, (c) => c.toUpperCase());
}

export function HistoricoNav({ ate }: { ate: string }) {
  const router = useRouter();
  function go(novoAte: string) {
    router.push(`/historico?ate=${novoAte}`);
  }
  return (
    <div className="inline-flex items-center gap-2">
      <button
        onClick={() => go(shiftMonth(ate, -4))}
        className="h-10 px-3 rounded-lg bg-surface border border-line/60 hover:border-lime/60 hover:bg-elevated text-ink-soft hover:text-ink transition-colors inline-flex items-center gap-1 text-xs"
        title="4 meses antes"
      >
        <ChevronLeft className="h-3.5 w-3.5" />
        4 antes
      </button>
      <div className="inline-flex items-center gap-2 h-10 px-4 rounded-lg bg-lime/15 border border-lime/50 text-sm font-semibold text-lime">
        até {fmt(ate)}
      </div>
      <button
        onClick={() => go(shiftMonth(ate, 4))}
        className="h-10 px-3 rounded-lg bg-surface border border-line/60 hover:border-lime/60 hover:bg-elevated text-ink-soft hover:text-ink transition-colors inline-flex items-center gap-1 text-xs"
        title="4 meses depois"
      >
        4 depois
        <ChevronRight className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}
