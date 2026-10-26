"""Genera el kit de identidad visual ATMDH / OAMT (SVG + PNG).

Uso: python -I build.py
Salida: ../dist/svg, ../dist/png
"""
import os, sys, subprocess, shutil, math
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)

from fontTools.ttLib import TTFont
from fontTools.varLib import instancer
from fontTools.pens.svgPathPen import SVGPathPen
from fontTools.pens.transformPen import TransformPen

import mark as geo   # perfil del corredor (motivo secundario)

DIST = os.path.normpath(os.path.join(HERE, "..", "dist"))
SVG_DIR = os.path.join(DIST, "svg")
PNG_DIR = os.path.join(DIST, "png")
for d in (SVG_DIR, PNG_DIR):
    os.makedirs(d, exist_ok=True)

EDGE = r"C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe"
FONT = r"C:\Windows\Fonts\bahnschrift.ttf"

# ---------------------------------------------------------------- paleta
NOCHE = "#0B1626"      # Noche andina
LAGO = "#0F6B78"       # Lago Titicaca
LAGO_CLARO = "#2FA3B5"
OCRE = "#E3A02B"       # Ocre del altiplano
HIELO = "#F3F0E8"      # Hielo
NIEBLA = "#5A6577"     # Niebla (texto terciario sobre claro)
NIEBLA_CLARA = "#A9B4C4"

# ---------------------------------------------------------------- tipografia
class Face:
    def __init__(self, wght, wdth=100):
        base = TTFont(FONT)
        self.f = instancer.instantiateVariableFont(base, {"wght": wght, "wdth": wdth}, inplace=False)
        self.gs = self.f.getGlyphSet()
        self.cmap = self.f.getBestCmap()
        self.upm = self.f["head"].unitsPerEm
        self.hmtx = self.f["hmtx"]

    def width(self, text, size, track=0.0):
        s = size / self.upm
        w = 0.0
        for ch in text:
            g = self.cmap.get(ord(ch))
            w += self.hmtx[g][0] * s + track * size
        return w - track * size

    def path(self, text, x, y, size, track=0.0):
        s = size / self.upm
        pen = SVGPathPen(self.gs, ntos=lambda v: ("%.2f" % v).rstrip("0").rstrip("."))
        cx = x
        for ch in text:
            g = self.cmap.get(ord(ch))
            self.gs[g].draw(TransformPen(pen, (s, 0, 0, -s, cx, y)))
            cx += self.hmtx[g][0] * s + track * size
        return pen.getCommands()

SEMI = Face(620)
REG = Face(400)
LIGHT = Face(300)

def txt(face, text, x, y, size, fill, track=0.0, anchor="start"):
    w = face.width(text, size, track)
    if anchor == "middle":
        x -= w / 2
    elif anchor == "end":
        x -= w
    return f'<path d="{face.path(text, x, y, size, track)}" fill="{fill}"/>', w

# ---------------------------------------------------------------- simbolo
S, G, RAD = 52, 10, 11
P = S + G
SIZE = 5 * S + 4 * G                      # 300
CELLS = [(2, 0), (1, 1), (2, 1), (3, 1), (0, 2), (1, 2), (3, 2), (4, 2),
         (1, 3), (2, 3), (3, 3), (2, 4)]
HOLLOW = (3, 3)

VARIANTS = {
    # nombre: (lado Peru, eje y lado Bolivia, anillo, texto1, texto2, texto3)
    "color":      dict(peru=LAGO, bol=NOCHE, ring=OCRE, t1=NOCHE, t2=LAGO, t3=NIEBLA, bg=None),
    "reversed":   dict(peru=LAGO_CLARO, bol=HIELO, ring=OCRE, t1=HIELO, t2="#7FCBD8", t3=NIEBLA_CLARA, bg=NOCHE),
    "mono-dark":  dict(peru=NOCHE, bol=NOCHE, ring=NOCHE, t1=NOCHE, t2=NOCHE, t3=NOCHE, bg=None),
    "mono-light": dict(peru=HIELO, bol=HIELO, ring=HIELO, t1=HIELO, t2=HIELO, t3=HIELO, bg=NOCHE),
}

def mark_inner(v):
    g = []
    for c, r in CELLS:
        x, y = c * P, r * P
        col = v["peru"] if c < 2 else v["bol"]
        if (c, r) == HOLLOW:
            g.append(f'<rect x="{x+3}" y="{y+3}" width="{S-6}" height="{S-6}" rx="{RAD-2}" fill="none" stroke="{col}" stroke-width="6"/>')
        else:
            g.append(f'<rect x="{x}" y="{y}" width="{S}" height="{S}" rx="{RAD}" fill="{col}"/>')
    cx = 2 * P + S / 2
    g.append(f'<circle cx="{cx}" cy="{cx}" r="21" fill="none" stroke="{v["ring"]}" stroke-width="9"/>')
    return "".join(g)

