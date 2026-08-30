# Architecture overview

## Scope

M0 defines boundaries and quality controls. M1 will implement identity and multi-tenancy.
Segment behavior remains configuration-driven; Food, Construction, and Cleaning are not
separate applications.

The central product direction is [Business Analytics as a Service](../product/business-analytics-as-a-service.md).
Existing operational modules are preserved as inputs and follow-up capabilities for analysis;
they do not redefine NALIE as an ERP. The incremental delivery sequence is maintained in the
[roadmap](../roadmap.md).

## Context and containers

```text
 Users
   | HTTPS + authenticated session
   v
 Next.js Web (portal + admin console, PT-BR/EN-US)
   | short-lived user token; no service-role credential
   v
 FastAPI (authentication context, permission matrix, tenant guard, orchestration)
   | scoped SQL / storage / auth operations
   +---------------------+----------------------+----------------------+
   v                     v                      v
 Supabase Auth      PostgreSQL + RLS       Private Storage
                         |
                         v
              Domain modules / adapters
       ingestion | classification | forecast | Power BI
                         |
                         v
              Analytics-ready views / exports

 Observability spans Web + API + jobs:
 request IDs, structured safe logs, health, metrics, error adapter
```

## Request and tenant boundary

1. Supabase Auth issues a session to an invited user.
2. The web app sends the session token; a submitted `company_id` is never sufficient proof.
3. FastAPI validates the token and resolves active company membership and permissions from
   trusted records.
4. The API authorizes the action and supplies the trusted tenant context to repositories.
5. PostgreSQL RLS independently restricts rows using authenticated identity/membership.
6. Responses and signed storage URLs are tenant-scoped and short-lived.

SUPER_ADMIN access is explicit, audited, and implemented as policy rather than as a broad UI
bypass. Server-side service-role use is limited to narrow administrative/job paths that
perform their own authorization and auditing.

## Repository boundaries

```text
apps/web                 presentation, locale selection, permission-aware navigation
apps/api                 authz enforcement, use cases, API contracts, health
packages/shared-types    frontend-only shared TypeScript contracts
packages/i18n            translation catalogs; no duplicated pages
services/*               domain modules/adapters, promoted only when needed
supabase/*               schema, RLS, private-storage policies, synthetic seeds
tests/security           tenant isolation and IDOR regression tests
tests/e2e                critical user journeys
docs                     architecture, decisions, model, security, runbooks
```

FastAPI owns analytical and ETL rules. Next.js server functionality is reserved for web-edge
concerns and does not become a second business backend. Modules start in-process; no
microservices or Kubernetes are justified in M0.

## Data lifecycle

Future ingestion follows:

```text
raw_import (immutable) -> validation -> parser adapter -> staging -> normalization
  -> classification -> human review -> canonical tables -> analytical views/exports
```

Each transition records tenant, import/job identity, parser version, counts, errors, actor,
and safe timestamps. Reprocessing creates a new result lineage without replacing the raw
source. Original descriptions, amounts, currencies, and exchange-rate provenance survive.

## Configuration and extension points

- Company profile resolves segment, country, region, locale, branding, and enabled modules.
- A permission matrix centralizes role-to-capability mapping.
- Parser, ClassificationProvider, ExchangeRateProvider, ErrorTrackingAdapter, and
  PowerBIProvider are replaceable interfaces.
- Production Power BI secrets and service credentials remain server-side; development uses
  a mock provider.
- Embedded BI is deferred. When approved, each authorized user receives exactly one active
  embedded BI assignment, resolved server-side from authenticated identity and company
  membership.

## Environments and operations

DEV and PROD use distinct Supabase projects, hosts, credentials, buckets, and observability
destinations. CI performs format, lint, type, unit-test, and build gates. Later milestones add
reproducible database startup, migration verification, RLS/security integration tests,
backup/restore exercises, rate limiting, and E2E coverage.

## Security invariants

- Every business entity has `company_id` or an unambiguous tenant-owned parent.
- RLS is enabled and forced where appropriate on all sensitive tenant tables.
- Backend authorization remains mandatory even with RLS.
- Storage paths are implementation details, not authorization controls.
- Sensitive actions write append-only audit events with safe metadata.
- PII is minimized and workforce records use pseudonymous operational codes.
- No banking credentials, real production data, public signup, or browser service key.
