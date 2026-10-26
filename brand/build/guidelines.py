"""Genera la guia de identidad visual (HTML) a partir de la paleta y los SVG.
Uso: python -I guidelines.py <carpeta_de_salida> <prefijo_svg> <prefijo_img>
"""
import os, sys
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import build as B

out_dir, SV, IM, FN = sys.argv[1], sys.argv[2], sys.argv[3], sys.argv[4]   # ej: ../dist  svg/  img/

def lum(h):
    h = h.lstrip("#"); r, g, b = [int(h[i:i+2], 16) / 255 for i in (0, 2, 4)]
    f = lambda c: c / 12.92 if c <= 0.03928 else ((c + 0.055) / 1.055) ** 2.4
    return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b)

def cr(a, b):
    la, lb = sorted([lum(a), lum(b)], reverse=True)
    return (la + 0.05) / (lb + 0.05)

def rgb(h):
    h = h.lstrip("#"); return ", ".join(str(int(h[i:i+2], 16)) for i in (0, 2, 4))

pairs = [
    ("Noche on Hielo", B.NOCHE, B.HIELO, "Body text, wordmark, headings"),
    ("Lago on Hielo", B.LAGO, B.HIELO, "Subtitle, links, Peru-side cells"),
    ("Niebla on Hielo", B.NIEBLA, B.HIELO, "Secondary text"),
    ("Hielo on Noche", B.HIELO, B.NOCHE, "Reversed wordmark and text"),
    ("Ocre on Noche", B.OCRE, B.NOCHE, "Accent ring, highlights on dark"),
    ("Lago claro on Noche", B.LAGO_CLARO, B.NOCHE, "Peru-side cells on dark"),
    ("Ocre on Hielo", B.OCRE, B.HIELO, "Graphic only, never for text"),
]
rows = ""
for name, fg, bg, use in pairs:
    r = cr(fg, bg)
    verdict = "AAA" if r >= 7 else ("AA" if r >= 4.5 else ("large text only" if r >= 3 else "graphic only"))
    rows += (f'<tr><td><span class="sw" style="background:{bg}"><i style="color:{fg}">Aa</i></span> {name}</td>'
             f'<td class="num">{r:.1f} : 1</td><td>{verdict}</td><td>{use}</td></tr>')

swatches = [
    ("Noche andina", B.NOCHE, "Primary. Wordmark, Bolivia-side cells, dark backgrounds, header.", "about 55%"),
    ("Hielo", B.HIELO, "Ground. Pages, cards, reversed wordmark.", "about 30%"),
    ("Lago Titicaca", B.LAGO, "Secondary. Peru-side cells, subtitles, links.", "about 10%"),
    ("Ocre del altiplano", B.OCRE, "Accent. The ring and one highlight per layout.", "5% at most"),
]
sw_html = "".join(
    f'<div class="swatch"><div class="chip" style="background:{h};{"border:1px solid #cfcabd;" if h == B.HIELO else ""}"></div>'
    f'<b>{n}</b><span class="mono">{h}</span><span class="mono">RGB {rgb(h)}</span><p>{u}</p><em>{p}</em></div>'
    for n, h, u, p in swatches)

