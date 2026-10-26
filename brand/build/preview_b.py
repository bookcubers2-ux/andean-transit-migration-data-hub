import sys, os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import mark_b as m
S = sys.argv[1]
a = m.svg(); b = m.svg(mass=m.HIELO, dot=m.NOCHE)
html = f'''<html><body style="margin:0;display:flex">
<div style="background:#F3F0E8;width:700px;height:500px;display:flex;align-items:center;justify-content:center"><div style="width:600px">{a}</div></div>
<div style="background:#0B1626;width:700px;height:500px;display:flex;align-items:center;justify-content:center"><div style="width:600px">{b}</div></div>
</body></html>'''
open(S + "/mk.html", "w", encoding="utf-8").write(html)
