# Incremental roadmap

> A sequência vigente para encerramento do produto está em
> [finalization-checklist.md](./finalization-checklist.md). O compilado para
> extração é, por decisão de produto, a última etapa.

This roadmap preserves the existing low-cost, multi-tenant architecture. It consolidates the
current product before adding the later analyst-workspace and embedded-BI decisions.

## Current foundation — completed in repository, pending environment validation

- Next.js portal and FastAPI boundary.
- Supabase multi-tenant schema, memberships, roles, permissions, and RLS foundations.
- Thirty ordered migrations covering the current prototype domains.
- Tenant-isolation SQL test foundation.
- Portal prototypes for finance, sales, products, workforce, planning, calendar, CRM,
  documents, billing, reports, and administration.

## M31 — Identity and tenant wiring

**Outcome:** real invited users enter only their authorized company environment.

- Connect Supabase DEV Auth to login and first access.
- Resolve trusted tenant context in FastAPI.
- Load company membership, role, permission overrides, and active status.
- Replace fixed company/user identity in the shell.
- Enforce password reset and audit flows through backend use cases.

**Migrations:** only corrective constraints/indexes if validation reveals gaps.

**Risks:** RLS mismatch, stale memberships, accidental SUPER_ADMIN bypass.

**Dependencies/cost:** DEV Supabase project; low fixed cost at initial volume.

## M32 — Company context and localization

**Outcome:** the existing portal adapts to the authenticated company without removing modules.

- Load company logo, name, colors, segment, country, currency, locale, and timezone.
- Apply PT-BR/EN-US catalogs and regional date/currency formatting.
- Use existing company settings and permission assignments for navigation.
- Introduce reviewed feature configuration for Food, Construction, and Cleaning.

**Migrations:** optional normalized branding/module configuration only after reviewing existing
JSON settings.

**Risks:** treating feature visibility as authorization; translation drift.

## M33 — Persist existing operational modules

**Outcome:** existing screens retain data and become tenant-scoped rather than demonstrative.

- Financial accounts, cards, payables, receivables, recurring series, and reconciliation.
- Products/costs, sales/orders, workforce/capacity, planning, savings, vehicles, and mileage.
- CRM, calendar, private messages, documents, weather, holidays, and service billing.
- Central API contracts and repositories without duplicating business rules in Next.js.

**Migrations:** missing canonical financial transaction/payable/receivable/recurrence tables,
subject to a separate impact review before creation.

**Risks:** current migrations overlap prototype concepts; consolidate instead of adding
parallel tables.

## M34 — Import and data lineage

**Outcome:** uploaded statements become reviewed canonical data.

- Private raw upload.
- OFX, CSV, XLSX, PDF, and marketplace statement adapters.
- Validation, duplicate detection, staging, normalization, classification, and human review.
- Immutable source lineage and reprocessing versions.
- Import, edit, bulk-delete, and classification audit events.

**Migrations:** raw imports, parser jobs, staging, canonical transactions, classification
reviews, and lineage; exact proposal requires approval.

**Risks/cost:** PDF parsing quality, storage growth, background-job runtime, personal data.

## M35 — Real dashboards and analytical queries

**Outcome:** current charts and summaries use persisted tenant data.

- Executive summary, key metrics, important changes, forecast preview, open actions, and latest
  available analysis.
- Period comparisons, labels, category maps, cash flow, margin, and workforce capacity.
- Explain data freshness and source coverage.

**Migrations:** analytical views/materialized summaries only when query evidence requires them.

**Risks/cost:** stale aggregates and unexplained automated conclusions.

## M36 — Secure report foundation

**Outcome:** reports can be published, versioned, authorized, downloaded, and audited.

- `reports`, `report_versions`, and `report_audiences` after migration approval.
- Private storage and short-lived signed downloads.
- Company/period/type/status/version workflow.
- Role/user audience checks and `REPORT_DOWNLOAD` audit event.
- First real executive PPT template after the secure foundation is accepted.

**Risks/cost:** document generation runtime, private storage, audience leakage.

## Next product phase — Analyst-led analytical memory

Approved for product design and incremental implementation:

- Analysis Workspace;
- analysis periods;
- findings;
- hypotheses and validation;
- analyst notes and conclusions;
- analytical history;
- findings/decisions/actions/results traceability.

The first interface prototype is available at `/portal/analises`. Persistence,
RLS, audit, and retention require the identity/tenant wiring milestone before a
database migration is approved.

## Approved integration package — Embedded BI and presentations

The customer creates the Power BI and PowerPoint content. Nalie only embeds,
authorizes, versions, links it to company/period, and audits access:

- one embedded BI assignment per authorized user;
- `company_analytics` and `user_analytics_assignments`;
- `EmbeddedAnalytics`, mock provider, and Microsoft provider;
- server-side embed authorization and cross-company denial tests;
- Power BI licensing/capacity cost evaluation.
- PowerPoint file or secure viewer-link incorporation; no PPT generation.

`Publish to Web` is never an option.

## Later decision package C — Advanced personalization

- Full segment-specific analytical modules.
- User-specific PPT narratives.
- Advanced forecasts using weather, holidays, and operational capacity.
- Broader company-specific branding.
