/* =====================================================================
   make_demo_data.mjs  ·  ATMDH / OAMT
   Genera un release L4 SINTETICO con el formato exacto que escribe
   R/09_export_dashboard.R, para poder ver el tablero funcionando antes
   de que existan los datos reales.

   Todo lo que sale de aqui queda marcado data_is_synthetic = true y el
   tablero lo grita en pantalla. Un tablero de migracion que no distingue
   entre dato real y dato de demostracion es una herramienta peligrosa.

   Aplica la MISMA compuerta que el pipeline de R: k=10, redondeo base 5,
   supresion complementaria, tope de dos ejes, minimo mensual.
   ===================================================================== */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(HERE, '..');
const OUT  = path.join(ROOT, 'dashboard', 'data');
fs.mkdirSync(OUT, { recursive: true });

// --- parametros de divulgacion, leidos del diccionario ---------------
const yamlText = fs.readFileSync(path.join(ROOT, 'dictionary', 'variables.yaml'), 'utf8');
const grab = (key, dflt) => {
  const m = yamlText.match(new RegExp(`^\\s{2}${key}:\\s*([0-9.]+)`, 'm'));
  return m ? Number(m[1]) : dflt;
};
const K_ANON = grab('k_anonymity', 10);
const ROUND_BASE = grab('rounding_base', 5);
const MAX_AXES = grab('max_axes', 2);

// --- RNG determinista ------------------------------------------------
function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rnd = mulberry32(20260810);
const pick = (arr, w) => {
  const total = w.reduce((a, b) => a + b, 0); let r = rnd() * total;
  for (let i = 0; i < arr.length; i++) { r -= w[i]; if (r <= 0) return arr[i]; }
  return arr[arr.length - 1];
};
const pois = (lambda) => {           // Knuth
  const L = Math.exp(-lambda); let k = 0, p = 1;
  do { k++; p *= rnd(); } while (p > L);
  return k - 1;
};

// --- municipios ------------------------------------------------------
const csv = fs.readFileSync(path.join(ROOT, 'dictionary', 'crosswalks', 'municipality_ids.csv'), 'utf8')
  .trim().split(/\r?\n/);
const header = csv[0].split(',');
const MUNIS = csv.slice(1).map(line => {
  // ninguna celda de este CSV contiene comas dentro de comillas
  const cells = line.split(',');
  const o = {}; header.forEach((h, i) => o[h] = cells[i]);
  o.lat = Number(o.lat); o.lon = Number(o.lon); o.pop_baseline = Number(o.pop_baseline);
  o.is_border_post = o.is_border_post === 'TRUE';
  return o;
});

// peso de flujo por nodo. Los pasos pequenios quedan chicos a proposito:
// asi se ve cuando la compuerta suprime, que es la mitad del punto.
const WEIGHT = {
  'BO-070101': 0.180, 'BO-020105': 0.150, 'PE-210402': 0.110, 'BO-020804': 0.100,
  'PE-230101': 0.090, 'BO-040101': 0.080, 'PE-211101': 0.070, 'PE-210101': 0.060,
  'BO-060301': 0.050, 'BO-051501': 0.040, 'BO-021701': 0.035, 'PE-211301': 0.025,
  'BO-040901': 0.020
};

// --- periodos --------------------------------------------------------
const PERIODS = [];
for (let y = 2022; y <= 2026; y++) {
  for (let m = 1; m <= 12; m++) {
    if (y === 2026 && m > 9) break;
    PERIODS.push(`${y}-M${String(m).padStart(2, '0')}`);
  }
}
const N_TARGET = 18500;
// calibracion: la tendencia y la estacionalidad inflan el total, asi que
// se corrige para aterrizar en los 18.500 registros de la escala real.
const CAL = 0.741;

