# Project Memory

## Core
Caixa da FER - POS/cash register for Cantina da FER. Mobile-first, light theme, teal primary (168 60% 38%). Plus Jakarta Sans font. Supabase backend with strict RLS. Roles: admin (full access), cashier (own data, current day only).

## Memories
- [Design system](mem://design/tokens) — Teal primary palette, income/expense/warning colors, financial-value utility classes
- [Database schema](mem://features/schema) — 10 tables: profiles, products, sales, sale_items, cash_entries, cash_closings, spr_volunteers, spr_fiado_charges, spr_fiado_charge_items, spr_fiado_payments
- [Auth & permissions](mem://features/auth) — admin sees all, cashier only own data for current business_date. has_role() security definer function. Approval flow: first user = auto-admin, rest need admin approval. Profile completion required (name, phone, address, email, avatar).
- [SPR Ramatis](mem://features/spr) — Fiado module for volunteers. Payment triggers auto cash_entry creation via handle_fiado_payment() trigger
- [Profile system](mem://features/profile) — profiles has phone, address, email, avatar_url, approval_status (pending_approval/approved/rejected), approved_by, approved_at. Avatars in Supabase Storage bucket 'avatars'. First-access redirect to complete profile.
