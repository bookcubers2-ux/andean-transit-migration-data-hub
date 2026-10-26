import sys, os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from mark import NODES, NOCHE, LAGO, OCRE, HIELO, NIEBLA

W, H = 500, 320
X0, DX = 30, 40
Y_TOP, Y_LOW = 70, 232      # y de la cresta: El Alto (4100) y el nodo mas bajo (416)
BASE = 300
E_MIN, E_MAX = 416, 4100
DEPTH = 30                   # los puntos viven por debajo de la cresta

def ridge():
    out = []
    for i, (nid, name, e) in enumerate(NODES):
        x = X0 + i * DX
        y = Y_LOW - (e - E_MIN) / (E_MAX - E_MIN) * (Y_LOW - Y_TOP)
        out.append((nid, round(x, 1), round(y, 1)))
    return out

def svg(mass=NOCHE, dot=HIELO, accent=OCRE, hollow=None, r=11, body_only=False, pad=0):
    hollow = hollow or dot
    R = ridge()
    pts = [(R[0][1], BASE)] + [(x, y) for _, x, y in R] + [(R[-1][1], BASE)]
    poly = " ".join(f"{x},{y}" for x, y in pts)
    g = [f'<polygon points="{poly}" fill="{mass}" stroke="{mass}" stroke-width="16" stroke-linejoin="round"/>']
    for nid, x, y in R:
        cy = y + DEPTH
        if nid == "desaguadero":
            g.append(f'<circle cx="{x-8}" cy="{cy}" r="14" fill="none" stroke="{accent}" stroke-width="6"/>')
            g.append(f'<circle cx="{x+8}" cy="{cy}" r="14" fill="none" stroke="{accent}" stroke-width="6"/>')
        elif nid == "pisiga":
            g.append(f'<circle cx="{x}" cy="{cy}" r="{r}" fill="none" stroke="{hollow}" stroke-width="5"/>')
        else:
            g.append(f'<circle cx="{x}" cy="{cy}" r="{r}" fill="{dot}"/>')
    body = "\n  ".join(g)
    if body_only:
        return body
    return (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="-10 -10 {W+20} {H+20}" role="img" '
            f'aria-label="ATMDH / OAMT">\n  {body}\n</svg>')
