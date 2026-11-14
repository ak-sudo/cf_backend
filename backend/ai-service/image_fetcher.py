"""
Safe image ingestion for the VLM.

The agent never fetches URLs itself. We download images here with:
  - HTTPS only, host allow-list (default: res.cloudinary.com), no IP literals, no redirects  -> blocks SSRF
  - streamed size cap and timeout                                                          -> blocks resource abuse
  - Pillow decode + re-encode to JPEG (max dimension bounded)                               -> rejects non-images,
    strips EXIF metadata such as GPS, and keeps token usage predictable
"""
import io
import ipaddress
import logging
from dataclasses import dataclass
from typing import List
from urllib.parse import urlparse

import httpx
from PIL import Image as PILImage, UnidentifiedImageError

from config import (
    IMAGE_ALLOWED_HOSTS,
    IMAGE_FETCH_TIMEOUT_SECONDS,
    MAX_IMAGE_BYTES,
    MAX_IMAGE_DIMENSION,
)

logger = logging.getLogger("civicflow-ai.images")

# Guard against decompression bombs (e.g. a tiny PNG that expands to gigapixels)
PILImage.MAX_IMAGE_PIXELS = 40_000_000

ALLOWED_CONTENT_TYPES = {"image/jpeg", "image/png", "image/webp"}


class ImageRejected(Exception):
    """Raised when an image URL or payload fails a safety check."""


@dataclass
class FetchedImage:
    content: bytes
    mime_type: str
    source_host: str


def _is_allowed_host(host: str) -> bool:
    host = host.lower().rstrip(".")
    try:
        ipaddress.ip_address(host)
        return False  # never fetch raw IPs (internal network / metadata endpoints)
    except ValueError:
        pass
    return any(host == allowed or host.endswith("." + allowed) for allowed in IMAGE_ALLOWED_HOSTS)


def validate_image_url(url: str) -> str:
    parsed = urlparse(url)
    if parsed.scheme != "https":
        raise ImageRejected("only https image URLs are allowed")
    if parsed.username or parsed.password:
        raise ImageRejected("credentials in image URLs are not allowed")
    if parsed.port not in (None, 443):
        raise ImageRejected("non-standard ports are not allowed")
    host = parsed.hostname or ""
    if not _is_allowed_host(host):
        raise ImageRejected(f"image host '{host}' is not in the allow-list")
    return host


def _normalise(raw: bytes) -> bytes:
    """Decode, verify and re-encode as JPEG with bounded dimensions (also drops EXIF/GPS)."""
    try:
        with PILImage.open(io.BytesIO(raw)) as probe:
            probe.verify()
        with PILImage.open(io.BytesIO(raw)) as img:
            img = img.convert("RGB")
            img.thumbnail((MAX_IMAGE_DIMENSION, MAX_IMAGE_DIMENSION))
            out = io.BytesIO()
            img.save(out, format="JPEG", quality=85, optimize=True)
            return out.getvalue()
    except (UnidentifiedImageError, OSError, PILImage.DecompressionBombError, ValueError) as exc:
        raise ImageRejected(f"not a valid image ({exc.__class__.__name__})") from exc


async def fetch_image(client: httpx.AsyncClient, url: str) -> FetchedImage:
    host = validate_image_url(url)

    async with client.stream("GET", url) as response:
        if response.status_code != 200:
            raise ImageRejected(f"image host returned HTTP {response.status_code}")

        content_type = response.headers.get("content-type", "").split(";")[0].strip().lower()
        if content_type not in ALLOWED_CONTENT_TYPES:
            raise ImageRejected(f"unsupported content type '{content_type or 'unknown'}'")

        declared = response.headers.get("content-length")
        if declared and declared.isdigit() and int(declared) > MAX_IMAGE_BYTES:
            raise ImageRejected("image exceeds size limit")

        buf = bytearray()
        async for chunk in response.aiter_bytes():
            buf.extend(chunk)
            if len(buf) > MAX_IMAGE_BYTES:
                raise ImageRejected("image exceeds size limit")

    return FetchedImage(content=_normalise(bytes(buf)), mime_type="image/jpeg", source_host=host)


async def fetch_images(urls: List[str]) -> tuple[List[FetchedImage], List[str]]:
    """Fetch all images; returns (images, rejection_reasons). Individual failures don't abort the batch."""
    images: List[FetchedImage] = []
    rejections: List[str] = []

    async with httpx.AsyncClient(
        timeout=IMAGE_FETCH_TIMEOUT_SECONDS,
        follow_redirects=False,
        headers={"User-Agent": "CivicFlow-AI-Service/2.0"},
    ) as client:
        for index, url in enumerate(urls):
            try:
                images.append(await fetch_image(client, url))
            except ImageRejected as exc:
                rejections.append(f"image {index + 1}: {exc}")
            except httpx.HTTPError as exc:
                rejections.append(f"image {index + 1}: download failed ({exc.__class__.__name__})")

    if rejections:
        logger.warning("Rejected %d of %d images: %s", len(rejections), len(urls), "; ".join(rejections))
    return images, rejections
