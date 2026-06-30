# Controle Financeiro | brunotropolis (financeiro-v2)

Painel financeiro enxuto. Reset do v1 (`financeiro/`) porque ficou complexo. Mesmo banco Supabase, app super focado: faturamento manual + recorrências + parceladas + buckets (teto) + projeção 6 meses + auto-sync Greenn.

## URLs e infra

- **Produção:** https://caixa.brunotropolis.com.br ✅ no ar
- **Repo:** https://github.com/brunotropolis/financeiro-v2 (público)
- **Pasta local:** `D:\CLAUDE\financeiro-v2\`
- **EasyPanel:** projeto `ofertas-beta`, serviço `financeiro-v2` (Dockerfile multi-stage)
- **DNS:** Cloudflare A `caixa.brunotropolis.com.br` → `187.77.49.160` (proxied)
- **SSL:** Let's Encrypt via EasyPanel
- **v1 antigo:** ❌ DERRUBADO em 30/06/2026 — DNS `financeiro.brunotropolis.com.br` deletado da zona Cloudflare brunotropolis (não resolve mais) + serviço EasyPanel `ofertas-beta/financeiro` parado (`services.app.stopService`). Repo `brunotropolis/financeiro` e o serviço parado seguem existindo (rebuildável); banco Supabase é compartilhado com o v2 (nada foi apagado). Hub `projetos` já apontava pro caixa.

## Login

- **URL:** https://caixa.brunotropolis.com.br/login
- **Usuários:** `contato@brunotropolis.com.br` ou `day.dos.anjos.ramos@gmail.com`
- **Senha:** `Musha003$` (resetada 30/06/2026, válida pros 2 usuários — antiga `Caixa@2026`)

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
| **4** | 🔧 | Polish baseado em uso real. ✅ v1 derrubado (30/jun). ✅ Histórico de buckets (edição "daqui pra frente" preserva passado). Falta: histórico de buckets via audit_log (opção 2), demais polish |

## Pendências (próxima sessão)

### ✅ Histórico de buckets — IMPLEMENTADO 30/06/2026 (Opção 1)

Editar teto de bucket agora **preserva o histórico** e aplica o teto novo pra frente (decisão Bruno 30/06: "edita hoje, mantém histórico antigo, altera pro futuro"). Como funciona:

- Modal de edição do bucket (`edit-entry-modal.tsx`) tem o seletor **"Aplicar alteração": Daqui pra frente (default) | Retroativo**.
  - **Daqui pra frente** → input `type="month"` (default = mês seguinte). POSTa `/api/recorrentes/[id]/split`: encerra o bucket atual (`data_fim` = último dia do mês anterior ao escolhido) e cria um bucket novo (`data_inicio` = 1º dia do mês escolhido, `valor_padrao` = teto novo + demais campos). Meses passados continuam no bucket antigo (teto antigo). Se o mês escolhido ≤ início do bucket, vira update retroativo simples (sem split).
  - **Retroativo** → PATCH normal em `valor_padrao` (comportamento antigo, corrige todos os meses).
- Endpoint novo: `POST /api/recorrentes/[id]/split` (`route.ts`).
- Filtro de mês passou a respeitar `data_fim` em 3 lugares: `ocorrenciasNoMes`/`ocorrenciasBucketNoMes` (`despesas/page.tsx`) e `ocorrenciasMensal` (`page.tsx` home). Bucket encerrado não aparece nos meses depois do `data_fim`.
- `getBuckets` (`catalog.ts`, dropdown de vínculo do `/lancar`) mostra só buckets vigentes hoje (`data_inicio <= hoje <= data_fim`), pra não duplicar o bucket fechado.
- Validado end-to-end no banco com bucket descartável: maio/jun=teto antigo, jul+=teto novo, 1 bucket ativo por mês (sem double-count).
- **Pendente (opção 2, complemento):** aba "Histórico" no modal lendo `audit_log` do v1 mostrando as alterações de teto ("03/06 — R$ 1k → R$ 1.5k"). ~30 linhas, sem migration.

### Outras pendências
- Cadastros sub-restantes (Bruno cadastrando aos poucos)
- Polish do que aparecer no uso
- ~~Derrubar `financeiro.brunotropolis.com.br` (v1)~~ ✅ feito 30/06
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

Pausa após 1 semana sem requests. Sintoma: DNS do projeto retorna `NXDOMAIN` (Non-existent domain). Resolver: dashboard Supabase → `Resume project` (1-5 min).

**Prevenção (30/06/2026):** workflow n8n `INFRA | Supabase Keepalive` (`kPDneiUfaBwkbXGE`), cron `0 12 */2 * *` (12h UTC dia sim/dia não) bate `GET /rest/v1/contas_bancarias?select=id&limit=1` com a `SUPABASE_ANON_KEY`. Script: `scripts/build_supabase_keepalive.py` (idempotente).

---

## Sessão 30/06/2026

**Contexto:** projeto Supabase ficou pausado por inatividade. Após reativar, vários ajustes pontuais.

### Senhas resetadas
Pelo admin API (service_role) — `Musha003$` pros 2 usuários:
- `contato@brunotropolis.com.br`
- `day.dos.anjos.ramos@gmail.com`

Recipe (Python, urllib): `PUT /auth/v1/admin/users/{uid}` com body `{"password": "..."}` + token validado via `POST /auth/v1/token?grant_type=password`. ⚠️ Gotcha: o `$` na senha precisa ir via body JSON (sem `--data-binary @file` no curl com Git Bash em Windows — vai vazio silenciosamente). Use `urllib.request` direto.

### Keepalive Supabase
Workflow n8n criado pra evitar pausa do free tier — ver "Notas sobre Supabase free tier" acima.

### Saques Greenn lançados (caixa real Dream Baby Unicred)
3 saques transferidos a partir de 15/06 lançados como receitas avulsas, origem **Recebimento Greenn**, status `recebido`:

| Data | Valor | ID |
|---|---|---|
| 22/06 | R$ 2.220,08 | `99386649…` |
| 19/06 | R$ 2.653,01 | `947e8a7c…` |
| 15/06 | R$ 2.433,77 | `26c9507a…` |

**Total: R$ 7.306,86.** Padrão do INSERT (`receitas_brutas`):
- `entidade_id = dff3c509…` (Dream Baby)
- `origem_id = 274b4f63…` (Recebimento Greenn)
- `projeto_id = c327e4ef…`
- `valor_bruto = valor_liquido`, `taxas = 0`, `parcelas = 1`
- `data_venda = data_prevista_pagamento = data_recebimento = <data do saque>`

**Cruzamento da fonte (Greenn `/extrato?action=my-withdrawal`):** os 10 saques mais recentes aparecem no DOM como texto após carregar a SPA — parsing via regex `(\d{2}\/\d{2}\/\d{2})\s+(\d{2}:\d{2})\s+R\$\s+...`. A API `apiadm.greenn.com.br/api/withdraw` existe mas o cookie httpOnly não é acessível via Chrome MCP (harness bloqueia chaves sensíveis no localStorage e cookies), então parse direto do DOM é o caminho. Ainda **pendente lançar 5 saques antigos (4 de mai/26 + 1 de 11/05) e o de 27/06 R$ 4.323,60 status `Requisitado`** — Bruno disse pra lançar só dos transferidos a partir de 15/06.

### Bug fix em `/despesas` tab Geral — "Total fixo do mês" duplicado
- **Sintoma reportado pelo Bruno:** card "Total fixo do mês" mostrando o mesmo valor de "Previsto fixo + buckets".
- **Causa:** `fixasTotal = fixasPago + fixasPrevisto`, e `fixasPrevisto = recPrevisto + bucketsTeto`. Quando `fixasPago=0` (típico cedo no mês), os 2 cards ficam idênticos porque ambos somam `bucketsTeto`.
- **Fix:** `src/app/despesas/page.tsx` linha ~1051. Card "Total fixo do mês" agora usa `fixasSoPrevisto = recPrevisto` (sem buckets). `fixasPrevisto` mantido pro card "Previsto fixo + buckets". Commit `85c83aa`.

### Pendência identificada nesta sessão
**Dashboard home (`/`) não LISTA buckets em lugar nenhum** — só soma `bucketsTeto` dentro do KPI "Despesas previstas" e `bucketsUsado` no "Despesas reais". Os 8 buckets ativos (7 entram em jun/26, ~R$ 10.996 de teto) ficam invisíveis na home.
- Opção 1 (sugerida): card "Buckets do mês" na home, lista compacta com utilizado/teto + barra (mini-versão do `/despesas` tab Buckets).
- Opção 2: subtotal explícito nos KPIs (`R$ X (sendo R$ 10.996 buckets)`).
- Bruno não decidiu ainda; segue como pendente.

---

**Última atualização:** 30/jun/2026.

---

## Sessão 30/06/2026 (parte 2)

Bruno: "derruba o v1, trabalha só com o caixa; bucket edita hoje mantém histórico antigo mas altera pro futuro; lança o saque de 4k que já caiu."

1. **Saque Greenn R$ 4.323,60 (27/06) lançado** como receita avulsa (origem Recebimento Greenn, status recebido, conta Dream Baby Unicred). ID `0d78e649-53cc-4650-bbf2-1595c5e93d7f`. Mesmo padrão dos 3 anteriores. Ainda pendentes os 5 saques antigos (mai/26 + 11/05), como combinado.
2. **v1 derrubado** — DNS `financeiro.brunotropolis.com.br` deletado (Cloudflare zona brunotropolis, record `c19b06e2…`) + serviço EasyPanel `ofertas-beta/financeiro` parado. Confirmado: domínio não resolve. Banco compartilhado intacto, repo/serviço seguem existindo (rebuildável).
3. **Histórico de buckets implementado** (ver Pendências → seção ✅). Edição "daqui pra frente" via novo endpoint `/api/recorrentes/[id]/split`, filtro de mês respeita `data_fim`, dropdown do /lancar mostra só vigentes. Validado no banco. **Ainda não deployado** — falta `git push` + deploy EasyPanel do financeiro-v2.

⚠️ **Deploy pendente:** as mudanças do histórico de buckets estão só locais (build passou). Pra ir pro ar: `git push origin main` + deploy EasyPanel (`services.app.deployService` via token do browser).
