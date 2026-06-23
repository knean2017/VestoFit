"""Garment scraper — extracts a product image from a retail page URL.

Strategy:
  1. Try Playwright (handles JS-rendered pages like Zara/H&M/ASOS).
  2. Fall back to a plain HTTP fetch if Playwright is unavailable or fails.

For both paths, image discovery order:
  - <meta property="og:image">
  - <meta name="twitter:image">
  - JSON-LD Product schema's `image` field
  - largest <img> inside elements with class containing "product"
"""

from __future__ import annotations

import json
import re
from urllib.parse import urlparse

import httpx
from bs4 import BeautifulSoup

_UA = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
    "AppleWebKit/537.36 (KHTML, like Gecko) "
    "Chrome/125.0 Safari/537.36"
)


async def fetch_garment_image(url: str) -> tuple[bytes, str]:
    """Returns (image_bytes, content_type). Raises ValueError on failure."""
    html = await _fetch_with_playwright(url)
    if html is None:
        async with httpx.AsyncClient(
            headers={"User-Agent": _UA}, follow_redirects=True, timeout=20
        ) as client:
            r = await client.get(url)
            r.raise_for_status()
            html = r.text

    img_url = _extract_image_url(html, url)
    if not img_url:
        raise ValueError(
            "Could not auto-detect a product image at that URL. "
            "Please upload the garment photo manually."
        )
    return await _download(img_url)


async def _fetch_with_playwright(url: str) -> str | None:
    try:
        from playwright.async_api import async_playwright
    except ImportError:
        return None

    try:
        async with async_playwright() as p:
            browser = await p.chromium.launch(headless=True)
            try:
                context = await browser.new_context(user_agent=_UA)
                page = await context.new_page()
                await page.goto(url, wait_until="domcontentloaded", timeout=20000)
                return await page.content()
            finally:
                await browser.close()
    except Exception:
        return None


def _extract_image_url(html: str, base_url: str) -> str | None:
    soup = BeautifulSoup(html, "lxml")

    og = soup.find("meta", property="og:image")
    if og and og.get("content"):
        return _absolute(og["content"], base_url)

    tw = soup.find("meta", attrs={"name": "twitter:image"})
    if tw and tw.get("content"):
        return _absolute(tw["content"], base_url)

    for script in soup.find_all("script", type="application/ld+json"):
        raw = script.string or ""
        try:
            data = json.loads(raw)
        except (json.JSONDecodeError, TypeError):
            continue
        for item in data if isinstance(data, list) else [data]:
            if not isinstance(item, dict):
                continue
            img = item.get("image")
            if isinstance(img, list) and img:
                first = img[0]
                if isinstance(first, dict) and first.get("url"):
                    return _absolute(first["url"], base_url)
                if isinstance(first, str):
                    return _absolute(first, base_url)
            elif isinstance(img, dict) and img.get("url"):
                return _absolute(img["url"], base_url)
            elif isinstance(img, str):
                return _absolute(img, base_url)

    biggest, biggest_score = None, 0
    for img in soup.find_all("img"):
        if not _looks_like_product_img(img):
            continue
        src = img.get("src") or img.get("data-src") or img.get("data-zoom-src")
        if not src or src.startswith("data:"):
            continue
        score = (_int(img.get("width")) or 0) * (_int(img.get("height")) or 0)
        if score > biggest_score:
            biggest_score = score
            biggest = src

    return _absolute(biggest, base_url) if biggest else None


def _looks_like_product_img(img) -> bool:
    parent_classes = " ".join(
        (img.get("class") or [])
        + [c for p in img.parents for c in (p.get("class") or [])][:3]
    ).lower()
    return any(s in parent_classes for s in ("product", "media", "image", "gallery"))


def _absolute(src: str | None, base_url: str) -> str | None:
    if not src:
        return None
    if src.startswith("//"):
        return "https:" + src
    if src.startswith(("http://", "https://")):
        return src
    p = urlparse(base_url)
    path = src if src.startswith("/") else "/" + src
    return f"{p.scheme}://{p.netloc}{path}"


def _int(v: object) -> int | None:
    if v is None:
        return None
    m = re.search(r"\d+", str(v))
    return int(m.group()) if m else None


async def _download(url: str) -> tuple[bytes, str]:
    async with httpx.AsyncClient(
        headers={"User-Agent": _UA}, follow_redirects=True, timeout=30
    ) as client:
        r = await client.get(url)
        r.raise_for_status()
        return r.content, r.headers.get("content-type", "image/jpeg")
