# Diagnóstico Contábil — Módulo de Fechamento de Caixa

> **Gerado por:** análise estática (read-only). Nenhum arquivo foi alterado.
> **Data da análise:** investigação das migrations + código-fonte frontend.

---

## 1. Fórmula Real de `expected_balance`

### 1.1 Trigger DB — `set_cash_transfer_snapshot_fields`

**Arquivo:** `supabase/migrations/20260331210623_b64e2dcc-3e95-48f5-8813-378eac4f3459.sql`
(versão anterior no arquivo `20260331205336_...sql`, sobrescrita pela migração posterior)

**Fórmula exata (linha 95):**
```sql
v_expected_balance := v_opening_balance + v_sales_total + v_income_total - v_expense_total;
```

Onde:
- `v_sales_total` = `SUM(s.total_amount)` de **todas** as formas de pagamento (`WHERE s.business_date = NEW.business_date AND COALESCE(s.is_deleted, false) = false`) — linhas 61-79.
- `v_income_total` = `SUM(cash_entries.amount WHERE entry_type = 'income')` — também sem filtro de `payment_method` — linhas 81-93.
- `v_expense_total` = `SUM(cash_entries.amount WHERE entry_type = 'expense')` — idem.

**⚠️ BUG CONTÁBIL — CONFIRMADO:**
A fórmula usa `v_sales_total` que é a soma de **todas as formas de pagamento** (PIX, débito, crédito, transferência e dinheiro somados juntos). O campo `v_cash_total` (só dinheiro físico) é calculado separadamente na linha 62 e salvo em `snapshot_cash_total` (linha 102), mas **não entra no cálculo do `expected_balance`**.

Resultado: `snapshot_expected_balance` inclui PIX + débito + crédito + transferência no saldo esperado em dinheiro, inflando o valor esperado em caixa.

**Fórmula contábil correta deveria ser:**
```sql
v_expected_balance := v_opening_balance + v_cash_total + v_income_cash_only - v_expense_cash_only;
```

**Adicionalmente:** `v_income_total` inclui pagamentos de fiado (`source_type = 'spr_fiado_payment'`) de qualquer método (PIX, débito etc.) pois não há filtro de `payment_method` na query de `cash_entries` (linhas 81-93). O subtotal de fiado está calculado mas apenas como informação (`v_fiado_payment_total`, linha 107), sem ser subtraído da fórmula.

### 1.2 Frontend — FechamentoPage.tsx

**Arquivo:** `src/pages/FechamentoPage.tsx:211`
```typescript
const expectedBalance = Number(openingBalance) + stats.sales + stats.income - stats.expense;
```

- `stats.sales` = soma de `total_amount` de todas as vendas ativas (`!is_deleted`) sem filtro de `payment_method` — linhas 175-176.
- `stats.income` = soma de `amount` de todas as `cash_entries` com `entry_type = 'income'` e `!is_deleted` — linhas 188-189.
- `stats.expense` = idem para `expense` — linha 190.

**⚠️ Mesmo bug:** PIX, débito, crédito e transferência entram em `stats.sales`, inflando o saldo esperado em dinheiro físico. O breakdown por método (`salesByMethod`) existe na tela para exibição, mas não é usado para corrigir o cálculo do `expectedBalance`.

### 1.3 CashDayStatement.tsx

**Arquivo:** `src/components/CashDayStatement.tsx:219`
```typescript
const expectedBalance = openingBalance + totalSales + totalIncome - totalExpense;
```
- `totalSales` = soma de todos os métodos de pagamento (linha 218).
- `totalIncome` / `totalExpense` = sem filtro de método (linhas 186-203).

**⚠️ Mesmo bug propagado** no extrato imprimível.

### 1.4 CashSessionPeriods.tsx

**Arquivo:** `src/components/CashSessionPeriods.tsx:135`
```typescript
expectedBalance: openingBalance + cumulativeSales + cumulativeIncome - cumulativeExpense,
```
e linha 169:
```typescript
expectedBalance: openingBalance + currentStats.sales + currentStats.income - currentStats.expense,
```
**⚠️ Mesmo bug** nos períodos por responsável.

