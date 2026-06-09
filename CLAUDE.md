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

**4 contas** que o painel acompanha (adicionado Cartão Unicred em 09/jun como 4ª opção, cor laranja `#f97316` pra diferenciar dívida de saldo):

| Conta | ID | Entidade | Cor |
|---|---|---|---|
| Manual RN — Unicred | `d6873ac0-52e3-4647-af2b-cdd1fa32e787` | Manual do Recém-Nascido | lime |
| Dream Baby — Unicred | `e4598c53-6282-4b62-8551-9b228265230d` | Dream Baby | verde |
| MRN Serviços — Conta Simples | `2bf03aa5-f7cc-466c-9a3f-a85bcb9d7e88` | MRN Serviços Digitais | azul |
| **Cartão Unicred** | `02cb3607-0b95-42ca-b29c-75774d8511a9` | Manual do Recém-Nascido | **laranja** |

⚠️ Cartão Unicred é tipo `corrente` no banco (constraint NOT NULL em `banco`/`tipo` — tipos permitidos: corrente/digital/prepaga). Funciona como conta no painel mas semanticamente é dívida.

## Tabelas Supabase usadas (subset do v1)

- `contas_bancarias` — as 4 ativas
- `categorias` — 25 (16 despesa + **9 receita**, adicionado "Recebimento Greenn" em 09/jun)
- `projetos` — 4 (Pessoal, Manual do Recém-Nascido, Brunotropolis, Ofertas Maternas)
- `origens_receita` — **12** (adicionado "Recebimento Greenn" slug `recebimento_greenn` em 09/jun)
- `recorrencias` — fixas + buckets (`tipo_valor` decide). Bucket = `tipo_valor='bucket'`
- `transacoes` — despesas avulsas + parceladas + transações vinculadas a bucket (via `recorrencia_id` apontando pro bucket)
- `receitas_brutas` — receitas (Greenn automático via webhook do v1 + manual)
- `greenn_saldos` — snapshots (disponivel/pendente/antecipavel)
- **`faturamento_snapshots`** (NEW 09/jun) — snapshot mensal por fonte pra congelar histórico. Schema: `(id, mes_referencia 'YYYY-MM', fonte 'greenn_meta'|'manual:<slug>', fonte_label, valor_bruto, valor_liquido, snap_em, snap_por, metadata jsonb)` + unique(mes_referencia, fonte).

Resto do v1 ignorado: `faturas_cartao`, `orcamentos`, `audit_log` (existe, não usado), `movimentacoes_bancarias`, `snapshots`, etc.

## Telas e rotas

### `/` Dashboard
Filtro de mês lime (`MesFilter`) no canto direito + 4 KPIs principais:
- **Entradas do mês** (verde) — receitas a receber + recebidas no mês + `greenn.disponivel + greenn.antecipavel` (cai em até 24h se solicitar)
- **Despesas previstas** (âmbar) — avulsas + recorrentes + tetos buckets + Meta Ads
- **Despesas reais** (vermelho) — lançadas (avulsas + recorrentes + bucket usado + Meta Ads)
- **Resultado do mês** = Entradas − Despesas reais

Card "Próximos vencimentos" (placeholder pra sprint futura). Sem cards de conta, sem saldo total, sem Greenn (movido pra `/receitas`), sem tabela de projeção 6 meses (ocultada — código vivo em `lib/projecao.ts`).

### `/lancar` — form universal
5 tipos (suporta `?tipo=receita_avulsa` na URL pra pré-selecionar):
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

Filtro de mês compartilhado (`MesFilter` lime), URL param `?m=YYYY-MM`.

1. **Geral** (default) — visão consolidada
   - **4 cards** grandes:
     - **Total fixo do mês** — recorrências fixas no mês
     - **Previsto fixo + buckets** — fixas a pagar + tetos cheios dos buckets
     - **Já pago + Meta Ads** — pago (verde) com nota do gasto Meta no mês
     - **Total do mês (com Meta)** — tudo somado, incluindo Meta Ads
   - **Linha Meta Ads** acima de Avulsas no breakdown (puxado do dashboard API n8n, 100% pago, ROAS Real exibido)
   - 3 cards clicáveis (Avulsas, Recorrentes, Buckets) levam pra tab
   - Mini-lista de buckets mostra **nome cadastrado** (não categoria) + utilizado/teto

