from dataclasses import dataclass
from enum import StrEnum
from uuid import UUID


class RoleCode(StrEnum):
    SUPER_ADMIN = "SUPER_ADMIN"
    COMPANY_ADMIN = "COMPANY_ADMIN"
    COMPANY_USER = "COMPANY_USER"


ROLE_PERMISSIONS: dict[RoleCode, frozenset[str]] = {
    RoleCode.SUPER_ADMIN: frozenset({"*"}),
    RoleCode.COMPANY_ADMIN: frozenset(
        {
            "audit.read",
            "company.profile.read",
            "company.settings.read",
            "company.settings.write",
            "portal.access",
            "users.invite",
            "users.read",
            "users.roles.write",
            "content.publications.read",
        }
    ),
    RoleCode.COMPANY_USER: frozenset(
        {
            "company.profile.read",
            "company.settings.read",
            "portal.access",
            "content.publications.read",
        }
    ),
}


class AuthorizationDenied(PermissionError):
    """The authenticated actor cannot perform the requested operation."""


@dataclass(frozen=True, slots=True)
class Membership:
    company_id: UUID | None
    role: RoleCode
    active: bool = True


@dataclass(frozen=True, slots=True)
class TenantContext:
    actor_id: UUID
    company_id: UUID | None
    role: RoleCode
    permissions: frozenset[str]

    def require(self, permission: str) -> None:
        if "*" not in self.permissions and permission not in self.permissions:
            raise AuthorizationDenied(f"Missing permission: {permission}")


def resolve_tenant_context(
    *,
    actor_id: UUID,
    requested_company_id: UUID | None,
    trusted_memberships: tuple[Membership, ...],
) -> TenantContext:
    """Resolve tenant from trusted memberships, never from browser input alone."""
    platform_membership = next(
        (
            membership
            for membership in trusted_memberships
            if membership.active
            and membership.company_id is None
            and membership.role is RoleCode.SUPER_ADMIN
        ),
        None,
    )
    if platform_membership is not None:
        return TenantContext(
            actor_id=actor_id,
            company_id=requested_company_id,
            role=platform_membership.role,
            permissions=ROLE_PERMISSIONS[platform_membership.role],
        )

    membership = next(
        (
            candidate
            for candidate in trusted_memberships
            if candidate.active and candidate.company_id == requested_company_id
        ),
        None,
    )
    if membership is None or requested_company_id is None:
        raise AuthorizationDenied("No active membership for requested company")

    return TenantContext(
        actor_id=actor_id,
        company_id=membership.company_id,
        role=membership.role,
        permissions=ROLE_PERMISSIONS[membership.role],
    )