CSS = """
:root{--noche:#0B1626;--hielo:#F3F0E8;--lago:#0F6B78;--ocre:#E3A02B;--niebla:#5A6577}
*{box-sizing:border-box}
html{background:#e9e6dd}
body{margin:0;font:15px/1.55 Bahnschrift,'Segoe UI',system-ui,sans-serif;color:var(--noche)}
.page{width:210mm;min-height:297mm;margin:12px auto;background:var(--hielo);padding:14mm 16mm 14mm;position:relative;page-break-after:always;overflow:hidden}
.page.dark{background:var(--noche);color:var(--hielo)}
h1{font-size:34px;line-height:1.1;margin:0 0 6px;font-weight:600;letter-spacing:.01em}
h2{font-size:22px;margin:0 0 10px;font-weight:600;letter-spacing:.01em}
h2 small{display:block;font-size:11px;letter-spacing:.14em;text-transform:uppercase;color:var(--lago);font-weight:600;margin-bottom:4px}
h3{font-size:14px;margin:16px 0 4px;font-weight:600}
p{margin:0 0 10px}
.mono{font-family:Consolas,'Courier New',monospace;font-size:12px}
.muted{color:var(--niebla)}
.grid2{display:grid;grid-template-columns:1fr 1fr;gap:14px}
.grid3{display:grid;grid-template-columns:repeat(3,1fr);gap:12px}
.grid4{display:grid;grid-template-columns:repeat(4,1fr);gap:12px}
.card{border:1px solid #d7d2c4;border-radius:10px;padding:12px;background:#fbfaf6}
.card.d{background:var(--noche);border-color:var(--noche);color:var(--hielo)}
.card img{max-width:100%;display:block}
.card .cap{font-size:11px;color:var(--niebla);margin-top:8px}
.card.d .cap{color:#A9B4C4}
.center{display:flex;align-items:center;justify-content:center}
.swatch{border:1px solid #d7d2c4;border-radius:10px;padding:10px;background:#fbfaf6}
.swatch .chip{height:50px;border-radius:7px;margin-bottom:8px}
.neutral .swatch .chip{height:26px;margin-bottom:6px}.neutral .swatch p{margin:2px 0 0}
.swatch b{display:block;font-size:14px}
.swatch .mono{display:block;color:var(--niebla)}
.swatch p{font-size:12px;margin:6px 0 2px}
.swatch em{font-size:11px;color:var(--lago);font-style:normal;font-weight:600}
table{border-collapse:collapse;width:100%;font-size:12px}
th,td{border-bottom:1px solid #d7d2c4;padding:6px 8px;text-align:left;vertical-align:middle}
th{font-size:11px;letter-spacing:.06em;text-transform:uppercase;color:var(--niebla)}
td.num{font-variant-numeric:tabular-nums;white-space:nowrap}
.sw{display:inline-flex;width:30px;height:22px;border-radius:5px;align-items:center;justify-content:center;border:1px solid #cfcabd;vertical-align:middle;margin-right:6px}
.sw i{font-style:normal;font-weight:700;font-size:12px}
.rule{border-left:4px solid var(--ocre);padding:4px 0 4px 12px;margin:10px 0}
.rule b{display:block}
.dont{position:relative}
.dont:after{content:"";position:absolute;right:8px;top:8px;width:22px;height:22px;border-radius:50%;background:#B4372D}
.dont:before{content:"\\00d7";position:absolute;right:8px;top:8px;width:22px;height:22px;line-height:21px;text-align:center;color:#fff;font-weight:700;z-index:2;font-size:16px}
.ok:before{content:"\\2713";position:absolute;right:8px;top:8px;width:22px;height:22px;line-height:22px;text-align:center;color:#fff;font-weight:700;z-index:2;font-size:13px;background:var(--lago);border-radius:50%}
.ok{position:relative}
.foot{position:absolute;left:16mm;right:16mm;bottom:8mm;font-size:10px;color:var(--niebla);display:flex;justify-content:space-between}
.dark .foot{color:#A9B4C4}
a{color:var(--lago)}
.cover{display:flex;flex-direction:column;justify-content:space-between;height:calc(297mm - 30mm)}
.legend li{margin:6px 0}
.dot{display:inline-block;width:12px;height:12px;border-radius:3px;margin-right:8px;vertical-align:-1px}
.dot.ring{background:none;border:3px solid var(--ocre);border-radius:50%;width:14px;height:14px;vertical-align:-2px}
.dot.hollow{background:none;border:2px solid var(--noche)}
@page{size:A4;margin:0}
@media print{html{background:none}.page{margin:0;box-shadow:none}}
@media screen and (max-width:820px){.page{width:auto;min-height:0;margin:0;padding:22px 18px}.grid2,.grid3,.grid4{grid-template-columns:1fr}.cover{height:auto;gap:30px}.foot{position:static;margin-top:16px}}
"""

def img(name, w=None, cls=""):
    st = f' style="width:{w}"' if w else ""
    return f'<img src="{SV}{name}" alt="ATMDH / OAMT symbol or logo"{st} class="{cls}">'

def foot(n, dark=False):
    return (f'<div class="foot"><span>ATMDH / OAMT · Visual identity v1.0 · October 2026</span><span>{n}</span></div>')

