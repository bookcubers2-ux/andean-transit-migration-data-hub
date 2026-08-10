/* =====================================================================
   charts.js  ·  ATMDH / OAMT
   Primitivas de grafico en SVG puro. Cero dependencias externas.

   Se descarto una libreria de graficos a proposito: uPlot son 45 KB y
   Plotly son 3 MB, y ninguna de las dos se descarga en un municipio sin
   internet. Con 54 puntos por serie el SVG a mano rinde de sobra en una
   maquina de doble nucleo.

   Especificaciones fijas: barras de 24 px como maximo con extremo
   redondeado de 4 px y base cuadrada, lineas de 2 px, marcadores de 8 px
   o mas, separacion de 2 px en color de superficie entre marcas
   contiguas, anillo de 2 px en los puntos.
   ===================================================================== */
(function () {
  const NS = 'http://www.w3.org/2000/svg';
  const DV = window.DV = {};

  const el = DV.el = (tag, attrs, kids) => {
    const n = document.createElementNS(NS, tag);
    for (const k in (attrs || {})) {
      if (attrs[k] === null || attrs[k] === undefined) continue;
      n.setAttribute(k, attrs[k]);
    }
    (kids || []).forEach(c => n.appendChild(c));
    return n;
  };
  const txt = DV.txt = (s, attrs) => {
    const n = el('text', attrs); n.textContent = s; return n;
  };
  const cssVar = DV.cssVar = (name) =>
    getComputedStyle(document.documentElement).getPropertyValue(name).trim();

  DV.fmt = (v, d) => v === null || v === undefined || Number.isNaN(v)
    ? '—' : Number(v).toLocaleString(document.documentElement.lang === 'en' ? 'en-US' : 'es-BO',
        { minimumFractionDigits: d || 0, maximumFractionDigits: d || 0 });
  DV.pct = (v, d) => v === null || v === undefined ? '—' : (100 * v).toFixed(d === undefined ? 0 : d) + '%';

  /* ---------- tooltip global ---------- */
  let tipEl = null;
  function tip() {
    if (!tipEl) { tipEl = document.createElement('div'); tipEl.id = 'tip'; document.body.appendChild(tipEl); }
    return tipEl;
  }
  DV.showTip = (html, ev) => {
    const t = tip(); t.innerHTML = html; t.style.opacity = '1';
    t.style.left = ev.clientX + 'px';
    t.style.top = Math.max(56, ev.clientY - 8) + 'px';
  };
  DV.hideTip = () => { if (tipEl) tipEl.style.opacity = '0'; };

  /* ---------- defs: trama para celdas suprimidas ---------- */
  // La supresion se DIBUJA. Una celda suprimida no es un cero ni un
  // hueco: es un dato que existe y que no se puede publicar, y el lector
  // tiene que poder verlo.
  DV.defs = () => el('defs', {}, [
    el('pattern', { id: 'hatch', width: 6, height: 6, patternUnits: 'userSpaceOnUse',
                    patternTransform: 'rotate(45)' }, [
      el('rect', { width: 6, height: 6, fill: 'var(--plane)' }),
      el('line', { x1: 0, y1: 0, x2: 0, y2: 6, stroke: 'var(--ink-3)', 'stroke-width': 2 })
    ])
  ]);

  /* ---------- escalas ---------- */
  DV.scale = (d0, d1, r0, r1) => {
    const span = (d1 - d0) || 1;
    const f = v => r0 + ((v - d0) / span) * (r1 - r0);
    f.invert = p => d0 + ((p - r0) / (r1 - r0)) * span;
    return f;
  };
  DV.niceTicks = (max, n) => {
    n = n || 5;
    if (!(max > 0)) return [0, 1];
    const raw = max / n, mag = Math.pow(10, Math.floor(Math.log10(raw)));
    const step = [1, 2, 2.5, 5, 10].find(s => s * mag >= raw) * mag;
    const out = []; for (let v = 0; v <= max + step * 0.001; v += step) out.push(v);
    return out;
  };

  const roundedEnd = (x, y, w, h, r, dir) => {
    // extremo redondeado, base cuadrada
    r = Math.min(r, h / 2, w);
    if (dir === 'right') return `M${x},${y}h${w - r}a${r},${r} 0 0 1 ${r},${r}v${h - 2 * r}a${r},${r} 0 0 1 ${-r},${r}h${-(w - r)}z`;
    return `M${x},${y + h}v${-(h - r)}a${r},${r} 0 0 1 ${r},${-r}h${w - 2 * r}a${r},${r} 0 0 1 ${r},${r}v${h - r}z`;
  };
  DV.roundedEnd = roundedEnd;

  /* =====================================================================
     BARRAS HORIZONTALES (una serie)
     ===================================================================== */
  DV.barsH = function (host, rows, opt) {
    opt = opt || {};
    const W = opt.width || 560, LEFT = opt.left || 132, RIGHT = 62;
    const BAR = Math.min(24, opt.bar || 20), GAP = 12;
    const H = opt.top || 8;
    const h = H + rows.length * (BAR + GAP);
    const max = Math.max(1, ...rows.map(r => r.value || 0));
    const x = DV.scale(0, max, LEFT, W - RIGHT);
    const s = el('svg', { viewBox: `0 0 ${W} ${h}`, width: '100%', role: 'img',
                          'aria-label': opt.ariaLabel || '' }, [DV.defs()]);

    rows.forEach((r, i) => {
      const y = H + i * (BAR + GAP);
      const suppressed = r.value === null || r.value === undefined;
      const w = suppressed ? 26 : Math.max(2, x(r.value) - LEFT);
      const g = el('g', { class: 'hit' });
      g.appendChild(el('path', {
        d: roundedEnd(LEFT, y, w, BAR, 4, 'right'),
        fill: suppressed ? 'url(#hatch)' : (r.color || 'var(--s1)'),
        opacity: suppressed ? 1 : (opt.dim && !r.on ? .35 : 1)
      }));
      g.appendChild(txt(r.label, { x: LEFT - 8, y: y + BAR / 2 + 4, 'text-anchor': 'end', class: 'mark-label' }));
      g.appendChild(txt(suppressed ? opt.suppressedLabel || 'n<10' : DV.fmt(r.value),
        { x: LEFT + w + 7, y: y + BAR / 2 + 4, class: 'mark-label' }));
      g.addEventListener('mousemove', e => DV.showTip(
        `<b>${r.label}</b>${suppressed
          ? `<span class="muted">${opt.suppressedTip || ''}</span>`
          : `${DV.fmt(r.value)} ${opt.unit || ''}` + (r.extra ? `<br><span class="muted">${r.extra}</span>` : '')}`, e));
      g.addEventListener('mouseleave', DV.hideTip);
      if (opt.onClick) g.addEventListener('click', () => opt.onClick(r));
      s.appendChild(g);
    });
    host.appendChild(s);
    return s;
  };

  /* =====================================================================
     COLUMNAS APILADAS  (separacion de 2 px en color de superficie)
     ===================================================================== */
  DV.stackedCols = function (host, groups, keys, colors, opt) {
    opt = opt || {};
    const W = opt.width || 900, TOP = 14, BOT = 46, LEFT = 8, RIGHT = 8;
    const H = opt.height || 250;
    const inner = W - LEFT - RIGHT;
    const band = inner / groups.length;
    const BAR = Math.min(24, band - 14);
    const y = DV.scale(0, 1, H - BOT, TOP);
    const s = el('svg', { viewBox: `0 0 ${W} ${H}`, width: '100%', role: 'img',
                          'aria-label': opt.ariaLabel || '' }, [DV.defs()]);

    // linea base
    s.appendChild(el('line', { x1: LEFT, y1: H - BOT, x2: W - RIGHT, y2: H - BOT, class: 'axisline' }));

    groups.forEach((g, gi) => {
      const cx = LEFT + band * gi + band / 2;
      const total = keys.reduce((a, k) => a + (g.values[k] || 0), 0);
      const anySup = keys.some(k => g.values[k] === null);
      let acc = 0;
      if (total === 0 && anySup) {
        s.appendChild(el('rect', { x: cx - BAR / 2, y: TOP, width: BAR, height: H - BOT - TOP,
                                   fill: 'url(#hatch)', rx: 4 }));
      } else {
        keys.forEach(k => {
          const v = g.values[k];
          if (!v) return;
          const frac = v / total;
          const y0 = y(acc + frac), y1 = y(acc);
          const hgt = Math.max(0, y1 - y0 - 2);          // separacion de 2 px
          const isTop = Math.abs(acc + frac - 1) < 1e-9;
          const rect = el('path', {
            d: isTop ? roundedEnd(cx - BAR / 2, y0, BAR, hgt + 2, 4, 'top')
                     : `M${cx - BAR / 2},${y0}h${BAR}v${hgt}h${-BAR}z`,
            fill: colors[k]
          });
          const gg = el('g', { class: 'hit' }, [rect]);
          gg.addEventListener('mousemove', e => DV.showTip(
            `<b>${g.label}</b>${opt.keyLabel ? opt.keyLabel(k) : k}: ${DV.fmt(v)} · ${DV.pct(frac)}`, e));
          gg.addEventListener('mouseleave', DV.hideTip);
          s.appendChild(gg);
          acc += frac;
        });
      }
      const lab = txt(g.label, { x: cx, y: H - BOT + 15, 'text-anchor': 'end', class: 'tick',
                                 transform: `rotate(-35 ${cx} ${H - BOT + 15})` });
      s.appendChild(lab);
    });
    host.appendChild(s);
    return s;
  };

  /* =====================================================================
     LINEAS con cruz y tooltip
     ===================================================================== */
  DV.lineChart = function (host, opt) {
    const W = opt.width || 900, H = opt.height || 260;
    const LEFT = 46, RIGHT = 16, TOP = 12, BOT = 34;
    const xs = opt.x;                             // etiquetas de periodo
    const series = opt.series;                    // [{key,label,color,values:[]}]
    const allV = series.flatMap(s => s.values).filter(v => v !== null && v !== undefined);
    const max = Math.max(1, ...allV);
    const ticks = DV.niceTicks(max, 4);
    const yMax = ticks[ticks.length - 1];
    const X = DV.scale(0, Math.max(1, xs.length - 1), LEFT, W - RIGHT);
    const Y = DV.scale(0, yMax, H - BOT, TOP);
    const s = el('svg', { viewBox: `0 0 ${W} ${H}`, width: '100%', role: 'img',
                          'aria-label': opt.ariaLabel || '' }, [DV.defs()]);

    ticks.forEach(t => {
      s.appendChild(el('line', { x1: LEFT, y1: Y(t), x2: W - RIGHT, y2: Y(t), class: 'gridline' }));
      s.appendChild(txt(DV.fmt(t), { x: LEFT - 7, y: Y(t) + 3.5, 'text-anchor': 'end', class: 'tick' }));
    });
    // rotulos de anio en el eje x
    xs.forEach((p, i) => {
      if (!p.endsWith('-M01') && i !== 0) return;
      s.appendChild(txt(p.slice(0, 4), { x: X(i), y: H - BOT + 15, 'text-anchor': 'middle', class: 'tick' }));
    });

    // bandas de incertidumbre primero, debajo de las lineas
    (opt.bands || []).forEach(b => {
      const pts = b.values.map((v, i) => v && [X(i), Y(v[0]), Y(v[1])]).filter(Boolean);
      if (!pts.length) return;
      const up = pts.map(p => `${p[0]},${p[2]}`).join(' ');
      const dn = pts.slice().reverse().map(p => `${p[0]},${p[1]}`).join(' ');
      s.appendChild(el('polygon', { points: up + ' ' + dn, fill: b.color, opacity: b.opacity || .14 }));
    });

    series.forEach(se => {
      const segs = []; let cur = [];
      se.values.forEach((v, i) => {
        if (v === null || v === undefined) { if (cur.length) segs.push(cur); cur = []; }
        else cur.push([X(i), Y(v)]);
      });
      if (cur.length) segs.push(cur);
      segs.forEach(seg => {
        if (seg.length === 1) {
          s.appendChild(el('circle', { cx: seg[0][0], cy: seg[0][1], r: 3, fill: se.color }));
        } else {
          s.appendChild(el('polyline', {
            points: seg.map(p => p.join(',')).join(' '), fill: 'none', stroke: se.color,
            'stroke-width': se.width || 2, 'stroke-linejoin': 'round', 'stroke-linecap': 'round',
            'stroke-dasharray': se.dash || null, opacity: se.opacity || 1
          }));
        }
      });
      // punto final con anillo de superficie de 2 px
      const last = se.values.map((v, i) => [v, i]).filter(p => p[0] !== null && p[0] !== undefined).pop();
      if (last && se.endDot !== false) {
        s.appendChild(el('circle', { cx: X(last[1]), cy: Y(last[0]), r: 4.5,
          fill: se.color, stroke: 'var(--surface-1)', 'stroke-width': 2 }));
      }
    });

    // capa de interaccion: cruz + tooltip
    const cross = el('line', { y1: TOP, y2: H - BOT, class: 'axisline', opacity: 0 });
    s.appendChild(cross);
    const overlay = el('rect', { x: LEFT, y: TOP, width: W - LEFT - RIGHT, height: H - TOP - BOT,
                                 fill: 'transparent', style: 'cursor:crosshair' });
    overlay.addEventListener('mousemove', ev => {
      const r = s.getBoundingClientRect();
      const px = LEFT + ((ev.clientX - r.left) / r.width) * W - LEFT;
      const i = Math.round(X.invert(LEFT + px));
      const idx = Math.max(0, Math.min(xs.length - 1, i));
      cross.setAttribute('x1', X(idx)); cross.setAttribute('x2', X(idx));
      cross.setAttribute('opacity', .6);
      const rows = series.map(se => {
        const v = se.values[idx];
        return `<span style="display:inline-block;width:9px;height:9px;border-radius:2px;background:${se.color};margin-right:5px"></span>${se.label}: ${v === null || v === undefined ? (opt.suppressedLabel || '—') : DV.fmt(v)}`;
      }).join('<br>');
      DV.showTip(`<b>${xs[idx]}</b>${rows}`, ev);
    });
    overlay.addEventListener('mouseleave', () => { cross.setAttribute('opacity', 0); DV.hideTip(); });
    s.appendChild(overlay);

    host.appendChild(s);
    return s;
  };

  /* =====================================================================
     PANELES PEQUENIOS (small multiples)
     ===================================================================== */
  DV.sparkPanel = function (host, name, values, opt) {
    opt = opt || {};
    const W = 210, H = 74, PAD = 6, LAB = 15;
    const clean = values.filter(v => v !== null && v !== undefined);
    const max = Math.max(1, ...clean);
    const X = DV.scale(0, Math.max(1, values.length - 1), PAD, W - PAD - 22);
    const Y = DV.scale(0, max, H - PAD, LAB + 4);
    const s = el('svg', { viewBox: `0 0 ${W} ${H}`, width: '100%' }, [DV.defs()]);
    s.appendChild(txt(name, { x: PAD, y: 11, class: 'mark-label' }));
    s.appendChild(txt(DV.fmt(max), { x: W - PAD, y: LAB + 6, 'text-anchor': 'end', class: 'tick' }));

    let cur = []; const segs = [];
    values.forEach((v, i) => {
      if (v === null || v === undefined) { if (cur.length) segs.push(cur); cur = []; }
      else cur.push([X(i), Y(v)]);
    });
    if (cur.length) segs.push(cur);
    // los tramos suprimidos se marcan en el eje, no se interpolan
    values.forEach((v, i) => {
      if (v === null || v === undefined)
        s.appendChild(el('rect', { x: X(i) - 1, y: H - PAD - 3, width: 2, height: 3, fill: 'var(--ink-3)' }));
    });
    segs.forEach(seg => s.appendChild(el('polyline', {
      points: seg.map(p => p.join(',')).join(' '), fill: 'none',
      stroke: opt.color || 'var(--s1)', 'stroke-width': 2, 'stroke-linejoin': 'round' })));
    s.appendChild(el('line', { x1: PAD, y1: H - PAD, x2: W - PAD - 22, y2: H - PAD, class: 'gridline' }));
    host.appendChild(s);
    return s;
  };

  /* =====================================================================
     TABLA  (el canal de accesibilidad obligatorio de cada grafico)
     ===================================================================== */
  DV.table = function (host, cols, rows, summaryLabel) {
    const d = document.createElement('details'); d.className = 'tableview';
    const sm = document.createElement('summary'); sm.textContent = summaryLabel; d.appendChild(sm);
    const wrap = document.createElement('div'); wrap.className = 'scroll-x';
    const t = document.createElement('table'); t.className = 'dv';
    const thead = document.createElement('tr');
    cols.forEach(c => { const th = document.createElement('th'); th.textContent = c; thead.appendChild(th); });
    t.appendChild(thead);
    rows.forEach(r => {
      const tr = document.createElement('tr');
      r.forEach(v => { const td = document.createElement('td'); td.textContent = v; tr.appendChild(td); });
      t.appendChild(tr);
    });
    wrap.appendChild(t); d.appendChild(wrap); host.appendChild(d);
    return d;
  };

  /* ---------- leyenda ---------- */
  DV.legend = function (host, items) {
    const div = document.createElement('div'); div.className = 'legend';
    items.forEach(it => {
      const sp = document.createElement('span'); sp.className = 'lk';
      sp.innerHTML = `<i style="background:${it.color}"></i>${it.label}`;
      div.appendChild(sp);
    });
    host.appendChild(div);
    return div;
  };
})();
