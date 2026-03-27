---
name: Central de Segurança com Alertas Inteligentes
description: Admin security dashboard with 5 tabs (alerts, overview, transfers, changes, incidents), AI enrichment, rules engine, real-time, review workflow
type: feature
---
## Architecture
1. Audit logs (DB triggers) → raw events in security_audit_logs
2. Trigger `evaluate_security_alert` scores events on INSERT
3. Score ≥30 → security_alert_candidates + security_alerts created
4. Score ≥50 → requires_admin_review + admin notifications
5. Edge function `process-security-alerts` enriches with AI summary
6. Email/WhatsApp delivery tracked in security_alert_deliveries

## Scoring Rules
- Event type: transfer=25-40, reopen=35, delete=30, unauthorized=25, blocked_mfa=40
- Severity boost: critical=30, high=20, medium=5
- requires_admin_review boost: +15
- Financial delta: +20
- Recurrence in same session: +15
- Score <30: no alert. 30-49: medium. 50-69: high. 70+: critical/urgent

## Deduplication
- Fingerprint = md5(event_type + session_id + business_date + user_id)
- 30min dedup window

## Tables
- security_alert_candidates: score, status (pending/promoted/deduplicated)
- security_alerts: severity, priority, title, summary (AI), recommended_action (AI), fingerprint, review workflow
- security_alert_deliveries: channel (email/whatsapp), delivery_status, provider_response

## UI Tabs
1. Alertas (default, with unread count badge): filtered alerts with severity/priority/review badges, AI summary, review workflow
2. Visão Geral: 6 stat cards, pending review banner, critical events
3. Transferências: transfer audit logs
4. Alterações: cash/sale/entry change logs
5. Incidentes: security incidents + incident-type logs

## Email
Not yet configured - needs email domain setup. Will use Lovable email infrastructure.

## WhatsApp
Z-API integration planned for Phase 2.
