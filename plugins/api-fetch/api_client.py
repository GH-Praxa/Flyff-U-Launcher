from __future__ import annotations

import logging
import time
from collections import deque
from typing import Any, Callable, Deque, Dict, Optional, Tuple
from urllib.parse import urljoin

import requests

from config import RateLimitSettings

logger = logging.getLogger(__name__)


class CancelledError(Exception):
    """Raised when the operation was cancelled from the UI."""


class RateLimiter:
    """Simple fixed-window rate limiter."""

    def __init__(self, settings: RateLimitSettings):
        self.settings = settings
        self._requests: Deque[float] = deque()

    def _prune(self, now: float) -> None:
        window = self.settings.window_seconds
        while self._requests and now - self._requests[0] > window:
            self._requests.popleft()

    def acquire(self, cancel_flag, pause_flag) -> None:
        """Block until a request slot is available or cancelled."""
        while True:
            if cancel_flag.is_set():
                raise CancelledError()

            while pause_flag.is_set():
                if cancel_flag.is_set():
                    raise CancelledError()
                time.sleep(0.05)

            now = time.monotonic()
            self._prune(now)
            if len(self._requests) < self.settings.max_requests:
                self._requests.append(now)
                return

            oldest = self._requests[0]
            wait_time = max(0.05, min(self.settings.window_seconds - (now - oldest), 1.0))
            time.sleep(wait_time)

    def snapshot(self) -> Tuple[int, int]:
        """Return (used, max) for the current window."""
        self._prune(time.monotonic())
        return len(self._requests), self.settings.max_requests


class ApiClient:
    """Synchronous API client with rate limiting (no retries)."""

    def __init__(self, base_url: str, settings: RateLimitSettings, log_callback: Optional[Callable[[str], None]] = None):
        self.base_url = base_url.rstrip("/")
        self.settings = settings
        self.session = requests.Session()
        self._log = log_callback or (lambda msg: logger.info(msg))
        self.rate_limiter = RateLimiter(settings)
        # Set a common user-agent to avoid being blocked
        self.session.headers.update({
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36"
        })

    def close(self) -> None:
        self.session.close()

    def _full_url(self, path: str) -> str:
        if not path.startswith("/"):
            path = "/" + path
        return urljoin(self.base_url + "/", path.lstrip("/"))

    def fetch_json(
        self,
        path: str,
        params: Optional[Dict[str, Any]],
        cancel_flag,
        pause_flag,
    ) -> Tuple[Any, int]:
        """Fetch JSON once (no retries). Returns (payload, requests_made)."""
        attempts = 1
        url = self._full_url(path)
        # Use a longer read timeout
        timeout = (self.settings.request_timeout, 60)

        self.rate_limiter.acquire(cancel_flag, pause_flag)
        try:
            response = self.session.get(url, params=params, timeout=timeout)
            if response.status_code >= 400:
                self._log(f"Request failed for {url} with status {response.status_code}; skipping retry")
            response.raise_for_status()
            try:
                return response.json(), attempts
            except ValueError as exc:
                raise RuntimeError(f"Antwort von {url} ist kein JSON.") from exc
        except CancelledError:
            raise
        except requests.RequestException as exc:  # network issue
            self._log(f"Request error for {url}: {exc}; skipping retry")
            raise

    def fetch_binary(
        self,
        path: str,
        params: Optional[Dict[str, Any]],
        cancel_flag,
        pause_flag,
    ) -> Tuple[bytes, int]:
        """Fetch raw bytes once (no retries). Returns (bytes, requests_made)."""
        attempts = 1
        url = self._full_url(path)
        timeout = (self.settings.request_timeout, 60)
        headers = {
            "User-Agent": self.session.headers["User-Agent"]
        }

        self.rate_limiter.acquire(cancel_flag, pause_flag)
        try:
            # Use a disposable request, not the session, for maximum isolation.
            response = requests.get(
                url, params=params, timeout=timeout, stream=True, headers=headers
            )

            if response.status_code >= 400:
                self._log(f"Request failed for {url} with status {response.status_code}; skipping retry")

            response.raise_for_status()

            chunks = []
            try:
                for chunk in response.iter_content(chunk_size=8192):
                    if cancel_flag.is_set():
                        raise CancelledError()
                    chunks.append(chunk)
            except requests.exceptions.ChunkedEncodingError as exc:
                # This can happen if the server closes the connection mid-stream
                raise requests.RequestException(f"Server closed connection during download for {url}") from exc


            content = b"".join(chunks)

            # Verify content length to be sure
            expected_size = response.headers.get('Content-Length')
            if expected_size and len(content) != int(expected_size):
                raise requests.RequestException(f"Incomplete download for {url}. Expected {expected_size} bytes, got {len(content)}.")

            return content, attempts
        except CancelledError:
            raise
        except requests.RequestException as exc:
            self._log(f"Request error for {url}: {exc}; skipping retry")
            raise
        finally:
            # Ensure the connection is closed if we're not using a session
            if 'response' in locals() and response:
                response.close()

    @staticmethod
    def _retry_after_seconds(response: requests.Response) -> Optional[float]:
        try:
            retry_after = response.headers.get("Retry-After")
            if retry_after is None:
                return None
            return float(retry_after)
        except Exception:
            return None
