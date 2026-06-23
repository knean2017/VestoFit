"""Frontality scoring — picks the best frontal photo from an upload set.

Uses OpenCV's bundled Haar cascade face detector. Lightweight, no model downloads,
works cross-platform. We score each photo on:
  - face size relative to image (closer / better-cropped photos score higher)
  - face center distance to image center (frontal pose with the subject centered)

Returns a 0..1 score. 0 means no face detected.
"""

from __future__ import annotations

import asyncio
from io import BytesIO

import cv2
import numpy as np
from PIL import Image

_FACE_CASCADE = cv2.CascadeClassifier(
    cv2.data.haarcascades + "haarcascade_frontalface_default.xml"
)


def _score_sync(data: bytes) -> float:
    try:
        img = np.array(Image.open(BytesIO(data)).convert("RGB"))
    except Exception:
        return 0.0

    gray = cv2.cvtColor(img, cv2.COLOR_RGB2GRAY)
    faces = _FACE_CASCADE.detectMultiScale(
        gray, scaleFactor=1.2, minNeighbors=5, minSize=(60, 60)
    )
    if len(faces) == 0:
        return 0.0

    h, w = gray.shape
    img_area = float(h * w)
    cx, cy = w / 2.0, h / 2.0

    fx, fy, fw, fh = max(faces, key=lambda f: f[2] * f[3])
    face_area = float(fw * fh)
    face_cx = fx + fw / 2.0
    face_cy = fy + fh / 2.0

    size_score = float(min(face_area / img_area * 8.0, 1.0))
    dist = ((face_cx - cx) ** 2 + (face_cy - cy) ** 2) ** 0.5
    center_score = float(max(0.0, 1.0 - dist / (w / 2.0)))

    return size_score * 0.7 + center_score * 0.3


async def score_frontality(image_bytes: bytes) -> float:
    return await asyncio.to_thread(_score_sync, image_bytes)
