# Controle Financeiro | brunotropolis (financeiro-v2)

Painel financeiro enxuto. Reset do v1 (`financeiro/`) porque ficou complexo. Mesmo banco Supabase, app super focado: faturamento manual + recorrências + parceladas + buckets (teto) + projeção 6 meses + auto-sync Greenn.

## URLs e infra

- **Produção:** https://caixa.brunotropolis.com.br ✅ no ar
- **Repo:** https://github.com/brunotropolis/financeiro-v2 (público)
- **Pasta local:** `D:\CLAUDE\financeiro-v2\`
- **EasyPanel:** projeto `ofertas-beta`, serviço `financeiro-v2` (Dockerfile multi-stage)
- **DNS:** Cloudflare A `caixa.brunotropolis.com.br` → `187.77.49.160` (proxied)
- **SSL:** Let's Encrypt via EasyPanel
- **v1 antigo:** `financeiro.brunotropolis.com.br` ainda no ar (vai derrubar quando v2 estiver validado)

## Login

- **URL:** https://caixa.brunotropolis.com.br/login
- **Usuários:** `contato@brunotropolis.com.br` ou `day.dos.anjos.ramos@gmail.com`
- **Senha:** `Caixa@2026` (resetada 08/06/2026, válida pros 2 painéis)

## Stack

- Next.js 15 (App Router, TS, Tailwind, `output: "standalone"`)
- Supabase (mesmo projeto do v1: `zageqyuwodvyxwohpugb`)
- Anthropic SDK (via fetch direto, sem instalar SDK) — Claude Haiku 4.5 pra Vision do Greenn
- lucide-react pra ícones
- Sem shadcn (componentes próprios mínimos)

## Visual

Dark + lime neon estilo "DWISCN" reference que Bruno mandou.

| Token | Valor |
|---|---|
| `bg` | `#0a0a0a` |
| `surface` | `#141414` |
| `elevated` | `#1a1a1a` |
| `line` | `#1f1f1f` |
| `lime` | `#c5f02c` (accent) |
| `positive` | `#34d399` |
| `negative` | `#f87171` |
| `amber-400` | (warning Tailwind) |

Sidebar com user chip + busca ⌘K + nome "Controle Financeiro | brunotropolis" no rodapé. Item ativo destacado em lime sólido. Favicon 💰 (`src/app/icon.svg`).

## IDs hardcoded (`src/lib/constants.ts`)

3 contas que o painel acompanha (resto fica fora):

| Conta | ID | Entidade |
|---|---|---|
| Manual RN — Unicred | `d6873ac0-52e3-4647-af2b-cdd1fa32e787` | Manual do Recém-Nascido |
| Dream Baby — Unicred | `e4598c53-6282-4b62-8551-9b228265230d` | Dream Baby |
| MRN Serviços — Conta Simples | `2bf03aa5-f7cc-466c-9a3f-a85bcb9d7e88` | MRN Serviços Digitais |

## Tabelas Supabase usadas (subset do v1)

- `contas_bancarias` — só as 3 ativas
- `categorias` — 24 (16 despesa + 8 receita)
- `projetos` — 4 (Pessoal, Manual do Recém-Nascido, Brunotropolis, Ofertas Maternas) ordem definida 22-Mai
- `origens_receita` — 11 (Greenn, Magalu, Amazon, etc)
- `recorrencias` — fixas + buckets (`tipo_valor` decide). Bucket = `tipo_valor='bucket'`
- `transacoes` — despesas avulsas + parceladas + transações vinculadas a bucket (via `recorrencia_id` apontando pro bucket)
- `receitas_brutas` — receitas (Greenn automático via webhook do v1 + manual)
- `greenn_saldos` — snapshots (disponivel/pendente/antecipavel)

Resto do v1 ignorado: `faturas_cartao`, `orcamentos`, `audit_log` (existe, não usado), `movimentacoes_bancarias`, `snapshots`, etc.

## Telas e rotas

### `/` Dashboard
- 4 KPIs (Saldo total, Faturamento mês, Despesas mês, Resultado)
- 3 cards de conta (Manual RN / Dream Baby / Conta Simples) + saldo atual
- Card lime "Saldo Greenn" — em caixa, a receber, antecipável + botão "Atualizar saldo"
- Próximos vencimentos (placeholder)
- **Tabela "Projeção de caixa — 6 meses":** linhas = 3 contas + Total, colunas = mês atual + 5 futuros
  - Cálculo: `saldo_anterior − despesas_previstas + receitas_a_receber` por mês
  - Considera recorrências (com frequência: mensal/semanal/quinzenal/bimestral)
  - Receitas usam `data_prevista_pagamento`

