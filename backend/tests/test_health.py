from app.main import app, _db_ok


def test_health_route_registered():
    assert any(getattr(r, "path", "") == "/health" for r in app.routes)


async def test_db_ok_false_when_engine_unreachable(monkeypatch):
    import app.main as main

    class BoomEngine:
        def connect(self):
            raise ConnectionError("db down")

    monkeypatch.setattr(main, "engine", BoomEngine())
    assert await _db_ok() is False
