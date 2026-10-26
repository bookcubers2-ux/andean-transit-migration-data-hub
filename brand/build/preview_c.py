import sys, os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import mark_c as m
S = sys.argv[1]
a = m.svg(); b = m.svg(cell=m.HIELO); c = m.svg(center="dot")
html = f'''<html><body style="margin:0;display:flex">
<div style="background:#F3F0E8;width:500px;height:500px;display:flex;align-items:center;justify-content:center"><div style="width:300px">{a}</div></div>
<div style="background:#0B1626;width:500px;height:500px;display:flex;align-items:center;justify-content:center"><div style="width:300px">{b}</div></div>
<div style="background:#F3F0E8;width:400px;height:500px;display:flex;align-items:center;justify-content:center"><div style="width:300px">{c}</div></div>
<div style="background:#F3F0E8;width:200px;height:500px;display:flex;flex-direction:column;gap:20px;align-items:center;justify-content:center"><div style="width:64px">{a}</div><div style="width:32px">{a}</div><div style="width:16px">{a}</div></div>
</body></html>'''
open(S + "/mk.html", "w", encoding="utf-8").write(html)
