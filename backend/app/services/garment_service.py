"""Garment image preprocessing and category inference."""

from __future__ import annotations

import asyncio
import logging
from io import BytesIO

from PIL import Image

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Category auto-detection
# ---------------------------------------------------------------------------

_DRESS_KW = {
    "dress", "gown", "jumpsuit", "romper", "overall", "overalls",
    "maxi", "midi", "mini", "bodysuit", "playsuit", "dungaree",
}
_BOTTOM_KW = {
    "pant", "pants", "trouser", "trousers", "jean", "jeans", "short",
    "shorts", "skirt", "chino", "chinos", "legging", "leggings",
    "cargo", "cargos", "jogger", "joggers", "sweatpant", "sweatpants",
    "bottom", "bottoms", "leg",
}
_TOP_KW = {
    "shirt", "tshirt", "t-shirt", "tee", "top", "tops", "blouse",
    "jacket", "coat", "sweater", "sweatshirt", "hoodie", "cardigan",
    "polo", "vest", "blazer", "overshirt", "jersey", "pullover",
    "knitwear", "knit", "crewneck", "zip", "puffer", "anorak",
    "windbreaker", "bomber", "denim-jacket",
}


def infer_category(url: str | None, description: str | None) -> str:
    """Return 'tops', 'bottoms', or 'dresses' inferred from URL path tokens
    and the free-text description.  Falls back to 'tops' (most common garment)
    when nothing matches."""
    blob = " ".join(filter(None, [url, description])).lower()
    # tokenise: split on / ? = - _ . and spaces
    import re
    tokens = set(re.split(r"[\s/\?\=\-\_\.\&]+", blob))

    for kw in _DRESS_KW:
        if kw in tokens or kw in blob:
            return "dresses"
    for kw in _BOTTOM_KW:
        if kw in tokens or kw in blob:
            return "bottoms"
    for kw in _TOP_KW:
        if kw in tokens or kw in blob:
            return "tops"
    return "tops"


# ---------------------------------------------------------------------------
# Background removal
# ---------------------------------------------------------------------------

def _clean_sync(data: bytes) -> bytes:
    try:
        from rembg import remove
    except ImportError:
        logger.warning("rembg not installed — returning original image without background removal")
        return data

    try:
        cut = remove(data)
        img = Image.open(BytesIO(cut)).convert("RGBA")
        bg = Image.new("RGB", img.size, (255, 255, 255))
        bg.paste(img, mask=img.split()[-1])
        out = BytesIO()
        bg.save(out, format="PNG", optimize=True)
        return out.getvalue()
    except Exception:
        logger.warning("rembg background removal failed — returning original image", exc_info=True)
        return data


async def clean_garment(data: bytes) -> bytes:
    return await asyncio.to_thread(_clean_sync, data)