2. **Avulsas** — transações tipo despesa sem `recorrencia_id` e sem `parcelado`
3. **Recorrentes** — fixas + parceladas (NÃO inclui buckets — foram movidos pra tab própria)
4. **Buckets** — só buckets. Cada card tem botão **"👁️ Ver N lançamentos"** que abre modal com as transações vinculadas (edit/delete via EditButton).

### `/receitas` — 2 tabs

Filtro de mês lime. Ordem das tabs: **Caixa → Faturamento** (Caixa default).

1. **Caixa** (default) — fluxo de caixa do mês
   - Filtra por `data_recebimento` no mês **OR** `data_prevista_pagamento` no mês
   - 4 cards: Já entrou / **Vai entrar** (inclui Greenn rápido) / Total / Greenn na plataforma
   - Tabela mostra "Cai em" + "Situação" (verde se recebido, âmbar "vai entrar" se previsto)

2. **Faturamento** — competência (data_venda no mês)
   - 3 cards: Faturamento do mês / Já em caixa / A receber
   - **SEM linha Greenn** (removida em 09/jun — só dados manuais lançados)
   - Botão "Nova receita" leva pra `/lancar?tipo=receita_avulsa` (já pré-selecionado)

Botão ✏️ pra editar receitas no canto direito.

### `/historico` (NEW 09/jun) — Faturamento mensal
Aba na sidebar entre Receitas e Lançamentos. Janela de **4 meses por vez**, navegável (‹ 4 antes | até XXX | 4 depois ›).

- **4 cards stats** da janela: Total / Greenn-Meta / Manual-Afiliados / Média mensal
- **Tabela cruzada:** linhas = origens (Greenn via Meta + cada origem manual), colunas = 4 meses + Total
- **Botão "fechar"** em cada coluna → POST `/api/faturamento/fechar-mes` → grava snapshot. Mês fechado mostra **🔒 cadeado lime** ao lado do label
- Controle a partir de **Abr/2026** — meses anteriores zerados
- Prefere snapshot se existir; senão calcula ao vivo (Meta API + receitas_brutas)
- Cron diário 23h BRT fecha automaticamente no último dia do mês

### `/configuracoes/greenn` — auto-sync via bookmarklet
Setup do bookmarklet pra atualizar Saldo Greenn em 1 clique.

