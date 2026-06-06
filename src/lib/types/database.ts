/**
 * Minimal types pro v2. Apenas o subset de tabelas que esse painel lê.
 * Estrutura completa (Row/Insert/Update + Views/Enums/CompositeTypes) é
 * obrigatória senão o Supabase SSR infere queries como `never`.
 */

type EmptyObj = Record<string, never>;

type Row<T> = {
  Row: T;
  Insert: Partial<T>;
  Update: Partial<T>;
  Relationships: [];
};

export type Database = {
  public: {
    Tables: {
      contas_bancarias: Row<{
        id: string;
        nome: string;
        tipo: string;
        saldo_atual: number | string;
        entidade_id: string | null;
        ativo: boolean;
      }>;
      receitas_brutas: Row<{
        id: string;
        valor_bruto: number | string;
        valor_liquido: number | string;
        taxas: number | string | null;
        status: string;
        data_venda: string;
        data_recebimento: string | null;
        data_prevista_pagamento: string | null;
        origem: string | null;
        origem_id: string | null;
        conta_id: string | null;
      }>;
      greenn_saldos: Row<{
        id: string;
        disponivel: number | string;
        pendente: number | string;
        antecipavel: number | string;
        capturado_em: string;
      }>;
      recorrencias: Row<{
        id: string;
        descricao: string;
        valor_padrao: number | string;
        tipo_valor: string | null;
        frequencia: string;
        dia_vencimento: number | null;
        conta_id: string | null;
        categoria_id: string | null;
        ativo: boolean;
      }>;
      transacoes: Row<{
        id: string;
        descricao: string;
        valor: number | string;
        tipo: string;
        data: string;
        status: string;
        conta_id: string | null;
        categoria_id: string | null;
      }>;
    };
    Views: EmptyObj;
    Functions: EmptyObj;
    Enums: EmptyObj;
    CompositeTypes: EmptyObj;
  };
};
