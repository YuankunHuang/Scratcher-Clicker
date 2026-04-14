"""
Art asset processor for 寻宝人.
- Removes white/light backgrounds (converts to transparent PNG)
- Rounds dimensions to nearest multiple of 4
- Copies processed files into the correct subdirectory
"""

from PIL import Image
import os, shutil, math

SRC = r"C:\Users\buptf\.cursor\projects\p-Cocos-capstone\assets"
DST = r"P:\Cocos\Scratcher-Clicker\docs\art"

# (source filename, dest relative path, target_size, bg_threshold, mode)
# mode: "white_bg"  → remove white bg
#       "black_bg"  → keep as-is (brush_tip uses luminance as alpha)
#       "none"      → just resize, no bg removal (dirt texture is opaque)
MANIFEST = [
    # ── Artifacts ─────────────────────────────────────────────────────────
    ("bronze_ding_dirty_raw.png",   "artifacts/bronze_ding/bronze_ding_dirty.png",  (512, 512), "white_bg"),
    ("bronze_ding_clean_raw.png",   "artifacts/bronze_ding/bronze_ding_clean.png",  (512, 512), "white_bg"),
    ("ceramic_vase_dirty_raw.png",  "artifacts/ceramic_vase/ceramic_vase_dirty.png",(512, 512), "white_bg"),
    ("ceramic_vase_clean_raw.png",  "artifacts/ceramic_vase/ceramic_vase_clean.png",(512, 512), "white_bg"),
    # ── Scratch textures ───────────────────────────────────────────────────
    ("brush_tip_soft_raw.png",      "scratch/brush_tip_soft.png",                   (128, 128), "lum_alpha"),
    ("dirt_overlay_raw.png",        "scratch/dirt_overlay.png",                     (512, 512), "none"),
    # ── Tools ─────────────────────────────────────────────────────────────
    ("tool_brush_raw.png",          "tools/tool_brush.png",                         (128, 128), "white_bg"),
    ("tool_polisher_raw.png",       "tools/tool_polisher.png",                      (128, 128), "white_bg"),
    ("tool_watergun_raw.png",       "tools/tool_watergun.png",                      (128, 128), "white_bg"),
    # ── UI icons ──────────────────────────────────────────────────────────
    ("icon_coin_raw.png",           "ui/icon_coin.png",                             (128, 128), "white_bg"),
    ("icon_reputation_raw.png",     "ui/icon_reputation.png",                       (128, 128), "white_bg"),
    # ── Museum ────────────────────────────────────────────────────────────
    ("museum_locked_raw.png",       "museum/artifact_locked.png",                   (128, 128), "white_bg"),
]


def round4(v: int) -> int:
    return max(4, (v + 2) // 4 * 4)


def remove_white_bg(img: Image.Image, threshold: int = 240) -> Image.Image:
    """
    Two-phase white background removal:

    Phase 1 — BFS flood fill from every border pixel.
        Removes the outer background that is connected to the image edges.
        Stops at non-white pixels, so object interiors are untouched here.

    Phase 2 — Global scan for isolated near-pure-white pixels.
        Handles enclosed white regions (e.g. the square hole in a coin, vessel
        interiors) that Phase 1 cannot reach because they are surrounded by
        non-white content.  Uses a tighter threshold (250) to avoid wiping
        off-white highlights like cream bristles or pale celadon glazes.
    """
    from collections import deque

    img = img.convert("RGBA")
    data = img.load()
    w, h = img.size

    # ── Phase 1: edge-seeded BFS ────────────────────────────────────────
    visited = [[False] * h for _ in range(w)]
    queue   = deque()

    def enqueue(x: int, y: int) -> None:
        if 0 <= x < w and 0 <= y < h and not visited[x][y]:
            r, g, b, _ = data[x, y]
            if r >= threshold and g >= threshold and b >= threshold:
                visited[x][y] = True
                queue.append((x, y))

    for x in range(w):
        enqueue(x, 0); enqueue(x, h - 1)
    for y in range(h):
        enqueue(0, y); enqueue(w - 1, y)

    while queue:
        x, y = queue.popleft()
        data[x, y] = (255, 255, 255, 0)
        for dx, dy in ((-1, 0), (1, 0), (0, -1), (0, 1)):
            enqueue(x + dx, y + dy)

    # ── Phase 2: global removal of isolated near-pure-white pixels ──────
    # Threshold is intentionally higher (250) than Phase 1 so that off-white
    # tones (cream highlights, pale glazes ~RGB 240-249) are preserved.
    hi = 250
    for y in range(h):
        for x in range(w):
            r, g, b, a = data[x, y]
            if a > 0 and r >= hi and g >= hi and b >= hi:
                data[x, y] = (r, g, b, 0)

    return img


def lum_as_alpha(img: Image.Image) -> Image.Image:
    """Use luminance as alpha, suitable for white-on-black brush tips."""
    gray = img.convert("L")
    result = Image.new("RGBA", img.size, (255, 255, 255, 0))
    result.putalpha(gray)
    return result


def fit_pad(img: Image.Image, target_w: int, target_h: int) -> Image.Image:
    """
    Scale the image to fit WITHIN (target_w × target_h) keeping aspect ratio,
    then pad the remaining space with transparent pixels to reach the exact target.
    No content is stretched or squished.
    """
    src_w, src_h = img.size
    scale = min(target_w / src_w, target_h / src_h)
    new_w = max(1, round(src_w * scale))
    new_h = max(1, round(src_h * scale))
    img = img.resize((new_w, new_h), Image.LANCZOS)

    canvas = Image.new("RGBA", (target_w, target_h), (0, 0, 0, 0))
    paste_x = (target_w - new_w) // 2
    paste_y = (target_h - new_h) // 2
    canvas.paste(img, (paste_x, paste_y), img)
    return canvas


def process(src_path: str, dst_path: str, target_size: tuple, mode: str):
    img = Image.open(src_path)

    if mode == "white_bg":
        img = remove_white_bg(img)
    elif mode == "lum_alpha":
        img = lum_as_alpha(img)
    elif mode == "none":
        img = img.convert("RGBA")

    tw, th = target_size
    assert tw % 4 == 0 and th % 4 == 0, "Target must be multiple of 4"

    if mode == "none":
        # Tileable textures: direct resize is acceptable
        img = img.resize((tw, th), Image.LANCZOS)
    else:
        # 1. Crop to the tight bounding box of non-transparent content
        bbox = img.getbbox()
        if bbox:
            img = img.crop(bbox)
        # 2. Fit into target canvas with transparent padding (no distortion)
        img = fit_pad(img, tw, th)

    os.makedirs(os.path.dirname(dst_path), exist_ok=True)
    img.save(dst_path, "PNG")
    print(f"  OK  {os.path.basename(dst_path)}  ({tw}x{th})  [{mode}]")


if __name__ == "__main__":
    print(f"\n=== Processing {len(MANIFEST)} assets ===\n", flush=True)
    for src_name, dst_rel, size, mode in MANIFEST:
        src = os.path.join(SRC, src_name)
        dst = os.path.join(DST, dst_rel)
        if not os.path.exists(src):
            print(f"  MISS  {src_name}")
            continue
        try:
            process(src, dst, size, mode)
        except Exception as e:
            print(f"  ERR  {src_name}: {e}")

    print("\n=== Done ===\n")