### `/lancamentos` — histórico geral
Lista todas transações com filtros período/conta/tipo. Tabela com edit. (Da Sprint 2.)

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
| `POST /api/lancar` | Cria transação/recorrência/bucket/receita baseado no `tipo`. Aceita `bucket_id` opcional pra avulsa vinculada |
| `PATCH/DELETE /api/transacoes/[id]` | Editar/excluir despesas avulsas e parcelas |
| `PATCH/DELETE /api/recorrentes/[id]` | Editar/excluir recorrências e buckets (PATCH também faz toggle ativo) |
| `PATCH/DELETE /api/receitas/[id]` | Editar/excluir receita_bruta |
| `POST /api/greenn/parse-saldo` | Claude Vision parse de print de carteira Greenn (fallback) |
| `POST /api/greenn/manual` | Entrada manual dos 3 valores Greenn (sem IA) |
| `POST /api/greenn/sync` | Bookmarklet POSTa Bearer token Greenn → servidor chama Greenn API → snapshot |
| `POST /api/faturamento/fechar-mes` (NEW 09/jun) | Snapshot do faturamento do mês. Body `{mes_referencia: 'YYYY-MM'}`. Auth via sessão Supabase OU header `X-Cron-Secret` (env `CRON_SECRET`). Idempotente (UPSERT em `faturamento_snapshots`). |

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
| **3.11** | ✅ | Cartão Unicred como 4ª conta + modal "Ver lançamentos" no bucket |
| **3.12** | ✅ | Dashboard refatorado: sem cards de conta, sem saldo total. 4 KPIs novos (Entradas/Despesas previstas/reais/Resultado). Filtro mês lime |
| **3.13** | ✅ | Meta Ads auto na Geral de Despesas + categoria/origem "Recebimento Greenn" + Greenn fora do dashboard. 4 boxes novos (Total fixo / Previsto fixo+buckets / Já pago+Meta / Total c/ Meta) |
| **3.14** | ✅ | `/historico` (4 meses navegáveis) com Greenn via Meta + manual por origem. Tira GreennLine de Faturamento |
| **3.15** | ✅ | Snapshot `faturamento_snapshots` (UPSERT idempotente) + botão "fechar mês" no histórico + cron n8n diário 23h BRT (fecha auto no último dia). Fix bucket `data_inicio` (usar mesFim, não mesInicio) |
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
- Lançamento de saques Greenn como receita avulsa (origem `recebimento_greenn`) — Bruno faz manualmente quando saca
- "Pagamento de fatura cartão" — cada mês Bruno lança 1 transação na conta Manual RN (corrente) com valor da fatura pra zerar a "dívida" simbólica do Cartão Unicred. Sem automação por ora.

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
| 11 | `contas_bancarias` aceita só tipos `corrente/digital/prepaga` + `banco` NOT NULL | Cartão Unicred salvo com tipo=`corrente`, banco=`Unicred`, cor laranja só pro visual |
| 12 | Bucket com `data_inicio` no meio do mês não aparecia | Função `ocorrenciasNoMes` comparava com `mesInicio` (primeiro dia). Trocar pra `mesFim` (último dia). Sanepar começava 05/jun, não entrava em junho — agora entra |

## Tabelas de auth/secrets

- `GREENN_SYNC_SECRET` — secret do bookmarklet Greenn (env var)
- `ANTHROPIC_API_KEY` — Claude Vision pra paste de print Greenn
- `CRON_SECRET` (NEW 09/jun) — secret pro workflow n8n disparar fechamento mensal sem precisar de sessão Supabase. Valor: `fc4f93b08a7e6a553338e786d89c1aa3f2d8165b599f5e4b` (em EasyPanel + `.env.local`)

## Cron n8n: fechamento mensal

Workflow `nUAkT6e2jLw6Sczd` — **FINANCEIRO V2 | Cron Fechar Mês**:
- Schedule diário 02:00 UTC = 23:00 BRT
- Code node calcula se hoje é último dia do mês BRT
- Se sim → HTTP POST `/api/faturamento/fechar-mes` com `X-Cron-Secret`
- Idempotente — pode re-rodar; UPSERT em `faturamento_snapshots`
- Script: `scripts/build_cron_fechar_mes.py` (reusable)

## Decisões de arquitetura

- **4 contas hardcoded** porque Bruno só usa essas. Resto fica fora do v2.
- **Tabela de Projetos** = central de custo (Pessoal, Manual RN, Brunotropolis, Ofertas Maternas) — ortogonal a Entidade (PF/PJ fiscal).
- **Bucket = tipo de recorrência**, não tabela nova. Reusa `recorrencias.tipo_valor='bucket'`.
- **Avulsa vinculada a bucket** via `transacoes.recorrencia_id = bucket.id` (mesmo campo que recorrência fixa usa, mas pra bucket).
- **Caixa virou tab default** em Receitas (decisão Bruno 09/06) — mais útil dia-a-dia que Faturamento.
- **Tab Geral default** em Despesas (decisão Bruno 09/06) — visão consolidada antes do detalhe.
- **Cartão de crédito como conta normal** (decisão Bruno 09/06) — gambiarra pragmática. Sem fatura virtual, sem ciclo de fechamento. Bruno lança "Pagamento fatura" manualmente.
- **Snapshot vs ao vivo no histórico** — `/historico` prefere snapshot se existir, senão calcula. Snapshot fica imutável (a Meta pode atualizar números retroativos, mas snap congela).

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

**Última atualização:** 09/jun/2026 (sessão noite) — Sprints 3.11 a 3.15 concluídos. Próximo: histórico de buckets (Opção 1 + 2) + lançamento manual de saques Greenn pra fluxo de caixa.