### `/lancar` — form universal
5 tipos:
1. **Despesa avulsa** → `transacoes` (status: prevista/paga)
2. **Despesa recorrente** → `recorrencias` (frequencia, dia_vencimento, tipo_valor=fixo)
3. **Despesa parcelada** → N inserts em `transacoes` com `parcelado=true`, `parcela_atual/total`
4. **Bucket** → `recorrencias` com `tipo_valor=bucket` (semanal/mensal/bimestral)
5. **Receita avulsa** → `receitas_brutas` (status: previsto/recebido, data_prevista_pagamento ou data_recebimento)

Todos os tipos têm seletor **Projeto** (central de custo, 4 botões coloridos) — default Pessoal.

**Vincular avulsa a bucket:** quando seleciona "Despesa avulsa" e tem buckets cadastrados, aparece dropdown "Vincular a bucket?". Se escolhido:
- `recorrencia_id` da transação = ID do bucket
- Categoria e conta do bucket são auto-preenchidas
- A transação NÃO aparece em Avulsas (filtra `recorrencia_id IS NULL`)
- Conta como "utilizado" no bucket (sem double-count)

### `/despesas` — 4 tabs

Filtro de mês compartilhado (botão lime destacado com ‹ › e date picker), URL param `?m=YYYY-MM`.

1. **Geral** (default) — visão consolidada
   - 3 cards grandes: Total / Já pago / Previsto
   - 3 cards clicáveis (Avulsas, Recorrentes, Buckets) que levam pra tab
   - Mini-lista de buckets mostrando nome cadastrado + utilizado/teto
   - **Total inclui:** avulsas + recorrentes + tetos buckets (cheios)
   - Decisão: bucket teto entra cheio no previsto (sem subtrair utilizado)

2. **Avulsas** — transações tipo despesa sem `recorrencia_id` e sem `parcelado`
   - Tabela com Data, Descrição, Conta, Categoria, Projeto, Status, Valor, Ações
   - Stats: Lançamentos / Já pago / Previsto

3. **Recorrentes** — fixas + parceladas (NÃO inclui buckets — foram movidos pra tab própria)
   - Stats: Lançamentos / Já pago / Previsto
   - Seção Fixas (tabela) — só as ativas no mês (filtro de ocorrências)
   - Seção Parceladas (cards) — grupos de parcelas com vencimento no mês
   - Cada linha tem botão editar + toggle pausar

4. **Buckets** — só buckets (`tipo_valor='bucket'`)
   - 4 cards stats: Buckets ativos / Teto total / Utilizado / Restante
   - Cor do "Utilizado" muda conforme % do teto: verde <70%, amarelo 70-100%, vermelho >100%
   - Cards 2 colunas cada bucket com:
     - Nome + categoria + projeto + freq
     - Barra de progresso colorida
     - Utilizado / Teto, Resta (ou "Estourou")
     - Botão editar
   - **Utilizado** = soma de transações com `recorrencia_id = bucket.id` (NÃO mais por categoria)

### `/receitas` — 2 tabs

1. **Caixa** (default) — fluxo de caixa do mês
   - Filtra por `data_recebimento` (já caiu) **OR** `data_prevista_pagamento` (vai cair)
   - 4 cards: Já entrou / Vai entrar / Total / Greenn na plataforma
   - Tabela mostra "Cai em" (data certa baseada em status) + "Situação" (verde se recebido, âmbar "vai entrar" se previsto)

2. **Faturamento** — competência (data_venda no mês)
   - 3 cards: Faturamento do mês / Já em caixa / A receber
   - Linha fixa Saldo Greenn no topo da tabela (só nessa tab)
   - Tabela com receitas filtradas por data_venda

Botão ✏️ pra editar receitas no canto direito.

### `/configuracoes/greenn` — auto-sync via bookmarklet

Setup do bookmarklet pra atualizar Saldo Greenn em 1 clique.

### `/lancamentos` — histórico geral

Lista todas transações (despesas e receitas) com filtros período/conta/tipo. Tabela com edit. (Da Sprint 2, mantida.)

## Modal de edição universal (`src/components/edit-entry-modal.tsx`)

Funciona pra 4 tipos: `transacao`, `recorrencia`, `bucket`, `receita`.

Campos contextuais:
- Comum: nome/descrição, valor, conta, categoria, projeto
- Transação: data, status (prevista/paga/atrasada)
- Recorrência: data início, frequência, dia vencimento
- Bucket: data início, frequência (semanal/mensal/bimestral)
- Receita: origem, data venda, status (previsto/recebido), data prevista, data recebimento

Botão **Excluir** com confirmação. Edição via PATCH em `/api/{transacoes|recorrentes|receitas}/[id]`. Delete via DELETE no mesmo endpoint.

