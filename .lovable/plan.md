
# Revisão Contábil do Fechamento de Caixa

Frente focada em **confiabilidade dos cálculos, clareza do extrato e legibilidade da impressão**. Executada em blocos incrementais, sem apagar histórico nem alterar dados já gravados.

## Princípio contábil central

```
Saldo esperado em DINHEIRO =
  Saldo inicial em dinheiro
+ Entradas em dinheiro (PDV dinheiro + SPR dinheiro + Fiado pago em dinheiro + Suprimentos + Entradas manuais)
- Saídas em dinheiro (Sangrias + Despesas dinheiro + Devoluções dinheiro + Estornos dinheiro + Retiradas)
```

PIX, débito, crédito, fiado adquirido em aberto, vendas canceladas e valores previstos **NUNCA** entram no dinheiro físico — aparecem apenas no Movimento Financeiro.

---

## Bloco 1 — Diagnóstico (somente leitura, sem alterar dados)

Mapear hoje a fórmula real em uso e identificar onde dinheiro/não-dinheiro estão misturados.

Arquivos a inspecionar:
- `FechamentoPage.tsx`, `CashDayStatement.tsx`, `CashSessionPeriods.tsx`, `MovimentosPage.tsx`, `CashCorrectionReview.tsx`
- DB: `set_cash_transfer_snapshot_fields`, `handle_fiado_payment`, `audit_cash_*`, `validate_*`
- Utilitários de impressão (térmica/A4)

Entrega: `.lovable/diagnostico-fechamento.md` listando:
- Fórmula atual de `expected_balance` (esperada vs implementada)
- Pontos onde PIX/cartão entram indevidamente no dinheiro físico
- Como pagamento SPR/Fiado é replicado em `cash_entries` (risco de duplicidade no trigger `handle_fiado_payment`)
- Tratamento atual de estornos e cancelamentos
- Identificadores únicos existentes em pagamentos consolidados

**Sem código alterado neste bloco.**

---

## Bloco 2 — Camada de cálculo unificada (frontend)

Criar um único módulo `src/lib/cash-accounting.ts` que toda a tela e a impressão usam, eliminando divergências entre views.

Funções puras:
- `computePhysicalCash(session, sales, entries)` → `{ openingBalance, cashIn, cashOut, expectedCash, breakdown }`
- `computeFinancialMovement(sales, entries, fiadoPayments)` → totais por forma de pagamento + em aberto + cancelado + estornado
- `computeClosingDifference(expectedCash, countedCash)` → `{ diff, status: 'ok'|'sobra'|'falta' }`

Regras explícitas (com testes):
- `payment_method='dinheiro'` → caixa físico
- `pix|debito|credito|transferencia` → só financeiro
- `spr_fiado_charges` (aquisição) → nunca soma em dinheiro
- `spr_fiado_payments` em dinheiro → soma; em PIX/cartão → só financeiro
- `is_deleted=true` ou status cancelado → fora dos totais positivos, somados em "Cancelado"
- Estorno em dinheiro → saída; estorno não-dinheiro → só financeiro

Sem mexer em triggers de DB neste bloco — apenas leitura agregada no cliente, mesma fonte para tela e impressão.

---

## Bloco 3 — Testes contábeis (Vitest)

`src/lib/__tests__/cash-accounting.test.ts` cobrindo os 6 cenários do pedido:

1. Caixa sem diferença (100 + 50 PDV$ + 20 Fiado$ − 30 sangria = 140)
2. PIX não entra no dinheiro (esperado = 100)
3. Cartão não entra no dinheiro (esperado = 100)
4. Fiado adquirido não entra (esperado = 100)
5. Fiado pago em dinheiro entra (esperado = 160)
6. Sangria reduz o esperado (100 + 100 − 50 = 150)

Bloco só é considerado concluído quando todos passarem.

---

## Bloco 4 — Novo Extrato / Tela de Fechamento

Reorganizar `FechamentoPage` / `CashDayStatement` em duas seções claramente separadas:

**A) Caixa Físico (Dinheiro)**
- Saldo inicial · Entradas em dinheiro · Saídas em dinheiro · Saldo esperado · Valor contado · Diferença · Status (OK/Sobra/Falta)

