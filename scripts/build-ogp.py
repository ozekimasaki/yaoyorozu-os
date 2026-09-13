#!/usr/bin/env python3
"""Build OGP SVG with outlined Japanese so crawlers do not need webfonts."""

from __future__ import annotations

import os
from pathlib import Path

from fontTools.misc.transform import Transform
from fontTools.pens.svgPathPen import SVGPathPen
from fontTools.pens.transformPen import TransformPen
from fontTools.ttLib import TTFont

ROOT = Path(__file__).resolve().parent.parent
FONT_DIR = Path(os.environ.get("YAO_FONTS", "/tmp/yao-fonts"))

TITLE = "\u516b\u767e\u4e07OS"
TAGLINE = "\u672a\u958b\u5c01\u306e\u65e5\u672c\u3092\u3001\u8d77\u52d5\u3059\u308b"
DESC = (
    "\u30d6\u30e9\u30a6\u30b6\u3092\u7b50\u4f53\u306b\u3059\u308b\u3001"
    "\u516b\u767e\u4e07\u306e\u95a2\u4fc2\u6027\u306e\u30aa\u30da\u30ec\u30fc\u30c6\u30a3\u30f3\u30b0\u30b7\u30b9\u30c6\u30e0"
)
EN = "YAOYOROZU OPERATING SYSTEM"
OG_TITLE = f"{TITLE} \u2014 {TAGLINE}"


def load(name: str) -> TTFont:
    path = FONT_DIR / name
    if not path.exists():
        raise SystemExit(f"missing font {path}")
    return TTFont(path)


def outlined_text(font: TTFont, text: str, x: float, y: float, size: float, fill: str, tracking: float = 0) -> str:
    glyph_set = font.getGlyphSet()
    cmap = font.getBestCmap()
    upem = font["head"].unitsPerEm
    scale = size / upem
    hmtx = font["hmtx"]
    glyphs: list[tuple[str, float]] = []
    cursor = 0.0
    for i, ch in enumerate(text):
        name = cmap.get(ord(ch))
        if name is None:
            raise SystemExit(f"missing glyph U+{ord(ch):04X} {ch!r}")
        glyphs.append((name, cursor))
        adv = hmtx[name][0] * scale
        cursor += adv
        if i < len(text) - 1:
            cursor += tracking
    origin = x - cursor / 2
    parts: list[str] = []
    for name, gx in glyphs:
        pen = SVGPathPen(glyph_set)
        tpen = TransformPen(pen, Transform(scale, 0, 0, -scale, origin + gx, y))
        glyph_set[name].draw(tpen)
        d = pen.getCommands()
        if d:
            parts.append(f'<path fill="{fill}" d="{d}"/>')
    return "\n    ".join(parts)


def main() -> None:
    serif_sb = load("ShipporiMincho-SemiBold.ttf")
    serif_md = load("ShipporiMincho-Medium.ttf")
    mono = load("IBMPlexMono-Medium.ttf")

    title_paths = outlined_text(serif_sb, TITLE, 600, 348, 74, "#f4ead8", tracking=16)
    en_paths = outlined_text(mono, EN, 600, 396, 15, "#e6c96a", tracking=7.5)
    tag_paths = outlined_text(serif_md, TAGLINE, 600, 474, 26, "#d9ccb0", tracking=8)
    desc_paths = outlined_text(serif_md, DESC, 600, 528, 16, "#d9ccb0", tracking=2.2)

    svg = f"""<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630" role="img" aria-labelledby="og-title og-desc">
  <title id="og-title">{OG_TITLE}</title>
  <desc id="og-desc">{DESC}\u3002</desc>
  <defs>
    <radialGradient id="og-bg" cx="50%" cy="28%" r="72%">
      <stop offset="0%" stop-color="#1a1812"/>
      <stop offset="52%" stop-color="#12100c"/>
      <stop offset="100%" stop-color="#0c0b09"/>
    </radialGradient>
    <linearGradient id="og-kasagi" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#e2573f"/>
      <stop offset="100%" stop-color="#c23a2b"/>
    </linearGradient>
  </defs>
  <rect width="1200" height="630" fill="url(#og-bg)"/>
  <ellipse cx="600" cy="188" rx="320" ry="96" fill="#c23a2b" opacity="0.11"/>
  <rect x="40" y="36" width="1120" height="558" rx="3" fill="none" stroke="#f4ead8" stroke-opacity="0.14" stroke-width="1"/>
  <rect x="48" y="44" width="1104" height="542" rx="1.5" fill="none" stroke="#c9a227" stroke-opacity="0.2" stroke-width="0.8"/>
  <g transform="translate(600, 86) scale(1.72) translate(-140, 0)">
    <rect x="10" y="18" width="260" height="10" fill="url(#og-kasagi)"/>
    <rect x="18" y="28" width="244" height="10" fill="#c23a2b"/>
    <rect x="46" y="28" width="12" height="84" fill="#c23a2b"/>
    <rect x="222" y="28" width="12" height="84" fill="#c23a2b"/>
    <rect x="46" y="68" width="188" height="7" fill="#c9a227"/>
    <rect x="86" y="38" width="8" height="28" fill="#e6c96a"/>
    <rect x="186" y="38" width="8" height="28" fill="#e6c96a"/>
  </g>
  <g id="og-title-paths" aria-hidden="true">
    {title_paths}
  </g>
  <g id="og-en-paths" aria-hidden="true">
    {en_paths}
  </g>
  <rect x="522" y="424" width="156" height="1.6" fill="#c23a2b"/>
  <g id="og-tag-paths" aria-hidden="true">
    {tag_paths}
  </g>
  <g id="og-desc-paths" opacity="0.78" aria-hidden="true">
    {desc_paths}
  </g>
</svg>
"""
    out = ROOT / "svg" / "ogp.svg"
    out.write_text(svg, encoding="utf-8")
    print(f"wrote {out}")

    fav = """<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" role="img" aria-label="Yaoyorozu OS">
  <title>Yaoyorozu OS</title>
  <rect width="32" height="32" fill="#0c0b09"/>
  <rect x="2.2" y="5.2" width="27.6" height="3.2" fill="#c23a2b"/>
  <rect x="4.4" y="8.7" width="23.2" height="2.4" fill="#a3221c"/>
  <rect x="6.6" y="8.7" width="3.4" height="17.4" fill="#c23a2b"/>
  <rect x="22" y="8.7" width="3.4" height="17.4" fill="#c23a2b"/>
  <rect x="6.6" y="17.4" width="18.8" height="2.2" fill="#c9a227"/>
  <rect x="10.2" y="11.4" width="2.3" height="5.4" fill="#e6c96a"/>
  <rect x="19.5" y="11.4" width="2.3" height="5.4" fill="#e6c96a"/>
</svg>
"""
    fav_path = ROOT / "favicon.svg"
    fav_path.write_text(fav, encoding="utf-8")
    print(f"wrote {fav_path}")


if __name__ == "__main__":
    main()
