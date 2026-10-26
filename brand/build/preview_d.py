import sys, os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import mark_c as m
S = sys.argv[1]
def two(cl, cr, cm, accent, hs):
    g=[]
    for c, r in m.CELLS:
        x, y = c*m.P, r*m.P
        col = cl if c < 2 else (cr if c > 2 else cm)
        if (c, r) == m.HOLLOW:
            g.append(f'<rect x="{x+3}" y="{y+3}" width="{m.S-6}" height="{m.S-6}" rx="{m.RAD-2}" fill="none" stroke="{col}" stroke-width="6"/>')
        else:
            g.append(f'<rect x="{x}" y="{y}" width="{m.S}" height="{m.S}" rx="{m.RAD}" fill="{col}"/>')
    cx = 2*m.P + m.S/2
    g.append(f'<circle cx="{cx}" cy="{cx}" r="21" fill="none" stroke="{accent}" stroke-width="9"/>')
    return f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {m.SIZE} {m.SIZE}">' + "".join(g) + '</svg>'
a = two(m.LAGO, m.NOCHE, m.NOCHE, m.OCRE, m.NOCHE)
b = two(m.HIELO, m.HIELO, m.HIELO, m.OCRE, m.HIELO)
c = two("#2FA3B5", m.HIELO, m.HIELO, m.OCRE, m.HIELO)
html = f'''<html><body style="margin:0;display:flex">
<div style="background:#F3F0E8;width:500px;height:500px;display:flex;align-items:center;justify-content:center"><div style="width:300px">{a}</div></div>
<div style="background:#0B1626;width:500px;height:500px;display:flex;align-items:center;justify-content:center"><div style="width:300px">{c}</div></div>
</body></html>'''
open(S + "/mk.html", "w", encoding="utf-8").write(html)
