# ADR-002: Shared database with defense-in-depth tenant isolation

- Status: Accepted as M1 implementation constraint
- Date: 2026-08-14

## Context

Financial and operational data from multiple companies will share the platform. A forged
identifier, buggy query, or hidden UI route must not expose another tenant. Low initial cost
also matters.

## Decision

Use a shared PostgreSQL database and shared schema with tenant ownership represented by
`company_id` on every business table or by an unambiguous tenant-owned parent. Resolve the
effective tenant from the authenticated user and active membership. Enforce access twice:
central backend permission checks and PostgreSQL RLS. Treat storage and Power BI mappings as
the same tenant boundary. Maintain a centralized role-to-permission matrix.

The browser may request a resource but cannot establish its authorization context. Service
role is server-only, used narrowly, and never substitutes for business authorization or audit.
Cross-tenant denial tests are merge-blocking for relevant changes.

## Consequences

- Shared infrastructure is cost-efficient and easier to operate initially.
- Every migration/query/repository needs tenant review and tests.
- RLS reduces blast radius of backend mistakes, while API checks provide clearer use-case
  authorization and protect non-database resources.
- SUPER_ADMIN workflows need explicit policies and immutable audit trails.
- Moving a company between tenants is not an ordinary update operation.

## Alternatives considered

- Database per company: strongest physical separation but excessive provisioning, migration,
  backup, and connection overhead at the expected scale.
- Schema per company: complicates migrations and analytics while still sharing infrastructure.
- Backend filters only: rejected because one missed predicate becomes a cross-tenant breach.
