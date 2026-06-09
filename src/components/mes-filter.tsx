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
    .toLocaleDateString("pt-BR", { month: "long", year: "numeric" })
    .replace(/^./, (c) => c.toUpperCase());
}

/**
 * Filtro de mês — destacado em lime. Reusado em /despesas e /receitas.
 * Recebe `basePath` (ex: "/despesas?tab=avulsas") — o param `m` é appendado/substituído.
 */
export function MesFilter({
  mes,
  basePath,
}: {
  mes: string;
  basePath: string;
}) {
  const router = useRouter();

  function go(novoMes: string) {
    const url = new URL(`${basePath}`, "http://x");
    url.searchParams.set("m", novoMes);
    router.push(`${url.pathname}${url.search}`);
  }

  return (
    <div className="inline-flex items-center gap-2">
      <button
        onClick={() => go(shiftMonth(mes, -1))}
        className="h-10 w-10 rounded-lg bg-surface border border-line/60 hover:border-lime/60 hover:bg-elevated text-ink-soft hover:text-ink transition-colors grid place-items-center"
        title="Mês anterior"
      >
        <ChevronLeft className="h-4 w-4" />
      </button>

      <label className="relative inline-flex items-center gap-2 h-10 px-4 rounded-lg bg-lime/15 border border-lime/50 cursor-pointer hover:bg-lime/20 transition-colors">
        <Calendar className="h-4 w-4 text-lime" />
        <span className="text-sm font-semibold text-lime select-none">{fmtLabel(mes)}</span>
        <input
          type="month"
          value={mes}
          onChange={(e) => go(e.target.value)}
          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
        />
      </label>

      <button
        onClick={() => go(shiftMonth(mes, 1))}
        className="h-10 w-10 rounded-lg bg-surface border border-line/60 hover:border-lime/60 hover:bg-elevated text-ink-soft hover:text-ink transition-colors grid place-items-center"
        title="Próximo mês"
      >
        <ChevronRight className="h-4 w-4" />
      </button>
    </div>
  );
}
