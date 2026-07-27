#!/usr/bin/env python3
"""
Add Polish glyphs to Caprasimo (upstream only covers basic Latin).

Composes ą ć ę ł ń ś ź ż (+ capitals) from the font's own parts:
- acute letters copy the font's e+acutecomb composite pattern,
- ż/Ż reuse the dieresis vertical placement with the dotaccent mark,
- ą/ę/Ą/Ę attach the existing ogonek mark at the baseline,
- ł/Ł get a hand-drawn diagonal bar matching the font's chunky weight.

Output: assets/fonts/CaprasimoPL.ttf, renamed per OFL (modified fonts must
not ship under the Reserved Font Name).
"""
from fontTools.ttLib import TTFont
from fontTools.ttLib.tables._g_l_y_f import Glyph, GlyphComponent
from fontTools.pens.ttGlyphPen import TTGlyphPen

SRC = "node_modules/@expo-google-fonts/caprasimo/400Regular/Caprasimo_400Regular.ttf"
OUT = "assets/fonts/CaprasimoPL.ttf"

font = TTFont(SRC)
glyf = font["glyf"]
hmtx = font["hmtx"]
cmap_tables = [t for t in font["cmap"].tables if t.isUnicode()]
order = font.getGlyphOrder()


def bbox(name):
    g = glyf[name]
    g.recalcBounds(glyf)
    return g.xMin, g.yMin, g.xMax, g.yMax


def center_x(name):
    x0, _, x1, _ = bbox(name)
    return (x0 + x1) / 2


def component(name, x, y, scale=None):
    c = GlyphComponent()
    c.glyphName = name
    c.x, c.y = int(x), int(y)
    c.flags = 0x0204  # ARGS_ARE_XY_VALUES | ROUND_XY_TO_GRID
    if scale is not None:
        c.transform = [[scale, 0], [0, scale]]
    return c


def add_glyph(newname, glyph, advance_from, codepoint):
    glyf.glyphs[newname] = glyph
    order.append(newname)
    hmtx.metrics[newname] = hmtx.metrics[advance_from]
    for t in cmap_tables:
        t.cmap[codepoint] = newname


def composite(base, mark, mark_x, mark_y):
    g = Glyph()
    g.numberOfContours = -1
    g.components = [component(base, 0, 0), component(mark, mark_x, mark_y)]
    return g


# --- reference offsets from the font's own composites ---
def comb_offset(comp_name, want_mark):
    g = glyf[comp_name]
    for c in g.components:
        if want_mark in c.glyphName:
            return c.glyphName, c.x, c.y
    raise KeyError(f"{want_mark} not in {comp_name}")


acute_mark, e_ac_x, e_ac_y = comb_offset("eacute", "acute")          # lowercase acute
ACUTE_MARK, E_AC_X, E_AC_Y = comb_offset("Eacute", "acute")          # capital acute
dier_mark, e_di_x, e_di_y = comb_offset("edieresis", "dieresis")     # lowercase top-mark height
DIER_MARK, E_DI_X, E_DI_Y = comb_offset("Edieresis", "dieresis")     # capital top-mark height

e_cx = center_x("e")
E_cx = center_x("E")

# dot mark: prefer combining form if present
dot_mark = "dotaccentcomb" if "dotaccentcomb" in glyf.glyphs else "dotaccent"
dot_cx = center_x(dot_mark)
dier_cx = center_x(dier_mark)
DOT_FIX = dier_cx - dot_cx  # keep the dot centred where the dieresis would sit

new = []

# --- acute letters: ć ń ś ź / Ć Ń Ś Ź ---
for base, cp in [("c", 0x107), ("n", 0x144), ("s", 0x15B), ("z", 0x17A)]:
    dx = center_x(base) - e_cx
    new.append((base + "acute.pl", composite(base, acute_mark, e_ac_x + dx, e_ac_y), base, cp))
for base, cp in [("C", 0x106), ("N", 0x143), ("S", 0x15A), ("Z", 0x179)]:
    dx = center_x(base) - E_cx
    new.append((base + "acute.pl", composite(base, ACUTE_MARK, E_AC_X + dx, E_AC_Y), base, cp))

# --- dot letters: ż / Ż ---
dx = center_x("z") - e_cx
new.append(("zdot.pl", composite("z", dot_mark, e_di_x + dx + DOT_FIX, e_di_y), "z", 0x17C))
dx = center_x("Z") - E_cx
new.append(("Zdot.pl", composite("Z", dot_mark, E_DI_X + dx + DOT_FIX, E_DI_Y), "Z", 0x17B))

