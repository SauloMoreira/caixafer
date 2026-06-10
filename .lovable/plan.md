# Auditoria Diária / Movimento do Dia

Nova página administrativa que consolida, em um único lugar, tudo que aconteceu no sistema em uma data — PDV, SPR, Fiado, pagamentos, entradas/saídas, cancelamentos, estornos, ajustes e estoque — com análise de IA e exportação.

## Acesso e navegação
- Rota: `/auditoria-diaria`, protegida por `ProtectedRoute adminOnly` (somente admin).
- Item de menu "Auditoria Diária" no grupo Administração da sidebar (visível só p/ admin).
- Não altera nenhuma rota ou permissão existente.

## Estrutura da página
1. **Cabeçalho** — título, seletor de data (default hoje), botão "Atualizar", botões "Exportar PDF" e "Exportar CSV".
2. **Cards de resumo do dia** (grid responsivo): Vendido PDV, SPR movimentado, Fiado lançado, Recebido, Em aberto, Entradas, Saídas, Cancelamentos, Estornos, Descontos, Ajustes manuais, Qtde de vendas, Usuários ativos no dia.
3. **Análise da IA** — card destacado acima da tabela com resumo executivo, pontos de atenção, divergências PDV/SPR/Fiado, movimentações suspeitas, sugestões de conferência. Botão "Gerar análise" (on-demand) + reuso de cache por data. Mensagem clara: "A IA apenas analisa — não altera dados".
4. **Filtros da tabela** — Origem (PDV/SPR/Fiado/Estoque/Pagamento/Ajuste/Cancelamento/Estorno), Tipo, Usuário, Cliente, Forma de pagamento, Status, faixa de valor, busca por texto, toggles "Somente manuais" e "Somente cancelados/estornados".
5. **Tabela consolidada** — colunas: Data/hora, Origem, Tipo, ID, Cliente, Produto/descrição, Forma de pgto, Valor, Status, Usuário, Observação, Ação ("Ver detalhes"). Paginação client-side + ordenação.
6. **Painel de detalhe** — `Sheet` lateral em desktop / drawer full em mobile com todos os dados da operação + histórico (via `security_audit_logs` da entidade) + link para tela original (PDV, SPR, Movimentos…).

## Fonte dos dados (somente leitura)
Consultas paralelas por `business_date = data selecionada`:
- `sales` + `sale_items` (com `is_deleted` para cancelamentos).
- `cash_entries` (entradas/saídas/ajustes manuais; `source_type` identifica origem fiado_payment etc.).
- `spr_fiado_charges` + `spr_fiado_charge_items`.
- `spr_fiado_payments`.
- `stock_movements` (filtrado por `created_at::date`).
- `security_audit_logs` (para histórico/alterações por entidade no detalhe).
- `profiles` para nomes de usuário; `spr_volunteers` para clientes SPR.

Todos os dados são normalizados num único array `MovementRow` no cliente (já temos RLS adequado; nada novo no banco).

## Análise de IA
- Nova edge function `daily-audit-analysis` (Lovable AI, modelo `google/gemini-3-flash-preview`).
- Input: payload já agregado pelo front (resumo + amostra dos movimentos relevantes — limitado em tamanho).
- Output: JSON estruturado `{ resumo, pontos_de_atencao[], divergencias[], sugestoes[] }` renderizado no card.
- Tratamento explícito de 429 (limite) e 402 (créditos).
- Não escreve em nenhuma tabela.

## Exportação
- **CSV**: gerado no cliente (resumo + linhas da tabela atual respeitando filtros).
- **PDF**: gerado no cliente com `jspdf` + `jspdf-autotable` (já instaláveis) — capa com resumo, bloco da análise da IA, tabela de movimentos.
- Loga evento `daily_audit_exported` via `log_security_event` (RPC já existente).

## Componentização
Novos arquivos:
- `src/pages/AuditoriaDiariaPage.tsx` — orquestra estado/filtros/data.
- `src/components/audit/DailySummaryCards.tsx`
- `src/components/audit/DailyAIAnalysis.tsx`
- `src/components/audit/DailyMovementsTable.tsx`
- `src/components/audit/MovementDetailSheet.tsx`
- `src/hooks/useDailyAudit.ts` — busca + normalização (React Query).
- `src/lib/audit-export.ts` — helpers CSV/PDF.
- `supabase/functions/daily-audit-analysis/index.ts` + entrada em `supabase/config.toml`.

Alterações mínimas:
- `src/App.tsx` — registra rota `/auditoria-diaria`.
- `src/components/layout/sidebar-config.tsx` — novo item admin.

## O que NÃO muda
- Sem mudanças em schema, RLS, triggers ou regras de negócio.
- IA é estritamente read-only.
- Nenhum fluxo existente (PDV, SPR, Fechamento, Movimentos) é tocado.

## Critérios de aceite cobertos
Seleção de data, consolidação multi-origem, análise de IA acima da tabela, filtros, detalhe sem perder contexto, exportação PDF/CSV, restrito a admin, responsivo.
