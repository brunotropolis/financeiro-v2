"use client";

import { useState } from "react";
import { Bookmark, Check, MousePointer } from "lucide-react";

export function BookmarkletBox({ href }: { href: string }) {
  const [copied, setCopied] = useState(false);

  async function copyToClipboard() {
    try {
      await navigator.clipboard.writeText(href);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      alert("Não consegui copiar. Arrasta o botão direto pra barra de favoritos.");
    }
  }

  return (
    <div>
      <div className="flex items-center gap-3 mb-2">
        {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
        <a
          href={href}
          onClick={(e) => e.preventDefault()}
          draggable
          className="inline-flex items-center gap-2 bg-lime text-bg font-semibold rounded-lg px-4 py-2.5 text-sm hover:bg-lime-glow cursor-grab active:cursor-grabbing select-none"
          title="Arrasta pra barra de favoritos"
        >
          <Bookmark className="h-4 w-4" />
          Sync Greenn
        </a>
        <button
          onClick={copyToClipboard}
          className="text-[11px] text-ink-soft hover:text-ink border border-line rounded-lg px-2.5 py-1.5"
        >
          {copied ? (
            <span className="inline-flex items-center gap-1 text-positive">
              <Check className="h-3 w-3" /> Copiado
            </span>
          ) : (
            "Copiar URL"
          )}
        </button>
      </div>
      <div className="flex items-start gap-1.5 text-[10px] text-ink-dim">
        <MousePointer className="h-3 w-3 mt-0.5 shrink-0" />
        <span>
          Arrasta o botão lime acima até a barra de favoritos do Chrome. Se não conseguir,
          clica em &quot;Copiar URL&quot; e cria um favorito novo manualmente colando o URL no
          campo de endereço.
        </span>
      </div>
    </div>
  );
}