---

## 2. Trigger `handle_fiado_payment`

**Arquivo:** `supabase/migrations/20260327121555_ed4ad52b-ccb6-4dd5-a394-4b6c4056888c.sql:235-272`

```sql
CREATE OR REPLACE FUNCTION public.handle_fiado_payment()
RETURNS TRIGGER LANGUAGE plpgsql ...
AS $$
BEGIN
  -- (atualiza status da cobrança)
  INSERT INTO public.cash_entries (
    entry_type, category, description, business_date, amount,
    payment_method, ...
    created_by, source_type, source_id
  ) VALUES (
    'income', 'fiado_payment', ...,
    NEW.payment_date, NEW.amount_paid,
    NEW.payment_method, ...   -- ← usa o payment_method do pagamento
    'spr_fiado_payment', NEW.id
  );
  RETURN NEW;
END;
$$;
CREATE TRIGGER on_fiado_payment_created
  AFTER INSERT ON public.spr_fiado_payments
  FOR EACH ROW EXECUTE FUNCTION public.handle_fiado_payment();
```

**⚠️ BUG CONFIRMADO:** O trigger insere em `cash_entries` com `entry_type = 'income'` para **qualquer** `payment_method` (PIX, débito, crédito, dinheiro). Isso significa que pagamentos de fiado via PIX ou débito geram uma entrada em `cash_entries` que é somada em `v_income_total` e em `stats.income`, inflando o saldo esperado em dinheiro físico.

O campo `payment_method` é preservado na `cash_entry` (correto para rastreabilidade), mas a fórmula do `expected_balance` não filtra por `payment_method = 'dinheiro'` ao somar `income_total`.

**Não há filtro `is_deleted`** na entrada criada pelo trigger — o trigger apenas cria; a exclusão lógica posterior (`is_deleted = true`) é tratada pelo frontend e pelas queries de fechamento.

---

## 3. Componentes do Extrato/Fechamento

### 3.1 FechamentoPage.tsx

| Aspecto | Detalhe |
|---|---|
| **Campos lidos** | `sales(total_amount, payment_method, is_deleted)` + `cash_entries(entry_type, amount, is_deleted)` |
| **Filtro `is_deleted`** | ✅ Sim — `filter((s) => !s.is_deleted)` (linha 175) e `filter((e) => !e.is_deleted)` (linha 188) |
| **Diferencia dinheiro de não-dinheiro** | ❌ Não no cálculo do `expectedBalance`. Sim apenas para exibição em `salesByMethod` |
| **Impressão vs. tela** | ✅ Mesma fonte: usa `stats.sales`, `stats.income`, `stats.expense`, `expectedBalance` — consistente entre tela (linha 704-708) e impressão (linhas 365-369 e RawBT linha 828-833) |

**Nota:** o operador não-admin vê apenas seus próprios registros (`eq('created_by', profile.id)` — linhas 173, 186), mas o admin vê todos. Isso pode causar **divergência de saldo** se existirem entradas de múltiplos operadores no mesmo dia.

### 3.2 CashDayStatement.tsx

| Aspecto | Detalhe |
|---|---|
| **Campos lidos** | `sales(total_amount, payment_method, created_at, sale_number, notes)` + `cash_entries(id, entry_type, category, description, amount, payment_method, ...)` |
| **Filtro `is_deleted`** | ✅ Sim — `.eq('is_deleted', false)` nas queries (linhas 136, 143) |
| **Diferencia dinheiro** | ❌ Não no `expectedBalance`. Sim para exibição via `salesByMethod` e `sprByMethod` |
| **Impressão vs. tela** | ✅ Mesma fonte: usa `printRef.current.innerHTML` (linha 229) |
| **Categorias parciais** | ⚠️ Bazar/Biblioteca são identificados por `s.notes.includes('bazar')` (linha 211) — heurística frágil |

### 3.3 CashSessionPeriods.tsx

