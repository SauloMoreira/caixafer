---
name: Regra contábil do caixa
description: Fórmula obrigatória do saldo esperado em dinheiro físico e separação dinheiro vs movimento financeiro
type: feature
---
**Saldo esperado em DINHEIRO FÍSICO = saldo_inicial + entradas_em_dinheiro − saídas_em_dinheiro.**

Entram no dinheiro físico (payment_method='dinheiro'):
- vendas PDV em dinheiro
- pagamento SPR em dinheiro
- pagamento Fiado em dinheiro
- suprimento em dinheiro
- entrada manual em dinheiro

Reduzem o dinheiro físico:
- sangria, despesa em dinheiro, estorno em dinheiro, devolução em dinheiro, retirada

NUNCA entram no dinheiro físico: PIX, débito, crédito, transferência, fiado adquirido em aberto, vendas canceladas/excluídas, valores apenas previstos.

Fonte única de verdade no frontend: `src/lib/cash-accounting.ts` (puro, testado com 15 cenários). Toda tela/impressão deve consumir esta camada — proibido recriar a fórmula.

Trigger DB `set_cash_transfer_snapshot_fields` calcula `snapshot_expected_balance` usando apenas dinheiro. Snapshots anteriores à migration `20260618-210425` permanecem como histórico imutável e o frontend recalcula via cash-accounting.ts ao exibir.

Trigger `handle_fiado_payment` continua criando `cash_entries` para qualquer método (preserva relatórios), mas a fórmula de dinheiro físico ignora entries com `payment_method != 'dinheiro'`.

IA de conferência: edge function `analyze-cash-closing` (Lovable AI, Gemini 2.5 Flash) é read-only e apenas auxilia a auditoria.
