"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Lock, Unlock, Loader2, Check } from "lucide-react";

export function FecharMesButton({
  mesIso,
  fechado,
  disabled,
}: {
  mesIso: string;
  fechado: boolean;
  disabled?: boolean;
}) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [ok, setOk] = useState(false);

  if (disabled) {
    return <span className="text-[9px] text-ink-dim">—</span>;
  }

  async function fechar() {
    setSaving(true);
    try {
      const res = await fetch("/api/faturamento/fechar-mes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mes_referencia: mesIso }),
      });
      const out = await res.json();
      if (!res.ok || out.error) {
        alert(out.error ?? `Erro ${res.status}`);
        return;
      }
      setOk(true);
      setTimeout(() => {
        setOk(false);
        router.refresh();
      }, 1200);
    } finally {
      setSaving(false);
    }
  }

  if (ok) {
    return (
      <span className="inline-flex items-center gap-1 text-[10px] text-positive">
        <Check className="h-3 w-3" /> ok
      </span>
    );
  }

  return (
    <button
      onClick={fechar}
      disabled={saving}
      className={`inline-flex items-center gap-1 text-[10px] rounded px-2 py-0.5 border transition-colors ${
        fechado
          ? "border-lime/40 text-lime hover:bg-lime/10"
          : "border-line text-ink-soft hover:text-ink hover:bg-elevated"
      } disabled:opacity-50`}
      title={fechado ? "Re-fechar (atualizar snapshot)" : "Fechar e congelar valores do mês"}
    >
      {saving ? (
        <Loader2 className="h-3 w-3 animate-spin" />
      ) : fechado ? (
        <Lock className="h-3 w-3" />
      ) : (
        <Unlock className="h-3 w-3" />
      )}
      {fechado ? "fechado" : "fechar"}
    </button>
  );
}
