export function formatBRL(valor: number | string | null | undefined): string {
  if (valor === null || valor === undefined) return "—";
  const n = typeof valor === "string" ? parseFloat(valor) : valor;
  if (Number.isNaN(n)) return "—";
  return n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export function formatBRLCompact(valor: number | string | null | undefined): string {
  if (valor === null || valor === undefined) return "—";
  const n = typeof valor === "string" ? parseFloat(valor) : valor;
  if (Number.isNaN(n)) return "—";
  if (Math.abs(n) >= 1_000_000) return `R$ ${(n / 1_000_000).toFixed(1).replace(".", ",")}M`;
  if (Math.abs(n) >= 1_000) return `R$ ${(n / 1_000).toFixed(1).replace(".", ",")}k`;
  return formatBRL(n);
}

export function formatDate(date: string | null | undefined): string {
  if (!date) return "—";
  return new Date(date).toLocaleDateString("pt-BR");
}

/** Parse flexível BR: "1234,56" / "1.234,56" / "1234.56" → number, 0 se inválido */
export function parseBRLInput(input: string | number | null | undefined): number {
  if (input === null || input === undefined) return 0;
  if (typeof input === "number") return Number.isFinite(input) ? input : 0;
  const s = String(input).replace(/[^\d.,-]/g, "");
  if (!s) return 0;
  if (s.includes(",")) {
    const n = parseFloat(s.replace(/\./g, "").replace(",", "."));
    return Number.isFinite(n) ? n : 0;
  }
  const dots = (s.match(/\./g) ?? []).length;
  if (dots === 1) {
    const [, dec] = s.split(".");
    if (dec.length <= 2) {
      const n = parseFloat(s);
      return Number.isFinite(n) ? n : 0;
    }
  }
  const n = parseFloat(s.replace(/\./g, ""));
  return Number.isFinite(n) ? n : 0;
}