// --- choques del calendario real (dictionary/reference/events_calendar.csv)
// Bloqueos y cierres reducen el flujo registrado; estados de emergencia y
// operativos suben la deteccion. Se aplican por municipio y mes.
const SHOCKS = [
  // Puno: bloqueos y cierre del puente, dic-2022 a mar-2023
  { ids: ['PE-210101','PE-211101','PE-210402','PE-211301','BO-020804'], from: '2022-M12', to: '2023-M03', factor: 0.35 },
  // OIM DTM: menos flujo en Puno por bloqueos, ene-2024
  { ids: ['PE-210101','PE-210402','BO-020804'], from: '2024-M01', to: '2024-M01', factor: 0.6 },
  // Bolivia: bloqueos de la COB, ene-2026
  { ids: ['BO-020105','BO-040101','BO-020804'], from: '2026-M01', to: '2026-M01', factor: 0.7 },
  // Bolivia: ola de bloqueos y paralizacion de Desaguadero, may-jun 2026
  { ids: ['BO-020105','BO-040101','BO-020804','PE-210402','BO-021701','PE-210101','PE-211101'], from: '2026-M05', to: '2026-M06', factor: 0.4 },
  // Chile: Plan Escudo Fronterizo, caida de cruces por Colchane desde mar-2026
  { ids: ['BO-040901'], from: '2026-M03', to: '2026-M12', factor: 0.45 },
  // Tacna: cadena de estados de emergencia (DS 135-2025, 013, 051 y 086-2026-PCM)
  { ids: ['PE-230101'], from: '2025-M12', to: '2026-M08', factor: 1, operativo: true },
  // Puno: estados de emergencia de 2023
  { ids: ['PE-210101','PE-211101','PE-210402','PE-211301'], from: '2023-M04', to: '2023-M09', factor: 1, operativo: true }
];
function shockFor(id, p) {
  let factor = 1, operativo = false;
  for (const s of SHOCKS) if (s.ids.includes(id) && p >= s.from && p <= s.to) {
    factor *= s.factor; operativo = operativo || !!s.operativo;
  }
  return { factor, operativo };
}

// --- generacion de eventos ------------------------------------------
const AGE_BANDS = ['00_04','05_09','10_14','15_19','20_24','25_29','30_34','35_39','40_44','45_49','50_54','55_59','60_64','65_up'];
const AGE_W     = [ 3, 3, 4, 7, 14, 17, 15, 12, 9, 6, 4, 3, 2, 1];
const ISIC      = ['A','C','F','G','H','I','N','T','OTH'];
const ISIC_W    = [ 5, 6, 16, 30, 9, 14, 8, 9, 3];
const FORMALITY = ['formal_contract','formal_selfemp','informal_wage','informal_own_account','unpaid','none'];
const FORM_W    = [ 4, 6, 34, 38, 5, 13];
const STATUS_W  = [ 30, 22, 24, 14, 7, 3];

const events = [];
const totalW = Object.values(WEIGHT).reduce((a, b) => a + b, 0);

for (const mun of MUNIS) {
  const w = (WEIGHT[mun.mun_id] || 0.02) / totalW;
  for (let ti = 0; ti < PERIODS.length; ti++) {
    const p = PERIODS[ti];
    const month = Number(p.slice(6));
    // tendencia + estacionalidad (pico en enero y julio, movilidad andina)
    const trend = 1 + 0.55 * (ti / PERIODS.length);
    const seas  = 1 + 0.28 * Math.cos((2 * Math.PI * (month - 1)) / 12)
                    + 0.12 * Math.cos((4 * Math.PI * (month - 1)) / 12);
    // operativos: choques de deteccion, no de flujo. Es la covariable critica.
    const sh = shockFor(mun.mun_id, p);
    const operativo = sh.operativo || rnd() < 0.05;
    const lambda = CAL * (N_TARGET / PERIODS.length) * w * trend * seas * (operativo ? 2.1 : 1) * sh.factor;
    const n = pois(Math.max(0.3, lambda));

    for (let i = 0; i < n; i++) {
      const age = pick(AGE_BANDS, AGE_W);
      const working = !['00_04','05_09','10_14','65_up'].includes(age);
      const absorbedFast = rnd() < (mun.pop_baseline > 200000 ? 0.52 : 0.28);
      const days = working
        ? Math.max(0, Math.round(absorbedFast ? 8 + rnd() * 50 : 70 + rnd() * 240))
        : null;
      events.push({
        mun_id: mun.mun_id,
        obs_period: p,
        age_band: age,
        sex: rnd() < 0.46 ? 'F' : (rnd() < 0.985 ? 'M' : 'X'),
        status_rank: pick([1,2,3,4,5,6], STATUS_W),
        isic1: working ? pick(ISIC, ISIC_W) : null,
        formality: working ? pick(FORMALITY, FORM_W) : null,
        days_to_first_income: days,
        absorbed_60d: days !== null ? days <= 60 : null,
        enforcement_context: operativo ? 'operativo' : 'routine',
        segment: mun.corridor_segment
      });
    }
  }
}

