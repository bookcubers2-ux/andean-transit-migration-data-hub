import sys, os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import build as B
S = sys.argv[1]
def with_dot(v, style, col, op=1.0):
    inner = B.mark_inner(v)
    c = B.S / 2
    if style == "dot":
        d = f'<circle cx="{c}" cy="{c}" r="10" fill="{col}" opacity="{op}"/>'
    elif style == "ring":
        d = f'<circle cx="{c}" cy="{c}" r="10" fill="none" stroke="{col}" stroke-width="5" opacity="{op}"/>'
    else:
        d = f'<circle cx="{c}" cy="{c}" r="12" fill="none" stroke="{col}" stroke-width="4" stroke-dasharray="6 5" opacity="{op}"/><circle cx="{c}" cy="{c}" r="4.5" fill="{col}" opacity="{op}"/>'
    return f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="-6 -6 312 312">{inner}{d}</svg>'
L = B.VARIANTS["color"]; R = B.VARIANTS["reversed"]
cells = []
for st in ("dot", "ring", "dash"):
    cells.append(f'<div style="background:#F3F0E8;width:300px;height:330px;display:flex;align-items:center;justify-content:center"><div style="width:260px">{with_dot(L, st, "#8E9BAE")}</div></div>')
for st in ("dot", "ring", "dash"):
    cells.append(f'<div style="background:#0B1626;width:300px;height:330px;display:flex;align-items:center;justify-content:center"><div style="width:260px">{with_dot(R, st, B.HIELO)}</div></div>')
open(S + "/mk.html", "w", encoding="utf-8").write('<html><body style="margin:0;display:grid;grid-template-columns:repeat(3,300px)">' + "".join(cells) + '</body></html>')
