from fastapi.testclient import TestClient

from app.main import app


def test_health_endpoint(monkeypatch) -> None:
    monkeypatch.setenv("APP_ENV", "test")
    from app.config import get_settings

    get_settings.cache_clear()
    response = TestClient(app).get("/health")

    assert response.status_code == 200
    assert response.json() == {"status": "ok", "environment": "test"}
    get_settings.cache_clear()