html = f"""<!doctype html><html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>ATMDH / OAMT · Visual identity guidelines</title>
<link rel="icon" type="image/svg+xml" href="{SV}atmdh-app-icon.svg">
<style>{CSS}</style></head><body>

<!-- 1 PORTADA -->
<section class="page dark"><div class="cover">
  <div>{img("atmdh-stacked-reversed.svg", "430px")}</div>
  <div>
    <h1>Visual identity guidelines</h1>
    <p style="font-size:17px;color:#7FCBD8;margin:0 0 4px">Count the crossing, never the person.</p>
    <p class="muted" style="color:#A9B4C4">Contar el cruce, nunca a la persona.</p>
    <p style="margin-top:26px;font-size:12px;color:#A9B4C4">Version 1.0 · October 2026<br>Andean Transit Migration Data Hub (ATMDH / OAMT)<br>Departmental Youth Council of Santa Cruz, Bolivia · Asociación Juvenil Bookcubers</p>
  </div>
</div></section>

<!-- 2 LA IDEA -->
<section class="page">
  <h2><small>1 · The idea</small>One crossing, twelve cells, and a protected one</h2>
  <p>The Hub counts people who cross the central Andean corridor between Peru and Bolivia, and it is built so that nobody can be followed. The symbol says both things at once. It is a <b>stepped diamond</b>, the form that recurs in Andean textiles, and it echoes the <b>chakana</b>, the stepped cross whose name is usually translated as <i>bridge</i>.</p>
  <div class="grid2" style="align-items:center;margin-top:8px">
    <div class="card center" style="padding:26px">{img("atmdh-symbol-color.svg", "300px")}</div>
    <ul class="legend" style="list-style:none;padding:0;margin:0">
      <li><span class="dot" style="background:#0F6B78"></span><b>Lago, left of the axis.</b> The Peruvian side of the corridor.</li>
      <li><span class="dot" style="background:#0B1626"></span><b>Noche, the axis and the right side.</b> The Bolivian side, and the corridor that runs through both.</li>
      <li><span class="dot ring"></span><b>The ochre ring.</b> Desaguadero: one bridge, two municipalities, the only point where the corridor is literally a single place.</li>
      <li><span class="dot hollow"></span><b>The hollow cell.</b> A protected cell, one with fewer than ten people. It is drawn so the reader can see that it exists and cannot be shown. It is never drawn as zero and never left out.</li>
      <li><span class="dot" style="background:#0B1626;opacity:.55"></span><b>Twelve cells.</b> One for each node of the Hub, around a center that stays open.</li>
      <li><span class="dot" style="background:#8E9BAE;border-radius:50%;width:10px;height:10px;margin-left:1px;margin-right:9px"></span><b>The open dot, top left.</b> A place held for the next country. It is not a node and it is not counted: it marks that the diamond can grow.</li>
    </ul>
  </div>
  <div class="rule"><b>The name of the symbol is “El Cruce”, the crossing.</b>It is the unit the Hub counts. The person who crosses is never the unit.</div>
  <h3>How the name is written</h3>
  <p><b>ATMDH / OAMT</b> is the full signature: <b>ATMDH</b> in English (Andean Transit Migration Data Hub) and <b>OAMT</b> in Spanish. In running text use “the Hub”, “el Hub” or “ATMDH”. Spanish descriptor: <i>Hub de Datos de Migración de Tránsito Andina</i>.</p>
  <h3>Signature line</h3>
  <p><b>Count the crossing, never the person.</b> / <i>Contar el cruce, nunca a la persona.</i> It is optional. Use it on covers, social cards and presentation closings, not next to the logo in small spaces.</p>
  {foot("2")}
</section>

<!-- 3 VERSIONES -->
<section class="page">
  <h2><small>2 · Logo versions</small>Pick the lockup by the space you have</h2>
  <div class="grid2">
    <div class="card"><div class="center" style="padding:10px">{img("atmdh-horizontal-color.svg", "100%")}</div><div class="cap"><b>Horizontal, full color.</b> Default for light backgrounds. File: ATMDH_logo_horizontal_color</div></div>
    <div class="card d"><div class="center" style="padding:10px">{img("atmdh-horizontal-reversed.svg", "100%")}</div><div class="cap"><b>Horizontal, reversed.</b> For Noche and photographs with a dark panel. File: ATMDH_logo_horizontal_reversed</div></div>
    <div class="card"><div class="center" style="padding:10px">{img("atmdh-stacked-color.svg", "56%")}</div><div class="cap"><b>Stacked.</b> Covers, posters, square profile slots. File: ATMDH_logo_stacked_color / _reversed</div></div>
    <div class="card"><div class="center" style="padding:12px 10px">{img("atmdh-symbol-color.svg", "36%")}</div><div class="cap"><b>Symbol only.</b> Use when the name already appears nearby, or below 180 px wide. File: ATMDH_symbol_color / _reversed</div></div>
    <div class="card"><div class="center" style="gap:24px;padding:18px 10px"><div style="width:44%">{img("atmdh-horizontal-mono-dark.svg", "100%")}</div></div><div class="cap"><b>One color, dark.</b> Stamps, fax, black and white print. File: ATMDH_logo_*_mono-dark</div></div>
    <div class="card d"><div class="center" style="gap:24px;padding:18px 10px"><div style="width:44%">{img("atmdh-horizontal-mono-light.svg", "100%")}</div></div><div class="cap"><b>One color, light.</b> Over a single dark color or image. File: ATMDH_logo_*_mono-light</div></div>
  </div>
  <div class="grid3" style="margin-top:12px;align-items:stretch">
    <div class="card center" style="padding:14px">{img("atmdh-app-icon.svg", "110px")}</div>
    <div class="card" style="grid-column:span 2"><h3 style="margin-top:0">App icon and favicon</h3><p style="font-size:13px">The symbol, reversed, on a Noche rounded square with 21% of padding. Files: ATMDH_app_icon_1024 and ATMDH_app_icon_180, plus favicon.svg for the website.</p></div>
  </div>
  <h3>Which file for what</h3>
  <table style="font-size:11.5px"><tr><th>You need</th><th>Use</th></tr>
  <tr><td>Slide, document, letterhead on white or Hielo</td><td>ATMDH_logo_horizontal_color.png</td></tr>
  <tr><td>Social post, banner, dark slide</td><td>ATMDH_logo_horizontal_reversed.png or ATMDH_social_card_1200x630.png</td></tr>
  <tr><td>Profile picture, square slot</td><td>ATMDH_app_icon_1024.png</td></tr>
  <tr><td>Print that must be one color</td><td>ATMDH_logo_*_mono-dark.png</td></tr>
  <tr><td>Web, large print, anything that must stay sharp</td><td>The matching .svg in the same kit</td></tr></table>
  {foot("3")}
</section>

<!-- 4 ESPACIO Y TAMANO -->
<section class="page">
  <h2><small>3 · Clear space and minimum size</small>Give the symbol room to breathe</h2>
  <div class="grid2" style="align-items:center">
    <div class="card center" style="padding:30px"><div style="position:relative;width:270px;padding:56px;background:repeating-linear-gradient(45deg,#e7e2d3 0 6px,#f0ecdf 6px 12px);border:1.5px dashed #0F6B78">
      <div style="background:var(--hielo)">{img("atmdh-symbol-color.svg", "100%")}</div></div></div>
    <div><h3 style="margin-top:0">Clear space</h3><p>Keep <b>one cell</b> of the symbol free on every side, about 17% of its width. For the lockups, measure that cell from the symbol and apply it to the whole block. Nothing enters the shaded area: no text, no edge of the page, no other logo.</p>
    <h3>Minimum size</h3>
    <table><tr><th>Version</th><th>Screen</th><th>Print</th></tr>
    <tr><td>Symbol</td><td class="num">16 px</td><td class="num">5 mm</td></tr>
    <tr><td>Stacked</td><td class="num">140 px wide</td><td class="num">35 mm</td></tr>
    <tr><td>Horizontal</td><td class="num">180 px wide</td><td class="num">45 mm</td></tr></table></div>
  </div>
  <h3>The symbol at small sizes</h3>
  <div class="card" style="display:flex;align-items:flex-end;gap:34px;padding:22px 26px">
    <div>{img("atmdh-symbol-color.svg", "96px")}<div class="cap mono">96</div></div>
    <div>{img("atmdh-symbol-color.svg", "64px")}<div class="cap mono">64</div></div>
    <div>{img("atmdh-symbol-color.svg", "48px")}<div class="cap mono">48</div></div>
    <div>{img("atmdh-symbol-color.svg", "32px")}<div class="cap mono">32</div></div>
    <div>{img("atmdh-symbol-color.svg", "24px")}<div class="cap mono">24</div></div>
    <div>{img("atmdh-symbol-color.svg", "16px")}<div class="cap mono">16</div></div>
    <div class="cap" style="margin-left:auto;max-width:210px">Below 24 px the hollow cell reads as a lighter square. That is still correct.</div>
  </div>
  <h3>Backgrounds</h3>
  <div class="grid4">
    <div class="card center ok" style="background:#F3F0E8;padding:16px">{img("atmdh-symbol-color.svg", "70px")}</div>
    <div class="card center ok" style="background:#0B1626;padding:16px">{img("atmdh-symbol-reversed.svg", "70px")}</div>
    <div class="card center ok" style="background:#0F6B78;padding:16px">{img("atmdh-symbol-mono-light.svg", "70px")}</div>
    <div class="card center dont" style="background:linear-gradient(135deg,#E3A02B,#B4372D);padding:16px">{img("atmdh-symbol-color.svg", "70px")}</div>
  </div>
  <p class="cap muted" style="font-size:11px;margin-top:6px">Full color on Hielo or white. Reversed on Noche. One-color light on Lago or other dark brand colors. Never on a busy photograph or a saturated gradient: put a Noche panel under it.</p>
  {foot("4")}
</section>

<!-- 5 COLOR -->
<section class="page">
  <h2><small>4 · Color</small>Night, ice, lake, and one ring of ochre</h2>
  <p>Four colors. Noche and Hielo do most of the work. Lago marks the Peruvian side and the secondary voice. Ocre appears once per layout: the ring, a highlight, a number that matters. If a layout has ochre in three places, remove two.</p>
  <div class="grid4">{sw_html}</div>
  <h3>Contrast, checked</h3>
  <table><tr><th>Pair</th><th>Ratio</th><th>WCAG</th><th>Use</th></tr>{rows}</table>
  <h3>Neutrals</h3>
  <div class="grid4 neutral">
    <div class="swatch"><div class="chip" style="background:{B.NIEBLA}"></div><b>Niebla</b><span class="mono">{B.NIEBLA}</span><p>Secondary text on light.</p></div>
    <div class="swatch"><div class="chip" style="background:{B.NIEBLA_CLARA}"></div><b>Niebla clara</b><span class="mono">{B.NIEBLA_CLARA}</span><p>Secondary text on dark.</p></div>
    <div class="swatch"><div class="chip" style="background:{B.LAGO_CLARO}"></div><b>Lago claro</b><span class="mono">{B.LAGO_CLARO}</span><p>Peru-side cells on dark.</p></div>
    <div class="swatch"><div class="chip" style="background:#7FCBD8"></div><b>Lago hielo</b><span class="mono">#7FCBD8</span><p>Subtitle on dark.</p></div>
  </div>
  <div class="rule"><b>Charts keep their own palette.</b>The dashboard charts use a separate, validated data palette so that categories stay distinguishable. Brand colors belong to the frame around the data: header, buttons, page, covers.</div>
  {foot("5")}
</section>

<!-- 6 TIPOGRAFIA -->
<section class="page">
  <h2><small>5 · Typography</small>One family, two weights, tabular numbers</h2>
  <div class="grid2">
    <div class="card"><div style="font-size:54px;font-weight:600;letter-spacing:.07em;line-height:1">ATMDH</div><div class="cap"><b>Bahnschrift SemiBold.</b> Wordmark, titles, section labels. Wordmark tracking +7%.</div></div>
    <div class="card"><div style="font-size:30px;line-height:1.2">Recorded events by municipality and month</div><div class="cap"><b>Bahnschrift Regular.</b> Subtitles, body text, interface.</div></div>
  </div>
  <div class="card" style="margin-top:12px"><div style="font-size:15px;font-variant-numeric:tabular-nums;display:flex;gap:40px"><span>3.140</span><span>1.354.441</span><span>85.000</span><span>n&lt;10</span></div><div class="cap">Numbers use tabular figures so columns line up. The suppression marker is always written <b>n&lt;10</b>.</div></div>
  <h3>Fallback</h3>
  <p>Bahnschrift ships with Windows 10 and 11. Where it is missing, use <b>Segoe UI</b>, then the system sans-serif. The logo files already carry the wordmark as outlines, so they never depend on the font. The website uses the system font stack on purpose, so that it loads offline with no remote fonts.</p>
  <h3>Writing</h3>
  <ul>
    <li>Say <b>“recorded events”</b>, never “population” or “number of migrants”.</li>
    <li>Say <b>“people who cross”</b> or <b>“people in transit”</b>. Avoid “flows” as a subject without people behind it, and avoid “illegal”.</li>
    <li>Write every public text in English and Spanish. Spanish first on Bolivian and Peruvian channels, English first on international ones.</li>
    <li>Dates as 2026-10-27 in data, “27 October 2026” in prose. Keep sentences short and put the number first.</li>
  </ul>
  {foot("6")}
</section>

<!-- 7 PRIVACIDAD VISUAL -->
<section class="page">
  <h2><small>6 · Visual rules that protect people</small>The identity follows the privacy design</h2>
  <p>These rules are not taste. They are the same promises the system makes in code, applied to every poster, slide and post.</p>
  <div class="rule"><b>1. Never show an identifiable migrant.</b>No faces, no documents, no children, no license plates, no photographs taken at a crossing without written consent and a reason that belongs to the story. When in doubt, show the place or the object (a bridge, a bus terminal, a shelter door), not the person.</div>
  <div class="rule"><b>2. Never plot a person.</b>No map with one dot per individual and no route drawn for one traveler. Maps show nodes and totals by municipality and month, nothing finer.</div>
  <div class="rule"><b>3. A protected cell is hollow, never zero.</b>If a figure is below ten, draw the hollow cell or the hatched bar and write n&lt;10. Do not print 0 and do not hide the row.</div>
  <div class="rule"><b>4. Say what the number is.</b>Every count carries the label “recorded events” and its source. Every forecast carries its band. A line without a band is not published.</div>
  <div class="rule"><b>5. Credit the sources.</b>The Hub reuses figures from INE Bolivia, INEI, Migraciones, DIGEMIG, UNHCR, IOM, Chile’s PDI. Name them next to the figure, as the site does.</div>
  <div class="rule"><b>6. Be honest about the stage.</b>When a figure comes from a demonstration or an estimate, label it as such on the same slide.</div>
  <h3>Photography</h3>
  <p>Landscape and infrastructure at altitude: the Desaguadero bridge, the El Alto skyline, Lake Titicaca, the Pisiga road. Natural light, no filters, no saturated color grading. Place text on a Noche panel, never directly on the picture.</p>
  {foot("7")}
</section>

<!-- 8 USOS INCORRECTOS -->
<section class="page">
  <h2><small>7 · What not to do</small>Eight ways to break the symbol</h2>
  <div class="grid4">
    <div class="card dont center" style="padding:22px 10px"><div style="width:100px;transform:scaleX(1.5)">{img("atmdh-symbol-color.svg", "100%")}</div></div>
    <div class="card dont center" style="padding:22px 10px"><div style="width:100px;transform:rotate(30deg)">{img("atmdh-symbol-color.svg", "100%")}</div></div>
    <div class="card dont center" style="padding:22px 10px"><div style="width:100px;filter:hue-rotate(150deg) saturate(1.8)">{img("atmdh-symbol-color.svg", "100%")}</div></div>
    <div class="card dont center" style="padding:22px 10px"><div style="width:100px;filter:drop-shadow(5px 6px 4px rgba(0,0,0,.55))">{img("atmdh-symbol-color.svg", "100%")}</div></div>
  </div>
  <div class="grid4" style="margin-top:6px;text-align:center;font-size:11px;color:#5A6577"><span>Do not stretch</span><span>Do not rotate</span><span>Do not recolor</span><span>No shadows or glow</span></div>
  <div class="grid4" style="margin-top:14px">
    <div class="card dont center" style="padding:22px 10px"><div style="width:100px;opacity:.35">{img("atmdh-symbol-color.svg", "100%")}</div></div>
    <div class="card dont center" style="padding:22px 10px;background:repeating-linear-gradient(45deg,#d9a35c 0 12px,#6aa0b8 12px 24px,#c85c6a 24px 36px)"><div style="width:100px">{img("atmdh-symbol-color.svg", "100%")}</div></div>
    <div class="card dont center" style="padding:22px 10px"><div style="width:100px;transform:scale(1,.6)">{img("atmdh-symbol-color.svg", "100%")}</div></div>
    <div class="card dont center" style="padding:22px 10px"><div style="width:100px;filter:grayscale(1) contrast(3) brightness(1.1)">{img("atmdh-symbol-color.svg", "100%")}</div></div>
  </div>
  <div class="grid4" style="margin-top:6px;text-align:center;font-size:11px;color:#5A6577"><span>Do not fade it</span><span>Not on busy backgrounds</span><span>Do not squash it</span><span>Do not flatten the colors</span></div>
  <h3>Never</h3>
  <ul>
    <li>Fill the hollow cell, or remove the ring or the open dot. They carry the meaning.</li>
    <li>Add cells, or arrange the twelve cells in a different shape. The open dot is the only element reserved for growth: when a new country joins, it becomes a cell and this guide is reissued.</li>
    <li>Retype ATMDH in another typeface, change its tracking, or separate it from the symbol in the lockups.</li>
    <li>Place the logo inside a circle or a badge of another organization’s color.</li>
  </ul>
  <h3>Partners</h3>
  <p>Next to the logos of other organizations, keep the ATMDH logo at the same optical height and respect its clear space. Do not imply endorsement: use the line “Developed in the Departmental Youth Council of Santa Cruz” only if the Council has agreed.</p>
  {foot("8")}
</section>

<!-- 9 APLICACIONES -->
<section class="page">
  <h2><small>8 · In use</small>Website, preview card and files</h2>
  <h3 style="margin-top:0">Website header</h3>
  <div class="card" style="padding:0;overflow:hidden"><img src="{IM}app-website-header.png" alt="Website header" style="width:100%"></div>
  <p class="cap muted" style="font-size:11px;margin-top:6px">Noche bar, reversed symbol at 40 px, ochre line below, Lago claro and Hielo for text. The selected tab carries the ochre underline.</p>
  <div class="grid2" style="margin-top:8px">
    <div><h3>Preview card</h3><div class="card" style="padding:0;overflow:hidden"><img src="{IM}social-card.png" alt="Social card" style="width:100%"></div><p class="cap muted" style="font-size:11px;margin-top:6px">1200 × 630 px. It is the image that appears when the Hub link is shared.</p></div>
    <div><h3>Kit contents</h3><table style="font-size:11.5px">
    <tr><td>SVG</td><td>symbol, horizontal, stacked, icon, 4 color versions</td></tr>
    <tr><td>PNG</td><td>same set with transparent background, 1200 to 2400 px</td></tr>
    <tr><td>Icon</td><td>1024 and 180 px, favicon.svg</td></tr>
    <tr><td>Card</td><td>social card 1200 × 630</td></tr>
    <tr><td>Guide</td><td>this document, PDF and web page</td></tr></table>
    <p class="muted" style="font-size:12px;margin-top:10px">Web page: <a href="https://bookcubers2-ux.github.io/andean-transit-migration-data-hub/brand/">bookcubers2-ux.github.io/andean-transit-migration-data-hub/brand/</a></p></div>
  </div>
  <h3>Using this identity in a co-branded post</h3>
  <ol>
    <li>Photo of the speaker or place on the left, text on a Noche panel on the right.</li>
    <li>Horizontal logo, reversed, bottom left, with the clear space respected.</li>
    <li>One ochre element only: the ring in the logo, or a single highlighted figure.</li>
    <li>Caption in two languages, with the sources named.</li>
  </ol>
  {foot("9")}
</section>
</body></html>"""

os.makedirs(out_dir, exist_ok=True)
with open(os.path.join(out_dir, FN), "w", encoding="utf-8") as f:
    f.write(html)
print("ok", out_dir)