**B) Movimento Financeiro do Dia**
- Vendas por forma de pagamento · Pagamentos SPR por forma · Pagamentos Fiado por forma · Total vendido · Total recebido · Em aberto · Cancelado · Estornado

**Listagens detalhadas:**
- Entradas em dinheiro: hora, origem (PDV/SPR/Fiado/Suprimento), descrição, valor, usuário, ID
- Saídas em dinheiro: hora, tipo (Sangria/Despesa/Estorno/Devolução/Ajuste), descrição, valor, usuário, ID
- Movimentos não-dinheiro: agrupados por forma, com aviso "não compõem o dinheiro físico"

**Bloco de conferência destacado** ao final com saldo esperado × contado × diferença e a mensagem explicativa pedida.

Sem alterar regras de negócio — só reorganizar a visualização sobre os dados já existentes.

---

## Bloco 5 — Análise da IA (Conferência)

Edge Function `analyze-cash-closing` (Lovable AI, `google/gemini-3-flash-preview`) recebe o snapshot do fechamento e devolve:
- Possíveis causas da diferença
- Lançamentos em dinheiro a conferir
- Sangrias/despesas do dia
- SPR/Fiado recebidos em dinheiro
- Pagamentos PIX/cartão que NÃO deveriam estar no dinheiro físico
- Cancelamentos/estornos · movimentos manuais · operações sem ID
- Sugestões objetivas

Componente `CashClosingAIReview` exibido na tela de fechamento. **Read-only**, não altera dados.

---

## Bloco 6 — Impressão legível (alta legibilidade)

Layout dedicado de impressão do fechamento (`CashClosingPrintout`):
- Texto preto (#000), nada de cinza claro
- Fonte base 14px; títulos 16–18px; valores totais em negrito; diferença em destaque grande
- Tabelas com bordas visíveis, espaçamento generoso
- Boa renderização em P&B
- Cabeçalho (casa, data, operador, hora impressão) · Resumo financeiro · Detalhamento (Entradas, Saídas, PDV, SPR, Fiado, Sangrias, Despesas, Estornos, Cancelamentos) · Campos de assinatura (operador + administrador) · Observações
- Mesma fonte de dados do módulo `cash-accounting.ts` (tela = impressão)

Mantém a impressão térmica existente intacta; este layout é específico A4 para conferência contábil.

---

## Bloco 7 — Validação de pagamentos SPR/Fiado e identificadores

Conferir (e corrigir se necessário) que:
- `handle_fiado_payment` não duplica valor no caixa físico
- Pagamentos consolidados aparecem **uma única vez** mesmo quitando vários itens
- Cada pagamento tem identificador único rastreável (`payment_id`/`source_id`)

Se faltar identificador estável, criar migration mínima adicionando coluna `payment_group_id` em `spr_fiado_payments` (sem apagar dados existentes).

---

## Bloco 8 — Relatório final

Documento curto com: causas encontradas, correções aplicadas, validações, testes executados e pendências residuais. Confirmação de que o caixa ficou consistente e auditável.

---

## Regras de execução

- Incremental: rodar um bloco por vez, validar, seguir.
- Não apagar histórico nem reescrever dados já gravados.
- Toda alteração de cálculo preserva rastreabilidade (audit logs continuam).
- Não misturar com outras frentes.
- Parar ao fim de cada bloco para validação do usuário.

## Detalhes técnicos

- Fonte única de cálculo no frontend: `src/lib/cash-accounting.ts` (puro, testável).
- Testes: Vitest, sem dependência de DB.
- IA: Edge Function Supabase via Lovable AI Gateway (Gemini 3 Flash).
- Impressão A4: componente React isolado + CSS `@media print` com `color-adjust: exact`.
- Migrations só se Bloco 7 confirmar necessidade.

## Recomendação de partida

Começar por **Bloco 1 (diagnóstico)** isoladamente — leitura pura, zero risco — para ancorar correções dos blocos seguintes em fatos do código atual, não em suposições.

**Perguntas antes de aprovar:**
1. OK iniciar somente pelo Bloco 1 (diagnóstico, sem código)?
2. Impressão A4 dedicada de fechamento substitui a térmica de 80mm para esse relatório, ou ambas devem coexistir?
3. Há um dia/sessão específico com diferença para usar como caso real no diagnóstico?
