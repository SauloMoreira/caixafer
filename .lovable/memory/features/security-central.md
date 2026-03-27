---
name: Central de Segurança
description: Admin-only security dashboard with 4 tabs (overview, transfers, changes, incidents), real-time updates, badges, filters, audit detail view
type: feature
---
## Tabs
- Visão Geral: 6 stat cards (transfers/changes/deletions/reopens/incidents/notifications today), pending review banner, critical events, latest actions
- Transferências de Caixa: filtered list of transfer-related audit logs
- Alterações de Caixa: filtered list of cash/sale/entry changes
- Incidentes e Acessos: security incidents + incident-type audit logs

## Filters
- Text search (name, reason, event)
- Severity (info/medium/high/critical)
- Entity type (caixa/transferência/lançamento/venda/perfil)
- Status (completed/pending/rejected/cancelled)
- Requires admin review toggle

## Badges
- Severity: color-coded (blue/amber/red)
- Entity type: color-coded per entity
- Status: color-coded
- Role badge (admin/cashier)
- "Revisão" badge for requires_admin_review

## Database
- security_audit_logs: added session_id, action_summary, reason, ip_address, user_agent, status, requires_admin_review, target_role
- Indexes on all filterable columns
- Realtime enabled on security_audit_logs
- Triggers updated: audit_cash_transfers (includes cash_responsibility_changed event with session snapshot), audit_cash_closings_changes, audit_sales_changes, audit_cash_entries_changes — all now populate action_summary, requires_admin_review, status

## Detail Dialog
Shows: event, summary, entity, severity, status, actor, role, target, dates, session_id, reason, route, notes, old_data, new_data, diff view
