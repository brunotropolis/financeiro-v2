"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import {
  X,
  Upload,
  Sparkles,
  Loader2,
  Check,
  AlertCircle,
  Pencil,
  Image as ImageIcon,
} from "lucide-react";
import { formatBRL, parseBRLInput } from "@/lib/formatters";
import { cn } from "@/lib/utils";

export function GreennModal({ onClose }: { onClose: () => void }) {
  const [tab, setTab] = useState<"manual" | "print">("manual");

  return (
    <div
      className="fixed inset-0 z-50 grid place-items-center bg-black/60 backdrop-blur-sm p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg bg-surface border border-line/60 rounded-2xl p-5"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between mb-4">
          <div>
            <h3 className="text-base font-semibold flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-lime" />
              Atualizar saldo Greenn
            </h3>
            <p className="text-xs text-ink-dim mt-1">
              Salva um snapshot novo com os 3 valores da carteira.
            </p>
          </div>
          <button onClick={onClose} className="text-ink-dim hover:text-ink">
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 mb-4 bg-bg rounded-lg p-1 border border-line/60">
          <TabBtn
            active={tab === "manual"}
            onClick={() => setTab("manual")}
            icon={Pencil}
            label="Digitar valores"
          />
          <TabBtn
            active={tab === "print"}
            onClick={() => setTab("print")}
            icon={ImageIcon}
            label="Colar print"
          />
        </div>

        {tab === "manual" ? <ManualForm onClose={onClose} /> : <PrintForm onClose={onClose} />}
      </div>
    </div>
  );
}

function TabBtn({
  active,
  onClick,
  icon: Icon,
  label,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ElementType;
  label: string;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "flex-1 flex items-center justify-center gap-1.5 text-xs py-1.5 rounded-md transition-colors",
        active ? "bg-lime text-bg font-semibold" : "text-ink-soft hover:text-ink"
      )}
    >
      <Icon className="h-3 w-3" />
      {label}
    </button>
  );
}

function ManualForm({ onClose }: { onClose: () => void }) {
  const router = useRouter();
  const [disponivel, setDisponivel] = useState("");
  const [pendente, setPendente] = useState("");
  const [antecipavel, setAntecipavel] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [sucesso, setSucesso] = useState<string | null>(null);

  async function enviar() {
    setErro(null);
    setSucesso(null);
    const d = parseBRLInput(disponivel);
    const p = parseBRLInput(pendente);
    const a = parseBRLInput(antecipavel);

    if (d === 0 && p === 0 && a === 0) {
      setErro("Preenche pelo menos um valor.");
      return;
    }

    setEnviando(true);
    try {
      const res = await fetch("/api/greenn/manual", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ disponivel: d, pendente: p, antecipavel: a }),
      });
      const out = await res.json();
      if (!res.ok || out.error) throw new Error(out.error || `Erro ${res.status}`);
      setSucesso(
        `Snapshot salvo: ${formatBRL(d)} em caixa · ${formatBRL(p)} a receber · ${formatBRL(a)} antecipável`
      );
      setTimeout(() => {
        onClose();
        router.refresh();
      }, 1200);
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Erro");
    } finally {
      setEnviando(false);
    }
  }

  return (
    <>
      <div className="text-[11px] text-ink-dim mb-3">
        Abre o{" "}
        <a
          href="https://adm.greenn.com.br/extrato"
          target="_blank"
          rel="noreferrer"
          className="underline text-lime"
        >
          extrato Greenn
        </a>{" "}
        e copia os 3 valores da seção "Minha carteira".
      </div>

      <div className="space-y-3 mb-4">
        <Field
          label="Em caixa (disponível)"
          hint="Saldo liberado pra saque"
          value={disponivel}
          onChange={setDisponivel}
        />
        <Field
          label="A receber (pendente)"
          hint="Vendas em hold que vão liberar"
          value={pendente}
          onChange={setPendente}
        />
        <Field
          label="Antecipável"
          hint="Subset do pendente que pode ser antecipado"
          value={antecipavel}
          onChange={setAntecipavel}
        />
      </div>

      {erro && (
        <div className="flex items-start gap-2 text-xs text-negative bg-negative/10 border border-negative/30 rounded-lg p-3 mb-3">
          <AlertCircle className="h-3.5 w-3.5 mt-0.5" /> {erro}
        </div>
      )}
      {sucesso && (
        <div className="flex items-start gap-2 text-xs text-positive bg-positive/10 border border-positive/30 rounded-lg p-3 mb-3">
          <Check className="h-3.5 w-3.5 mt-0.5" /> {sucesso}
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
          disabled={enviando}
          className="text-xs bg-lime text-bg font-semibold rounded-lg px-4 py-2 hover:bg-lime-glow disabled:opacity-60 inline-flex items-center gap-1.5"
        >
          {enviando && <Loader2 className="h-3 w-3 animate-spin" />}
          {enviando ? "Salvando..." : "Salvar snapshot"}
        </button>
      </div>
    </>
  );
}

function Field({
  label,
  hint,
  value,
  onChange,
}: {
  label: string;
  hint: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div>
      <label className="text-[11px] text-ink-soft block">{label}</label>
      <div className="text-[10px] text-ink-dim mb-1">{hint}</div>
      <div className="relative">
        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-dim text-xs">
          R$
        </span>
        <input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          inputMode="decimal"
          placeholder="0,00"
          className="w-full bg-bg border border-line rounded-lg pl-9 pr-3 py-2 text-sm focus:outline-none focus:border-lime"
        />
      </div>
    </div>
  );
}

function PrintForm({ onClose }: { onClose: () => void }) {
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
    reader.onload = () => setPreview(reader.result as string);
    reader.readAsDataURL(file);
  }

  async function handlePaste(e: React.ClipboardEvent) {
    const item = [...e.clipboardData.items].find((i) => i.type.startsWith("image/"));
    if (item) {
      const f = item.getAsFile();
      if (f) handleFile(f);
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
      if (!res.ok || out.error) throw new Error(out.error || `Erro ${res.status}`);
      setSucesso(
        `Atualizado: ${formatBRL(out.disponivel)} em caixa · ${formatBRL(out.pendente)} pendente · ${formatBRL(out.antecipavel)} antecipável`
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
    <div onPaste={handlePaste} tabIndex={0}>
      <div className="text-[11px] text-ink-dim mb-3">
        Tira print da seção "Minha carteira" do{" "}
        <a
          href="https://adm.greenn.com.br/extrato"
          target="_blank"
          rel="noreferrer"
          className="underline text-lime"
        >
          extrato Greenn
        </a>{" "}
        e cola aqui (Ctrl+V).
      </div>

      {preview ? (
        <div className="relative mb-4">
          {/* eslint-disable-next-line @next/next/no-img-element */}
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
          <AlertCircle className="h-3.5 w-3.5 mt-0.5" /> {erro}
        </div>
      )}
      {sucesso && (
        <div className="flex items-start gap-2 text-xs text-positive bg-positive/10 border border-positive/30 rounded-lg p-3 mb-3">
          <Check className="h-3.5 w-3.5 mt-0.5" /> {sucesso}
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
          {enviando ? "Lendo..." : "Ler print"}
        </button>
      </div>
    </div>
  );
}
