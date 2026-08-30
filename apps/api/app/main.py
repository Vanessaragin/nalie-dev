from typing import Annotated

from fastapi import Depends, FastAPI

from app.config import get_settings
from app.security.jwt import AuthenticatedActor, get_current_actor

app = FastAPI(title="Intelligence Platform API", version="0.1.0")


@app.get("/health", tags=["operations"])
def health() -> dict[str, str]:
    settings = get_settings()
    return {"status": "ok", "environment": settings.app_env}


@app.get("/auth/me", tags=["identity"])
def auth_me(
    actor: Annotated[AuthenticatedActor, Depends(get_current_actor)],
) -> dict[str, str | None]:
    return {"user_id": str(actor.user_id), "role": actor.role, "email": actor.email}