def wrap(w, h, body, bg=None, title="ATMDH / OAMT"):
    rect = f'<rect width="{w}" height="{h}" fill="{bg}"/>' if bg else ""
    return (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {w:.0f} {h:.0f}" width="{w:.0f}" height="{h:.0f}" '
            f'role="img" aria-label="{title}"><title>{title}</title>{rect}{body}</svg>')

def svg_symbol(v, pad=0, with_bg=False):
    w = SIZE + 2 * pad
    body = f'<g transform="translate({pad},{pad})">{mark_inner(v)}</g>'
    return wrap(w, w, body, bg=v["bg"] if with_bg else None)

def lockup_h(v, with_bg=False):
    """Simbolo a la izquierda, texto a la derecha."""
    t1, w1 = txt(SEMI, "ATMDH", 0, 0, 118, v["t1"], track=0.07)
    slash, ws = txt(LIGHT, "/ OAMT", 0, 0, 118, v["t3"] if v["t3"] != v["t1"] else v["t1"], track=0.05)
    sub1, _ = txt(REG, "Andean Transit Migration Data Hub", 0, 0, 44, v["t2"], track=0.005)
    sub2, _ = txt(LIGHT, "Hub de Datos de Migración de Tránsito Andina", 0, 0, 29, v["t3"], track=0.005)
    x0 = SIZE + 62
    gap = 34
    a, wa = txt(SEMI, "ATMDH", x0, 146, 118, v["t1"], track=0.07)
    b, wb = txt(LIGHT, "/ OAMT", x0 + wa + gap, 146, 118, v["t3"], track=0.05)
    c, wc = txt(REG, "Andean Transit Migration Data Hub", x0, 210, 44, v["t2"], track=0.005)
    d, wd = txt(LIGHT, "Hub de Datos de Migración de Tránsito Andina", x0, 256, 29, v["t3"], track=0.005)
    total = x0 + max(wa + gap + wb, wc, wd)
    body = f'<g>{mark_inner(v)}</g>{a}{b}{c}{d}'
    pad = 28
    body = f'<g transform="translate({pad},{pad})">{body}</g>'
    return wrap(total + 2 * pad, SIZE + 2 * pad, body, bg=v["bg"] if with_bg else None), total + 2 * pad, SIZE + 2 * pad

def lockup_v(v, with_bg=False):
    """Simbolo arriba, texto centrado debajo."""
    c1, w1 = txt(SEMI, "ATMDH", 0, 0, 104, v["t1"], track=0.07)
    c2, w2 = txt(LIGHT, "/ OAMT", 0, 0, 104, v["t3"], track=0.05)
    gap = 28
    line1 = w1 + gap + w2
    s3, w3 = txt(REG, "Andean Transit Migration Data Hub", 0, 0, 44, v["t2"], track=0.005)
    s4, w4 = txt(LIGHT, "Hub de Datos de Migración de Tránsito Andina", 0, 0, 29, v["t3"], track=0.005)
    W = max(line1, w3, w4, SIZE) + 40
    cx = W / 2
    mx = cx - SIZE / 2
    y1 = SIZE + 40 + 78
    a, _ = txt(SEMI, "ATMDH", cx - line1 / 2, y1, 104, v["t1"], track=0.07)
    b, _ = txt(LIGHT, "/ OAMT", cx - line1 / 2 + w1 + gap, y1, 104, v["t3"], track=0.05)
    c, _ = txt(REG, "Andean Transit Migration Data Hub", cx, y1 + 62, 44, v["t2"], track=0.005, anchor="middle")
    d, _ = txt(LIGHT, "Hub de Datos de Migración de Tránsito Andina", cx, y1 + 108, 29, v["t3"], track=0.005, anchor="middle")
    H = y1 + 108 + 28
    body = f'<g transform="translate({mx},0)">{mark_inner(v)}</g>{a}{b}{c}{d}'
    pad = 28
    body = f'<g transform="translate({pad},{pad})">{body}</g>'
    return wrap(W + 2 * pad, H + 2 * pad, body, bg=v["bg"] if with_bg else None), W + 2 * pad, H + 2 * pad

def app_icon(size=1024, radius=232):
    v = VARIANTS["reversed"]
    m = size * 0.58
    k = m / SIZE
    off = (size - m) / 2
    body = (f'<rect width="{size}" height="{size}" rx="{radius}" fill="{NOCHE}"/>'
            f'<g transform="translate({off},{off}) scale({k})">{mark_inner(v)}</g>')
    return wrap(size, size, body, title="ATMDH / OAMT app icon")

