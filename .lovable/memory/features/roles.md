---
name: User roles system
description: Three roles (admin, cashier, volunteer) with different access levels and menu visibility
type: feature
---
## Roles
- **admin**: Full access to all features
- **cashier**: Own data for current business_date, PDV, movements, closing, reports, SPR management
- **volunteer**: Only Meu SPR (/meu-spr), profile, and dashboard redirect to meu-spr

## Assignment
- First user auto-approved as admin
- All other users start as pending_approval with cashier role
- Admin assigns role after approval (admin, cashier, volunteer)
- Volunteer role requires linking to spr_volunteers via volunteer_id in profiles

## Volunteer Access
- Menu: Meu Consumo, Perfil, Sair (no Início or Pendências)
- Route: /meu-consumo (renamed from /meu-spr)
- Cannot access: PDV, movimentos, fechamento, produtos, relatórios, usuários, SPR management
- Profile completion: name, phone, email (no address/avatar required)

## Route Protection
- ProtectedRoute accepts `allowedRoles` prop
- `adminOnly` prop still works for backwards compatibility
