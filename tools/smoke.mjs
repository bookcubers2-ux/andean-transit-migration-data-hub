/* =====================================================================
   smoke.mjs  ·  ATMDH / OAMT
   Prueba de humo del tablero SIN navegador.

   Monta un DOM minimo, carga los mismos archivos que carga index.html en
   el mismo orden, y recorre las cinco vistas en los dos idiomas. Sirve
   para que un cambio en app.js no llegue roto a una oficina municipal
   donde nadie puede abrir la consola del navegador.

       node tools/smoke.mjs
   ===================================================================== */
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const DASH = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'dashboard');

/* ---------- DOM minimo ---------- */
let nodes = [];
function makeNode(tag, ns) {
  const n = {
    tagName: String(tag).toUpperCase(), _ns: ns || null,
    children: [], attrs: {}, style: {}, dataset: {},
    _text: '', _html: '', hidden: false, className: '',
    appendChild(c) { this.children.push(c); c.parentNode = this; return c; },
    removeChild(c) { this.children = this.children.filter(x => x !== c); },
    setAttribute(k, v) {
      this.attrs[k] = String(v);
      if (k.startsWith('data-')) this.dataset[k.slice(5).replace(/-(\w)/g, (_, c) => c.toUpperCase())] = String(v);
      if (k === 'class') this.className = String(v);
    },
    getAttribute(k) { return this.attrs[k] ?? null; },
    removeAttribute(k) { delete this.attrs[k]; },
    addEventListener(t, fn) { (this._ev ||= {})[t] = fn; },
    getBoundingClientRect() { return { left: 0, top: 0, width: 900, height: 400 }; },
    querySelector(s) { return query(s, this); },
    querySelectorAll(s) { return queryAll(s, this); },
    get textContent() { return this._text; }, set textContent(v) { this._text = String(v); },
    get innerHTML() { return this._html; }, set innerHTML(v) { this._html = String(v); if (v === '') this.children = []; },
    classList: { add() {}, remove() {}, contains() { return false; } }
  };
  nodes.push(n);
  return n;
}
function allNodes(root) {
  const out = [];
  (function walk(n) { out.push(n); n.children.forEach(walk); })(root);
  return out;
}
function matches(n, sel) {
  sel = sel.trim();
  const attr = sel.match(/^([.#\w]+)?\[([\w-]+)="([^"]+)"\]$/);
  if (attr) {
    const base = attr[1] || '';
    if (base && !matches(n, base)) return false;
    return n.getAttribute(attr[2]) === attr[3];
  }
  if (sel.startsWith('#')) return n.attrs.id === sel.slice(1);
  if (sel.startsWith('.')) return (n.className || '').split(/\s+/).includes(sel.slice(1));
  return n.tagName === sel.toUpperCase();
}
let ROOT;
const query = (s, r) => allNodes(r || ROOT).find(n => matches(n, s)) || null;
const queryAll = (s, r) => allNodes(r || ROOT).filter(n => matches(n, s));

ROOT = makeNode('body');
ROOT.attrs.id = 'body';
const documentElement = makeNode('html');
documentElement.lang = 'es';

/* elementos que define index.html */
const seed = (tag, attrs) => { const n = makeNode(tag); for (const k in attrs) n.setAttribute(k, attrs[k]); ROOT.appendChild(n); return n; };
['t-title','t-sub','lang','vintage','kchip','perf','synthetic','theme','foot-k','foot-linkage','foot-scope']
  .forEach(id => seed('div', { id }));
['corridor','labour','time','model','method'].forEach(t => {
  seed('button', { class: 'tab', 'data-tab': t });
  seed('section', { class: 'view', 'data-view': t });
});

const document_ = {
  documentElement,
  createElement: t => makeNode(t),
  createElementNS: (ns, t) => makeNode(t, ns),
  createTextNode: t => makeNode('#text'),
  querySelector: s => query(s),
  querySelectorAll: s => queryAll(s),
  body: ROOT
};

const store = {};
const ctx = {
  window: {}, document: document_,
  localStorage: { getItem: k => store[k] ?? null, setItem: (k, v) => { store[k] = String(v); } },
  performance: { now: () => 0 },
  getComputedStyle: () => ({ getPropertyValue: () => '#2a78d6' }),
  console, Math, JSON, Date, Number, String, Array, Object, Map, Set, Boolean, isNaN, parseInt, parseFloat,
  Intl
};
ctx.window = ctx;
ctx.globalThis = ctx;
vm.createContext(ctx);

const load = f => {
  try { vm.runInContext(fs.readFileSync(path.join(DASH, f), 'utf8'), ctx, { filename: f }); }
  catch (e) { console.error(`FALLO al cargar ${f}:\n  ${e.message}`); process.exit(1); }
};

['data/manifest.js','data/geo.js','data/cubes.js','data/forecast.js','data/scorecard.js',
 'data/coverage.js','i18n.js','charts.js'].forEach(load);

/* app.js se ejecuta solo al cargar; se captura su render inicial */
load('app.js');

/* ---------- recorrido de vistas y de idiomas ---------- */
let fails = 0;
const tabs = queryAll('.tab');
for (const lang of ['es', 'en']) {
  // conmutar idioma por el manejador real del boton
  if (lang === 'en') query('#lang')._ev.click();
  for (const b of tabs) {
    nodes = [];                       // no acumular entre vistas
    try {
      b._ev.click();
      const view = query(`.view[data-view="${b.dataset.tab}"]`);
      const painted = allNodes(view).length;
      if (painted < 5) { console.error(`VACIA: ${lang}/${b.dataset.tab} (${painted} nodos)`); fails++; }
      else console.log(`  ok  ${lang} · ${b.dataset.tab.padEnd(9)} ${painted} nodos`);
    } catch (e) {
      console.error(`ERROR ${lang}/${b.dataset.tab}: ${e.message}\n${e.stack.split('\n')[1]}`);
      fails++;
    }
  }
}

/* ---------- invariantes de la compuerta, del lado del tablero ---------- */
const M = ctx.window.ATMDH.manifest, C = ctx.window.ATMDH.cubes;
const K = M.k_anonymity;
let bad = 0;
for (const [name, cube] of Object.entries(C)) {
  if (!Array.isArray(cube)) continue;
  for (const r of cube) {
    if (r.n !== null && r.n !== undefined && r.n > 0 && r.n < K) {
      console.error(`COMPUERTA: ${name} publica n=${r.n} por debajo de k=${K}`); bad++;
    }
    if (r.n !== null && r.n !== undefined && r.n % M.rounding_base !== 0) {
      console.error(`REDONDEO: ${name} publica n=${r.n}, no multiplo de ${M.rounding_base}`); bad++;
    }
  }
}
for (const f of ctx.window.ATMDH.forecast) {
  if (![f.lo95, f.lo80, f.point, f.hi80, f.hi95].every(v => typeof v === 'number')) {
    console.error('MODELO: pronostico sin banda completa'); bad++;
  }
  if (!(f.lo95 <= f.lo80 && f.lo80 <= f.hi80 && f.hi80 <= f.hi95)) {
    console.error(`MODELO: bandas desordenadas en ${f.mun_id} paso ${f.step}`); bad++;
  }
}
console.log(bad === 0 ? '  ok  compuerta k, redondeo y bandas de incertidumbre'
                      : `  ${bad} violaciones de invariantes`);

process.exit(fails + bad === 0 ? 0 : 1);