## API routes

| Endpoint | Função |
|---|---|
| `POST /api/lancar` | Cria transação/recorrência/bucket/receita baseado no `tipo` |
| `PATCH/DELETE /api/transacoes/[id]` | Editar/excluir despesas avulsas e parcelas |
| `PATCH/DELETE /api/recorrentes/[id]` | Editar/excluir recorrências e buckets (PATCH também faz toggle ativo) |
| `PATCH/DELETE /api/receitas/[id]` | Editar/excluir receita_bruta |
| `POST /api/greenn/parse-saldo` | Claude Vision parse de print de carteira Greenn (fallback) |
| `POST /api/greenn/manual` | Entrada manual dos 3 valores Greenn (sem IA) |
| `POST /api/greenn/sync` | Bookmarklet POSTa Bearer token Greenn → servidor chama Greenn API → snapshot |

## Greenn auto-sync — caminho descoberto

**Problema:** Greenn anti-fraude (`SUSPECTED_INTERN_FRAUD`) bloqueia `/oauth/token` (login E refresh) quando vem de IP datacenter (EasyPanel). Browserless + Puppeteer não funcionam.

**Descoberta-chave:** anti-fraude bloqueia SÓ o login/refresh. Endpoints autenticados (`/financial-statement/resume`) passam normal **se** tiver Bearer token válido. Validado testando.

**Solução em produção:**
1. Bruno cria bookmarklet manualmente no Chrome (Chrome strip `javascript:` de drag-and-drop desde 2021 — instruções na página `/configuracoes/greenn`)
2. Bookmarklet roda no domínio `adm.greenn.com.br` (cookies do Bruno presentes)
3. Pega `access_token` do cookie
4. POSTa pra `/api/greenn/sync` com header `X-Sync-Secret`
5. Servidor chama Greenn API → grava em `greenn_saldos`

**Secret:** env var `GREENN_SYNC_SECRET` (24 bytes hex random). No EasyPanel + `.env.local`.

**Limitação:** token Greenn vive 30min. Bruno precisa abrir Greenn antes de clicar no bookmarklet (qualquer página renova). Não rola refresh server-side por causa do anti-fraude.

## Lógica de buckets

- Bucket é uma `recorrencia` com `tipo_valor='bucket'`
- Tem `valor_padrao` = teto, `frequencia` (semanal/mensal/bimestral), `data_inicio`
- NÃO materializa transações (não vira gasto sozinho)
- "Utilizado" = soma de transações com `recorrencia_id = bucket.id` (vínculo explícito)
- **Filtro de mês:** bucket aparece se `ocorrenciasBucketNoMes() > 0`:
  - Semanal/Mensal: aparece em todos os meses ≥ data_inicio
  - Bimestral: aparece nos meses alternados (mes_atual - mes_inicio) % 2 === 0
- **Editar teto:** hoje altera retroativo (passado, presente, futuro). Pendente implementar histórico (ver "Pendências").

## Projeção de caixa (`src/lib/projecao.ts`)

Pra cada um dos 6 meses (atual + 5):

```
saldo_inicial = saldo_atual_conta (mês 0) ou saldo_final_mês_anterior
despesas_mês = transações previstas (incluindo recorrências materializadas)
              + recorrências fixas não materializadas × ocorrências no mês
              (buckets NÃO entram porque não materializam)
receitas_mês = receitas_brutas com data_prevista_pagamento no mês e status != recebido
saldo_final = saldo_inicial - despesas_mês + receitas_mês
```

Mostra na tabela por conta + total (com receitas).

## Sprints

| Sprint | Status | Entrega |
|---|---|---|
| **1** | ✅ | Scaffolding + Dashboard read-only + tema + deploy + SSL |
| **2** | ✅ | /lancar (5 tipos), /recorrentes, /lancamentos, edit transações |
| **3** | ✅ | Projeção 6 meses + /receitas com paste Greenn (Claude Vision) |
| **3.5** | ✅ | Greenn auto-sync via bookmarklet (sem print) |
| **3.6** | ✅ | Limpeza base + reset com backup XLSX no Drive + Projeto no form |
| **3.7** | ✅ | Bucket com freq + tab /despesas com tabs Avulsas/Recorrentes |
| **3.8** | ✅ | Editar/excluir tudo + filtro mês maior lime |
| **3.9** | ✅ | Tab Buckets separada + tab Geral + Caixa default em Receitas |
| **3.10** | ✅ | Vincular avulsa a bucket (sem double-count) + nome cadastrado em listas |
| **4** | ⬜ | Polish baseado em uso real + derrubar v1 |

## Pendências (próxima sessão)

