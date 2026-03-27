---
name: Cash session operational rules
description: Only one open session per day, only current responsible can operate, primary admin override with audit
type: feature
---
## Rules
- One open cash session per business_date (enforced by unique partial index `idx_one_open_cash_per_day`)
- Only `current_responsible_id` can: sell (PDV), create entries, close, register SPR payments
- Transfer is the only way to change responsible
- Blocked attempts logged as `cash_operation_blocked_wrong_user`

## Primary Admin Override
- Profile flags: `is_primary_admin`, `has_operational_override` (both boolean)
- User: saulocmoreira@gmail.com (id: 2042db5c-c744-4def-9b05-c6f9ab40a072)
- Can operate any session in override mode with mandatory reason + full audit
- Override events: `primary_admin_override_used`, `primary_admin_cash_operation`, etc.
- OverrideConfirmDialog component handles reason collection
- useCashSession hook provides session state and override detection

## Security Central
- New tabs: Bloqueios, Override
- New event labels for blocked and override actions