# --- ogonek letters: ą ę / Ą Ę (hook hangs from the base's lower right) ---
og_x0, og_y0, og_x1, og_y1 = bbox("ogonek")
og_w = og_x1 - og_x0
for base, cp in [("a", 0x105), ("e", 0x119)]:
    bx0, _, bx1, _ = bbox(base)
    mark_x = bx1 - og_x1 - int(0.15 * og_w)  # tuck under the right edge
    new.append((base + "ogonek.pl", composite(base, "ogonek", mark_x, 0), base, cp))
for base, cp in [("A", 0x104), ("E", 0x118)]:
    bx0, _, bx1, _ = bbox(base)
    mark_x = bx1 - og_x1 - int(0.05 * og_w)
    new.append((base + "ogonek.pl", composite(base, "ogonek", mark_x, 0), base, cp))

# --- stroke bar for ł / Ł: chunky diagonal parallelogram, drawn to match weight ---
upm = font["head"].unitsPerEm  # typically 1000
bar_th = int(upm * 0.075)  # bar thickness ~ matches stem weight visually


def make_bar(name, cx, cy, half_w, rise):
    """Diagonal bar centred at (cx, cy): from lower-left to upper-right."""
    pen = TTGlyphPen(glyf.glyphs)
    x0, y0 = cx - half_w, cy - rise
    x1, y1 = cx + half_w, cy + rise
    # Clockwise, matching the letters' outline winding — otherwise the
    # non-zero fill rule punches a white hole where bar and stem overlap.
    pen.moveTo((x0, y0))
    pen.lineTo((x0, y0 + bar_th))
    pen.lineTo((x1, y1 + bar_th))
    pen.lineTo((x1, y1))
    pen.closePath()
    g = pen.glyph()
    glyf.glyphs[name] = g
    order.append(name)
    hmtx.metrics[name] = (0, 0)
    return name


def stroke_letter(newname, base, cp, height_frac):
    bx0, by0, bx1, by1 = bbox(base)
    cx = (bx0 + bx1) / 2
    cy = by0 + (by1 - by0) * height_frac
    half_w = (bx1 - bx0) * 0.52 + upm * 0.02
    rise = upm * 0.09
    bar = make_bar(newname + ".bar", cx, cy, half_w, rise)
    g = Glyph()
    g.numberOfContours = -1
    g.components = [component(base, 0, 0), component(bar, 0, 0)]
    new.append((newname, g, base, cp))


stroke_letter("lslash.pl", "l", 0x142, 0.48)
stroke_letter("Lslash.pl", "L", 0x141, 0.42)

# --- periodcentered (·), used in headings like "6 parks · 14.2 km" ---
if 0xB7 not in cmap_tables[0].cmap:
    px0, py0, px1, py1 = bbox("period")
    x0, _, x1, _ = bbox("x")
    x_height = bbox("x")[3]
    lift = int((x_height - (py1 - py0)) / 2)
    g = Glyph()
    g.numberOfContours = -1
    g.components = [component("period", 0, lift)]
    new.append(("periodcentered.pl", g, "period", 0xB7))

# --- register everything ---
for name, glyph, adv_from, cp in new:
    add_glyph(name, glyph, adv_from, cp)

font.setGlyphOrder(order)
font["maxp"].numGlyphs = len(order)

# --- OFL: rename (Caprasimo is a Reserved Font Name) ---
namemap = {1: "Caprasimo PL", 3: "CaprasimoPL-Parko", 4: "Caprasimo PL Regular", 6: "CaprasimoPL-Regular", 16: "Caprasimo PL"}
for rec in font["name"].names:
    if rec.nameID in namemap:
        rec.string = namemap[rec.nameID].encode("utf-16-be") if b"\x00" in rec.toBytes() else namemap[rec.nameID].encode("latin-1")

import os

os.makedirs("assets/fonts", exist_ok=True)
font.save(OUT)

# verify
check = TTFont(OUT).getBestCmap()
polish = [0x105, 0x107, 0x119, 0x142, 0x144, 0x15B, 0x17A, 0x17C, 0x104, 0x106, 0x118, 0x141, 0x143, 0x15A, 0x179, 0x17B]
missing = [hex(c) for c in polish if c not in check]
print("saved", OUT, "| glyphs:", len(check), "| missing polish:", missing or "NONE")
