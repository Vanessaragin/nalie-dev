# ADR-001: Modular monorepo stack

- Status: Accepted for M0
- Date: 2026-08-14

## Context

The product needs a responsive bilingual portal, analytical/ETL capabilities, strong tenant
isolation, and a low initial operating cost. A small team must review and test changes without
operating distributed infrastructure.

## Decision

Use a private modular monorepo with Next.js + TypeScript for the web application; FastAPI +
Python for the API, analytics, and ETL orchestration; and Supabase PostgreSQL/Auth/private
Storage. Use npm workspaces for JavaScript packages and a standalone Python `pyproject.toml`.
Keep ingestion, classification, forecasting, and Power BI behind module/provider boundaries
inside the deployable applications until independent scaling is demonstrated.

Target Cloudflare-compatible frontend hosting, but validate the selected Next.js adapter and
required runtime features before deployment. Run FastAPI on a managed Python host. Do not
claim a free tier is adequate for production financial workloads.

## Consequences

- TypeScript fits the web ecosystem; Python fits parsers and numerical/analytical work.
- Two language toolchains add setup and CI cost, made explicit through root commands.
- Supabase accelerates auth/storage/database work while PostgreSQL policies remain portable.
- Provider boundaries allow mock Power BI and future vendors without blocking local work.
- No microservices, Kubernetes, direct banking integration, or paid dependency is introduced.

## Alternatives considered

- Next.js-only backend: simpler toolchain, but less suitable for the expected ETL ecosystem.
- Python-rendered frontend: simpler language count, but weaker fit for the desired portal UX.
- Early microservices: rejected because operational cost exceeds demonstrated scaling needs.
