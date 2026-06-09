"use client";

import { useState } from "react";
import { Copy, Check } from "lucide-react";

export function BookmarkletBox({ href }: { href: string }) {
  const [copied, setCopied] = useState(false);

  async function copyToClipboard() {
    try {
      await navigator.clipboard.writeText(href);
      setCopied(true);
      setTimeout(() => setCopied(false), 3000);
    } catch {
      // fallback: select all + copy
      const ta = document.getElementById("bookmarklet-code") as HTMLTextAreaElement | null;
      if (ta) {
        ta.select();
        document.execCommand("copy");
        setCopied(true);
        setTimeout(() => setCopied(false), 3000);
      }
    }
  }

  return (
    <div>
      <button
        onClick={copyToClipboard}
        className={`w-full inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-semibold transition-colors ${
          copied
            ? "bg-positive/15 text-positive border border-positive/40"
            : "bg-lime text-bg hover:bg-lime-glow"
        }`}
      >
        {copied ? (
          <>
            <Check className="h-4 w-4" />
            Copiado! Cola no campo URL ao criar o favorito.
          </>
        ) : (
          <>
            <Copy className="h-4 w-4" />
            Copiar código do favorito
          </>
        )}
      </button>

      <details className="mt-2">
        <summary className="text-[10px] text-ink-dim cursor-pointer hover:text-ink-soft">
          Ver código (avançado)
        </summary>
        <textarea
          id="bookmarklet-code"
          readOnly
          value={href}
          rows={3}
          className="mt-2 w-full bg-bg border border-line rounded-lg p-2 text-[10px] font-mono text-ink-soft resize-none"
          onClick={(e) => (e.target as HTMLTextAreaElement).select()}
        />
      </details>
    </div>
  );
}
