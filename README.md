# Intelligence Platform

Foundation for a secure, low-cost, multi-tenant business intelligence product for small
companies in Brazil and the United States. M0 established the repository and quality gates.
M1 identity and tenant-isolation foundations are now present as migrations, policies, and
authorization tests.

## Architecture

- `apps/web`: Next.js/TypeScript portal and admin console.
- `apps/api`: FastAPI backend for authorization, analytical rules, and orchestration.
- `packages/shared-types`: stable cross-frontend TypeScript contracts.
- `packages/i18n`: PT-BR and EN-US translation resources.
- `services`: reserved module boundaries for ingestion, classification, and forecasting.
- `supabase`: versioned PostgreSQL migrations, RLS policies, and synthetic seeds.
- `tests`: cross-application E2E and security suites.
- `docs`: architecture, data model, ADRs, security guidance, and runbooks.

See the [product direction](docs/product/business-analytics-as-a-service.md),
[incremental roadmap](docs/roadmap.md), [architecture overview](docs/architecture/overview.md),
and the two initial ADRs.

## Prerequisites

- Node.js 20 or newer (CI uses Node.js 22)
- npm 10 or newer
- Python 3.12 or newer
- GNU Make (optional convenience)

The Supabase CLI and a running Docker Desktop are required for local database and pgTAP tests.

## Local setup

```bash
cp .env.example .env
npm ci
python3 -m venv .venv
.venv/bin/pip install -e 'apps/api[dev]'
```

Replace placeholder values only in `.env`. Do not commit it. The service-role key is
server-only and must never use a `NEXT_PUBLIC_` prefix.

## Development

Run the applications in separate terminals:

```bash
npm run dev:web
.venv/bin/uvicorn app.main:app --reload --app-dir apps/api
```

Web: `http://localhost:3000`. API health: `http://localhost:8000/health`.
The protected identity probe is `GET http://localhost:8000/auth/me` and requires a Supabase
user access token in the bearer authorization header.

## Quality and tests

```bash
npm run format:check
npm run lint
npm run typecheck
npm test
npm run build
```

Or run all gates with `make verify`. CI executes equivalent frontend and API jobs.

## Migrations

Immutable, ordered SQL migrations live in `supabase/migrations`; pgTAP security tests live in
`supabase/tests`. With the Supabase CLI and Docker Desktop running, use `supabase db reset`
and `supabase test db`. Destructive changes require a reversible migration or explicit backup
strategy.

## Environment variables

`.env.example` documents the contract. Browser-safe variables are explicitly prefixed
`NEXT_PUBLIC_`; credentials and database URLs are server-only. Production secrets belong in
the hosting provider's secret manager, never in Git or build output.

## Deployment

No production deployment is configured in M0. The intended path is Cloudflare-compatible
hosting for the Next.js application, a managed Python runtime for FastAPI, and Supabase for
PostgreSQL/Auth/private Storage. DEV and PROD must use separate projects and secrets. A
deployment workflow is deferred until environments and rollback procedures are approved.

Before a production build, validate the secret contract without printing secret values:

```bash
npm run check:production-env
```

Final activation sequence:

1. Create separate DEV and PROD Supabase projects.
2. Configure the Auth redirect URL for `/primeiro-acesso?mode=recovery`.
3. Apply every migration in `supabase/migrations` in filename order.
4. Expose only the publishable key through `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`.
5. Keep `SUPABASE_SERVICE_ROLE_KEY` only in the server secret manager.
6. Run tests, type checking, the production environment check and the build.
7. Validate blocked access, password recovery and private signed downloads with synthetic users.

## Security notes

- The browser will never be trusted to select the effective tenant for privileged work.
- PostgreSQL RLS and backend authorization are independent, mandatory controls.
- Sensitive tables and private storage require cross-tenant denial tests in M1.
- Raw imports will be immutable and transformations traceable.
- Logs must exclude secrets and unnecessary full financial records.
- Public signup and real data are out of scope; seeds must remain synthetic.

See [security baseline](docs/security/baseline.md).

## Activation still required

- Supply the final HTTPS portal URL and configure it in hosting and Supabase Auth.
- Connect the separate financial ingestion application to the three canonical tables using
  server-only credentials.
- Run the two-company production acceptance procedure documented in
  `docs/operations/production-runbook.md`.
- Configure production hosting and its rollback procedure.
