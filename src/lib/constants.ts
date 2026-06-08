/**
 * As 3 contas que esse painel acompanha. Hardcoded por design.
 * entidade_id é necessário pra inserir transação/recorrencia.
 */
export const CONTAS_ATIVAS = [
  {
    id: "d6873ac0-52e3-4647-af2b-cdd1fa32e787",
    nome: "Manual RN",
    apelido: "Unicred",
    cor: "#c5f02c",
    entidade_id: "f587e50f-eb39-45e1-b748-fb191a8bcb3f",
  },
  {
    id: "e4598c53-6282-4b62-8551-9b228265230d",
    nome: "Dream Baby",
    apelido: "Unicred",
    cor: "#34d399",
    entidade_id: "dff3c509-c4c7-4035-915d-3a7400c0e279",
  },
  {
    id: "2bf03aa5-f7cc-466c-9a3f-a85bcb9d7e88",
    nome: "Conta Simples",
    apelido: "MRN Serviços",
    cor: "#60a5fa",
    entidade_id: "83ecce91-47ae-479b-bb90-7baa711fb339",
  },
] as const;

export const CONTAS_ATIVAS_IDS = CONTAS_ATIVAS.map((c) => c.id);

export function entidadeDeConta(contaId: string): string | null {
  return CONTAS_ATIVAS.find((c) => c.id === contaId)?.entidade_id ?? null;
}
