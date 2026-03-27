---
name: Cash session transfers
description: Cashier-to-cashier transfer of cash register responsibility with dual authorization, audit trail, and notifications
type: feature
---
## Overview
Allows a cashier to transfer responsibility of an open cash register session to another cashier, requiring dual authorization (requester + acceptor).

## Database
- `cash_session_transfers` table with status enum (pending, accepted, rejected, cancelled)
- `cash_closings` has `current_responsible_id`, `transfer_count`, `last_transfer_id`
- Trigger `audit_cash_transfers` auto-creates audit logs and notifications on insert/update
- RLS: involved parties can view; from_user can insert/cancel; to_user can accept/reject; admin full access

## Flow
1. Caixa 1 requests transfer → selects target cashier + mandatory reason
2. Caixa 2 gets notification + banner to accept/reject
3. On acceptance: `current_responsible_id` updated, Caixa 2 can operate
4. Caixa 1 loses write access to the session

## Components
- `CashTransferDialog` — request modal with cashier selection and reason
- `PendingTransferBanner` — shows incoming/outgoing pending transfers (polls every 30s)
- `CashTransferHistory` — displays transfer history for a session

## Reasons
troca_turno, saida_antecipada, pausa_operacional, continuidade_atendimento, outro
