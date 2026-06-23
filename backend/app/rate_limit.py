import time
from collections import OrderedDict
from threading import Lock

from fastapi import HTTPException, Request, status

MAX_KEYS = 10_000


class RateLimiter:
    def __init__(self, max_requests: int, window_seconds: int):
        self._max = max_requests
        self._window = window_seconds
        self._hits: OrderedDict[str, list[float]] = OrderedDict()
        self._lock = Lock()

    def check(self, key: str) -> None:
        now = time.monotonic()
        with self._lock:
            while len(self._hits) > MAX_KEYS:
                self._hits.popitem(last=False)

            hits = self._hits.get(key, [])
            cutoff = now - self._window
            hits = [t for t in hits if t > cutoff]
            if len(hits) >= self._max:
                self._hits[key] = hits
                raise HTTPException(
                    status.HTTP_429_TOO_MANY_REQUESTS,
                    "Too many requests, try again later",
                )
            hits.append(now)
            self._hits[key] = hits
            self._hits.move_to_end(key)


_auth_limiter = RateLimiter(max_requests=10, window_seconds=60)
_search_limiter = RateLimiter(max_requests=20, window_seconds=60)


def _client_ip(request: Request) -> str:
    return request.client.host if request.client else "unknown"


def rate_limit_auth(request: Request) -> None:
    _auth_limiter.check(_client_ip(request))


def rate_limit_search(request: Request) -> None:
    _search_limiter.check(_client_ip(request))