// --- matriz origen-destino (declarada, no rastreada) -----------------
// Nadie es seguido de un municipio a otro. Estas aristas salen de
// origin_mun_id e intended_dest_id declarados en la entrevista.
const CORRIDOR_EDGES = [
  ['PE-211101','PE-210101',0.70], ['PE-211101','PE-210402',0.22], ['PE-211101','PE-230101',0.30],
  ['PE-210101','PE-210402',0.62], ['PE-210101','PE-211301',0.24], ['PE-210101','PE-230101',0.20],
  ['PE-211301','BO-021701',0.80], ['PE-210402','BO-020804',0.92],
  ['BO-021701','BO-020105',0.74], ['BO-020804','BO-020105',0.86],
  ['BO-020105','BO-040101',0.58], ['BO-020105','BO-070101',0.40],
  ['BO-040101','BO-070101',0.42], ['BO-040101','BO-040901',0.26], ['BO-040101','BO-051501',0.24],
  ['BO-070101','BO-060301',0.22], ['BO-051501','BO-060301',0.10],
  ['PE-230101','PE-230101',0.00]
];
const odRaw = [];
for (const [o, d, share] of CORRIDOR_EDGES) {
  if (share === 0) continue;
  for (const yr of ['2022','2023','2024','2025','2026']) {
    const base = events.filter(e => e.mun_id === o && e.obs_period.startsWith(yr)).length;
    const n = Math.round(base * share * (0.85 + rnd() * 0.3));
    if (n > 0) odRaw.push({ origin_mun_id: o, intended_dest_id: d, yr, n });
  }
}

/* =====================================================================
   LA COMPUERTA. Misma logica que R/07_disclosure_control.R.
   ===================================================================== */
const roundBase = (x) => (x == null ? null : Math.round(x / ROUND_BASE) * ROUND_BASE);

function gate(rows, { groupBy = null, valueCols = [], axes = [] } = {}) {
  if (axes.length > MAX_AXES) {
    throw new Error(`[compuerta] ${axes.length} ejes (${axes.join(' x ')}) y el maximo es ${MAX_AXES}.`);
  }
  const out = rows.map(r => ({ ...r, suppressed: r.n < K_ANON }));
  // supresion complementaria: si un grupo tiene exactamente una celda
  // suprimida, se recupera restando del margen. Se suprime la siguiente.
  if (groupBy) {
    const groups = {};
    out.forEach(r => { (groups[r[groupBy]] ||= []).push(r); });
    for (const g of Object.values(groups)) {
      let guard = 0;
      while (g.filter(r => r.suppressed).length === 1 && guard++ < 50) {
        const open = g.filter(r => !r.suppressed).sort((a, b) => a.n - b.n);
        if (!open.length) break;
        open[0].suppressed = true;
      }
    }
  }
  return out.map(r => {
    const o = { ...r };
    o.n = r.suppressed ? null : roundBase(r.n);
    for (const v of valueCols) o[v] = r.suppressed ? null : r[v];
    return o;
  });
}

const countBy = (rows, keys, extra = () => ({})) => {
  const m = new Map();
  for (const r of rows) {
    const k = keys.map(x => r[x]).join('');
    if (!m.has(k)) { const o = {}; keys.forEach(x => o[x] = r[x]); o.n = 0; o._rows = []; m.set(k, o); }
    const o = m.get(k); o.n++; o._rows.push(r);
  }
  return [...m.values()].map(o => { const rows_ = o._rows; delete o._rows; return { ...o, ...extra(rows_) }; });
};