def social_card():
    v = VARIANTS["reversed"]
    W, H = 1200, 630
    # motivo secundario: perfil de elevacion del corredor, tenue, al pie
    pts = geo.pts()
    xs = [x for _, x, _ in pts]; ys = [y for _, _, y in pts]
    sx = (W - 160) / (max(xs) - min(xs))
    prof = []
    for nid, x, y in pts:
        px = 80 + (x - min(xs)) * sx
        py = 600 - (geo.BASE - y) / (geo.BASE - geo.TOP) * 110
        prof.append((px, py, nid))
    line = " ".join(f"{x:.1f},{y:.1f}" for x, y, _ in prof)
    dots = "".join(f'<circle cx="{x:.1f}" cy="{y:.1f}" r="5" fill="{LAGO_CLARO}" opacity=".7"/>' for x, y, _ in prof)
    body = f'<rect width="{W}" height="{H}" fill="{NOCHE}"/>'
    body += f'<polyline points="{line}" fill="none" stroke="{LAGO_CLARO}" stroke-width="3" stroke-linejoin="round" opacity=".45"/>{dots}'
    k = 270 / SIZE
    body += f'<g transform="translate(90,128) scale({k})">{mark_inner(v)}</g>'
    x0 = 430
    a, wa = txt(SEMI, "ATMDH", x0, 232, 96, HIELO, track=0.07)
    b, wb = txt(LIGHT, "/ OAMT", x0 + wa + 26, 232, 96, NIEBLA_CLARA, track=0.05)
    c, _ = txt(REG, "Andean Transit Migration Data Hub", x0, 292, 38, "#7FCBD8", track=0.005)
    d, _ = txt(LIGHT, "Hub de Datos de Migración de Tránsito Andina", x0, 336, 26, NIEBLA_CLARA, track=0.005)
    e, _ = txt(SEMI, "Count the crossing, never the person.", x0, 420, 34, OCRE, track=0.01)
    body += a + b + c + d + e
    return wrap(W, H, body, title="ATMDH / OAMT")

# ---------------------------------------------------------------- render
def write(name, svg):
    p = os.path.join(SVG_DIR, name)
    with open(p, "w", encoding="utf-8") as f:
        f.write(svg)
    return p

def to_png(svg_path, out_png, w, h, transparent=True, bg="#ffffff"):
    html = os.path.join(DIST, "_r.html")
    with open(html, "w", encoding="utf-8") as f:
        f.write('<!doctype html><meta charset="utf-8"><style>html,body{margin:0;padding:0;background:%s}'
                'img{display:block;width:%dpx;height:%dpx}</style><img src="file:///%s">'
                % ("transparent" if transparent else bg, w, h, svg_path.replace("\\", "/")))
    args = [EDGE, "--headless=new", "--disable-gpu", "--hide-scrollbars", "--force-device-scale-factor=1",
            f"--window-size={w},{h}", f"--screenshot={out_png}"]
    if transparent:
        args.append("--default-background-color=00000000")
    args.append("file:///" + html.replace("\\", "/"))
    subprocess.run(args, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, check=True, timeout=120)

def main():
    jobs = []   # (svg_name, png_name, width_px, transparent)
    for key, v in VARIANTS.items():
        tag = {"color": "color", "reversed": "reversed", "mono-dark": "mono-dark", "mono-light": "mono-light"}[key]
        tr = v["bg"] is None
        svg = svg_symbol(v, pad=20)
        write(f"atmdh-symbol-{tag}.svg", svg)
        jobs.append((f"atmdh-symbol-{tag}.svg", f"ATMDH_symbol_{tag}.png", 1200, True))
        h, w, hh = lockup_h(v)
        write(f"atmdh-horizontal-{tag}.svg", h)
        jobs.append((f"atmdh-horizontal-{tag}.svg", f"ATMDH_logo_horizontal_{tag}.png", 2400, True))
        s, w2, h2 = lockup_v(v)
        write(f"atmdh-stacked-{tag}.svg", s)
        jobs.append((f"atmdh-stacked-{tag}.svg", f"ATMDH_logo_stacked_{tag}.png", 1600, True))
    # versiones con fondo propio (para quien necesita un PNG listo sobre su color)
    h, w, hh = lockup_h(VARIANTS["reversed"], with_bg=True)
    write("atmdh-horizontal-reversed-bg.svg", h)
    s, w2, h2 = lockup_v(VARIANTS["color"], with_bg=True)
    write("atmdh-app-icon.svg", app_icon())
    write("atmdh-social-card.svg", social_card())
    return jobs

def dims(svg_name):
    import re
    s = open(os.path.join(SVG_DIR, svg_name), encoding="utf-8").read()
    m = re.search(r'viewBox="0 0 (\d+) (\d+)"', s)
    return int(m.group(1)), int(m.group(2))

if __name__ == "__main__":
    jobs = main()
    for svg_name, png_name, width, tr in jobs:
        w0, h0 = dims(svg_name)
        h = round(width * h0 / w0)
        to_png(os.path.join(SVG_DIR, svg_name), os.path.join(PNG_DIR, png_name), width, h, transparent=tr)
        print("ok", png_name, width, h)
    to_png(os.path.join(SVG_DIR, "atmdh-app-icon.svg"), os.path.join(PNG_DIR, "ATMDH_app_icon_1024.png"), 1024, 1024)
    to_png(os.path.join(SVG_DIR, "atmdh-app-icon.svg"), os.path.join(PNG_DIR, "ATMDH_app_icon_180.png"), 180, 180)
    to_png(os.path.join(SVG_DIR, "atmdh-social-card.svg"), os.path.join(PNG_DIR, "ATMDH_social_card_1200x630.png"), 1200, 630, transparent=False)
    print("listo")