| Aspecto | Detalhe |
|---|---|
| **Campos lidos** | Snapshots de `cash_session_transfers` (campos `snapshot_*`) + stats atuais via props |
| **Filtro `is_deleted`** | N/A — usa snapshots já calculados no momento da transferência |
| **Diferencia dinheiro** | ⚠️ `paymentBreakdown` decompõe por método (dinheiro, PIX etc.) mas `expectedBalance` de cada período soma tudo |
| **Ponto de investigação** | Período atual usa `currentSalesByMethod` mas subtrai `cumulativePayments` baseados apenas nos snapshots de vendas — **pagamentos de fiado não são subtraídos** dos `cumulativePayments` do período atual (linha 158) |

### 3.4 CashCorrectionReview.tsx

| Aspecto | Detalhe |
|---|---|
| **Campos lidos** | `sales` + `cash_entries` incluindo `is_deleted = true` (linhas 92-95, 115-120) |
| **Filtro `is_deleted`** | ⚠️ Não filtra — exibe todos, incluindo soft-deleted, para fins de revisão/correção |
| **Diferencia dinheiro** | Não calcula totais, apenas lista movimentos |
| **Impressão** | Não tem impressão direta — é UI de revisão |

### 3.5 MovimentosPage.tsx

| Aspecto | Detalhe |
|---|---|
| **Campos lidos** | `cash_entries(*)` com `.eq('is_deleted', false)` (linha 60) |
| **Filtro `is_deleted`** | ✅ Sim na listagem principal |
| **Diferencia dinheiro** | ❌ Não — lista todos os métodos sem distinção |
| **Impressão** | Sem funcionalidade de impressão |

### 3.6 useDailyAudit.ts

| Aspecto | Detalhe |
|---|---|
| **Campos lidos** | `sales(*)`, `cash_entries(*)`, `spr_fiado_charges(*)`, `spr_fiado_payments(*)`, `stock_movements(*)` |
| **Filtro `is_deleted`** | ⚠️ Busca **tudo** (linhas 81-88), filtra em memória: `pdv_total` exclui deletados (linha 265), mas `rows` inclui deletados com `origin = "Estorno"` (linha 154) |
| **Diferencia dinheiro** | ❌ `income_total` e `expense_total` somam todos os métodos (linhas 281-286) |
| **Duplicação de fiado** | ⚠️ `spr_fiado_payments` gera linha no audit (`payment-group-${gid}`) E também gera `cash_entries` via trigger — ambas aparecem em `rows`. O audit agrupa pagamentos por `payment_group_id` (linha 205) mas a `cash_entry` correspondente aparece separadamente como `entry-${e.id}` (linha 149). Isso pode causar **dupla exibição** do mesmo recebimento de fiado |

---

## 4. Impressão

### 4.1 FechamentoPage — Impressão HTML (`handlePrint`)

**Arquivo:** `src/pages/FechamentoPage.tsx:380-391`

```css
body { font-family: 'Courier New', monospace; font-size: 15px; color: #000; }
```
- **Fonte:** `Courier New` (monospace) — adequada para cupom.
- **Cor:** `#000` explicitamente — bom contraste.
- **Tamanho de página:** `@page { size: 80mm auto; margin: 0; }` — formato cupom térmico.
- **Dados:** mesma fonte que a tela (`stats.*`, `expectedBalance`).

### 4.2 FechamentoPage — RawBT (`PrintButton`)

**Arquivo:** `src/pages/FechamentoPage.tsx:816-843`
- Usa mesmos valores: `stats.sales`, `stats.income`, `stats.expense`, `expectedBalance`.
- Sem estilo (texto puro para impressora térmica).

### 4.3 FechamentoPage — Bluetooth (`BluetoothPrintButton` + `printClosing`)

**Arquivo:** `src/pages/FechamentoPage.tsx:844-868`, `src/lib/bluetooth-printer.ts`
- Passa os mesmos valores de tela para `printClosing`.
- **Consistente** com a tela.

### 4.4 CashDayStatement — Impressão HTML