// --- cubos -----------------------------------------------------------
const flowRaw = [];
for (const mun of MUNIS) for (const p of PERIODS) {
  flowRaw.push({ mun_id: mun.mun_id, obs_period: p,
    n: events.filter(e => e.mun_id === mun.mun_id && e.obs_period === p).length });
}
// contar con un solo barrido en vez de 13x54 filtros
{
  const idx = new Map();
  for (const e of events) {
    const k = e.mun_id + '' + e.obs_period;
    idx.set(k, (idx.get(k) || 0) + 1);
  }
  flowRaw.forEach(r => { r.n = idx.get(r.mun_id + '' + r.obs_period) || 0; });
}

const workers = events.filter(e => e.isic1 !== null);

const cubes = {
  flow: gate(flowRaw, { groupBy: 'mun_id', axes: ['obs_period'] }),
  od:   gate(odRaw,   { axes: ['origin_mun_id', 'intended_dest_id'] }),
  sector: gate(
    countBy(workers, ['mun_id', 'isic1'], rows => ({
      // dominancia simulada: un empleador con mas del 60% de la celda
      top_employer_share: Number((0.18 + rnd() * 0.5).toFixed(2)),
      contested_share: Number((rnd() < 0.15 ? 0.2 + rnd() * 0.4 : 0).toFixed(2))
    })),
    { groupBy: 'mun_id', axes: ['isic1'], valueCols: ['top_employer_share', 'contested_share'] }),
  formality: gate(countBy(workers, ['mun_id', 'formality']), { groupBy: 'mun_id', axes: ['formality'] }),
  demog:     gate(countBy(events,  ['mun_id', 'age_band']),  { groupBy: 'mun_id', axes: ['age_band'] }),
  status:    gate(countBy(events,  ['mun_id', 'status_rank']), { groupBy: 'mun_id', axes: ['status_rank'] }),
  absorption: gate(
    countBy(workers, ['mun_id', 'obs_period'], rows => {
      const abs_ = rows.filter(r => r.absorbed_60d).length;
      const ds = rows.map(r => r.days_to_first_income).sort((a, b) => a - b);
      return { absorbed: abs_, rate: Number((abs_ / rows.length).toFixed(3)),
               median_days: ds[Math.floor(ds.length / 2)] };
    }),
    { groupBy: 'mun_id', axes: ['obs_period'], valueCols: ['rate', 'median_days', 'absorbed'] }),
  days_dist: gate(
    countBy(workers.map(r => ({ ...r,
      days_band: r.days_to_first_income <= 30 ? '000_030'
               : r.days_to_first_income <= 60 ? '031_060'
               : r.days_to_first_income <= 120 ? '061_120'
               : r.days_to_first_income <= 240 ? '121_240' : '241_up' })),
      ['mun_id', 'days_band']),
    { groupBy: 'mun_id', axes: ['days_band'] })
};

// agregados de segmento y de corredor: son celdas que pasan k por
// construccion, y son la unica forma de ver los nodos pequenios.
const segFlow = [];
for (const seg of [...new Set(MUNIS.map(m => m.corridor_segment))]) {
  const ids = MUNIS.filter(m => m.corridor_segment === seg).map(m => m.mun_id);
  for (const p of PERIODS) {
    const n = flowRaw.filter(r => ids.includes(r.mun_id) && r.obs_period === p)
                     .reduce((a, b) => a + b.n, 0);
    segFlow.push({ corridor_segment: seg, obs_period: p, n: roundBase(n), suppressed: false });
  }
}
const corridorFlow = PERIODS.map(p => ({
  obs_period: p, suppressed: false,
  n: roundBase(flowRaw.filter(r => r.obs_period === p).reduce((a, b) => a + b.n, 0))
}));
cubes.segment_flow = segFlow;
cubes.corridor_flow = corridorFlow;

/* =====================================================================
   PRONOSTICO. Cosecha de solo flujo.
   Ingenua estacional con deriva. Es la referencia obligatoria y en esta
   cosecha es tambien el modelo publicado, porque la serie de demanda
   laboral todavia no existe para los doce nodos. Ver model_card.md.
   ===================================================================== */
const H = 6;
const forecast = [];
const scorecard = [];

