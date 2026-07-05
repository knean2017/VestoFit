import inspect
from types import SimpleNamespace

from app.schemas.tryon import TryOnOutfitRequest
from app.services.tryon_service import _LAYER_ORDER, run_outfit_job


def test_outfit_request_schema_roundtrip():
    req = TryOnOutfitRequest(item_ids=["a", "b"])
    assert req.item_ids == ["a", "b"]


def test_layer_order_bottoms_under_tops_under_dresses():
    assert _LAYER_ORDER["bottoms"] < _LAYER_ORDER["tops"] < _LAYER_ORDER["dresses"]


def test_unknown_category_sorts_last():
    items = [SimpleNamespace(category=c) for c in ("dresses", None, "tops", "bottoms")]
    items.sort(key=lambda w: _LAYER_ORDER.get(w.category, 99))
    assert [i.category for i in items] == ["bottoms", "tops", "dresses", None]


def test_run_outfit_job_is_async():
    assert inspect.iscoroutinefunction(run_outfit_job)
