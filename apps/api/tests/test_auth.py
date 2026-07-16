from collections.abc import Iterator

import pytest
from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)


@pytest.fixture
def fake_verify(monkeypatch: pytest.MonkeyPatch) -> Iterator[None]:
    def _verify(token: str) -> dict[str, str]:
        if token == "good-token":
            return {"uid": "uid-123"}
        raise ValueError("bad token")

    monkeypatch.setattr("app.auth.verify_id_token", _verify)
    yield


def test_whoami_rejects_missing_token() -> None:
    response = client.get("/v1/me/whoami")
    assert response.status_code == 401


def test_whoami_rejects_invalid_token(fake_verify: None) -> None:
    response = client.get("/v1/me/whoami", headers={"Authorization": "Bearer nonsense"})
    assert response.status_code == 401


def test_whoami_returns_uid_from_token(fake_verify: None) -> None:
    response = client.get("/v1/me/whoami", headers={"Authorization": "Bearer good-token"})
    assert response.status_code == 200
    assert response.json() == {"uid": "uid-123"}