for (const mun of MUNIS) {
  const y = flowRaw.filter(r => r.mun_id === mun.mun_id).map(r => r.n);
  const m = y.length;
  const last12 = y.slice(-12);
  const drift = (y[m - 1] - y[m - 24]) / 23;
  // sigma de los residuos de la ingenua en el historico
  const res = [];
  for (let i = 12; i < m; i++) res.push(y[i] - y[i - 12]);
  const sd = Math.sqrt(res.reduce((a, b) => a + b * b, 0) / res.length);

  for (let h = 1; h <= H; h++) {
    const point = Math.max(0, last12[(h - 1) % 12] + drift * h);
    const s = sd * Math.sqrt(h);
    const lastP = PERIODS[PERIODS.length - 1];
    let yy = Number(lastP.slice(0, 4)), mm = Number(lastP.slice(6)) + h;
    while (mm > 12) { mm -= 12; yy++; }
    forecast.push({
      mun_id: mun.mun_id, step: h,
      obs_period: `${yy}-M${String(mm).padStart(2, '0')}`,
      point: Math.round(point),
      lo80: Math.max(0, Math.round(point - 1.2816 * s)), hi80: Math.round(point + 1.2816 * s),
      lo95: Math.max(0, Math.round(point - 1.9600 * s)), hi95: Math.round(point + 1.9600 * s)
    });
  }

  // retrospectiva por origen movil, h=3
  let ae = 0, se = 0, cnt = 0, inside = 0;
  for (let o = 24; o < m - 3; o++) {
    for (let h = 1; h <= 3; h++) {
      const pt = Math.max(0, y[o + h - 12]);
      const s = sd * Math.sqrt(h);
      const act = y[o + h];
      ae += Math.abs(act - pt); se += (act - pt) ** 2; cnt++;
      if (act >= pt - 1.2816 * s && act <= pt + 1.2816 * s) inside++;
    }
  }
  let scale = 0; for (let i = 1; i < m; i++) scale += Math.abs(y[i] - y[i - 1]);
  scale /= (m - 1);
  const MASE = (ae / cnt) / scale;
  scorecard.push({
    mun_id: mun.mun_id,
    MASE: Number(MASE.toFixed(2)),
    RMSSE: Number((Math.sqrt(se / cnt) / scale).toFixed(2)),
    coverage80: Number((inside / cnt).toFixed(2)),
    n_origins: cnt,
    beats_naive: null,          // en esta cosecha el modelo ES la ingenua
    mean_level: Math.round(y.reduce((a, b) => a + b, 0) / m)
  });
}

/* --- cobertura (doble sistema, Chapman) -----------------------------
   Donde el registro administrativo y la encuesta municipal no se
   superponen, la cobertura se reporta como desconocida. Un supuesto no
   verificable no se disfraza de dato. */
const coverage = MUNIS.map(mun => {
  const known = mun.pop_baseline > 20000 && rnd() > 0.25;
  return {
    mun_id: mun.mun_id,
    coverage_known: known,
    coverage: known ? Number((0.28 + rnd() * 0.42).toFixed(2)) : null,
    coverage_lo: known ? null : null,
    note_es: known ? 'Estimacion de doble sistema (registro administrativo x encuesta municipal).'
                   : 'Sin superposicion entre fuentes. Cobertura desconocida, no asumida.',
    note_en: known ? 'Dual-system estimate (administrative register x municipal survey).'
                   : 'No overlap between sources. Coverage unknown, not assumed.'
  };
});

