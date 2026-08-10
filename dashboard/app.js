/* =====================================================================
   app.js  ·  ATMDH / OAMT
   Tablero de tres vistas mas la capa de modelo y la metodologia.
   Todo el estado vive en memoria y en localStorage. Nada pide red.
   ===================================================================== */
(function () {
  const D = window.ATMDH;
  const $ = (s, r) => (r || document).querySelector(s);
  const $$ = (s, r) => [...(r || document).querySelectorAll(s)];
  const mk = (tag, cls, html) => {
    const n = document.createElement(tag);
    if (cls) n.className = cls;
    if (html !== undefined) n.innerHTML = html;
    return n;
  };

  if (!D || !D.manifest) {
    document.body.innerHTML =
      '<div style="padding:2rem;font:14px system-ui">' +
      '<h1>Falta el paquete de datos</h1>' +
      '<p>No se encontro <code>dashboard/data/manifest.js</code>.</p>' +
      '<p>Genere un release: <code>node tools/make_demo_data.mjs</code> (datos sinteticos) ' +
      'o <code>source("run_all.R")</code> (datos reales).</p></div>';
    return;
  }

  const M = D.manifest, C = D.cubes, GEO = D.geo;
  const MUN = M.municipalities;
  const munById = Object.fromEntries(MUN.map(m => [m.mun_id, m]));
  const K = M.k_anonymity;

  const state = {
    lang: localStorage.getItem('atmdh.lang') || 'es',
    theme: localStorage.getItem('atmdh.theme') || 'system',
    tab: 'corridor',
    mun: 'BO-070101',
    year: 'all',
    indicator: 'flow'
  };
  let T = window.I18N[state.lang];
  const tr = (k, vars) => {
    let s = k.split('.').reduce((o, p) => (o || {})[p], T) || k;
    for (const v in (vars || {})) s = s.replace('{' + v + '}', vars[v]);
    return s;
  };
  const cl = (list, code) => {
    const e = (M.codelists && M.codelists[list] && M.codelists[list][code]);
    if (!e) return code;
    return e[state.lang] || e.es || code;
  };

  /* ---------- listas de codigos de respaldo ----------
     El manifiesto de demostracion no incluye codelists, asi que el
     tablero trae las etiquetas minimas. Con un release de R vienen del
     diccionario y estas quedan sin usar. */
  const FALLBACK = {
    es: {
      isic1: { A:'Agricultura', C:'Manufactura', F:'Construccion', G:'Comercio', H:'Transporte',
               I:'Alojamiento y comida', N:'Servicios de apoyo', T:'Trabajo domestico', OTH:'Otras secciones' },
      formality: { formal_contract:'Contrato formal', formal_selfemp:'Cuenta propia registrada',
                   informal_wage:'Asalariado informal', informal_own_account:'Cuenta propia informal',
                   unpaid:'No remunerado', none:'Sin actividad remunerada' },
      status: { 1:'Sin documentacion', 2:'Tramite iniciado', 3:'Permiso de transito',
                4:'Permanencia temporal', 5:'Con autorizacion laboral', 6:'Permanencia indefinida' },
      segment: { S1_PUNO:'S1 · Altiplano peruano', S2_FRONTERA:'S2 · Frontera del Titicaca',
                 S3_TRONCAL:'S3 · Eje troncal boliviano', S4_SALIDAS:'S4 · Salidas del corredor' },
      days: { '000_030':'0 a 30 dias', '031_060':'31 a 60 dias', '061_120':'61 a 120 dias',
              '121_240':'121 a 240 dias', '241_up':'241 dias o mas' }
    },
    en: {
      isic1: { A:'Agriculture', C:'Manufacturing', F:'Construction', G:'Trade', H:'Transport',
               I:'Accommodation and food', N:'Support services', T:'Domestic work', OTH:'Other sections' },
      formality: { formal_contract:'Formal contract', formal_selfemp:'Registered self-employed',
                   informal_wage:'Informal wage work', informal_own_account:'Informal own-account',
                   unpaid:'Unpaid', none:'No paid activity' },
      status: { 1:'Undocumented', 2:'Application filed', 3:'Transit permit',
                4:'Temporary stay', 5:'Work authorised', 6:'Permanent stay' },
      segment: { S1_PUNO:'S1 · Peruvian altiplano', S2_FRONTERA:'S2 · Titicaca border',
                 S3_TRONCAL:'S3 · Bolivian trunk axis', S4_SALIDAS:'S4 · Corridor exits' },
      days: { '000_030':'0 to 30 days', '031_060':'31 to 60 days', '061_120':'61 to 120 days',
              '121_240':'121 to 240 days', '241_up':'241 days or more' }
    }
  };
  const lab = (grp, code) => (FALLBACK[state.lang][grp] || {})[code] || String(code);

  const PERIODS = M.periods || [...new Set(C.flow.map(r => r.obs_period))].sort();
  const YEARS = [...new Set(PERIODS.map(p => p.slice(0, 4)))];

  const SEQ = ['var(--seq-1)','var(--seq-2)','var(--seq-3)','var(--seq-4)','var(--seq-5)','var(--seq-6)','var(--seq-7)'];
  const CAT = ['var(--s1)','var(--s2)','var(--s3)','var(--s4)','var(--s5)','var(--s6)','var(--s7)','var(--s8)'];

  /* =====================================================================
     ayudas de datos
     ===================================================================== */
  const flowSeries = (munId) => {
    const m = new Map(C.flow.filter(r => r.mun_id === munId).map(r => [r.obs_period, r.n]));
    return PERIODS.map(p => (m.has(p) ? m.get(p) : null));
  };
  const yearFilter = (r) => state.year === 'all' || r.obs_period.slice(0, 4) === state.year;

  const munTotal = (munId) => {
    const rows = C.flow.filter(r => r.mun_id === munId && yearFilter(r));
    const pub = rows.filter(r => r.n !== null);
    return { value: pub.reduce((a, b) => a + b.n, 0), suppressed: rows.length - pub.length,
             partial: rows.length !== pub.length };
  };
  const munAbsorption = (munId) => {
    const rows = C.absorption.filter(r => r.mun_id === munId && yearFilter(r) && r.rate !== null);
    if (!rows.length) return null;
    return rows.reduce((a, b) => a + b.rate, 0) / rows.length;
  };

  /* =====================================================================
     VISTA A · CORREDOR
     ===================================================================== */
  function renderCorridor(host) {
    host.innerHTML = '';

    const ctrls = mk('div', 'controls');
    ctrls.appendChild(field(tr('indicator'), [
      ['flow', tr('ind_flow')], ['absorption', tr('ind_absorption')], ['border', tr('ind_border')]
    ], state.indicator, v => { state.indicator = v; render(); }));
    ctrls.appendChild(field(tr('year'),
      [['all', tr('all_years')], ...YEARS.map(y => [y, y])], state.year,
      v => { state.year = v; render(); }));
    host.appendChild(ctrls);

    const split = mk('div', 'grid split');
    split.style.gridTemplateColumns = 'minmax(380px, 1fr) minmax(300px, 380px)';
    host.appendChild(split);

    /* ---- mapa ---- */
    const mapCard = mk('div', 'card');
    mapCard.appendChild(mk('h2', null, tr('map_title')));
    mapCard.appendChild(mk('p', 'sub', tr('map_sub')));
    split.appendChild(mapCard);

    const vb = GEO.viewbox;
    const s = DV.el('svg', { viewBox: `0 0 ${vb.w} ${vb.h}`, width: '100%',
                             role: 'img', 'aria-label': tr('map_title') }, [DV.defs()]);

    // capas de referencia
    const lake = GEO.layers.lake_titicaca;
    s.appendChild(DV.el('polygon', {
      points: lake.map(p => `${p.x},${p.y}`).join(' '),
      fill: 'var(--seq-1)', opacity: .45, stroke: 'var(--seq-2)', 'stroke-width': 1 }));
    ['border_bo_pe', 'border_bo_cl', 'border_bo_ar'].forEach(k => {
      s.appendChild(DV.el('polyline', {
        points: GEO.layers[k].map(p => `${p.x},${p.y}`).join(' '),
        fill: 'none', stroke: 'var(--axis)', 'stroke-width': 1.5, 'stroke-linejoin': 'round' }));
    });

    // valores del indicador
    const vals = {};
    GEO.nodes.forEach(n => {
      vals[n.mun_id] = state.indicator === 'absorption' ? munAbsorption(n.mun_id) : munTotal(n.mun_id).value;
    });
    const nums = Object.values(vals).filter(v => v !== null && v !== undefined);
    const vmax = Math.max(1, ...nums), vmin = Math.min(...nums);
    const rampIdx = v => {
      if (v === null || v === undefined) return -1;
      const t = (v - vmin) / ((vmax - vmin) || 1);
      return Math.min(SEQ.length - 1, Math.max(0, Math.round(t * (SEQ.length - 1))));
    };

    // aristas origen-destino declaradas
    const od = C.od.filter(r => state.year === 'all' || r.yr === state.year)
                   .filter(r => r.n !== null && r.origin_mun_id !== r.intended_dest_id);
    const odAgg = {};
    od.forEach(r => {
      const k = r.origin_mun_id + '>' + r.intended_dest_id;
      odAgg[k] = (odAgg[k] || 0) + r.n;
    });
    const odMax = Math.max(1, ...Object.values(odAgg));
    const pos = Object.fromEntries(GEO.nodes.map(n => [n.mun_id, n]));
    Object.entries(odAgg).forEach(([k, v]) => {
      const [o, d] = k.split('>');
      const a = pos[o], b = pos[d];
      if (!a || !b) return;
      const mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2;
      const dx = b.x - a.x, dy = b.y - a.y;
      const cx = mx - dy * 0.13, cy = my + dx * 0.13;
      const g = DV.el('g', { class: 'hit' }, [DV.el('path', {
        d: `M${a.x},${a.y}Q${cx},${cy} ${b.x},${b.y}`, fill: 'none',
        stroke: 'var(--s1)', 'stroke-width': 1 + 7 * Math.sqrt(v / odMax),
        'stroke-linecap': 'round', opacity: .22 })]);
      g.addEventListener('mousemove', e => DV.showTip(
        `<b>${munById[o].mun_name_short} → ${munById[d].mun_name_short}</b>${DV.fmt(v)} ${tr('ind_flow').toLowerCase()}`, e));
      g.addEventListener('mouseleave', DV.hideTip);
      s.appendChild(g);
    });

    // nodos
    const rMax = 26, rMin = 7;
    // los totales se calculan UNA vez: en una maquina de doble nucleo el
    // costo de recalcularlos por nodo se nota.
    const totals = Object.fromEntries(GEO.nodes.map(n => [n.mun_id, munTotal(n.mun_id)]));
    const tMax = Math.max(1, ...Object.values(totals).map(t => t.value));
    GEO.nodes.forEach(n => {
      const t = totals[n.mun_id];
      const r = rMin + (rMax - rMin) * Math.sqrt(t.value / tMax);
      const v = vals[n.mun_id];
      let fill;
      if (state.indicator === 'border') fill = n.is_border_post ? 'var(--s1)' : 'var(--s2)';
      else fill = v === null || v === undefined ? 'url(#hatch)' : SEQ[rampIdx(v)];
      const sel = n.mun_id === state.mun;
      const g = DV.el('g', { class: 'hit' });
      g.appendChild(DV.el('circle', { cx: n.x, cy: n.y, r: r, fill: fill,
        stroke: 'var(--surface-1)', 'stroke-width': 2, class: 'node-ring' }));
      if (sel) g.appendChild(DV.el('circle', { cx: n.x, cy: n.y, r: r + 4.5, fill: 'none',
        stroke: 'var(--ink-1)', 'stroke-width': 1.5 }));
      const right = n.x < vb.w * 0.55;
      g.appendChild(DV.txt(n.mun_name_short, {
        x: n.x + (right ? r + 7 : -(r + 7)), y: n.y + 4,
        'text-anchor': right ? 'start' : 'end',
        class: 'node-label' + (sel ? ' sel' : '') }));
      g.addEventListener('mousemove', e => {
        const abs = munAbsorption(n.mun_id);
        DV.showTip(`<b>${munById[n.mun_id].mun_name}</b>` +
          `${tr('ind_flow')}: ${DV.fmt(t.value)}${t.partial ? ' <span class="muted">(+ ' + t.suppressed + ' ' + tr('suppressed_months').toLowerCase() + ')</span>' : ''}<br>` +
          `${tr('ind_absorption')}: ${abs === null ? '—' : DV.pct(abs)}<br>` +
          `<span class="muted">${lab('segment', n.corridor_segment)}</span>`, e);
      });
      g.addEventListener('mouseleave', DV.hideTip);
      g.addEventListener('click', () => { state.mun = n.mun_id; render(); });
      s.appendChild(g);
    });
    mapCard.appendChild(s);

    if (state.indicator === 'border') {
      DV.legend(mapCard, [{ color: 'var(--s1)', label: tr('border_post') },
                          { color: 'var(--s2)', label: tr('inland_node') }]);
    } else {
      const lg = mk('div', 'legend');
      lg.innerHTML = SEQ.map((c, i) =>
        `<span class="lk"><i style="background:${c}"></i>${i === 0 ? DV.fmt(vmin) : (i === SEQ.length - 1 ? DV.fmt(vmax) : '')}</span>`).join('') +
        `<span class="lk"><i style="background:var(--ink-3)"></i>${tr('suppressed', { k: K })}</span>`;
      mapCard.appendChild(lg);
    }
    mapCard.appendChild(mk('p', 'sub', GEO.note[state.lang]));

    DV.table(mapCard,
      [tr('municipality'), tr('ind_flow'), tr('suppressed_months'), tr('ind_absorption'), tr('segment')],
      GEO.nodes.map(n => {
        const t = munTotal(n.mun_id), a = munAbsorption(n.mun_id);
        return [munById[n.mun_id].mun_name, DV.fmt(t.value), t.suppressed, a === null ? '—' : DV.pct(a),
                lab('segment', n.corridor_segment)];
      }), tr('show_table'));

    /* ---- panel de detalle ---- */
    const side = mk('div', 'grid');
    split.appendChild(side);

    const m = munById[state.mun];
    const t = munTotal(state.mun);
    const abs = munAbsorption(state.mun);
    const det = mk('div', 'card');
    det.appendChild(mk('h2', null, tr('node_detail')));
    det.appendChild(mk('p', 'sub', m.mun_name));
    const dl = mk('div');
    dl.innerHTML = `
      <div class="tiles" style="grid-template-columns:1fr 1fr">
        <div class="tile"><div class="label">${tr('events_total')}</div>
          <div class="value">${DV.fmt(t.value)}</div>
          <div class="note">${t.partial ? '+ ' + t.suppressed + ' ' + tr('suppressed_months').toLowerCase() : '&nbsp;'}</div></div>
        <div class="tile"><div class="label">${tr('ind_absorption')}</div>
          <div class="value">${abs === null ? '—' : DV.pct(abs)}</div>
          <div class="note">&nbsp;</div></div>
      </div>
      <p style="font-size:12.5px;color:var(--ink-2);margin:.9rem 0 0">
        ${tr('country')}: <b>${m.country_iso3}</b> · ${m.adm1_name}<br>
        ${tr('segment')}: <b>${lab('segment', m.corridor_segment)}</b><br>
        ${m.is_border_post ? tr('border_post') : tr('inland_node')} · ${tr('pop')}: ${DV.fmt(m.pop_baseline)}<br>
        ${tr('code_status')}: <code>${m.national_code}</code>
        <span class="status ${m.code_status === 'verified' ? 'good' : 'warning'}">${m.code_status === 'verified' ? tr('code_verified') : tr('code_needs_review')}</span>
      </p>`;
    det.appendChild(dl);
    side.appendChild(det);

    // composicion por edad del nodo (un eje, filtro de municipio)
    const ageCard = mk('div', 'card');
    ageCard.appendChild(mk('h2', null, state.lang === 'es' ? 'Composicion por edad' : 'Age composition'));
    ageCard.appendChild(mk('p', 'sub', m.mun_name_short));
    const ageRows = C.demog.filter(r => r.mun_id === state.mun)
      .sort((a, b) => String(a.age_band).localeCompare(String(b.age_band)))
      .map(r => ({ label: String(r.age_band).replace('_', '-').replace('-up', '+'), value: r.n }));
    DV.barsH(ageCard, ageRows, { width: 380, left: 58, bar: 13,
      suppressedLabel: 'n<' + K, suppressedTip: tr('suppressed', { k: K }), ariaLabel: 'edad' });
    side.appendChild(ageCard);
  }

  /* =====================================================================
     VISTA B · MERCADO LABORAL
     ===================================================================== */
  function renderLabour(host) {
    host.innerHTML = '';

    const ctrls = mk('div', 'controls');
    ctrls.appendChild(field(tr('municipality'),
      [['all', state.lang === 'es' ? 'Todo el corredor' : 'Whole corridor'],
       ...MUN.map(m => [m.mun_id, m.mun_name_short])], state.mun,
      v => { state.mun = v; render(); }));
    host.appendChild(ctrls);

    const sel = state.mun;
    const inSel = r => sel === 'all' || r.mun_id === sel;

    // ---- fichas ----
    const absRows = C.absorption.filter(r => inSel(r) && r.rate !== null);
    const absorption = absRows.length ? absRows.reduce((a, b) => a + b.rate, 0) / absRows.length : null;
    const medRows = absRows.map(r => r.median_days).sort((a, b) => a - b);
    const median = medRows.length ? medRows[Math.floor(medRows.length / 2)] : null;
    const formRows = C.formality.filter(inSel);
    const formTot = formRows.filter(r => r.n !== null).reduce((a, b) => a + b.n, 0);
    const informal = formRows.filter(r => r.n !== null &&
      ['informal_wage', 'informal_own_account'].includes(r.formality)).reduce((a, b) => a + b.n, 0);
    const allCells = [...C.flow, ...C.formality, ...C.sector, ...C.demog, ...C.absorption, ...C.days_dist];
    const supCells = allCells.filter(r => r.suppressed).length;

    const tiles = mk('div', 'tiles');
    tiles.innerHTML = `
      <div class="tile hero"><div class="label">${tr('hero_absorption')}</div>
        <div class="value">${absorption === null ? '—' : DV.pct(absorption)}</div>
        <div class="note">${tr('hero_absorption_note')}</div></div>
      <div class="tile"><div class="label">${tr('tile_median_days')}</div>
        <div class="value">${median === null ? '—' : DV.fmt(median)}</div>
        <div class="note">&nbsp;</div></div>
      <div class="tile"><div class="label">${tr('tile_informal')}</div>
        <div class="value">${formTot ? DV.pct(informal / formTot) : '—'}</div>
        <div class="note">&nbsp;</div></div>
      <div class="tile"><div class="label">${tr('tile_suppressed')}</div>
        <div class="value">${DV.fmt(supCells)}</div>
        <div class="note">${tr('of_cells', { n: DV.fmt(allCells.length) })}</div></div>`;
    host.appendChild(tiles);

    const grid = mk('div', 'grid split');
    grid.style.gridTemplateColumns = '1fr 1fr';
    grid.style.marginTop = '1rem';
    host.appendChild(grid);

    // ---- sectores ----
    const secCard = mk('div', 'card');
    secCard.appendChild(mk('h2', null, tr('sector_title')));
    secCard.appendChild(mk('p', 'sub', tr('sector_sub')));
    const secAgg = {};
    C.sector.filter(inSel).forEach(r => {
      if (!secAgg[r.isic1]) secAgg[r.isic1] = { n: 0, sup: 0, contested: 0 };
      if (r.n === null) secAgg[r.isic1].sup++;
      else { secAgg[r.isic1].n += r.n; if (r.contested_share > 0) secAgg[r.isic1].contested++; }
    });
    const secRows = Object.entries(secAgg)
      .map(([k, v]) => ({ label: lab('isic1', k), value: v.n || null,
        extra: v.sup ? (state.lang === 'es'
          ? v.sup + ' celda(s) municipal(es) suprimida(s)'
          : v.sup + ' municipal cell(s) suppressed') : (v.contested
          ? (state.lang === 'es' ? 'incluye mapeos en disputa' : 'includes contested mappings') : '') }))
      .sort((a, b) => (b.value || 0) - (a.value || 0));
    DV.barsH(secCard, secRows, { width: 560, left: 138, unit: '', suppressedLabel: 'n<' + K,
      suppressedTip: tr('suppressed', { k: K }), ariaLabel: tr('sector_title') });
    DV.table(secCard, [tr('sector_title'), tr('ind_flow')],
      secRows.map(r => [r.label, r.value === null ? tr('suppressed', { k: K }) : DV.fmt(r.value)]),
      tr('show_table'));
    grid.appendChild(secCard);

    // ---- dias al primer ingreso ----
    const dayCard = mk('div', 'card');
    dayCard.appendChild(mk('h2', null, tr('days_title')));
    dayCard.appendChild(mk('p', 'sub', tr('days_sub')));
    const bands = ['000_030', '031_060', '061_120', '121_240', '241_up'];
    const dayAgg = {};
    C.days_dist.filter(inSel).forEach(r => {
      dayAgg[r.days_band] = (dayAgg[r.days_band] || 0) + (r.n || 0);
    });
    const dayRows = bands.map((b, i) => ({
      label: lab('days', b), value: dayAgg[b] || null,
      color: i < 2 ? 'var(--s1)' : 'var(--seq-2)'
    }));
    DV.barsH(dayCard, dayRows, { width: 560, left: 138, suppressedLabel: 'n<' + K,
      suppressedTip: tr('suppressed', { k: K }), ariaLabel: tr('days_title') });
    DV.legend(dayCard, [
      { color: 'var(--s1)', label: state.lang === 'es' ? 'Absorbido en 60 dias' : 'Absorbed within 60 days' },
      { color: 'var(--seq-2)', label: state.lang === 'es' ? 'Fuera del corte' : 'Outside the cut' }]);
    DV.table(dayCard, [tr('days_title'), tr('ind_flow')],
      dayRows.map(r => [r.label, r.value === null ? tr('suppressed', { k: K }) : DV.fmt(r.value)]),
      tr('show_table'));
    grid.appendChild(dayCard);

    // ---- formalidad apilada ----
    const fCard = mk('div', 'card');
    fCard.style.gridColumn = '1 / -1';
    fCard.appendChild(mk('h2', null, tr('formality_title')));
    fCard.appendChild(mk('p', 'sub', tr('formality_sub')));
    const keys = ['formal_contract', 'formal_selfemp', 'informal_wage', 'informal_own_account', 'unpaid', 'none'];
    const colors = Object.fromEntries(keys.map((k, i) => [k, CAT[i]]));
    const groups = MUN.map(m => {
      const vals = {};
      keys.forEach(k => {
        const row = C.formality.find(r => r.mun_id === m.mun_id && r.formality === k);
        vals[k] = row ? row.n : 0;
      });
      return { label: m.mun_name_short, values: vals };
    });
    DV.stackedCols(fCard, groups, keys, colors, {
      width: 1180, height: 270, ariaLabel: tr('formality_title'),
      keyLabel: k => lab('formality', k) + ' · '
    });
    DV.legend(fCard, keys.map(k => ({ color: colors[k], label: lab('formality', k) })));
    DV.table(fCard, [tr('municipality'), ...keys.map(k => lab('formality', k))],
      groups.map(g => [g.label, ...keys.map(k => g.values[k] === null
        ? tr('suppressed', { k: K }) : DV.fmt(g.values[k]))]), tr('show_table'));
    grid.appendChild(fCard);
  }

  /* =====================================================================
     VISTA C · SERIE TEMPORAL
     ===================================================================== */
  function naiveBenchmark(values) {
    // ingenua estacional con deriva, calculada sobre lo publicado
    const out = values.map(() => null);
    const known = values.map((v, i) => [v, i]).filter(p => p[0] !== null);
    if (known.length < 24) return out;
    const first = known[0], last = known[known.length - 1];
    const drift = (last[0] - first[0]) / Math.max(1, last[1] - first[1]);
    for (let i = 12; i < values.length; i++) {
      if (values[i - 12] === null) continue;
      out[i] = Math.max(0, Math.round(values[i - 12] + drift * 12));
    }
    return out;
  }

  function renderTime(host) {
    host.innerHTML = '';
    const ctrls = mk('div', 'controls');
    ctrls.appendChild(field(tr('municipality'),
      MUN.map(m => [m.mun_id, m.mun_name_short]), state.mun, v => { state.mun = v; render(); }));
    host.appendChild(ctrls);

    const card = mk('div', 'card');
    card.appendChild(mk('h2', null, tr('ts_title') + ' · ' + munById[state.mun].mun_name_short));
    card.appendChild(mk('p', 'sub', tr('ts_sub')));
    const vals = flowSeries(state.mun);
    const nb = naiveBenchmark(vals);
    DV.lineChart(card, {
      x: PERIODS, width: 1180, height: 280,
      suppressedLabel: tr('suppressed', { k: K }),
      ariaLabel: tr('ts_title'),
      series: [
        { key: 'naive', label: tr('series_naive'), color: 'var(--ink-3)', values: nb, width: 2, opacity: .7, endDot: false },
        { key: 'act', label: tr('series_actual'), color: 'var(--s1)', values: vals }
      ]
    });
    DV.legend(card, [{ color: 'var(--s1)', label: tr('series_actual') },
                     { color: 'var(--ink-3)', label: tr('series_naive') },
                     { color: 'var(--ink-3)', label: tr('suppressed', { k: K }) }]);
    DV.table(card, [tr('year') + '-M', tr('series_actual'), tr('series_naive')],
      PERIODS.map((p, i) => [p, vals[i] === null ? tr('suppressed', { k: K }) : DV.fmt(vals[i]),
                             nb[i] === null ? '—' : DV.fmt(nb[i])]), tr('show_table'));
    host.appendChild(card);

    const sm = mk('div', 'card');
    sm.style.marginTop = '1rem';
    sm.appendChild(mk('h2', null, tr('ts_small_title')));
    sm.appendChild(mk('p', 'sub', tr('ts_small_sub')));
    const wrap = mk('div');
    wrap.style.display = 'grid';
    wrap.style.gridTemplateColumns = 'repeat(auto-fill, minmax(200px, 1fr))';
    wrap.style.gap = '.4rem';
    MUN.forEach(m => {
      const cell = mk('div');
      cell.style.cursor = 'pointer';
      cell.addEventListener('click', () => { state.mun = m.mun_id; render(); });
      DV.sparkPanel(cell, m.mun_name_short, flowSeries(m.mun_id),
        { color: m.mun_id === state.mun ? 'var(--s1)' : 'var(--seq-3)' });
      wrap.appendChild(cell);
    });
    sm.appendChild(wrap);
    host.appendChild(sm);
  }

  /* =====================================================================
     VISTA D · MODELO
     ===================================================================== */
  function renderModel(host) {
    host.innerHTML = '';

    // aviso permanente, no descartable
    const warn = mk('div', 'epistemic');
    warn.innerHTML = `<h3>${tr('epistemic_h')}</h3><ol>
      <li>${tr('epi_1')}</li><li>${tr('epi_2')}</li><li>${tr('epi_3')}</li>
      <li>${tr('epi_4')}</li><li>${tr('epi_5')}</li></ol>`;
    host.appendChild(warn);

    const ctrls = mk('div', 'controls');
    ctrls.style.marginTop = '1rem';
    ctrls.appendChild(field(tr('municipality'),
      MUN.map(m => [m.mun_id, m.mun_name_short]), state.mun, v => { state.mun = v; render(); }));
    host.appendChild(ctrls);

    // ---- grafico de abanico ----
    const card = mk('div', 'card');
    card.appendChild(mk('h2', null, tr('model_title') + ' · ' + munById[state.mun].mun_name_short));
    card.appendChild(mk('p', 'sub', tr('model_sub')));

    const fc = D.forecast.filter(r => r.mun_id === state.mun).sort((a, b) => a.step - b.step);
    const hist = PERIODS.slice(-24);
    const histVals = flowSeries(state.mun).slice(-24);
    const xs = [...hist, ...fc.map(r => r.obs_period)];
    const nH = hist.length;
    const lastKnown = [...histVals].reverse().find(v => v !== null) ?? null;

    const actual = [...histVals, ...fc.map(() => null)];
    const point = xs.map((_, i) => i === nH - 1 ? lastKnown : (i >= nH ? fc[i - nH].point : null));
    const band80 = xs.map((_, i) => i === nH - 1 ? [lastKnown, lastKnown]
      : (i >= nH ? [fc[i - nH].lo80, fc[i - nH].hi80] : null));
    const band95 = xs.map((_, i) => i === nH - 1 ? [lastKnown, lastKnown]
      : (i >= nH ? [fc[i - nH].lo95, fc[i - nH].hi95] : null));

    DV.lineChart(card, {
      x: xs, width: 1180, height: 300, ariaLabel: tr('model_title'),
      suppressedLabel: tr('suppressed', { k: K }),
      bands: [{ values: band95, color: 'var(--s1)', opacity: .10 },
              { values: band80, color: 'var(--s1)', opacity: .18 }],
      series: [
        { key: 'act', label: tr('series_actual'), color: 'var(--s1)', values: actual },
        { key: 'fc', label: tr('series_forecast'), color: 'var(--s2)', values: point, dash: '6 4' }
      ]
    });
    DV.legend(card, [
      { color: 'var(--s1)', label: tr('series_actual') },
      { color: 'var(--s2)', label: tr('series_forecast') },
      { color: 'var(--s1)', label: state.lang === 'es' ? 'Bandas 80% y 95%' : '80% and 95% bands' }]);
    DV.table(card, [tr('year') + '-M', tr('series_forecast'), 'lo80', 'hi80', 'lo95', 'hi95'],
      fc.map(r => [r.obs_period, DV.fmt(r.point), DV.fmt(r.lo80), DV.fmt(r.hi80),
                   DV.fmt(r.lo95), DV.fmt(r.hi95)]), tr('show_table'));
    card.style.marginTop = '1rem';
    host.appendChild(card);

    // ---- tarjeta de calibracion ----
    const sc = mk('div', 'card');
    sc.style.marginTop = '1rem';
    sc.appendChild(mk('h2', null, tr('scorecard_title')));
    sc.appendChild(mk('p', 'sub', tr('scorecard_sub') + ' ' + tr('is_naive') + '.'));
    const wrap = mk('div', 'scroll-x');
    const t = mk('table', 'dv');
    t.innerHTML = `<tr><th>${tr('municipality')}</th><th>${tr('level')}</th><th>${tr('mase')}</th>
      <th>${tr('rmsse')}</th><th>${tr('cov80')}</th><th style="text-align:left">${state.lang === 'es' ? 'Calibracion' : 'Calibration'}</th></tr>` +
      D.scorecard.sort((a, b) => b.mean_level - a.mean_level).map(r => {
        const c = r.coverage80;
        const cls = c >= 0.72 && c <= 0.92 ? 'good' : (c >= 0.55 ? 'warning' : 'critical');
        const txt_ = cls === 'good' ? tr('cal_good') : (cls === 'warning' ? tr('cal_warn') : tr('cal_bad'));
        return `<tr><td>${munById[r.mun_id].mun_name_short}</td><td>${DV.fmt(r.mean_level)}</td>
          <td>${r.MASE.toFixed(2)}</td><td>${r.RMSSE.toFixed(2)}</td><td>${DV.pct(c)}</td>
          <td style="text-align:left"><span class="status ${cls}">${txt_}</span></td></tr>`;
      }).join('');
    wrap.appendChild(t); sc.appendChild(wrap);
    sc.appendChild(mk('p', 'sub', state.lang === 'es'
      ? 'MASE de 1,00 significa que el modelo iguala a la referencia ingenua. Por encima de 1,00 pierde. La cobertura del 80% deberia acercarse a 0,80: por debajo, el intervalo es demasiado angosto y el modelo esta sobreconfiado.'
      : 'A MASE of 1.00 means the model matches the naive benchmark. Above 1.00 it loses. The 80% coverage should sit near 0.80: below that, the interval is too narrow and the model is overconfident.'));
    host.appendChild(sc);

    // ---- cobertura ----
    const cov = mk('div', 'card');
    cov.style.marginTop = '1rem';
    cov.appendChild(mk('h2', null, tr('coverage_title')));
    cov.appendChild(mk('p', 'sub', tr('coverage_sub')));
    const covRows = D.coverage.map(r => ({
      label: munById[r.mun_id].mun_name_short,
      value: r.coverage_known ? Math.round(r.coverage * 100) : null,
      extra: r[state.lang === 'es' ? 'note_es' : 'note_en']
    })).sort((a, b) => (b.value || -1) - (a.value || -1));
    DV.barsH(cov, covRows, { width: 700, left: 120, unit: '%',
      suppressedLabel: tr('coverage_unknown'),
      suppressedTip: tr('coverage_unknown'), ariaLabel: tr('coverage_title') });
    DV.table(cov, [tr('municipality'), tr('coverage_title')],
      covRows.map(r => [r.label, r.value === null ? tr('coverage_unknown') : r.value + '%']),
      tr('show_table'));
    host.appendChild(cov);
  }

  /* =====================================================================
     VISTA E · METODOLOGIA
     ===================================================================== */
  function renderMethod(host) {
    host.innerHTML = '';
    const card = mk('div', 'card');
    card.appendChild(mk('h2', null, tr('method_title')));
    const p = mk('div', 'prose');
    const es = state.lang === 'es';
    p.innerHTML = es ? `
      <h3>Que es una celda suprimida</h3>
      <p>Toda cifra publicada pasa por una compuerta antes de salir del pipeline de R. Una celda con menos de
      <b>${K}</b> registros no se publica, y no se publica como cero: se dibuja rayada, para que el lector vea
      que ahi hay un dato que existe y que no se puede mostrar. Los conteos publicados se redondean a base
      ${M.rounding_base}. Si una fila queda con una sola celda suprimida, se suprime una segunda, porque de lo
      contrario la primera se recupera restando del total.</p>
      <h3>Por que no hay tablas de tres vias</h3>
      <p>El maximo es de <b>${M.max_axes} ejes</b> por celda. Con alrededor de 28 registros por municipio-mes,
      cruzar municipio por nacionalidad por ocupacion deja celdas de dos o tres personas. No es una limitacion
      del tablero: es el tamano de la muestra, y el tablero lo dice en lugar de ofrecer un constructor de tablas
      dinamicas que produciria pantallas vacias.</p>
      <h3>Nadie es seguido de un nodo a otro</h3>
      <p>${tr('footer_linkage')} La sal criptografica es por municipio, de modo que la clave de episodio
      deduplica dentro de un municipio y es inutil fuera de el. Se pierde precision analitica. Se gana una
      herramienta que no puede usarse contra las personas que cuenta.</p>
      <h3>Que significa "evento registrado"</h3>
      <p>Los conteos son eventos registrados, nunca totales de poblacion. Solo se registra a quien interactua
      con el Estado, y la intensidad de esa interaccion cambia con los operativos de control. Por eso cada
      registro trae la covariable <code>enforcement_context</code>, y por eso la cobertura se estima por doble
      sistema donde el registro administrativo y la encuesta municipal se superponen, y se declara desconocida
      donde no.</p>
      <h3>Geometria</h3>
      <p>${GEO.note.es}</p>
    ` : `
      <h3>What a suppressed cell is</h3>
      <p>Every published figure passes through a gate before it leaves the R pipeline. A cell with fewer than
      <b>${K}</b> records is not published, and it is not published as a zero: it is drawn hatched, so the reader
      can see that a datum exists there and cannot be shown. Published counts are rounded to base
      ${M.rounding_base}. If a row is left with exactly one suppressed cell, a second one is suppressed, because
      otherwise the first is recoverable by subtraction from the total.</p>
      <h3>Why there are no three-way tables</h3>
      <p>The cap is <b>${M.max_axes} axes</b> per cell. At roughly 28 records per municipality-month, crossing
      municipality by nationality by occupation leaves cells of two or three people. This is not a limitation of
      the dashboard: it is the sample size, and the dashboard says so instead of offering a pivot builder that
      would produce empty screens.</p>
      <h3>Nobody is followed from one node to another</h3>
      <p>${tr('footer_linkage')} The cryptographic salt is per municipality, so the episode key deduplicates
      within a municipality and is useless outside it. Analytical precision is lost. What is gained is a tool
      that cannot be used against the people it counts.</p>
      <h3>What "recorded event" means</h3>
      <p>Counts are recorded events, never population totals. Only those who interact with the state are
      recorded, and the intensity of that interaction changes with enforcement operations. That is why every
      record carries the <code>enforcement_context</code> covariate, and why coverage is estimated by dual
      system where the administrative register and the municipal survey overlap, and declared unknown where
      they do not.</p>
      <h3>Geometry</h3>
      <p>${GEO.note.en}</p>
    `;
    card.appendChild(p);
    host.appendChild(card);

    const src = mk('div', 'card');
    src.style.marginTop = '1rem';
    src.appendChild(mk('h2', null, tr('sources')));
    const ul = mk('div', 'prose');
    ul.innerHTML = '<ul>' + M.sources.map(s =>
      `<li><b>${s.publisher}</b> <span class="chip">${s.source_id}</span><br>
       <span style="color:var(--ink-3)">${state.lang === 'es' ? s.caveat_es : s.caveat_en}</span></li>`).join('') + '</ul>';
    src.appendChild(ul);
    host.appendChild(src);
  }

  /* =====================================================================
     armazon
     ===================================================================== */
  function field(label, options, value, onChange) {
    const l = mk('label', 'field');
    l.appendChild(document.createTextNode(label));
    const s = document.createElement('select');
    options.forEach(([v, t]) => {
      const o = document.createElement('option');
      o.value = v; o.textContent = t; if (v === value) o.selected = true;
      s.appendChild(o);
    });
    s.addEventListener('change', () => onChange(s.value));
    l.appendChild(s);
    return l;
  }

  const VIEWS = { corridor: renderCorridor, labour: renderLabour, time: renderTime,
                  model: renderModel, method: renderMethod };

  function render() {
    T = window.I18N[state.lang];
    document.documentElement.lang = state.lang;
    DV.hideTip();

    $('#t-title').textContent = tr('title');
    $('#t-sub').textContent = tr('subtitle');
    $('#lang').textContent = tr('lang');
    $('#vintage').textContent = tr('vintage') + ' ' + M.vintage;
    $('#kchip').textContent = 'k = ' + K;

    $$('.tab').forEach(b => {
      b.textContent = tr('tabs.' + b.dataset.tab);
      b.setAttribute('aria-selected', b.dataset.tab === state.tab);
    });
    $$('.view').forEach(v => { v.hidden = v.dataset.view !== state.tab; });

    $('#foot-k').textContent = tr('footer_k', { k: K, b: M.rounding_base, a: M.max_axes });
    $('#foot-linkage').textContent = tr('footer_linkage');
    $('#foot-scope').textContent = M.forecast_scope[state.lang];

    const host = $(`.view[data-view="${state.tab}"]`);
    const t0 = performance.now();
    VIEWS[state.tab](host);
    $('#perf').textContent = Math.round(performance.now() - t0) + ' ms';
  }

  /* ---------- eventos ---------- */
  $('#lang').addEventListener('click', () => {
    state.lang = state.lang === 'es' ? 'en' : 'es';
    localStorage.setItem('atmdh.lang', state.lang);
    render();
  });
  $('#theme').addEventListener('click', () => {
    const order = ['system', 'light', 'dark'];
    state.theme = order[(order.indexOf(state.theme) + 1) % 3];
    localStorage.setItem('atmdh.theme', state.theme);
    applyTheme(); render();
  });
  function applyTheme() {
    if (state.theme === 'system') document.documentElement.removeAttribute('data-theme');
    else document.documentElement.setAttribute('data-theme', state.theme);
    $('#theme').textContent = state.theme === 'system' ? '◐' : (state.theme === 'light' ? '☀' : '☾');
  }
  $$('.tab').forEach(b => b.addEventListener('click', () => { state.tab = b.dataset.tab; render(); }));

  applyTheme();
  render();
})();
