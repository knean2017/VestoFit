import time
from collections import defaultdict
from threading import Lock

from fastapi import HTTPException, Request, status


class RateLimiter:
    def __init__(self, max_requests: int, window_seconds: int):
        self._max = max_requests
        self._window = window_seconds
        self._hits: dict[str, list[float]] = defaultdict(list)
        self._lock = Lock()

    def check(self, key: str) -> None:
        now = time.monotonic()
        with self._lock:
            hits = self._hits[key]
            cutoff = now - self._window
            self._hits[key] = [t for t in hits if t > cutoff]
            if len(self._hits[key]) >= self._max:
                raise HTTPException(
                    status.HTTP_429_TOO_MANY_REQUESTS,
                    "Too many requests, try again later",
                )
            self._hits[key].append(now)


_auth_limiter = RateLimiter(max_requests=10, window_seconds=60)
_search_limiter = RateLimiter(max_requests=20, window_seconds=60)


def _client_ip(request: Request) -> str:
    forwarded = request.headers.get("x-forwarded-for")
    if forwarded:
        return forwarded.split(",")[0].strip()
    return request.client.host if request.client else "unknown"


def rate_limit_auth(request: Request) -> None:
    _auth_limiter.check(_client_ip(request))


def rate_limit_search(request: Request) -> None:
    _search_limiter.check(_client_ip(request))
