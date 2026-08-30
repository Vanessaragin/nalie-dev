# M1 identity and tenant isolation

## Implemented foundation

- Supabase-managed `auth.users` linked one-to-one to minimal application profiles.
- Companies, settings, memberships, centralized roles and permissions, and append-only audit
  records.
- RLS enabled and forced on all M1 public tables.
- Trusted helper functions resolve active membership and capability from `auth.uid()`.
- Private `company-assets` bucket with tenant UUID as the first logical folder.
- Backend tenant context rejects a browser-supplied company unless trusted membership matches.
- FastAPI verifies Supabase user JWTs against asymmetric ES256/RS256 keys from the project
  JWKS endpoint, including issuer, audience, expiry, subject, and authenticated role.
- Synthetic pgTAP fixtures prove Company A/B isolation and role restrictions.

## Protected API identity

`GET /auth/me` requires `Authorization: Bearer <user-access-token>`. The backend derives the
issuer and JWKS discovery URL from `SUPABASE_URL`; `SUPABASE_JWT_AUDIENCE` defaults to
`authenticated`. Symmetric HS256 tokens and API keys are not accepted as user bearer tokens.
The publishable key belongs in the `apikey` header when a Supabase endpoint requires it.

## Run database security tests

Install the Supabase CLI, start Docker Desktop, then run from the repository root:

```bash
supabase start
supabase db reset
supabase test db
```

The local Auth configuration disables public signup. Test users and companies exist only
inside transaction-scoped pgTAP tests and are rolled back.

## Invariants

- A company role always has a non-null company; a platform role always has a null company.
- `SUPER_ADMIN` is an explicit active platform membership, not a frontend flag.
- Company identifiers received from the browser are resource selectors, never authorization.
- Company users cannot modify settings, invite users, or access the platform console.
- Audit entries have no authenticated update/delete policy.
- Service-role configuration is server-only and statically checked out of browser code.

## Remaining M1 work

- Wire the validated actor to a PostgreSQL membership repository for request-level tenant
  resolution.
- Implement invitation and password-recovery flows against a real DEV Supabase project.
- Add production MFA enforcement hooks and session-expiry configuration.
- Build authenticated company switch/branding screens after API integration.
- Exercise the pgTAP suite locally and in CI once the Supabase CLI runtime is provisioned.
