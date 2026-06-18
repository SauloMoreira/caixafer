# Relatório Final — Revisão Contábil do Fechamento de Caixa

## Causa raiz da diferença frequente

A fórmula `expected_balance = opening + sales + income − expense` estava somando **todas as formas de pagamento** (PIX, débito, crédito, transferência) ao dinheiro físico esperado. Pagamentos em PIX inflavam o saldo esperado, gerando "falta" sistemática.

Achados confirmados (relatório completo em `.lovable/diagnostico-fechamento.md`):
- Trigger DB `set_cash_transfer_snapshot_fields` (linha 95)
- `FechamentoPage.tsx` (linha 211), `CashDayStatement.tsx` (219), `CashSessionPeriods.tsx` (135, 169)
- `handle_fiado_payment` inseria `cash_entry` income para qualquer método, alimentando a fórmula errada.

## Correções aplicadas

### Frontend — fonte única de cálculo
- **`src/lib/cash-accounting.ts`** (novo): `computePhysicalCash`, `computeFinancialMovement`, `computeClosingDifference`, `computeClosing`. PIX/cartão/transferência nunca compõem o dinheiro físico.
- **`src/pages/FechamentoPage.tsx`**: reorganizada em 2 blocos visualmente separados:
  - **A) Caixa físico (dinheiro)** — saldo inicial, entradas $, saídas $, saldo esperado.
  - **B) Movimento financeiro** — vendas/entradas/saídas por método, cancelados.
  - Conferência final destacada com status OK/Sobra/Falta e mensagem explicativa.
  - Vendas não-dinheiro marcadas visualmente.
- **`src/components/CashDayStatement.tsx`** e **`CashSessionPeriods.tsx`** consomem a camada central; "Saldo esperado" em períodos vira "Movimento total" (snapshots históricos mostram movimento, não dinheiro físico).

### IA de conferência
- Edge function **`analyze-cash-closing`** (Lovable AI, Gemini 2.5 Flash) — read-only. Recebe o snapshot e devolve parecer: causas possíveis, pagamentos PIX/cartão indevidamente contados como dinheiro, sangrias/despesas a conferir, sugestões objetivas.
- Componente **`CashClosingAIReview`** na tela de fechamento com botão "Analisar".

### Banco de dados
- Migration **`20260618-210425`** — `set_cash_transfer_snapshot_fields` corrigido. Novos snapshots usam:
  `expected_balance = opening + cash_total + income_cash − expense_cash`.
- Snapshots **históricos preservados** (não recalculados).
- `handle_fiado_payment` mantido — frontend agora filtra corretamente pelo `payment_method`.

### Impressão
- Layout existente mantido (sem A4 dedicado, conforme orientação).
- Texto preto puro, fonte 15–18px, totais e diferença com bordas pretas sólidas e negrito reforçado.
- Mesmos dois blocos da tela (Caixa Físico / Movimento Financeiro) com a mesma fonte de dados.

## Validações executadas

**15/15 testes contábeis passando** (`src/lib/__tests__/cash-accounting.test.ts`):
- Cenário 1: 100 + 50 PDV$ + 20 Fiado$ − 30 sangria = **140** ✓
- Cenário 2: PIX 50 → esperado **100** ✓
- Cenário 3: Crédito 80 + Débito 40 → esperado **100** ✓
- Cenário 4: Fiado adquirido 60 → esperado **100** ✓
- Cenário 5: Fiado pago em dinheiro 60 → esperado **160** ✓
- Cenário 6: Venda$ 100 − sangria 50 → esperado **150** ✓
- Adicionais: pagamento fiado via PIX não infla; método nulo conta como dinheiro (legado); cancelados não entram; ponto flutuante arredondado; integração completa.

Build sem erros · preview saudável · memória do projeto atualizada (`mem://features/cash-accounting-rules`).

## Pendências residuais (sugestões, não bloqueantes)

1. Soft-delete de `spr_fiado_payments` não propaga para a `cash_entry` correspondente — sugerido trigger reverso.
2. `spr_fiado_charges` sem `is_deleted` — padronizar com sales/cash_entries.
3. Pagamentos consolidados podem ganhar `payment_group_id` explícito (hoje rastreamento via `source_id`).
4. Backfill opcional dos snapshots históricos — **não recomendado** por ora (preserva histórico fiel).

## Conclusão

O caixa agora separa **dinheiro físico** de **movimento financeiro** em todos os pontos: tela, impressão e banco. A fórmula está centralizada, testada e protegida por memória do projeto. PIX, cartões e transferências aparecem nos relatórios mas não geram mais diferença no dinheiro contado. A IA de conferência ajuda na auditoria sem alterar dados. Histórico preservado.
