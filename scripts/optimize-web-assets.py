#!/usr/bin/env python3
"""Build smaller WebP derivatives for images used by the web UI."""
from pathlib import Path
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]

def convert(source: Path, max_size: tuple[int, int], quality: int = 90) -> tuple[int, int]:
    image = Image.open(source).convert("RGBA")
    image.thumbnail(max_size, Image.Resampling.LANCZOS)
    target = source.with_suffix(".webp")
    image.save(target, "WEBP", quality=quality, method=6, alpha_quality=100)
    return source.stat().st_size, target.stat().st_size

groups = [
    (ROOT / "assets/heading", "*-custom.png", (512, 512), 90),
    (ROOT / "assets/heading", "*-front.png", (256, 256), 90),
    (ROOT / "assets/topics", "*.png", (1200, 900), 90),
    (ROOT / "assets/prep-prompts", "*.png", (1400, 400), 90),
    (ROOT / "assets", "home-tagline.png", (1600, 160), 90),
    (ROOT / "assets/dialect-map", "*.png", (1400, 1400), 90),
    (ROOT / "assets/records", "*.png", (1100, 1100), 90),
    (ROOT / "public/assets/discs", "*-front.png", (1000, 1000), 90),
    (ROOT / "public/assets/dialect-labels", "*.png", (700, 700), 90),
]
total_before = total_after = count = 0
for directory, pattern, max_size, quality in groups:
    for source in sorted(directory.rglob(pattern)):
        before, after = convert(source, max_size, quality)
        total_before += before
        total_after += after
        count += 1
print(f"Created {count} WebP assets: {total_before / 1024 / 1024:.1f} MiB -> {total_after / 1024 / 1024:.1f} MiB")
