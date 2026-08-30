from dataclasses import dataclass
from typing import Annotated, Any
from uuid import UUID

import jwt
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jwt import PyJWKClient

from app.config import Settings, get_settings

ALLOWED_ALGORITHMS = ("ES256", "RS256")
bearer_scheme = HTTPBearer(auto_error=False)


@dataclass(frozen=True, slots=True)
class AuthenticatedActor:
    user_id: UUID
    role: str
    email: str | None


class JwtVerifier:
    def __init__(self, settings: Settings) -> None:
        issuer = settings.supabase_jwt_issuer
        jwks_url = settings.supabase_jwks_url
        if not issuer or not jwks_url:
            raise RuntimeError("SUPABASE_URL is required for JWT verification")
        self.issuer = issuer
        self.audience = settings.supabase_jwt_audience
        self.jwks_client = PyJWKClient(jwks_url, cache_jwk_set=True, lifespan=600)

    def verify(self, token: str) -> AuthenticatedActor:
        signing_key = self.jwks_client.get_signing_key_from_jwt(token)
        claims = self._decode_token(token, signing_key.key)
        try:
            user_id = UUID(claims["sub"])
        except (KeyError, TypeError, ValueError) as error:
            raise jwt.InvalidTokenError("JWT subject is not a valid UUID") from error

        role = claims.get("role")
        if role != "authenticated":
            raise jwt.InvalidTokenError("JWT is not an authenticated user token")
        return AuthenticatedActor(user_id=user_id, role=role, email=claims.get("email"))

    def _decode_token(self, token: str, key: Any) -> dict[str, Any]:
        return jwt.decode(
            token,
            key=key,
            algorithms=list(ALLOWED_ALGORITHMS),
            audience=self.audience,
            issuer=self.issuer,
            options={"require": ["exp", "iat", "iss", "sub", "aud", "role"]},
        )


def get_current_actor(
    credentials: Annotated[HTTPAuthorizationCredentials | None, Depends(bearer_scheme)],
    settings: Annotated[Settings, Depends(get_settings)],
) -> AuthenticatedActor:
    if credentials is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Missing bearer token")
    try:
        return JwtVerifier(settings).verify(credentials.credentials)
    except RuntimeError as error:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Authentication service is not configured",
        ) from error
    except jwt.PyJWTError as error:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid bearer token"
        ) from error
