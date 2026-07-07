"""Generate responsive WebP variants for blog attachments.

Scans posts/**/attachments/ for raster images, writes WebP copies at
capped widths into assets/img/ under flat content-hash names (attachment
filenames contain Hebrew and spaces; srcset cannot tolerate spaces), and
maintains assets/img/manifest.json mapping source paths to variants.

Originals are never modified. Idempotent: unchanged files (by SHA-1) are
skipped; variants whose source disappeared are pruned.
"""
import hashlib
import json
import sys
from pathlib import Path

from PIL import Image, ImageOps

ROOT = Path(__file__).resolve().parent.parent
POSTS = ROOT / "posts"
OUT = ROOT / "assets" / "img"
MANIFEST = OUT / "manifest.json"
WIDTHS = [800, 1600]
QUALITY = 82
# GIF/SVG pass through untouched (animation / vector); webp already efficient
EXTS = {".png", ".jpg", ".jpeg"}


def file_hash(path):
    h = hashlib.sha1()
    with open(path, "rb") as f:
        for chunk in iter(lambda: f.read(1 << 20), b""):
            h.update(chunk)
    return h.hexdigest()


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    old = {}
    if MANIFEST.exists():
        old = json.loads(MANIFEST.read_text(encoding="utf-8"))

    manifest = {}
    made = skipped = failed = 0
    for src in sorted(POSTS.rglob("*")):
        if src.suffix.lower() not in EXTS or "attachments" not in src.parts:
            continue
        rel = src.relative_to(POSTS).as_posix()
        try:
            digest = file_hash(src)
            entry = old.get(rel)
            if entry and entry.get("hash") == digest and all(
                (ROOT / v["path"]).exists() for v in entry["variants"]
            ):
                manifest[rel] = entry
                skipped += 1
                continue
            with Image.open(src) as im:
                im = ImageOps.exif_transpose(im)
                if im.mode in ("P", "RGBA", "LA"):
                    im = im.convert("RGBA")
                else:
                    im = im.convert("RGB")
                w, h = im.size
                variants = []
                for target in WIDTHS:
                    if target >= w:
                        continue
                    ratio = target / w
                    resized = im.resize((target, max(1, round(h * ratio))), Image.LANCZOS)
                    name = f"{digest[:12]}.{target}.webp"
                    resized.save(OUT / name, "WEBP", quality=QUALITY, method=4)
                    variants.append({"w": target, "path": f"assets/img/{name}"})
                if not variants:
                    # Source smaller than every target: single full-size webp copy
                    name = f"{digest[:12]}.{w}.webp"
                    im.save(OUT / name, "WEBP", quality=QUALITY, method=4)
                    variants.append({"w": w, "path": f"assets/img/{name}"})
                manifest[rel] = {"hash": digest, "w": w, "h": h, "variants": variants}
                made += 1
        except Exception as e:  # noqa: BLE001 — one bad image must not kill the sync
            print(f"WARN could not process {rel}: {e}", file=sys.stderr)
            failed += 1

    # Prune orphaned variants (source deleted/changed)
    keep = {Path(v["path"]).name for e in manifest.values() for v in e["variants"]}
    pruned = 0
    for f in OUT.glob("*.webp"):
        if f.name not in keep:
            f.unlink()
            pruned += 1

    MANIFEST.write_text(
        json.dumps(manifest, ensure_ascii=False, indent=0, sort_keys=True) + "\n",
        encoding="utf-8",
    )
    print(f"variants: {made} generated, {skipped} unchanged, {pruned} pruned, {failed} failed, {len(manifest)} sources")


if __name__ == "__main__":
    main()
