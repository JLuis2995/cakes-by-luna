"""Shrink, rotate and strip metadata from gallery photos, keeping each file name.

Usage: python optimizar_fotos.py <folder>
Already-optimized files (small enough and without metadata) are left untouched,
so running it again changes nothing.
"""
import sys
from pathlib import Path

from PIL import Image, ImageOps

MAX_LADO = 1350          # longest side, in pixels (the gallery shows them at ~360px wide)
MAX_BYTES = 450 * 1024   # above this the file is re-compressed
EXTENSOES = {".jpg", ".jpeg", ".png", ".webp"}


def precisa(img: Image.Image, arquivo: Path) -> bool:
    return max(img.size) > MAX_LADO or arquivo.stat().st_size > MAX_BYTES or bool(img.getexif())


def otimizar(arquivo: Path) -> bool:
    with Image.open(arquivo) as img:
        if not precisa(img, arquivo):
            return False
        img = ImageOps.exif_transpose(img)
        img.thumbnail((MAX_LADO, MAX_LADO), Image.LANCZOS)
        ext = arquivo.suffix.lower()
        if ext in (".jpg", ".jpeg"):
            img.convert("RGB").save(arquivo, "JPEG", quality=82, optimize=True, progressive=True)
        elif ext == ".webp":
            img.save(arquivo, "WEBP", quality=80, method=6)
        else:
            img.save(arquivo, "PNG", optimize=True)
    return True


def main() -> None:
    pasta = Path(sys.argv[1] if len(sys.argv) > 1 else "assets/galeria")
    for arquivo in sorted(pasta.iterdir()):
        if arquivo.suffix.lower() not in EXTENSOES:
            continue
        antes = arquivo.stat().st_size
        try:
            if otimizar(arquivo):
                print(f"optimized {arquivo.name}: {antes // 1024} KB -> {arquivo.stat().st_size // 1024} KB")
        except Exception as e:  # a broken file must not stop the others
            print(f"skipped {arquivo.name}: {e}")


if __name__ == "__main__":
    main()
