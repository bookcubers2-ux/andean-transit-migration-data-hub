import sys, os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import mark as m
S = sys.argv[1]
a = m.mark_svg()
b = m.mark_svg(line=m.HIELO, dot=m.HIELO)
html = f'''<html><body style="margin:0;display:flex">
<div style="background:#F3F0E8;width:700px;height:500px;display:flex;align-items:center;justify-content:center"><div style="width:600px">{a}</div></div>
<div style="background:#0B1626;width:700px;height:500px;display:flex;align-items:center;justify-content:center"><div style="width:600px">{b}</div></div>
</body></html>'''
open(S + "/mk.html", "w", encoding="utf-8").write(html)
