"use client";

import { useState } from "react";
import { GreennModal } from "@/components/greenn-modal";

export function GreennUpdateButton({
  className,
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button onClick={() => setOpen(true)} className={className}>
        {children}
      </button>
      {open && <GreennModal onClose={() => setOpen(false)} />}
    </>
  );
}
