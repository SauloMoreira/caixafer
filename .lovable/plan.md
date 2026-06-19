# Livro de Movimento de Caixa Virtual

Nova tela `/livro-caixa` que organiza os movimentos diários em formato de livro-caixa digital, consumindo os dados já existentes (sales, cash_entries, cash_closings) sem alterar a lógica contábil validada.

## Escopo

- Tela nova: **Livro de Movimento de Caixa**
- Sem novas tabelas no banco — tudo derivado das tabelas atuais
- Sem mudanças nos cálculos do fechamento, extrato ou camada `cash-accounting.ts`
- Apenas Admin e Coordenador veem (mesmo padrão das telas financeiras)

## Estrutura de cada "página"

Cada página = uma `business_date`.

**Cabeçalho:**
- Título "LIVRO DE MOVIMENTO DE CAIXA"
- Data
- Nº da página (00001, 00002…) sequencial por empresa, atribuído pela ordem cronológica das datas que tiveram `cash_closings`
- Empresa (nome do `companies`)

**Tabela:**
| DOC Nº | Origem | Histórico | Entrada | Saída | Tipo de Documento | Referência do Documento |

DOC Nº reinicia em 01 a cada página.

## Regras de geração de linhas

**Consolidadas** (uma linha por categoria × forma de pagamento):
- PDV → "PDV Dinheiro", "PDV PIX", "PDV Débito", "PDV Crédito", "PDV Transferência" (Origem: PDV)
- Biblioteca → "Biblioteca PIX" etc. (Origem: Biblioteca) — derivado de vendas com `notes` contendo "biblioteca"
- Bazar → idem (Origem: Bazar)
- Doações consolidadas por forma quando sem documento (Origem: Doação)

**Analíticas** (uma linha por lançamento):
- Mensalidades (sempre, mesmo sem doc)
- Qualquer `cash_entry` com `document_type` ou `document_reference` preenchido
- Despesas, sangrias, estornos, retiradas, suprimentos, ajustes manuais → uma linha cada
- Pagamentos SPR/Fiado → uma linha cada (Origem: SPR/Fiado)

**Origem** segue o `source_type`/categoria do lançamento original: PDV, Biblioteca, Bazar, SPR, Fiado, Mensalidade, Doação, Despesa, Sangria, Estorno, Ajuste Manual, Suprimento, Outro.

**Histórico** = padrão "Origem + Forma de pagamento" para consolidados, ou "Tipo + descrição" para analíticos.

## Rodapé da página

- Total Entradas (soma de toda coluna Entrada)
- Total Saídas (soma de toda coluna Saída)
- Saldo Anterior (saldo esperado em dinheiro físico da última página com movimento anterior à data, usando `computePhysicalCash`)
- Saldo Atual (saldo esperado em dinheiro físico do dia)
- Detalhamento por forma de pagamento (dinheiro, PIX, débito, crédito, transferência)

Todos os totais consomem `src/lib/cash-accounting.ts` (sem recriar fórmulas).

## Quando não houver movimento

- Cabeçalho preenchido, tabela vazia
- Mensagem central: "NÃO HOUVE MOVIMENTO NESTA DATA"
- Totais zerados; Saldo Anterior = Saldo Atual = último saldo conhecido
- Sem número de página (mostra "—")

## Tela de consulta

**Filtros:** data específica, intervalo de datas, busca por nº da página, empresa (no momento sempre a empresa atual).

**Navegação:** botões Página Anterior / Próxima / Ir para Hoje.

**Ações:** Visualizar, Imprimir (térmica 80mm + A4 paisagem para auditoria), Reprocessar (recarrega dados — não altera nada).

## Layout visual

- Estética de livro-caixa: cabeçalho destacado, tabela com linhas separadas, fontes legíveis, rodapé contábil
- Impressão **B&W**, A4 paisagem para o livro completo (mais legível para auditoria), com cabeçalho e rodapé fixos
- Botão extra para impressão térmica 80mm resumida

## Implementação técnica

**Arquivos novos:**
- `src/lib/cash-book.ts` — funções puras: `buildBookPage(date, sales, entries, prevBalance)` → lista de linhas + totais; `assignPageNumbers(closings)` → mapa date→número
- `src/pages/LivroCaixaPage.tsx` — tela completa
- Rota `/livro-caixa` em `App.tsx`
- Item de menu no `sidebar-config.tsx` para Admin/Coordenador

**Dados consumidos** (sem migrations):
- `cash_closings` (datas + saldo inicial para sequência de páginas e cálculo de saldo anterior)
- `sales` + `sale_items.notes` para Bazar/Biblioteca
- `cash_entries` para mensalidades, doações, despesas, etc.
- `spr_fiado_payments` (já espelhados em `cash_entries` via trigger — usar `cash_entries` para não duplicar)

**Garantias contábeis:**
- Testes adicionais em `src/lib/__tests__/cash-book.test.ts` validando:
  - Total Entradas − Total Saídas + Saldo Anterior = Saldo Atual
  - Saldo Atual = `computePhysicalCash(...).expectedCash` para o mesmo dia
  - Bazar/Biblioteca + outras formas PDV = total de vendas (sem duplicidade)
- Nenhuma alteração em `cash-accounting.ts`, `FechamentoPage.tsx`, `CashDayStatement.tsx`, `CashAnalyticalStatement.tsx`

## Critérios de aceite

- Tela acessível em `/livro-caixa` para Admin/Coordenador
- Páginas numeradas sequencialmente
- DOC Nº reinicia a cada página
- Consolidação + analítico conforme regras
- Coluna Origem presente
- Mensagem "NÃO HOUVE MOVIMENTO NESTA DATA" quando aplicável
- Filtros, navegação e impressão funcionais
- Testes passando, sem regressão no fechamento