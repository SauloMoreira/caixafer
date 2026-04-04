# Memory: constraints/saas-single-tenant-phase
Updated: 2026-04-04

## Decisão: Empresa Única — Não Expandir Multiempresa Nesta Fase

A fundação SaaS está consolidada e auditada. O sistema opera como empresa única (Caixa da FER, ID: `a0000000-0000-0000-0000-000000000001`).

### O que NÃO fazer agora:
- Não implementar isolamento multiempresa por RLS via company_id
- Não criar troca de tenant na interface
- Não adicionar seletor de empresa
- Não refatorar RLS existente para filtrar por company_id
- Não alterar comportamento atual de nenhuma funcionalidade

### Regra para novas implementações:
- Novas tabelas operacionais devem incluir `company_id uuid DEFAULT 'a0000000-0000-0000-0000-000000000001'::uuid` quando relevante
- Novas queries devem ser compatíveis com contexto de empresa única
- Novos documentos/impressões devem usar dados da empresa via `useCompany()`
- Novas permissões devem considerar a empresa atual
- Não é necessário adicionar filtro explícito de company_id nas queries do frontend nesta fase

### Fundação já implementada (preservar):
- Tabela `companies` com dados completos (CNPJ, logo, tema, rodapé)
- `company_id` em 16 tabelas operacionais com default para empresa padrão
- `company_memberships` com 12 usuários vinculados
- Funções `get_user_company_id()` e `user_belongs_to_company()` prontas
- Trigger `handle_new_user_company_membership` funcional
- `useCompany()` hook e `useThemeColor()` consumindo dados dinâmicos
- Documentos (recibo, demonstrativo) usando dados da empresa
