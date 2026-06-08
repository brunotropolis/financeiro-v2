/**
 * Subset das tabelas do v1. Estrutura completa (Row/Insert/Update + Views/Enums)
 * obrigatória — senão Supabase SSR infere queries como `never`.
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
      categorias: Row<{
        id: string;
        nome: string;
        tipo: string;
        cor_hex: string | null;
        icone: string | null;
        ativo: boolean;
      }>;
      origens_receita: Row<{
        id: string;
        slug: string;
        nome: string;
        ativo: boolean;
      }>;
      receitas_brutas: Row<{
        id: string;
        origem: string | null;
        origem_id: string | null;
        entidade_id: string | null;
        produto_nome: string | null;
        valor_bruto: number | string;
        taxas: number | string | null;
        valor_liquido: number | string;
        metodo_pagamento: string | null;
        parcelas: number | null;
        data_venda: string;
        data_prevista_pagamento: string | null;
        data_recebimento: string | null;
        status: string;
        notas: string | null;
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
        nome: string;
        tipo: string;
        valor_padrao: number | string;
        tipo_valor: string | null;
        frequencia: string;
        dia_vencimento: number | null;
        dia_semana: number | null;
        pode_pular: boolean | null;
        forma_pagamento: string | null;
        cartao_id: string | null;
        conta_id: string | null;
        categoria_id: string | null;
        entidade_id: string | null;
        fornecedor_id: string | null;
        data_inicio: string;
        data_fim: string | null;
        notas: string | null;
        ativo: boolean;
      }>;
      transacoes: Row<{
        id: string;
        tipo: string;
        descricao: string;
        valor: number | string;
        data_competencia: string;
        data_pagamento: string | null;
        entidade_id: string | null;
        categoria_id: string | null;
        fornecedor_id: string | null;
        forma_pagamento: string | null;
        cartao_id: string | null;
        conta_id: string | null;
        parcelado: boolean | null;
        parcela_atual: number | null;
        parcela_total: number | null;
        valor_parcela: number | string | null;
        transacao_pai_id: string | null;
        recorrencia_id: string | null;
        fatura_id: string | null;
        status: string;
        notas: string | null;
        origem: string | null;
      }>;
    };
    Views: EmptyObj;
    Functions: EmptyObj;
    Enums: EmptyObj;
    CompositeTypes: EmptyObj;
  };
};