**Arquivo:** `src/components/CashDayStatement.tsx:229-252`
```css
body { font-family: 'Segoe UI', system-ui, sans-serif; font-size: 14px; color: #000; }
```
- **Fonte diferente** do FechamentoPage (Segoe UI vs Courier New).
- **⚠️ Inconsistência visual:** o extrato detalhado usa fonte proporcional, o fechamento usa monospace.
- **Contraste:** cor `#000` — adequado.
- **Dados:** usa `printRef.current.innerHTML` — exibe o mesmo que está na tela.

### 4.5 PrintButton.tsx / BluetoothPrintButton.tsx

- `PrintButton` é um wrapper de `usePrinter` que chama `printReceipt(lines)` — sem lógica de dados.
- `BluetoothPrintButton` é um wrapper de `connectPrinter` + callback `onPrint` — sem lógica de dados.
- Ambos são agnósticos de conteúdo; os dados são passados pelo caller.

---

## 5. Identificadores de Pagamento

### Schema de `spr_fiado_payments`

**Arquivo:** `supabase/migrations/20260327121555_ed4ad52b-ccb6-4dd5-a394-4b6c4056888c.sql:216-228`

| Campo | Tipo | Descrição |
|---|---|---|
| `id` | UUID PK | Identificador único do pagamento |
| `fiado_charge_id` | UUID FK | Cobrança que está sendo paga |
| `volunteer_id` | UUID FK | Voluntário |
| `payment_date` | DATE | Data do pagamento |
| `amount_paid` | NUMERIC(10,2) | Valor pago |
| `payment_method` | payment_method | Método |
| `created_by` | UUID FK | Operador |

**Migração posterior:** `supabase/migrations/20260610162526_1d2b17b6-d4eb-40d8-9f29-73f7911e49ae.sql`
- Adicionado `payment_group_id UUID NOT NULL DEFAULT gen_random_uuid()`.
- Registros existentes tiveram `payment_group_id = id` (migração de dados na linha 5).

### Schema de `cash_entries`

**Arquivo:** `supabase/migrations/20260327121555_ed4ad52b-ccb6-4dd5-a394-4b6c4056888c.sql:114-129`

| Campo | Tipo | Descrição |
|---|---|---|
| `id` | UUID PK | Identificador |
| `source_type` | TEXT | Ex: `'spr_fiado_payment'` |
| `source_id` | UUID | FK lógica para `spr_fiado_payments.id` |

### Análise de Duplicação

**⚠️ PONTO CRÍTICO:** O trigger `handle_fiado_payment` cria **uma `cash_entry` por `spr_fiado_payment`** (1:1). O `useDailyAudit.ts` agrupa `spr_fiado_payments` por `payment_group_id` (linha 205) e exibe como uma linha consolidada — mas também itera `cash_entries` e exibe cada entrada de `source_type = 'spr_fiado_payment'` como uma linha separada (`entry-${e.id}`, linha 155).

Resultado: **um pagamento de fiado aparece duas vezes na auditoria diária** — uma vez como `payment-group-*` e uma vez como `entry-*` correspondente.

O `payment_group_id` em `spr_fiado_payments` é único por grupo de pagamento, mas não há campo equivalente em `cash_entries` para rastrear o grupo. Há apenas `source_id` (que aponta para `spr_fiado_payments.id`, não para `payment_group_id`).

---

## 6. Tratamento de Estornos e Cancelamentos

### 6.1 Adição do `is_deleted`

**Arquivo:** `supabase/migrations/20260327154020_c33c6d70-0a85-4f54-bad4-b3c27a053daf.sql:3-28`
- Colunas `is_deleted`, `deleted_at`, `deleted_by`, `deletion_reason`, `updated_at`, `updated_by` adicionadas a `sales`, `cash_entries` e `spr_fiado_payments`.

### 6.2 Auditoria de Exclusões

**Arquivo:** `supabase/migrations/20260327191109_2ba97bc2-28ee-46ee-a524-a0d7ceb9fa45.sql:221-271`
- Trigger audita `sale_deleted` (linha 221) e `cash_entry_deleted` (linha 261) quando `is_deleted` muda de `false` para `true`.

