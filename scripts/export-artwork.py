"""Export generated source art to bounded, deterministic runtime PNGs.

Only size, atlas alignment and indexed PNG encoding change; source paintings stay intact.
Requires Pillow for maintainers regenerating checked-in art. Builds use exported PNGs.
"""

from pathlib import Path
from PIL import Image, ImageOps

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "design" / "artwork"
OUTPUT = ROOT / "game-packages" / "puerto-rico" / "art"
OUTPUT.mkdir(parents=True, exist_ok=True)


def export(image, name, colors=128):
    method = Image.FASTOCTREE if image.mode == "RGBA" else Image.MEDIANCUT
    image.quantize(colors=colors, method=method).save(OUTPUT / name, optimize=True)


harbor = Image.open(SOURCE / "harbor-source.png")
export(ImageOps.fit(harbor, (800, 500)), "harbor.png")
export(ImageOps.fit(harbor, (800, 450)), "cover.png")
export(Image.open(SOURCE / "icon-source.png").resize((256, 256), Image.LANCZOS), "icon.png", 256)

# ImageGen's painted horizontal grid lines are not exactly equidistant. Normalize
# the reviewed cell bounds when exporting so CSS uses an exact 5 x 5 atlas.
buildings = Image.open(SOURCE / "buildings-source.png")
xs = [0, 250, 502, 752, 1003, 1254]
ys = [0, 231, 460, 694, 946, 1254]
atlas = Image.new("RGB", (750, 750))
for row in range(5):
    for col in range(5):
        tile = buildings.crop((xs[col] + 2, ys[row] + 2, xs[col + 1] - 2, ys[row + 1] - 2))
        atlas.paste(ImageOps.fit(tile, (150, 150)), (col * 150, row * 150))
export(atlas, "buildings.png")

objects = Image.open(SOURCE / "objects-source.png")
atlas = Image.new("RGB", (704, 704))
for row in range(4):
    for col in range(4):
        tile = objects.crop((col * 313.5 + 2, row * 313.5 + 2, (col + 1) * 313.5 - 2, (row + 1) * 313.5 - 2))
        atlas.paste(tile.resize((176, 176), Image.LANCZOS), (col * 176, row * 176))
export(atlas, "objects.png")

for file in sorted(OUTPUT.glob("*.png")):
    print(f"{file.name}: {file.stat().st_size} bytes")
