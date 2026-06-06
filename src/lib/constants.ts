/**
 * As 3 contas que esse painel acompanha. Hardcoded por design — Bruno disse
 * que só usa essas no dia-a-dia. O resto fica fora do v2 (ainda existe no v1).
 */
export const CONTAS_ATIVAS = [
  {
    id: "d6873ac0-52e3-4647-af2b-cdd1fa32e787",
    nome: "Manual RN",
    apelido: "Unicred",
    cor: "#c5f02c",
  },
  {
    id: "e4598c53-6282-4b62-8551-9b228265230d",
    nome: "Dream Baby",
    apelido: "Unicred",
    cor: "#34d399",
  },
  {
    id: "2bf03aa5-f7cc-466c-9a3f-a85bcb9d7e88",
    nome: "Conta Simples",
    apelido: "MRN Serviços",
    cor: "#60a5fa",
  },
] as const;

export const CONTAS_ATIVAS_IDS = CONTAS_ATIVAS.map((c) => c.id);
