# ATMDH / OAMT
### Hub de Datos de Migración de Tránsito Andina · Andean Transit Migration Data Hub
Corredor andino central · Bolivia y Perú · 12 nodos de tránsito · 13 municipios

### ▶ Tablero en vivo: **https://bookcubers2-ux.github.io/andean-transit-migration-data-hub/**

> Los datos publicados en ese enlace son **sintéticos**, generados para poder mostrar el sistema completo antes de cargar los datos reales. El tablero lo declara en una franja permanente. **Ningún dato personal de ninguna persona migrante está publicado en internet, ni lo estará:** el pipeline de R corre en una máquina local, las capas L0 a L2 están excluidas del repositorio por `.gitignore`, y lo único que cruza la frontera de exportación son celdas agregadas que pasaron la compuerta k=10.

---

## Ver el tablero ahora mismo

```bash
node tools/make_demo_data.mjs     # genera un release L4 SINTÉTICO
node tools/serve.mjs 8642         # -> http://localhost:8642
```

O simplemente abra `dashboard/index.html` con doble clic. Funciona igual, sin servidor y sin internet: los datos se cargan como `.js` (no `.json`) precisamente para que `file://` no los bloquee.

Todo lo que produce `make_demo_data.mjs` queda marcado `data_is_synthetic: true` y el tablero lo anuncia en una franja permanente. **Ninguna cifra de la demostración viene de una persona real.**

---

## La corrida real

```r
Sys.setenv(ATMDH_VINTAGE = "2026Q3", ATMDH_RELEASE_DATE = "2026-09-30")
source("run_all.R")
```

En Windows: doble clic en `make.bat`.

Paquetes: `yaml readr dplyr tidyr stringr lubridate purrr digest jsonlite testthat`; opcionales `glmmTMB` (modelo principal), `writexl readxl` (formularios), `sf rmapshaper` (geometría real cuando lleguen los shapefiles).

---

## Arquitectura en una pantalla

```
FUENTES              PIPELINE EN R (una máquina)              PUBLICACIÓN
Raspados admin ──┐   L0 crudo (cifrado, se purga a 30 días)
Encuesta municipal├─▶ L1 staging (tipado + linaje)
Formulario papel  │   L2 canónico (SEUDÓNIMO)          ══ LA COMPUERTA ══
(XLSForm/xlsx)  ──┘   L3 cubos (agregados)          ──▶ L4 release (.js)
                      L3m salidas del modelo                    │
                                                                ▼
                                                   dashboard/  ·  sin servidor,
                                                   sin instalación, sin build
```

### Las tres decisiones que sostienen todo lo demás

1. **`dictionary/variables.yaml` es la fuente única de verdad.** Genera las reglas de validación de R, el XLSForm y la plantilla `.xlsx`, las etiquetas bilingües del tablero y el codebook impreso. Agregar una variable es editar el YAML, nunca el código.
2. **La anonimización se ejecuta en la frontera de exportación, no en la interfaz.** El tablero no puede filtrar microdatos porque nunca los recibe. `R/07_disclosure_control.R` es el único camino de L3 a L4, y `tests/testthat/test-disclosure.R` bloquea el build si una sola celda incumple.
3. **No existe clave de persona entre municipios.** La sal es por municipio. El movimiento del corredor se reconstruye a nivel agregado con el origen y el destino declarados. Se pierde precisión analítica; se gana una herramienta que no puede usarse contra las personas que cuenta.

---

## Parámetros de divulgación vigentes

| | |
|---|---|
| Build | uno solo, público |
| k | **10** en todas partes |
| Redondeo | base 5 |
| Regla de dominancia | supresión si un empleador concentra > 60% de la celda |
| Ejes máximos por celda | **2** (con ~28 registros por municipio-mes, una tabla de tres vías no sobrevive a k=10) |
| Unidad temporal mínima | mes |
| Unidad geográfica mínima | municipio |
| Supresión complementaria | sí, contra recuperación por márgenes |
| Consistencia entre cosechas | sí, contra ataque por diferencia |

---

## Estructura

```
dictionary/     variables.yaml, codelists.yaml, crosswalks/
R/              00_setup … 10_geo, run_all.R
tests/testthat/ test-disclosure.R   <- bloquea el release
dashboard/      index.html, styles.css, i18n.js, charts.js, app.js, data/
tools/          make_demo_data.mjs, serve.mjs, smoke.mjs
docs/           GUIA_TECNICO.md, model_card.md
```

## Pruebas

```bash
node tools/smoke.mjs      # monta un DOM mínimo, recorre las 5 vistas en ES y EN,
                          # y verifica k, redondeo y bandas de incertidumbre
```

En R, `testthat::test_dir("tests/testthat")` corre la compuerta contra el release escrito.

---

## Pendientes conocidos (declarados, no escondidos)

1. **Códigos nacionales sin verificar.** Siete de los trece municipios llevan `code_status = needs_review` en `dictionary/crosswalks/municipality_ids.csv`. Deben confirmarse contra el catálogo del INE (Bolivia) y el UBIGEO del INEI (Perú) antes de la primera corrida en producción. El tablero muestra ese estado en el panel de detalle del nodo.
2. **Geometría esquemática.** Las capas de frontera y el lago Titicaca son polilíneas de referencia. Las posiciones de los nodos sí son coordenadas reales proyectadas. Reemplazar por los límites oficiales con `sf` + `rmapshaper::ms_simplify(keep = 0.02)`; el resto del sistema no cambia.
3. **Serie de demanda laboral ausente.** Cuatro nodos no la entregan, por lo que la cosecha 2026Q3 pronostica **solo flujo**. Ver `docs/model_card.md`.
4. **Base legal.** El diseño asume que rige el régimen más estricto de los dos, la Ley 29733 del Perú (Bolivia se apoya en el hábeas data constitucional, Art. 130, sin ley integral). La versión vigente del reglamento debe citarla la asesoría jurídica en el protocolo, no este README.

---

Consejo Departamental de la Juventud de Santa Cruz (Ley Departamental N° 31).