### 🥇 Histórico de buckets (decisão Bruno 09/06)

Hoje editar teto de bucket muda **todos os meses** (sem preservar passado). Implementar:

- **Opção 1 (recomendada):** modal de edição pergunta "Aplicar a partir de qual mês?":
  - "Foi sempre assim (retroativo)" → atualiza valor_padrao direto (comportamento atual)
  - "A partir de Jul/26 em diante" → fecha bucket atual (`data_fim`) e cria novo (`data_inicio` + teto novo)
  - Usa `data_inicio`/`data_fim` que já existem no schema
- **Opção 2 (complemento):** aba "Histórico" no modal lendo do `audit_log` do v1 — mostra todas as alterações ("03/06 — Teto R$ 1k → R$ 1.5k")

Custo: ~50 linhas opção 1 + ~30 linhas opção 2. Sem migration.

### Outras pendências
- Cadastros sub-restantes (Bruno cadastrando aos poucos)
- Polish do que aparecer no uso
- Derrubar `financeiro.brunotropolis.com.br` (v1)

## Bugs corrigidos na jornada

| # | Bug | Fix |
|---|---|---|
| 1 | TypeScript `never` inference Supabase SSR | Helper `Row<T>` + `EmptyObj` no Database type |
| 2 | Docker COPY `/app/public` falha (pasta vazia) | `public/.gitkeep` |
| 3 | EasyPanel `domains.createDomain` schema mudou | `id` UUID + `certificateResolver` + `wildcard` + `serviceDestination` com `protocol: "http"` |
| 4 | EasyPanel token rotaciona por sessão (IP) | Chamar API via Chrome MCP (sessão logada) em vez de curl externo |
| 5 | Enum `status_transacao` usa `paga` (não `pago`) | Trocar comparações; também `data_competencia` (não `data`) |
| 6 | Bucket falha por NOT NULL em `dia_vencimento` | Deriva do `data_inicio` (campo ignorado em buckets) |
| 7 | Enum `origem_transacao` não aceita `manual` | Usa `painel` (válido: whatsapp/painel/importacao_csv/recorrencia/meta_api/greenn/outro) |
| 8 | Greenn `/oauth/token` bloqueia datacenter IP | Bookmarklet no browser Bruno (residencial) + servidor só chama API com token já-emitido |
| 9 | Chrome strip `javascript:` em drag-to-bookmark | Instruções na página pra criar manual via "Adicionar página…" |
| 10 | Double-count bucket × avulsa | Vincular avulsa via `recorrencia_id = bucket.id`; tab Buckets usa esse vínculo em vez de categoria |

## Decisões de arquitetura

- **3 contas hardcoded** porque Bruno só usa essas. Resto fica fora do v2.
- **Tabela de Projetos** = central de custo (Pessoal, Manual RN, Brunotropolis, Ofertas Maternas) — ortogonal a Entidade (PF/PJ fiscal).
- **Bucket = tipo de recorrência**, não tabela nova. Reusa `recorrencias.tipo_valor='bucket'`.
- **Avulsa vinculada a bucket** via `transacoes.recorrencia_id = bucket.id` (mesmo campo que recorrência fixa usa, mas pra bucket).
- **Caixa virou tab default** em Receitas (decisão Bruno 09/06) — mais útil dia-a-dia que Faturamento.
- **Tab Geral default** em Despesas (decisão Bruno 09/06) — visão consolidada antes do detalhe.

## Comandos úteis

```bash
# Build local
cd /d/CLAUDE/financeiro-v2 && npm run build

# Push (autenticação via PAT no remote)
git push origin main

# Trigger deploy EasyPanel (precisa token live via browser)
# Via Chrome MCP: localStorage easypanel.state.token → POST services.app.deployService

# Snapshot Greenn via bookmarklet (Bruno faz no browser)
# Página: /configuracoes/greenn → arrasta favorito manualmente

# Backup XLSX da base (5 abas, 254+ linhas)
cd /d/CLAUDE/financeiro-v2/backups
python export_backup.py "financeiro_backup_$(date +%Y%m%d_%H%M%S).xlsx"

# Upload pro Drive via n8n
source /d/CLAUDE/.env.meta && export N8N_API_KEY
python upload_to_drive.py NOME_DO_XLSX
```

## Notas sobre Supabase free tier

Pausa após 1 semana sem requests. Sintoma: site retorna erro auth. Resolver: dashboard Supabase → `Resume project` (1-5 min). Prevenir: visita semanal OU upgrade pro tier ($25/mês).

---

**Última atualização:** 09/jun/2026 — Sprint 3.10 concluído. Próximo: histórico de buckets (Opção 1 + 2).
