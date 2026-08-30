# NALIE — Business Analytics as a Service

## Product direction

NALIE is a **Business Analytics as a Service platform for micro and small businesses**. It
must not be positioned as an ERP, accounting system, document repository, isolated financial
dashboard, or Power BI portal. Existing operational features remain in the product when they
help collect, organize, explain, or follow an analysis.

The value chain is:

```text
data -> organization -> analysis -> context -> insights -> forecasts
  -> client discussion -> actions -> follow-up
```

Human analysis remains part of the service. Technology organizes evidence and preserves
context; it does not replace the analyst or present an automatic inference as a proven cause.

## Preservation rule

No existing module is removed merely because the positioning changed. Finance, accounts,
sales, products, workforce, planning, calendars, messages, documents, billing, weather,
holidays, CRM, audit, and reports are consolidated as supporting capabilities. New work must
improve and connect them instead of creating parallel replacements.

Before adding a feature, ask: **does it help produce, understand, explain, discuss, or follow
an analysis?** If not, it requires an explicit product decision.

## Client experience

The client enters the intelligence environment of their own business. The home experience
should answer:

- How is the business performing?
- What changed?
- What requires attention?
- What is the current forecast?
- What is being followed?
- Which actions remain open?

The target composition is an executive summary, key metrics, relevant changes, forecast,
open actions, and latest published analysis. Dashboards support this narrative; they do not
define it.

## Company, segment, and location context

Each company keeps its tenant-isolated environment, company name, logo, configurable visual
identity, segment, enabled modules, currency, locale, country, region, city, and timezone.

Initial segments remain configuration-driven feature sets rather than separate applications:

- **Food:** ingredients, recipes, units, portion cost, CMV, delivery fees, and margin.
- **Construction:** projects, phases, materials, workforce, budget, actual, and deviation.
- **Cleaning:** contracts, sites, teams, hours, materials, travel, and contract margin.

Brazil and United States localization includes BRL/USD, PT-BR/EN-US, local date formats,
PIX/ACH, and source-specific statement formats. Fiscal automation is excluded until reviewed
for each jurisdiction.

## Embedded BI decision

Embedded BI is a later milestone. **Each authorized user may have exactly one embedded BI
assignment.** The embedded experience is personal to that user and must not expose a report
selector capable of opening another user's or company's analytics.

Future model:

```text
company_analytics
- id
- company_id
- provider
- workspace_id
- report_id
- dataset_id
- enabled
- configuration

user_analytics_assignments
- id
- company_id
- user_id (unique active assignment)
- company_analytics_id
- locale
- enabled
- configuration
- created_at
- updated_at
```

The backend resolves `authenticated_user -> active company membership -> permission -> one
user assignment -> allowed provider configuration`. Browser-supplied report identifiers are
never trusted. Secrets and service credentials stay server-side. `Publish to Web` is forbidden.

The future reusable component is `<EmbeddedAnalytics />`, backed by a provider boundary:

- `MockPowerBIProvider` during development;
- `MicrosoftPowerBIProvider` in production.

Loading, errors, authorization, responsive sizing, fullscreen, refresh, locale, company
context, and report configuration belong to the component/provider contract.

## Executive presentations

PowerPoint is a curated executive narrative, not an automatic export of every BI page. A
presentation belongs to a company, period, analysis, version, and authorized audience. It can
include company branding, currency, locale, metrics, charts, analyst conclusions, attention
points, forecast, action plan, and analyst observations.

The target private-storage model is:

```text
reports
- id, company_id, period_start, period_end, report_type, title
- status, created_by, published_at

report_versions
- id, report_id, version, storage_path, mime_type, generated_at

report_audiences
- report_id, user_id nullable, role nullable, access_level
```

Download authorization is server-side. A validated request receives a short-lived signed URL,
and `REPORT_DOWNLOAD` is appended to the audit log. Different roles may receive different
authorized versions.

## Analyst-led capabilities reserved for later decision

The following concepts remain explicitly preserved but are not approved for immediate schema
or UI implementation:

- Analysis Workspace;
- findings;
- hypotheses and their validation;
- analytical history;
- findings-to-actions traceability;
- advanced automatic analytics;
- production Power BI;
- audience-specific PPT generation.

No structural migration for these concepts is created until impact, schema, security, cost,
dependencies, and milestone scope are approved.

## Current capability consolidation

### Existing foundations to preserve

- Multi-tenant companies, profiles, memberships, roles, permissions, and RLS foundations.
- CRM, activities, calendar, private messages, priorities, and personal calendar scope.
- Financial accounts, vehicles, mileage, fuel calculations, import batches, and billing.
- Sales channels, orders, products, costs, workforce, planning, budget/forecast/actual.
- Documents, exports, product/financial decisions, weather, holidays, savings goals, and audit.
- Portal screens for all major modules and current interaction prototypes.

### Existing but not yet wired end to end

- Most portal data is synthetic and client-side.
- Database migrations are ahead of API and UI integration.
- File selection does not yet run an ingestion pipeline.
- Forecasts, charts, recommendations, and decisions do not yet use canonical persisted data.
- Reports and downloads are visual simulations.
- Locale switching is incomplete.
- API currently exposes only health and authenticated-actor probes.

### Gaps to add through incremental delivery

1. Connect existing identity, tenant, and permission foundations to the portal.
2. Connect company profile, branding, location, locale, timezone, and enabled modules.
3. Persist the existing financial, sales, product, workforce, planning, calendar, and CRM UI.
4. Build immutable raw upload, parsing, validation, normalization, duplicate detection, review,
   and canonical transaction lineage.
5. Replace synthetic dashboard values with tenant-scoped analytical queries.
6. Complete PT-BR/EN-US catalogs and regional formatting.
7. Implement private report storage, publication, versions, audience authorization, signed
   downloads, and audit before real PPT generation.
8. Treat Embedded BI and analyst-led analytical memory as later approved milestones.

## Product decision gate

Before a significant architecture or database change, present:

- impact on existing capabilities;
- required migrations and rollback approach;
- tenant-isolation and authorization risks;
- technical and external dependencies;
- recurring and usage-based cost potential;
- proposed milestone and acceptance criteria.
