"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Power, Loader2 } from "lucide-react";

export function RecorrenteToggle({ id, ativo }: { id: string; ativo: boolean }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function toggle() {
    setLoading(true);
    try {
      const res = await fetch(`/api/recorrentes/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ativo: !ativo }),
      });
      if (!res.ok) {
        const out = await res.json().catch(() => ({}));
        alert(out.error ?? `Erro ${res.status}`);
        return;
      }
      router.refresh();
    } finally {
      setLoading(false);
    }
  }

  return (
    <button
      onClick={toggle}
      disabled={loading}
      title={ativo ? "Pausar recorrência" : "Reativar"}
      className="h-7 w-7 rounded-md grid place-items-center hover:bg-elevated text-ink-soft disabled:opacity-40"
    >
      {loading ? (
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
      ) : (
        <Power className={`h-3.5 w-3.5 ${ativo ? "text-positive" : "text-ink-dim"}`} />
      )}
    </button>
  );
}
