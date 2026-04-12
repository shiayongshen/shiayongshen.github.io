from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Any


POSTS_DIR = Path("content/posts")


@dataclass
class MarkdownPost:
    title: str
    slug: str
    summary: str
    category: str
    cover_image_url: str
    tags: list[str]
    published: bool
    created_at: datetime
    updated_at: datetime
    content_markdown: str


def _parse_bool(value: str) -> bool:
    return value.strip().lower() in {"true", "1", "yes"}


def _parse_list(value: str) -> list[str]:
    return [item.strip() for item in value.split(",") if item.strip()]


def _parse_datetime(value: str) -> datetime:
    return datetime.fromisoformat(value.replace("Z", "+00:00"))


def _stringify_datetime(value: datetime) -> str:
    return value.astimezone(timezone.utc).isoformat().replace("+00:00", "Z")


def _parse_frontmatter(raw: str) -> tuple[dict[str, Any], str]:
    if not raw.startswith("---\n"):
        return {}, raw

    _, remainder = raw.split("---\n", 1)
    frontmatter_raw, content = remainder.split("\n---\n", 1)
    metadata: dict[str, Any] = {}

    for line in frontmatter_raw.splitlines():
        if not line.strip():
            continue
        key, value = line.split(":", 1)
        metadata[key.strip()] = value.strip()

    return metadata, content.lstrip("\n")


def _serialize_frontmatter(metadata: dict[str, Any]) -> str:
    lines = ["---"]
    for key, value in metadata.items():
        if isinstance(value, list):
            rendered = ", ".join(value)
        elif isinstance(value, bool):
            rendered = "true" if value else "false"
        else:
            rendered = str(value)
        lines.append(f"{key}: {rendered}")
    lines.append("---")
    return "\n".join(lines)


def ensure_posts_dir() -> None:
    POSTS_DIR.mkdir(parents=True, exist_ok=True)


def post_path(slug: str) -> Path:
    return POSTS_DIR / f"{slug}.md"


def load_post_from_file(path: Path) -> MarkdownPost:
    metadata, content = _parse_frontmatter(path.read_text(encoding="utf-8"))
    return MarkdownPost(
        title=metadata["title"],
        slug=metadata["slug"],
        summary=metadata["summary"],
        category=metadata.get("category", "general"),
        cover_image_url=metadata.get("cover_image_url", ""),
        tags=_parse_list(metadata.get("tags", "")),
        published=_parse_bool(metadata.get("published", "true")),
        created_at=_parse_datetime(metadata["created_at"]),
        updated_at=_parse_datetime(metadata["updated_at"]),
        content_markdown=content,
    )


def list_posts(*, include_drafts: bool) -> list[MarkdownPost]:
    ensure_posts_dir()
    posts = [load_post_from_file(path) for path in POSTS_DIR.glob("*.md")]
    if not include_drafts:
        posts = [post for post in posts if post.published]
    return sorted(posts, key=lambda post: post.created_at, reverse=True)


def get_post(slug: str, *, include_drafts: bool) -> MarkdownPost | None:
    path = post_path(slug)
    if not path.exists():
        return None
    post = load_post_from_file(path)
    if not include_drafts and not post.published:
        return None
    return post


def save_post(payload: dict[str, Any], *, original_slug: str | None = None) -> MarkdownPost:
    ensure_posts_dir()
    now = datetime.now(timezone.utc)
    slug = payload["slug"]
    created_at = payload.get("created_at") or _stringify_datetime(now)
    updated_at = _stringify_datetime(now)

    path = post_path(slug)
    if original_slug != slug and path.exists():
        raise FileExistsError("Slug already exists")

    if original_slug and original_slug != slug:
        original_path = post_path(original_slug)
        if original_path.exists():
            original_path.unlink()

    metadata = {
        "title": payload["title"],
        "slug": slug,
        "summary": payload["summary"],
        "category": payload.get("category", "general"),
        "cover_image_url": payload.get("cover_image_url", ""),
        "tags": payload.get("tags", []),
        "published": payload.get("published", True),
        "created_at": created_at,
        "updated_at": updated_at,
    }
    document = f"{_serialize_frontmatter(metadata)}\n\n{payload['content_markdown'].rstrip()}\n"
    path.write_text(document, encoding="utf-8")
    return load_post_from_file(path)


def delete_post(slug: str) -> None:
    path = post_path(slug)
    if not path.exists():
        raise FileNotFoundError(slug)
    path.unlink()
