# Project Memory

## Core
Caixa da FER - POS/cash register for Cantina da FER. Mobile-first, light theme, teal primary (168 60% 38%). Plus Jakarta Sans font. Supabase backend with strict RLS. Roles: admin (full access), cashier (own data, current day only).

## Memories
- [Design system](mem://design/tokens) — Teal primary palette, income/expense/warning colors, financial-value utility classes
- [Database schema](mem://features/schema) — 10 tables: profiles, products, sales, sale_items, cash_entries, cash_closings, spr_volunteers, spr_fiado_charges, spr_fiado_charge_items, spr_fiado_payments
- [Auth & permissions](mem://features/auth) — admin sees all, cashier only own data for current business_date. has_role() security definer function
- [SPR Ramatis](mem://features/spr) — Fiado module for volunteers. Payment triggers auto cash_entry creation via handle_fiado_payment() trigger
- [Cash transfers](mem://features/cash-transfers) — Cashier-to-cashier transfer with dual authorization, audit trail, notifications
- [Roles](mem://features/roles) — Role system details
- [Security Central](mem://features/security-central) — Admin security dashboard: 4 tabs, filters, badges, real-time, audit detail view. Audit logs have session_id, action_summary, reason, status, requires_admin_review
