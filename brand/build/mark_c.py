import sys, os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from mark import NOCHE, LAGO, OCRE, HIELO, NIEBLA

S, G, RAD = 52, 10, 11          # lado de la celda, separacion, radio de esquina
P = S + G
SIZE = 5 * S + 4 * G            # 300
# rombo escalonado de 13 celdas (col, fila). El centro es el puente.
CELLS = [(2,0),
         (1,1),(2,1),(3,1),
         (0,2),(1,2),(3,2),(4,2),
         (1,3),(2,3),(3,3),
         (2,4)]
HOLLOW = (3,3)                  # celda protegida (n<10)

def svg(cell=NOCHE, accent=OCRE, hollow_stroke=None, center="ring", body_only=False, pad=0, hollow=HOLLOW):
    hs = hollow_stroke or cell
    g = []
    for c, r in CELLS:
        x, y = c * P, r * P
        if (c, r) == hollow:
            g.append(f'<rect x="{x+3}" y="{y+3}" width="{S-6}" height="{S-6}" rx="{RAD-2}" fill="none" stroke="{hs}" stroke-width="6"/>')
        else:
            g.append(f'<rect x="{x}" y="{y}" width="{S}" height="{S}" rx="{RAD}" fill="{cell}"/>')
    cx = cy = 2 * P + S / 2
    if center == "ring":
        g.append(f'<circle cx="{cx}" cy="{cy}" r="21" fill="none" stroke="{accent}" stroke-width="9"/>')
    else:
        g.append(f'<circle cx="{cx}" cy="{cy}" r="21" fill="{accent}"/>')
    body = "\n  ".join(g)
    if body_only:
        return body
    return (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="{-pad} {-pad} {SIZE+2*pad} {SIZE+2*pad}" role="img" '
            f'aria-label="ATMDH / OAMT">\n  {body}\n</svg>')
