"use client";

import Link from "next/link";
import { cn } from "@/lib/utils";

const TABS = [
  { id: "faturamento", label: "Faturamento" },
  { id: "caixa", label: "Caixa" },
];

export function ReceitasTabs({ current, mes }: { current: string; mes: string }) {
  return (
    <div className="flex gap-1 bg-surface border border-line/60 rounded-lg p-1 w-fit">
      {TABS.map((t) => {
        const active = current === t.id;
        return (
          <Link
            key={t.id}
            href={`/receitas?tab=${t.id}&m=${mes}`}
            className={cn(
              "text-xs px-4 py-2 rounded-md transition-colors",
              active
                ? "bg-lime text-bg font-semibold"
                : "text-ink-soft hover:text-ink hover:bg-elevated"
            )}
          >
            {t.label}
          </Link>
        );
      })}
    </div>
  );
}
