from uuid import UUID

import pytest

from app.security.authorization import (
    AuthorizationDenied,
    Membership,
    RoleCode,
    resolve_tenant_context,
)

ACTOR = UUID("00000000-0000-0000-0000-000000000101")
COMPANY_A = UUID("00000000-0000-0000-0000-00000000000a")
COMPANY_B = UUID("00000000-0000-0000-0000-00000000000b")


def test_browser_company_id_does_not_grant_cross_tenant_access() -> None:
    memberships = (Membership(COMPANY_A, RoleCode.COMPANY_ADMIN),)

    with pytest.raises(AuthorizationDenied):
        resolve_tenant_context(
            actor_id=ACTOR,
            requested_company_id=COMPANY_B,
            trusted_memberships=memberships,
        )


def test_company_user_cannot_change_administrative_settings() -> None:
    context = resolve_tenant_context(
        actor_id=ACTOR,
        requested_company_id=COMPANY_A,
        trusted_memberships=(Membership(COMPANY_A, RoleCode.COMPANY_USER),),
    )

    with pytest.raises(AuthorizationDenied):
        context.require("company.settings.write")

    context.require("content.publications.read")


def test_company_admin_cannot_access_platform_console() -> None:
    context = resolve_tenant_context(
        actor_id=ACTOR,
        requested_company_id=COMPANY_A,
        trusted_memberships=(Membership(COMPANY_A, RoleCode.COMPANY_ADMIN),),
    )

    with pytest.raises(AuthorizationDenied):
        context.require("admin.console.access")


def test_super_admin_has_explicit_platform_access() -> None:
    context = resolve_tenant_context(
        actor_id=ACTOR,
        requested_company_id=COMPANY_B,
        trusted_memberships=(Membership(None, RoleCode.SUPER_ADMIN),),
    )

    context.require("admin.console.access")
    assert context.company_id == COMPANY_B
