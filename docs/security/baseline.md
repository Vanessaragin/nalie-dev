# Security baseline

## M0 controls

- Secret placeholders only; `.env` variants are ignored except `.env.example`.
- Browser-safe and server-only configuration are visibly separated.
- CI has read-only repository permissions and deterministic lockfile installation.
- Framework version disclosure header is disabled in the web configuration.
- API exposes only a minimal health endpoint and validates settings.

## M1 acceptance gates

- Invitation-only Supabase Auth; password recovery and production TOTP hooks.
- Central permission matrix and backend membership validation.
- RLS and private storage policies with Company A/B isolation fixtures.
- IDOR tests for rows, files, admin settings, and Power BI configuration.
- Audit events for authentication and administrative changes where supported.
- CSP/secure headers, input validation, upload limits/type checks, session expiry, and rate
  limiting documented and tested in proportion to risk.
- Automated evidence that service-role credentials do not enter browser bundles.

Security controls should deny by default. Logs use correlation IDs and allow-listed metadata;
they must not contain secrets or unnecessary complete financial records.
