from __future__ import annotations

import json
import os
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any, Dict, List, Optional


@dataclass
class PaginationConfig:
    """Optional pagination settings for an endpoint."""

    page_param: str = "page"
    start: int = 1
    limit_param: Optional[str] = None
    page_size: Optional[int] = None
    max_pages: Optional[int] = None
    stop_on_empty: bool = True


@dataclass
class EndpointConfig:
    name: str
    path: str
    params: Dict[str, Any] = field(default_factory=dict)
    enabled: bool = True
    pagination: Optional[PaginationConfig] = None
    write_pretty: bool = False
    bulk_ids: Optional["BulkIdsConfig"] = None
    icons: List["IconSource"] = field(default_factory=list)
    output_subdir: Optional[str] = None


@dataclass
class EndpointsFile:
    base_url: str
    endpoints: List[EndpointConfig]


@dataclass
class RateLimitSettings:
    max_requests: int = 300
    window_seconds: int = 60
    request_timeout: float = 15.0
    max_retries: int = 0
    backoff_factor: float = 1.5


@dataclass
class BulkIdsConfig:
    """After initial list fetch, re-fetch details for all IDs in one call."""

    id_field: str = "id"
    join_with: str = ","
    path_template: Optional[str] = None  # e.g., "/class/{ids}"; if None, use f"{path}/{ids}"
    per_id: bool = False
    dest_subdir: Optional[str] = "parameter"


@dataclass
class IconSource:
    """Download icons using style + filename from payload."""

    filename_field: str = "icon"
    filename_template: Optional[str] = None  # e.g. "{worldTileName}{tileX}-{tileY}-0.png"
    styles: List[str] = field(default_factory=lambda: ["messenger", "old_female", "old_male", "target"])
    path_template: str = "/image/class/{style}/{fileName}"
    dest_subdir: Optional[str] = "icons"
    include_style_dir: bool = True
    tile_grid: bool = False
    tile_name_field: str = "tileName"
    tile_size_field: str = "tileSize"
    width_field: str = "width"
    height_field: str = "height"


def get_default_output_dir() -> Path:
    """Return the default output directory derived from %APPDATA%."""
    appdata = os.getenv("APPDATA")
    if not appdata:
        raise RuntimeError("APPDATA environment variable is not set; cannot determine default output path.")
    return Path(appdata) / "Flyff-U-Launcher" / "api_fetch"


def ensure_output_dir(path: Path) -> Path:
    path.mkdir(parents=True, exist_ok=True)
    return path


def _parse_pagination(raw: Dict[str, Any]) -> PaginationConfig:
    return PaginationConfig(
        page_param=raw.get("page_param", "page"),
        start=int(raw.get("start", 1)),
        limit_param=raw.get("limit_param"),
        page_size=int(raw["page_size"]) if raw.get("page_size") is not None else None,
        max_pages=int(raw["max_pages"]) if raw.get("max_pages") is not None else None,
        stop_on_empty=bool(raw.get("stop_on_empty", True)),
    )


def _parse_endpoint(raw: Dict[str, Any]) -> EndpointConfig:
    pagination = raw.get("pagination")
    pagination_cfg = _parse_pagination(pagination) if isinstance(pagination, dict) else None
    bulk_raw = raw.get("bulk_ids")
    bulk_cfg = None
    if isinstance(bulk_raw, dict):
        bulk_cfg = BulkIdsConfig(
            id_field=str(bulk_raw.get("id_field", "id")),
            join_with=str(bulk_raw.get("join_with", ",")),
            path_template=bulk_raw.get("path_template"),
            per_id=bool(bulk_raw.get("per_id", False)),
            dest_subdir=bulk_raw.get("dest_subdir", "parameter"),
        )
    icons_cfg: List[IconSource] = []
    icons_raw = raw.get("icons")
    if isinstance(icons_raw, list):
        for entry in icons_raw:
            if not isinstance(entry, dict):
                continue
            styles = entry.get("styles") or ["messenger", "old_female", "old_male", "target"]
            icons_cfg.append(
                IconSource(
                    filename_field=str(entry.get("filename_field", "icon")),
                    filename_template=entry.get("filename_template"),
                    styles=[str(s) for s in styles],
                    path_template=str(entry.get("path_template", "/image/class/{style}/{fileName}")),
                    dest_subdir=entry.get("dest_subdir", "icons"),
                    include_style_dir=bool(entry.get("include_style_dir", True)),
                    tile_grid=bool(entry.get("tile_grid", False)),
                    tile_name_field=str(entry.get("tile_name_field", "tileName")),
                    tile_size_field=str(entry.get("tile_size_field", "tileSize")),
                    width_field=str(entry.get("width_field", "width")),
                    height_field=str(entry.get("height_field", "height")),
                )
            )
    elif isinstance(icons_raw, dict):
        styles = icons_raw.get("styles") or ["messenger", "old_female", "old_male", "target"]
        icons_cfg.append(
            IconSource(
                filename_field=str(icons_raw.get("filename_field", "icon")),
                filename_template=icons_raw.get("filename_template"),
                styles=[str(s) for s in styles],
                path_template=str(icons_raw.get("path_template", "/image/class/{style}/{fileName}")),
                dest_subdir=icons_raw.get("dest_subdir", "icons"),
                include_style_dir=bool(icons_raw.get("include_style_dir", True)),
                tile_grid=bool(icons_raw.get("tile_grid", False)),
                tile_name_field=str(icons_raw.get("tile_name_field", "tileName")),
                tile_size_field=str(icons_raw.get("tile_size_field", "tileSize")),
                width_field=str(icons_raw.get("width_field", "width")),
                height_field=str(icons_raw.get("height_field", "height")),
            )
        )
    return EndpointConfig(
        name=str(raw["name"]),
        path=str(raw["path"]),
        params=raw.get("params", {}) or {},
        enabled=bool(raw.get("enabled", True)),
        pagination=pagination_cfg,
        write_pretty=bool(raw.get("write_pretty", False)),
        bulk_ids=bulk_cfg,
        icons=icons_cfg,
        output_subdir=raw.get("output_subdir") or raw.get("path_template"),
    )


def load_endpoints(file_path: Path) -> EndpointsFile:
    """Load endpoints configuration from a JSON file."""
    with file_path.open("r", encoding="utf-8") as handle:
        data = json.load(handle)

    base_url = data.get("base_url")
    if not base_url:
        raise ValueError("Missing 'base_url' in endpoints configuration.")

    endpoints_raw = data.get("endpoints", [])
    if not isinstance(endpoints_raw, list) or not endpoints_raw:
        raise ValueError("No endpoints defined in configuration.")

    endpoints = [_parse_endpoint(item) for item in endpoints_raw]
    return EndpointsFile(base_url=base_url, endpoints=endpoints)


def save_manifest(manifest: Dict[str, Any], output_dir: Path) -> Path:
    """Persist a manifest.json file with metadata about the run."""
    ensure_output_dir(output_dir)
    manifest_path = output_dir / "manifest.json"
    manifest_path.write_text(json.dumps(manifest, indent=2), encoding="utf-8")
    return manifest_path
