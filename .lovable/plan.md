# Detalhe de Fiado por Pessoa — SPR Ramatis

Adicionar um modal de detalhe completo ao clicar no nome da pessoa na aba **Fiados** da tela `SPR Ramatis`, com histórico, consolidação por operação de pagamento, linha do tempo do saldo e análise por IA (admin).

## Escopo

### 1. Clique no nome (lista de Fiados — `src/pages/SPRPage.tsx`)
- Hoje o card de fiado mostra `volunteer_name`. Tornar o nome clicável → abre `VolunteerFiadoDetailDialog` com `volunteerId`.
- Não alterar lógica de pagamento existente nem listagem.

### 2. Novo componente `VolunteerFiadoDetailDialog`
Modal full-screen em mobile / `max-w-4xl` em desktop, com botão **X** e **Voltar**.

**Cabeçalho:**
- Nome, status geral (Em aberto / Parcial / Quitado)
- Cards: Saldo devedor atual, Total adquirido (período), Total pago (período), Último pagamento, Qtd lançamentos em aberto, Qtd pagamentos
- Filtro de período: Hoje · 7 dias · 30 dias · Mês atual · Personalizado (date range)

**Abas (`Tabs`):**
1. **Resumo** — totais + lista compacta dos últimos movimentos
2. **Fiados adquiridos** — todos lançamentos com data/hora, descrição, qtde, valor, usuário, status, observações
3. **Pagamentos** — consolidados por `payment_group_id`; uma linha por operação com expand (Collapsible) mostrando os itens baixados, IDs, forma de pagamento, valor, usuário receptor
4. **Linha do tempo** — cronologia com Débito / Crédito / Saldo após (calculado incrementalmente)
5. **Auditoria** (somente admin) — usuários que lançaram/receberam, cancelamentos, ajustes, pagamentos sem `payment_group_id`

**Análise IA (admin)** — bloco acima/dentro de Resumo, reutilizando a edge function `daily-audit-analysis` com um payload focado na pessoa (ou novo prompt local). Vamos estender a função existente para aceitar `scope: 'volunteer'` com dados pré-agregados; sem alteração de regras de negócio.

### 3. Hook `useVolunteerFiadoHistory(volunteerId, range)`
Centraliza consultas:
- `spr_fiado_charges` da pessoa no período (com `spr_fiado_charge_items` para descrição/qtd)
- `spr_fiado_payments` da pessoa no período, ordenado por `payment_group_id`
- Saldo anterior ao início do período (charges - payments anteriores) → seed da linha do tempo
- Perfis dos usuários (`created_by`) via `get_user_names`

Retorna: `summary`, `charges[]`, `paymentGroups[]`, `timeline[]`, `previousBalance`, `loading`.

### 4. Visão do colaborador
- Rota atual `/meu-spr` (`MeuSPRPage`) já existe. Reaproveitar o mesmo dialog passando `volunteerId = profile.volunteer_id` e `mode="self"`:
  - Esconde aba Auditoria
  - Esconde análise IA detalhada; mostra frase simples: "Seu saldo atual é R$ X. No período você adquiriu R$ Y e pagou R$ Z."
  - Sem botões de edição
- Adicionar botão "Ver meu histórico completo" em `MeuSPRPage`.

### 5. Permissões
- Admin: pode abrir qualquer pessoa.
- Cashier/Coordinator: abrir qualquer pessoa (somente leitura no dialog — já é só leitura).
- Volunteer: apenas próprio `volunteer_id`. Bloquear no componente (já é restringido por RLS).
- Nada muta dados no dialog — 100% consultivo.

### 6. Consolidação
- Usa `payment_group_id` já existente em `spr_fiado_payments` (migração feita anteriormente).
- Pagamentos sem `payment_group_id` aparecem em **Auditoria** com flag "sem agrupamento".

### 7. Export (admin)
- Botões CSV e PDF dentro do dialog (admin only).
- CSV: reaproveitar utilitário de `src/lib/audit-export.ts` com pequena extensão para `volunteerExportCsv`.
- PDF: usar `print-window` existente (impressão do conteúdo do dialog).

## Arquivos

**Novos:**
- `src/components/spr/VolunteerFiadoDetailDialog.tsx` (modal + abas)
- `src/components/spr/VolunteerTimelineTable.tsx`
- `src/components/spr/VolunteerPaymentsList.tsx` (linha consolidada + Collapsible)
- `src/hooks/useVolunteerFiadoHistory.ts`
- `src/lib/volunteer-history-export.ts`

**Editados:**
- `src/pages/SPRPage.tsx` — nome clicável + state do dialog
- `src/pages/MeuSPRPage.tsx` — botão "Ver meu histórico"
- `supabase/functions/daily-audit-analysis/index.ts` — aceitar `scope: 'volunteer'` com payload pré-agregado (opcional, fallback para resumo local se vier vazio)

## Fora de escopo
- Não alterar lógica de criação/baixa de fiado.
- Não alterar RLS (já cobre).
- Não criar nova tabela/coluna — `payment_group_id` já existe.
- Cancelamentos/estornos: exibir se existirem em `audit_logs`, sem nova feature de execução.