/* --- geometria proyectada (misma matematica que R/10_geo.R) --------- */
const VB = { w: 900, h: 950 }, PAD = 70, LAT0 = -18.5;
const REF = {
  border_bo_pe: [[-69.65,-17.30],[-69.30,-16.90],[-69.10,-16.60],[-69.05,-16.35],[-69.15,-16.20],[-69.05,-16.05],[-68.85,-15.90],[-69.00,-15.60],[-69.40,-15.25],[-69.60,-14.95]],
  border_bo_cl: [[-69.55,-17.60],[-69.15,-18.20],[-68.95,-18.95],[-68.65,-19.25],[-68.55,-19.85],[-68.40,-20.50],[-68.20,-21.30],[-67.90,-22.00]],
  border_bo_ar: [[-66.05,-22.10],[-65.60,-22.09],[-65.00,-22.10],[-64.30,-22.05],[-63.70,-22.00],[-62.85,-22.00]],
  lake_titicaca:[[-69.95,-15.55],[-69.60,-15.30],[-69.20,-15.45],[-68.95,-15.75],[-68.85,-16.10],[-69.05,-16.30],[-69.25,-16.20],[-69.55,-16.05],[-69.85,-15.80],[-69.95,-15.55]]
};
const allPts = [...MUNIS.map(m => [m.lon, m.lat]), ...Object.values(REF).flat()];
const px = allPts.map(([lon]) => lon * Math.cos(LAT0 * Math.PI / 180));
const py = allPts.map(([, lat]) => -lat);
const rng_ = a => [Math.min(...a), Math.max(...a)];
const [x0, x1] = rng_(px), [y0, y1] = rng_(py);
const s = Math.min((VB.w - 2 * PAD) / (x1 - x0), (VB.h - 2 * PAD) / (y1 - y0));
const fx = v => +(PAD + (v - x0) * s + ((VB.w - 2 * PAD) - (x1 - x0) * s) / 2).toFixed(1);
const fy = v => +(PAD + (v - y0) * s + ((VB.h - 2 * PAD) - (y1 - y0) * s) / 2).toFixed(1);

const geo = {
  viewbox: VB,
  nodes: MUNIS.map(m => ({
    mun_id: m.mun_id, node_id: m.node_id, mun_name_short: m.mun_name_short,
    country_iso3: m.country_iso3, corridor_segment: m.corridor_segment,
    is_border_post: m.is_border_post,
    x: fx(m.lon * Math.cos(LAT0 * Math.PI / 180)), y: fy(-m.lat)
  })),
  layers: Object.fromEntries(Object.entries(REF).map(([k, pts]) =>
    [k, pts.map(([lon, lat]) => ({ x: fx(lon * Math.cos(LAT0 * Math.PI / 180)), y: fy(-lat) }))])),
  note: {
    es: 'Fronteras y lago Titicaca en trazado simplificado de referencia, escala de corredor. Las posiciones de los nodos son coordenadas reales proyectadas.',
    en: 'Borders and Lake Titicaca in a simplified reference outline at corridor scale. Node positions are real projected coordinates.'
  }
};

/* --- manifiesto ----------------------------------------------------- */
const manifest = {
  schema_version: '2.0.0',
  vintage: '2026Q3',
  release_date: '2026-10-24',
  build: 'public',
  k_anonymity: K_ANON,
  rounding_base: ROUND_BASE,
  max_axes: MAX_AXES,
  min_period: 'month',
  min_geography: 'municipality',
  data_is_synthetic: true,
  n_events_simulated: events.length,
  periods: PERIODS,
  measure_label: { es: 'eventos registrados', en: 'recorded events' },
  forecast_scope: {
    es: 'Pronostico de flujo registrado por municipio y mes, horizonte de 6 meses, con bandas del 80% y del 95%. La razon de absorcion a 60 dias se publica como descriptivo historico.',
    en: 'Forecast of recorded flow by municipality and month, 6-month horizon, with 80% and 95% bands. The 60-day absorption ratio is published as a historical descriptive.'
  },
  municipalities: MUNIS.map(m => ({
    mun_id: m.mun_id, node_id: m.node_id, mun_name_short: m.mun_name_short, mun_name: m.mun_name,
    country_iso3: m.country_iso3, adm1_name: m.adm1_name, corridor_segment: m.corridor_segment,
    is_border_post: m.is_border_post, code_status: m.code_status, national_code: m.national_code,
    pop_baseline: m.pop_baseline, pop_year: m.pop_year, pop_source: m.pop_source
  })),
  sources: [
    { source_id: 'SRC-BO-INE-EFLUVI', publisher: 'INE Bolivia y Direccion General de Migracion (SICOF)', kind: 'published_aggregate',
      caveat_es: 'Solo registra a quien se presenta ante la autoridad migratoria. La cobertura sube durante operativos y baja fuera de ellos.',
      caveat_en: 'Records only those who present to the migration authority. Coverage rises during enforcement operations and falls outside them.' },
    { source_id: 'SRC-PE-INEI-MIGRACIONES', publisher: 'INEI y Superintendencia Nacional de Migraciones (Peru)', kind: 'published_aggregate',
      caveat_es: 'Publicacion trimestral por oficina de control migratorio. Edad y sexo a nivel nacional.',
      caveat_en: 'Quarterly publication by migration control office. Age and sex at national level.' },
    { source_id: 'SRC-MUN-SURVEY', publisher: 'Encuesta municipal (tecnicos capacitados)', kind: 'municipal_survey',
      caveat_es: 'Muestra de conveniencia en nodos de transito. No es representativa de la poblacion migrante.',
      caveat_en: 'Convenience sample at transit nodes. Not representative of the migrant population.' },
    { source_id: 'SRC-MUN-PERMISOS', publisher: 'Registros municipales de licencias y puestos', kind: 'admin_transfer',
      caveat_es: 'Licencias de funcionamiento, puestos de mercado y altas formales por municipio y mes (SEPREC, SUNAT, MTEPS, MTPE y gobiernos municipales).',
      caveat_en: 'Business licences, market stalls and formal hires by municipality and month (SEPREC, SUNAT, MTEPS, MTPE and municipal governments).' },
    { source_id: 'SRC-REF-CONTEXT', publisher: 'ACNUR, OIM DTM, PDI Chile, INEI, INE Bolivia', kind: 'published_aggregate',
      caveat_es: 'Indicadores de contexto publicados por las fuentes. Ver la vista Contexto y fuentes.',
      caveat_en: 'Context indicators published by the sources. See the Context and sources view.' }
  ]
};

