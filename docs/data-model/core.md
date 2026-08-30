# M1 core data model

This model is implemented by the first M1 migration. Database-level isolation tests live in
`supabase/tests` and require a running local Supabase stack.

## Relationships

```text
auth.users (Supabase-managed)
    1 |---- 1 profiles
      |---- * company_users * ---- 1 companies ---- 1 company_settings
                         |
                         * ---- 1 roles * ---- * permissions

companies 1 ---- * audit_logs
profiles  1 ---- * audit_logs (actor, nullable for system events)
```

## Entities

### companies

Tenant root. Proposed fields: UUID primary key, legal/display name, logo reference, brand
colors, segment (`FOOD`, `CONSTRUCTION`, `CLEANING`), subsegment, country, state/region, city,
base currency, default locale, timezone, size/headcount range, optional revenue range,
branch summary, lifecycle status, timestamps. Business tables in later milestones reference
this root directly or through an unambiguous tenant-owned parent.

### company_settings

One-to-one tenant configuration: `company_id`, enabled module/feature map, regional options,
and version/timestamps. Changes require administrative capability and audit. Feature settings
control availability but never grant authorization.

### profiles

Application profile linked one-to-one to `auth.users.id`: display name, preferred locale,
status, and timestamps. Do not duplicate passwords or token material. Avoid unnecessary PII.

### company_users

Membership join: `company_id`, `profile_id`, `role_id`, membership status, invitation/acceptance
timestamps, inviter, and timestamps. Unique active membership per company/profile. The API
derives tenant context from authenticated profile plus this membership, never from a browser
company identifier alone.

### roles

Extensible role definitions with stable codes initially `SUPER_ADMIN`, `COMPANY_ADMIN`, and
`COMPANY_USER`. Scope distinguishes platform roles from company roles. UI role labels are
translated separately. Role codes are not scattered through components.

### permissions

Stable capability codes such as company settings read/write, users invite/manage, portal
read, and admin console access. A role-permission join forms the centralized matrix. The API
checks capabilities; the UI consumes them only to improve UX, not as a security boundary.

### audit_logs

Append-only security record: actor profile (nullable for trusted system actor), company,
action, resource type/id, timestamp, request/correlation ID, and allow-listed safe JSON
metadata. Company users cannot update or delete audit entries. Cross-tenant visibility and
SUPER_ADMIN access are explicit policies.

## M1 constraints and indexes

- UUID identifiers; UTC timestamps; normalized ISO country/currency and supported locale.
- Foreign keys prevent orphan membership/settings/audit records.
- Unique company/profile membership and unique stable role/permission codes.
- Index tenant-first query paths, including `(company_id, ...)` on tenant tables.
- Constrain segment/locale/status values through reviewed enums or reference tables.
- Prevent tenant ownership changes through ordinary update policies.

## Required M1 policy tests

Synthetic fixtures include Company A, Company B, their admins/users, and a SUPER_ADMIN.
Tests prove A cannot read/update B; users cannot mutate administrative settings; company
admins cannot access the platform console; private files and BI requests are tenant-bound;
and the service-role credential is absent from browser bundles. Both direct database policy
tests and API-level IDOR tests are required.

## Deferred beyond M1

Bank accounts, raw imports, transactions, products, orders, workforce, forecasts, reports,
documents, calendar, and segment-specific entities. Deferral keeps the first migration and
RLS review focused on the identity boundary.
