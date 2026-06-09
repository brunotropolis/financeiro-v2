"use client";

import { useRouter } from "next/navigation";
import { ChevronLeft, ChevronRight, Calendar } from "lucide-react";

function shiftMonth(mesIso: string, delta: number): string {
  const [y, m] = mesIso.split("-").map(Number);
  const d = new Date(y, m - 1 + delta, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function fmtLabel(mesIso: string): string {
  const [y, m] = mesIso.split("-").map(Number);
  const d = new Date(y, m - 1, 1);
  return d
    .toLocaleDateString("pt-BR", { month: "short", year: "2-digit" })
    .replace(".", "")
    .replace(/^./, (c) => c.toUpperCase());
}

export function MesFilter({ mes, tab }: { mes: string; tab: string }) {
  const router = useRouter();
  function go(novoMes: string) {
    router.push(`/despesas?tab=${tab}&m=${novoMes}`);
  }

  return (
    <div className="flex items-center gap-1 bg-surface border border-line/60 rounded-lg overflow-hidden">
      <button
        onClick={() => go(shiftMonth(mes, -1))}
        className="px-2 py-1.5 text-ink-soft hover:text-ink hover:bg-elevated"
        title="Mês anterior"
      >
        <ChevronLeft className="h-3.5 w-3.5" />
      </button>
      <div className="flex items-center gap-1.5 px-2 py-1.5 text-xs">
        <Calendar className="h-3 w-3 text-ink-dim" />
        <input
          type="month"
          value={mes}
          onChange={(e) => go(e.target.value)}
          className="bg-transparent border-0 outline-none text-ink font-medium w-20 cursor-pointer"
        />
        <span className="text-ink-dim text-[10px] hidden sm:inline">({fmtLabel(mes)})</span>
      </div>
      <button
        onClick={() => go(shiftMonth(mes, 1))}
        className="px-2 py-1.5 text-ink-soft hover:text-ink hover:bg-elevated"
        title="Próximo mês"
      >
        <ChevronRight className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}
