from datetime import UTC, datetime, timedelta
from types import SimpleNamespace
from uuid import UUID

import jwt
import pytest
from cryptography.hazmat.primitives.asymmetric import rsa
from fastapi.testclient import TestClient

from app.config import Settings
from app.main import app
from app.security.jwt import JwtVerifier

USER_ID = UUID("00000000-0000-0000-0000-000000000101")
ISSUER = "https://example.supabase.co/auth/v1"


@pytest.fixture(scope="module")
def rsa_keys():
    private_key = rsa.generate_private_key(public_exponent=65537, key_size=2048)
    return private_key, private_key.public_key()


def create_token(private_key, **overrides) -> str:
    now = datetime.now(UTC)
    claims = {
        "iss": ISSUER,
        "sub": str(USER_ID),
        "aud": "authenticated",
        "role": "authenticated",
        "email": "synthetic@example.test",
        "iat": now,
        "exp": now + timedelta(minutes=5),
    }
    claims.update(overrides)
    return jwt.encode(claims, private_key, algorithm="RS256", headers={"kid": "test-key"})


def test_verifies_supabase_asymmetric_token(rsa_keys) -> None:
    private_key, public_key = rsa_keys
    verifier = JwtVerifier(Settings(supabase_url="https://example.supabase.co"))
    verifier.jwks_client = SimpleNamespace(
        get_signing_key_from_jwt=lambda _token: SimpleNamespace(key=public_key)
    )

    actor = verifier.verify(create_token(private_key))

    assert actor.user_id == USER_ID
    assert actor.role == "authenticated"
    assert actor.email == "synthetic@example.test"


def test_rejects_wrong_audience(rsa_keys) -> None:
    private_key, public_key = rsa_keys
    verifier = JwtVerifier(Settings(supabase_url="https://example.supabase.co"))

    with pytest.raises(jwt.InvalidAudienceError):
        verifier._decode_token(create_token(private_key, aud="service_role"), public_key)


def test_rejects_expired_token(rsa_keys) -> None:
    private_key, public_key = rsa_keys
    expired = datetime.now(UTC) - timedelta(minutes=1)
    verifier = JwtVerifier(Settings(supabase_url="https://example.supabase.co"))

    with pytest.raises(jwt.ExpiredSignatureError):
        verifier._decode_token(create_token(private_key, exp=expired), public_key)


def test_auth_endpoint_requires_bearer_token() -> None:
    response = TestClient(app).get("/auth/me")

    assert response.status_code == 401
    assert response.json() == {"detail": "Missing bearer token"}
