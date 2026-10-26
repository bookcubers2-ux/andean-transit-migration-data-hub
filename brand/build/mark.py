"""Geometria del simbolo ATMDH / OAMT.

El simbolo es el perfil de elevacion del corredor, de oeste a este, con un
nodo por cada uno de los 12 nodos del Hub y la altura de cada uno a escala.
Elevaciones aproximadas en metros sobre el nivel del mar.
"""

NODES = [  # (id, nombre, elevacion_m)
    ("tacna", "Tacna", 562),
    ("juliaca", "Juliaca", 3825),
    ("puno", "Puno", 3830),
    ("yunguyo", "Yunguyo", 3847),
    ("copacabana", "Copacabana", 3841),
    ("desaguadero", "Desaguadero", 3808),   # nodo binacional (dos municipios)
    ("pisiga", "Pisiga", 3680),             # nodo protegido (celda suprimida)
    ("elalto", "El Alto", 4100),
    ("oruro", "Oruro", 3706),
    ("villazon", "Villazon", 3443),
    ("yacuiba", "Yacuiba", 580),
    ("santacruz", "Santa Cruz", 416),
]

# Paleta
NOCHE = "#0B1626"
LAGO = "#0F6B78"
OCRE = "#E3A02B"
HIELO = "#F3F0E8"
NIEBLA = "#8A94A3"

W, H = 500, 300
X0, DX = 30, 40
BASE, TOP = 268, 40
E_MIN, E_MAX = 416, 4100


def pts():
    out = []
    for i, (nid, name, e) in enumerate(NODES):
        x = X0 + i * DX
        y = BASE - (e - E_MIN) / (E_MAX - E_MIN) * (BASE - TOP)
        out.append((nid, round(x, 1), round(y, 1)))
    return out


def mark_svg(line=NOCHE, dot=NOCHE, accent=OCRE, hollow=None, sw=9, r=12.5,
             body_only=False, viewbox=None):
    """Devuelve el <svg> completo (o solo el contenido si body_only)."""
    hollow = hollow or line
    P = pts()
    poly = " ".join(f"{x},{y}" for _, x, y in P)
    g = [f'<polyline points="{poly}" fill="none" stroke="{line}" stroke-width="{sw}" '
         f'stroke-linejoin="round" stroke-linecap="round"/>']
    for nid, x, y in P:
        if nid == "desaguadero":
            g.append(f'<circle cx="{x-8}" cy="{y}" r="15" fill="none" stroke="{accent}" stroke-width="6"/>')
            g.append(f'<circle cx="{x+8}" cy="{y}" r="15" fill="none" stroke="{accent}" stroke-width="6"/>')
        elif nid == "pisiga":
            g.append(f'<circle cx="{x}" cy="{y}" r="{r}" fill="none" stroke="{hollow}" stroke-width="5"/>')
        else:
            g.append(f'<circle cx="{x}" cy="{y}" r="{r}" fill="{dot}"/>')
    body = "\n  ".join(g)
    if body_only:
        return body
    vb = viewbox or f"0 0 {W} {H}"
    return (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="{vb}" role="img" '
            f'aria-label="ATMDH / OAMT">\n  {body}\n</svg>')


if __name__ == "__main__":
    print(mark_svg())