### 6.3 Tratamento por Componente

| Tabela | FechamentoPage | CashDayStatement | CashCorrectionReview | MovimentosPage | useDailyAudit |
|---|---|---|---|---|---|
| `sales` | ✅ filtra `!is_deleted` | ✅ `.eq('is_deleted', false)` | ⚠️ inclui deletados p/ revisão | ✅ `.eq('is_deleted', false)` | ⚠️ busca tudo, mostra com badge |
| `cash_entries` | ✅ filtra `!is_deleted` | ✅ `.eq('is_deleted', false)` | ⚠️ inclui deletados p/ revisão | ✅ `.eq('is_deleted', false)` | ⚠️ busca tudo, mostra como "estorno" |
| `spr_fiado_payments` | N/A | N/A | ⚠️ inclui deletados | N/A | ⚠️ `anyDeleted` flag, não filtra |
| `spr_fiado_charges` | N/A | N/A | N/A | N/A | ✅ busca por `business_date`, sem filtro de status ativo |

**⚠️ PONTO DE INVESTIGAÇÃO:** `spr_fiado_charges` **não tem coluna `is_deleted`** no schema inicial (não encontrada nas migrations). A exclusão lógica existe apenas em `sales`, `cash_entries` e `spr_fiado_payments`. Cobranças de fiado só são canceladas indiretamente (por status `'open'`/`'partial'`/`'paid'`).

**⚠️ PONTO DE INVESTIGAÇÃO:** Quando um `spr_fiado_payment` é soft-deleted (`is_deleted = true`), a `cash_entry` correspondente criada pelo trigger `handle_fiado_payment` **não é automaticamente deletada**. Não há trigger inverso. Isso significa que o pagamento aparece como deletado em `spr_fiado_payments` mas a entrada em `cash_entries` pode continuar ativa, inflando `income_total`.

### 6.4 Trigger de snapshot (`set_cash_transfer_snapshot_fields`)

**Arquivo:** `supabase/migrations/20260331210623_b64e2dcc-3e95-48f5-8813-378eac4f3459.sql:79, 93`
```sql
AND COALESCE(s.is_deleted, false) = false   -- linha 79
AND COALESCE(ce.is_deleted, false) = false  -- linha 93
```
✅ Snapshots de transferência excluem corretamente registros soft-deleted.

---

## Resumo de Bugs Críticos

| # | Severidade | Descrição | Arquivos |
|---|---|---|---|
| B1 | 🔴 CRÍTICO | `expected_balance` inclui PIX/débito/crédito/transferência no saldo de dinheiro | `migrations/20260331210623.sql:95`, `FechamentoPage.tsx:211`, `CashDayStatement.tsx:219`, `CashSessionPeriods.tsx:135,169` |
| B2 | 🔴 CRÍTICO | `handle_fiado_payment` insere em `cash_entries` para qualquer `payment_method`, inflando `income_total` em dinheiro | `migrations/20260327121555.sql:258-268` |
| B3 | 🟠 ALTO | Pagamento de fiado aparece duplicado no audit (como `payment-group-*` e `entry-*`) | `useDailyAudit.ts:148-177, 203-238` |
| B4 | 🟠 ALTO | Soft-delete de `spr_fiado_payment` não propaga para `cash_entry` correspondente | Ausência de trigger inverso |
| B5 | 🟡 MÉDIO | Fonte de impressão inconsistente (Courier New vs Segoe UI) entre `FechamentoPage` e `CashDayStatement` | `FechamentoPage.tsx:382`, `CashDayStatement.tsx:234` |
| B6 | 🟡 MÉDIO | Operador não-admin vê apenas suas próprias vendas/entradas, causando divergência de saldo se houver múltiplos operadores no dia | `FechamentoPage.tsx:173,186` |
| B7 | 🟡 MÉDIO | `spr_fiado_charges` não tem `is_deleted`; cobranças não podem ser canceladas logicamente | Schema `migrations/20260327121555.sql:180-190` |
