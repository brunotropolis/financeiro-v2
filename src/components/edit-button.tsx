"use client";

import { useState } from "react";
import { Pencil } from "lucide-react";
import { EditEntryModal, type EditableEntry, type OrigemOpt } from "@/components/edit-entry-modal";

type Categoria = { id: string; nome: string };
type Projeto = { id: string; nome: string; cor: string | null };

export function EditButton({
  entry,
  categorias,
  projetos,
  origens,
  compact,
}: {
  entry: EditableEntry;
  categorias: Categoria[];
  projetos: Projeto[];
  origens?: OrigemOpt[];
  compact?: boolean;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        onClick={() => setOpen(true)}
        title="Editar"
        className={
          compact
            ? "h-7 w-7 rounded-md grid place-items-center hover:bg-elevated text-ink-soft hover:text-ink"
            : "inline-flex items-center gap-1 text-[11px] text-ink-soft hover:text-ink border border-line rounded-md px-2 py-1 hover:bg-elevated"
        }
      >
        <Pencil className="h-3.5 w-3.5" />
        {!compact && <span>Editar</span>}
      </button>
      {open && (
        <EditEntryModal
          entry={entry}
          categorias={categorias}
          projetos={projetos}
          origens={origens}
          onClose={() => setOpen(false)}
        />
      )}
    </>
  );
}
