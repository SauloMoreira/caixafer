# Project Memory

## Core
Caixa da FER - POS/cash register for Cantina da FER. Mobile-first, light theme, teal primary (168 60% 38%). Plus Jakarta Sans font. Supabase backend with strict RLS. Roles: admin (full access), cashier (own data, current day only), volunteer (own SPR data only).

## Memories
- [Design system](mem://design/tokens) — Teal primary palette, income/expense/warning colors, financial-value utility classes
- [Database schema](mem://features/schema) — 11 tables: profiles (with volunteer_id), products, sales, sale_items, cash_entries, cash_closings, spr_volunteers, spr_fiado_charges, spr_fiado_charge_items, spr_fiado_payments, notifications
- [Auth & permissions](mem://features/auth) — admin sees all, cashier only own data for current business_date, volunteer sees only own SPR data via volunteer_id link. has_role() security definer function. Approval flow: first user = auto-admin, rest need admin approval.
- [SPR Ramatis](mem://features/spr) — Fiado module for volunteers. Payment triggers auto cash_entry creation via handle_fiado_payment() trigger. Volunteer users access /meu-spr.
- [Profile system](mem://features/profile) — profiles has phone, address, email, avatar_url, approval_status, volunteer_id. Avatars in Storage bucket 'avatars'.
- [User roles](mem://features/roles) — app_role enum: admin, cashier, volunteer. Admin assigns roles after approval. Volunteer must be linked to spr_volunteers via volunteer_id.
- [Notifications](mem://features/notifications) — SPR > 30 days notifications. refresh_spr_notifications() DB function generates/cleans notifications. Bell in AppLayout for admin/volunteer. Admin page at /notificacoes.
