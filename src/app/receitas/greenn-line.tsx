"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { RefreshCw, X, Upload, Sparkles, Loader2, Check, AlertCircle } from "lucide-react";
import { formatBRL } from "@/lib/formatters";

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

      {open && <PasteModal onClose={() => setOpen(false)} />}
    </>
  );
}

function PasteModal({ onClose }: { onClose: () => void }) {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [sucesso, setSucesso] = useState<string | null>(null);
  const [preview, setPreview] = useState<string | null>(null);

  function handleFile(file: File) {
    setErro(null);
    setSucesso(null);
    const reader = new FileReader();
    reader.onload = () => {
      setPreview(reader.result as string);
    };
    reader.readAsDataURL(file);
  }

  async function handlePaste(e: React.ClipboardEvent) {
    const item = [...e.clipboardData.items].find((i) => i.type.startsWith("image/"));
    if (item) {
      const file = item.getAsFile();
      if (file) handleFile(file);
    }
  }

  async function enviar() {
    if (!preview) {
      setErro("Cola um print ou seleciona um arquivo");
      return;
    }
    setEnviando(true);
    setErro(null);
    try {
      const mediaTypeMatch = preview.match(/^data:(image\/\w+);base64,/);
      const mediaType = mediaTypeMatch?.[1] ?? "image/png";
      const res = await fetch("/api/greenn/parse-saldo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ image: preview, media_type: mediaType }),
      });
      const out = await res.json();
      if (!res.ok || out.error) {
        throw new Error(out.error || `Erro ${res.status}`);
      }
      setSucesso(
        `Atualizado: em caixa ${formatBRL(out.disponivel)}, pendente ${formatBRL(out.pendente)}, antecipável ${formatBRL(out.antecipavel)}.`
      );
      setTimeout(() => {
        onClose();
        router.refresh();
      }, 1500);
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Erro");
    } finally {
      setEnviando(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 grid place-items-center bg-black/60 backdrop-blur-sm p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg bg-surface border border-line/60 rounded-2xl p-5"
        onClick={(e) => e.stopPropagation()}
        onPaste={handlePaste}
        tabIndex={0}
      >
        <div className="flex items-start justify-between mb-4">
          <div>
            <h3 className="text-base font-semibold flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-lime" />
              Atualizar saldo Greenn
            </h3>
            <p className="text-xs text-ink-dim mt-1">
              Tira print da seção "Minha carteira" do{" "}
              <a
                href="https://adm.greenn.com.br/extrato"
                target="_blank"
                rel="noreferrer"
                className="underline text-lime"
              >
                adm.greenn.com.br/extrato
              </a>{" "}
              e cola aqui (Ctrl+V) ou faz upload.
            </p>
          </div>
          <button onClick={onClose} className="text-ink-dim hover:text-ink">
            <X className="h-4 w-4" />
          </button>
        </div>

        {preview ? (
          <div className="relative mb-4">
            <img
              src={preview}
              alt="preview"
              className="w-full max-h-72 object-contain rounded-lg border border-line/60 bg-bg"
            />
            <button
              onClick={() => setPreview(null)}
              className="absolute top-2 right-2 bg-bg/80 hover:bg-bg border border-line rounded-md p-1"
            >
              <X className="h-3 w-3" />
            </button>
          </div>
        ) : (
          <div
            onClick={() => fileRef.current?.click()}
            className="rounded-lg border border-dashed border-line/60 hover:border-lime/60 hover:bg-lime/[0.04] grid place-items-center text-center py-10 cursor-pointer mb-4 transition-colors"
          >
            <Upload className="h-5 w-5 text-ink-dim mb-2" />
            <div className="text-sm text-ink-soft">Cola aqui (Ctrl+V) ou clica pra enviar</div>
            <div className="text-[11px] text-ink-dim mt-1">PNG/JPG do extrato Greenn</div>
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) handleFile(f);
              }}
            />
          </div>
        )}

        {erro && (
          <div className="flex items-start gap-2 text-xs text-negative bg-negative/10 border border-negative/30 rounded-lg p-3 mb-3">
            <AlertCircle className="h-3.5 w-3.5 mt-0.5" />
            <div>{erro}</div>
          </div>
        )}

        {sucesso && (
          <div className="flex items-start gap-2 text-xs text-positive bg-positive/10 border border-positive/30 rounded-lg p-3 mb-3">
            <Check className="h-3.5 w-3.5 mt-0.5" />
            <div>{sucesso}</div>
          </div>
        )}

        <div className="flex justify-end gap-2">
          <button
            onClick={onClose}
            className="text-xs px-3 py-2 rounded-lg border border-line text-ink-soft hover:bg-elevated"
          >
            Cancelar
          </button>
          <button
            onClick={enviar}
            disabled={!preview || enviando}
            className="text-xs bg-lime text-bg font-semibold rounded-lg px-4 py-2 hover:bg-lime-glow disabled:opacity-60 inline-flex items-center gap-1.5"
          >
            {enviando && <Loader2 className="h-3 w-3 animate-spin" />}
            {enviando ? "Lendo..." : "Atualizar"}
          </button>
        </div>
      </div>
    </div>
  );
}
