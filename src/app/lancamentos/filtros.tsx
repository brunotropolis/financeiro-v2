"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { CONTAS_ATIVAS } from "@/lib/constants";

export function LancamentosFiltros({
  periodo,
  conta,
  tipo,
}: {
  periodo: string;
  conta: string;
  tipo: string;
}) {
  const router = useRouter();
  const params = useSearchParams();

  function update(key: string, value: string) {
    const sp = new URLSearchParams(params.toString());
    sp.set(key, value);
    router.push(`/lancamentos?${sp.toString()}`);
  }

  return (
    <div className="flex flex-wrap gap-2">
      <Select value={periodo} onChange={(v) => update("p", v)}>
        <option value="mes">Mês atual</option>
        <option value="3m">Últimos 3 meses</option>
        <option value="futuro">Próximos meses</option>
        <option value="tudo">Tudo (6m)</option>
      </Select>

      <Select value={conta} onChange={(v) => update("conta", v)}>
        <option value="todas">Todas contas</option>
        {CONTAS_ATIVAS.map((c) => (
          <option key={c.id} value={c.id}>
            {c.nome}
          </option>
        ))}
      </Select>

      <Select value={tipo} onChange={(v) => update("tipo", v)}>
        <option value="todos">Tudo</option>
        <option value="despesa">Despesas</option>
        <option value="receita">Receitas</option>
      </Select>
    </div>
  );
}

function Select({
  value,
  onChange,
  children,
}: {
  value: string;
  onChange: (v: string) => void;
  children: React.ReactNode;
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="bg-surface border border-line/60 rounded-lg px-3 py-1.5 text-xs text-ink focus:outline-none focus:border-lime"
    >
      {children}
    </select>
  );
}