/* --- escritura ------------------------------------------------------ */
const writeJs = (name, obj) => {
  const body = [
    '/* ATMDH / OAMT - generado por tools/make_demo_data.mjs. No editar a mano. */',
    'window.ATMDH = window.ATMDH || {};',
    `window.ATMDH.${name} = ${JSON.stringify(obj)};`
  ].join('\n');
  fs.writeFileSync(path.join(OUT, `${name}.js`), body);
  return Buffer.byteLength(body);
};

// --- paquete de referencia (dictionary/reference/*.csv) -------------
function parseCsv(file) {
  const txt = fs.readFileSync(path.join(ROOT, 'dictionary', 'reference', file), 'utf8').replace(/^\uFEFF/, '');
  const rows = []; let row = [], cell = '', q = false;
  for (let i = 0; i < txt.length; i++) {
    const c = txt[i];
    if (q) { if (c === '"') { if (txt[i + 1] === '"') { cell += '"'; i++; } else q = false; } else cell += c; }
    else if (c === '"') q = true;
    else if (c === ',') { row.push(cell); cell = ''; }
    else if (c === '\n' || c === '\r') { if (c === '\r' && txt[i + 1] === '\n') i++; row.push(cell); rows.push(row); row = []; cell = ''; }
    else cell += c;
  }
  if (cell || row.length) { row.push(cell); rows.push(row); }
  const [h, ...body] = rows.filter(r => r.length > 1);
  return body.map(r => Object.fromEntries(h.map((k, i) => [k, r[i] ?? ''])));
}
const reference = {
  events: parseCsv('events_calendar.csv').map(({ verification, ...e }) => e),
  minimum_wage: parseCsv('minimum_wage.csv'),
  admin_flows: parseCsv('admin_flows.csv'),
  context: parseCsv('context_indicators.csv'),
  sources: parseCsv('sources.csv')
};

let total = 0;
total += writeJs('reference', reference);
total += writeJs('manifest', manifest);
total += writeJs('geo', geo);
total += writeJs('cubes', cubes);
total += writeJs('forecast', forecast);
total += writeJs('scorecard', scorecard);
total += writeJs('coverage', coverage);

const sup = cubes.flow.filter(r => r.suppressed).length;
console.log(`[demo] ${events.length} eventos simulados en ${MUNIS.length} municipios / ${new Set(MUNIS.map(m=>m.node_id)).size} nodos, ${PERIODS.length} meses.`);
console.log(`[demo] Compuerta k=${K_ANON}: ${sup}/${cubes.flow.length} celdas municipio-mes suprimidas (${(100*sup/cubes.flow.length).toFixed(0)}%).`);
console.log(`[demo] Paquete L4: ${(total/1024).toFixed(0)} KB en 7 archivos -> ${OUT}`);
