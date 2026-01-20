from __future__ import annotations

import json
import math
import threading
import time
from collections import deque
from pathlib import Path
from typing import Any, Dict, List, Optional

from PyQt6.QtCore import QThread, pyqtSignal

from api_client import ApiClient, CancelledError
from config import EndpointConfig, RateLimitSettings, ensure_output_dir, save_manifest


def safe_filename(name: str) -> str:
    """Return a filesystem-safe name for storing JSON output."""
    return "".join(ch if ch.isalnum() or ch in ("-", "_") else "_" for ch in name)


class DownloadThread(QThread):
    progress_changed = pyqtSignal(int, int)  # steps_done, total_steps
    endpoint_started = pyqtSignal(str, int, int)  # name, idx, total
    endpoint_finished = pyqtSignal(str, bool, str, str)  # name, success, path, error
    log_message = pyqtSignal(str)
    request_window = pyqtSignal(int, int, int)  # used in window, max in window, total
    finished_all = pyqtSignal(int, int, float, str)  # successes, failures, duration, manifest path
    cancelled = pyqtSignal()

    def __init__(
        self,
        base_url: str,
        endpoints: List[EndpointConfig],
        output_dir: Path,
        rate_limit: Optional[RateLimitSettings] = None,
    ):
        super().__init__()
        self.base_url = base_url
        self.endpoints = endpoints
        self.output_dir = ensure_output_dir(output_dir)
        self.rate_limit = rate_limit or RateLimitSettings()
        self._cancel_flag = threading.Event()
        self._pause_flag = threading.Event()
        self._requests_made = 0
        # Progress tracking in steps (requests/downloads)
        self._steps_total = sum(1 + (1 if (ep.bulk_ids and not ep.bulk_ids.per_id) else 0) for ep in endpoints)
        self._steps_done = 0
        self._request_events = deque()

    def cancel(self) -> None:
        self._cancel_flag.set()

    def pause(self) -> None:
        self._pause_flag.set()

    def resume(self) -> None:
        self._pause_flag.clear()

    def is_paused(self) -> bool:
        return self._pause_flag.is_set()

    def _wait_if_paused(self) -> None:
        while self._pause_flag.is_set():
            if self._cancel_flag.is_set():
                raise CancelledError()
            time.sleep(0.05)

    def run(self) -> None:
        start_ts = time.time()
        successes = 0
        failures = 0
        manifest_path = ""
        client = ApiClient(self.base_url, self.rate_limit, log_callback=self.log_message.emit)
        try:
            self.progress_changed.emit(self._steps_done, max(self._steps_total, 1))
            total = len(self.endpoints)
            for idx, endpoint in enumerate(self.endpoints, start=1):
                if self._cancel_flag.is_set():
                    raise CancelledError()

                self._wait_if_paused()
                self.endpoint_started.emit(endpoint.name, idx, total)
                try:
                    saved_path = self._download_endpoint(client, endpoint)
                    successes += 1
                    self.endpoint_finished.emit(endpoint.name, True, str(saved_path), "")
                except CancelledError:
                    raise
                except Exception as exc:
                    failures += 1
                    self.endpoint_finished.emit(endpoint.name, False, "", str(exc))
                    self.log_message.emit(f"Error fetching {endpoint.name}: {exc}")

                self._emit_progress()
                used = self._window_used()
                self.request_window.emit(used, self.rate_limit.max_requests, self._requests_made)

            duration = time.time() - start_ts
            manifest_path = str(
                save_manifest(
                    {
                        "timestamp": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
                        "duration_seconds": duration,
                        "requests": self._requests_made,
                        "successes": successes,
                        "failures": failures,
                    },
                    self.output_dir,
                )
            )
            self.finished_all.emit(successes, failures, duration, manifest_path)
        except CancelledError:
            self.cancelled.emit()
        finally:
            client.close()

    def _download_endpoint(self, client: ApiClient, endpoint: EndpointConfig) -> str:
        base_params = endpoint.params.copy() if endpoint.params else {}
        payload: Any
        requests_for_endpoint = 0
        subdir_raw = endpoint.output_subdir or (endpoint.name or endpoint.path.strip("/").replace("/", "_"))
        parts = [p for p in subdir_raw.replace("\\", "/").split("/") if p]
        if not parts:
            parts = [endpoint.name or endpoint.path.strip("/").replace("/", "_")]
        safe_parts = [safe_filename(p) for p in parts]
        endpoint_dir = self.output_dir.joinpath(*safe_parts)
        safe_root_name = safe_parts[-1] if safe_parts else safe_filename(subdir_raw)

        if endpoint.pagination:
            page_cfg = endpoint.pagination
            results: List[Any] = []
            current_page = page_cfg.start
            while True:
                self._wait_if_paused()
                params = base_params.copy()
                params[page_cfg.page_param] = current_page
                if page_cfg.limit_param and page_cfg.page_size:
                    params[page_cfg.limit_param] = page_cfg.page_size

                try:
                    data, req_count = client.fetch_json(endpoint.path, params, self._cancel_flag, self._pause_flag)
                    self._record_requests(req_count)
                    requests_for_endpoint += req_count
                except Exception as exc:
                    self.log_message.emit(f"Seite {current_page} für {endpoint.name} übersprungen: {exc}")
                    break
                if isinstance(data, list):
                    results.extend(data)
                else:
                    results.append(data)

                if page_cfg.stop_on_empty and (data is None or data == [] or data == {}):
                    break
                if page_cfg.max_pages and current_page >= page_cfg.max_pages:
                    break
                current_page += 1

            payload = results
        else:
            payload, req_count = client.fetch_json(endpoint.path, base_params, self._cancel_flag, self._pause_flag)
            requests_for_endpoint += req_count
            self._record_requests(req_count)

        main_path = self._store_payload(endpoint, payload, target_dir=endpoint_dir)
        detail_path: Path | None = None
        detail_payload: Any | None = None
        detail_entries: List[Any] = []
        self._advance_steps(1)  # main fetch done

        # Optional second pass: fetch details per ID or combined
        if endpoint.bulk_ids:
            ids = self._collect_ids(payload, endpoint.bulk_ids.id_field)
            if ids:
                joined = endpoint.bulk_ids.join_with.join(ids)
                detail_path_tmpl = endpoint.bulk_ids.path_template
                detail_dest = endpoint.bulk_ids.dest_subdir or "parameter"
                detail_dir = ensure_output_dir(endpoint_dir / safe_filename(detail_dest))

                if endpoint.bulk_ids.per_id:
                    if ids:
                        self._add_total_steps(len(ids))
                        self._emit_progress()
                    for single_id in ids:
                        if detail_path_tmpl:
                            detail_path_str = detail_path_tmpl.format(ids=joined, id=single_id)
                        else:
                            clean_path = endpoint.path.rstrip("/")
                            detail_path_str = f"{clean_path}/{single_id}"
                        try:
                            detail_payload, req_count = client.fetch_json(
                                detail_path_str, None, self._cancel_flag, self._pause_flag
                            )
                            requests_for_endpoint += req_count
                            self._record_requests(req_count)
                            self._store_payload(
                                endpoint,
                                detail_payload,
                                suffix="",
                                target_dir=detail_dir,
                                filename_override=str(single_id),
                            )
                            detail_entries.append(detail_payload)
                        except Exception as exc:
                            self.log_message.emit(
                                f"Details für {endpoint.name} (ID {single_id}) übersprungen: {exc}"
                            )
                        finally:
                            self._advance_steps(1)
                    detail_path = detail_dir
                    self.log_message.emit(f"Details geladen (pro ID) für {endpoint.name}: {len(ids)} Dateien")
                else:
                    if detail_path_tmpl:
                        detail_path_str = detail_path_tmpl.format(ids=joined)
                    else:
                        clean_path = endpoint.path.rstrip("/")
                        detail_path_str = f"{clean_path}/{joined}"

                    try:
                        detail_payload, req_count = client.fetch_json(
                            detail_path_str, None, self._cancel_flag, self._pause_flag
                        )
                        requests_for_endpoint += req_count
                        self._record_requests(req_count)
                        detail_path = self._store_payload(
                            endpoint,
                            detail_payload,
                            suffix="parameter",
                            target_dir=detail_dir,
                        )
                        self.log_message.emit(f"Details geladen für {endpoint.name}: {detail_path_str}")
                    except Exception as exc:
                        self.log_message.emit(f"Details für {endpoint.name} übersprungen: {exc}")
                    finally:
                        self._advance_steps(1)  # detail fetch done
            else:
                self.log_message.emit(f"Keine IDs gefunden für {endpoint.name}, Details werden übersprungen.")

        # Combined file for per-id runs (e.g., world_parameter.json)
        if detail_entries and endpoint.bulk_ids and endpoint.bulk_ids.per_id:
            combined_name = f"{safe_root_name}_parameter"
            self._store_payload(
                endpoint,
                detail_entries,
                suffix="",
                target_dir=endpoint_dir,
                filename_override=combined_name,
            )

        # Optional: download icons based on filenames
        if endpoint.icons:
            source_payload = detail_entries if detail_entries else (detail_payload if detail_payload is not None else payload)
            total_icons = 0
            icon_jobs: List[tuple] = []
            for icon_cfg in endpoint.icons:
                filenames = self._collect_file_names_with_template(source_payload, icon_cfg)
                if not filenames:
                    continue
                total_icons += len(filenames) * max(1, len(icon_cfg.styles))
                icon_jobs.append((icon_cfg, filenames))
            if total_icons:
                self._add_total_steps(total_icons)
                self._emit_progress()

            for icon_cfg, filenames in icon_jobs:
                base_dir = endpoint_dir
                if icon_cfg.dest_subdir:
                    base_dir = ensure_output_dir(base_dir / safe_filename(icon_cfg.dest_subdir))
                styles = icon_cfg.styles or [""]
                failed_icons = 0
                for style in styles:
                    target_dir = base_dir
                    if icon_cfg.include_style_dir and style:
                        target_dir = ensure_output_dir(base_dir / safe_filename(style))
                    for fname in filenames:
                        path_str = icon_cfg.path_template.format(style=style, fileName=fname)
                        try:
                            content, req_count = client.fetch_binary(path_str, None, self._cancel_flag, self._pause_flag)
                            requests_for_endpoint += req_count
                            self._record_requests(req_count)
                            file_path = target_dir / fname
                            ensure_output_dir(target_dir)
                            file_path.write_bytes(content)
                        except Exception as exc:
                            failed_icons += 1
                            self.log_message.emit(f"Icon download failed ({path_str}): {exc}")
                        finally:
                            self._advance_steps(1)
            if total_icons:
                self.log_message.emit(f"Icons geladen für {endpoint.name} ({total_icons} Dateien)")
            else:
                self.log_message.emit(f"Keine Icon-Dateinamen gefunden für {endpoint.name}, Icon-Download übersprungen.")

        if detail_path:
            return f"{main_path} ; {detail_path}"
        return str(main_path)

    @staticmethod
    def _collect_ids(payload: Any, id_field: str) -> List[str]:
        ids: List[str] = []
        if isinstance(payload, list):
            for item in payload:
                if isinstance(item, dict) and id_field in item:
                    ids.append(str(item[id_field]))
                elif isinstance(item, (str, int)):
                    ids.append(str(item))
        elif isinstance(payload, dict) and id_field in payload:
            ids.append(str(payload[id_field]))
        return ids

    def _collect_file_names_with_template(self, payload: Any, icon_cfg) -> List[str]:
        names: List[str] = []

        def add_from_item(item: Any) -> None:
            if not isinstance(item, dict):
                return
            if icon_cfg.tile_grid:
                tile_name = item.get(icon_cfg.tile_name_field) or item.get("tileName")
                width = item.get(icon_cfg.width_field)
                height = item.get(icon_cfg.height_field)
                tile_size = item.get(icon_cfg.tile_size_field, 512)
                if tile_name is None or width is None or height is None or icon_cfg.filename_template is None:
                    return
                try:
                    tile_size_val = max(1, int(tile_size))
                    w = int(width)
                    h = int(height)
                except (TypeError, ValueError):
                    return
                tiles_x = max(1, math.ceil(w / tile_size_val))
                tiles_y = max(1, math.ceil(h / tile_size_val))
                for x in range(tiles_x):
                    for y in range(tiles_y):
                        fmt_data = dict(item)
                        fmt_data.update(
                            worldTileName=tile_name,
                            tileName=tile_name,
                            tileX=x,
                            tileY=y,
                        )
                        try:
                            names.append(icon_cfg.filename_template.format(**fmt_data))
                        except KeyError:
                            continue
                return

            if icon_cfg.filename_template:
                try:
                    names.append(icon_cfg.filename_template.format(**item))
                except KeyError:
                    return
            elif icon_cfg.filename_field in item:
                names.append(str(item[icon_cfg.filename_field]))

        if isinstance(payload, list):
            for item in payload:
                add_from_item(item)
        elif isinstance(payload, dict):
            add_from_item(payload)
            for value in payload.values():
                if isinstance(value, list):
                    for item in value:
                        add_from_item(item)

        # deduplicate while preserving order
        seen = set()
        unique = []
        for n in names:
            if n not in seen:
                seen.add(n)
                unique.append(n)
        return unique

    def _record_requests(self, count: int) -> None:
        now = time.monotonic()
        for _ in range(max(1, count)):
            self._request_events.append(now)
        self._prune_requests(now)
        self._requests_made += count

    def _prune_requests(self, now: Optional[float] = None) -> None:
        now = now or time.monotonic()
        window = self.rate_limit.window_seconds
        while self._request_events and now - self._request_events[0] > window:
            self._request_events.popleft()

    def _window_used(self) -> int:
        self._prune_requests()
        return len(self._request_events)

    def _advance_steps(self, count: int) -> None:
        self._steps_done += count
        self._emit_progress()

    def _add_total_steps(self, count: int) -> None:
        self._steps_total += count

    def _emit_progress(self) -> None:
        self.progress_changed.emit(self._steps_done, max(self._steps_total, 1))

    def _store_payload(
        self,
        endpoint: EndpointConfig,
        payload: Any,
        suffix: str = "",
        target_dir: Optional[Path] = None,
        filename_override: Optional[str] = None,
    ) -> Path:
        target = target_dir or (self.output_dir / safe_filename(endpoint.name or endpoint.path.strip("/").replace("/", "_")))
        ensure_output_dir(target)
        filename = (
            safe_filename(filename_override)
            if filename_override
            else safe_filename(endpoint.name or endpoint.path.strip("/").replace("/", "_"))
        )
        if suffix:
            filename = f"{filename}_{suffix}"
        json_path = target / f"{filename}.json"
        with json_path.open("w", encoding="utf-8") as handle:
            if endpoint.write_pretty:
                json.dump(payload, handle, indent=2, ensure_ascii=False)
            else:
                json.dump(payload, handle)
        return json_path
