# ATMDH / OAMT
### Hub de Datos de Migración de Tránsito Andina · Andean Transit Migration Data Hub
Corredor andino central · Bolivia y Perú · 12 nodos de tránsito · 13 municipios

### ▶ Tablero en vivo: **https://bookcubers2-ux.github.io/andean-transit-migration-data-hub/**

> Los datos publicados en ese enlace son la **primera cosecha con registros reales**: 412 cuestionarios con consentimiento informado (versión v0.9-), recogidos por voluntarios del Hub entre marzo y septiembre de 2026 en Santa Cruz, Cochabamba, La Paz y El Alto. **Ningún dato personal de ninguna persona migrante está publicado en internet, ni lo estará:** el pipeline de R corre en una máquina local, los cuestionarios viven en `_ENTREGAS/` (excluida del repositorio), y lo único que cruza la frontera de exportación son celdas agregadas que pasaron la compuerta k=10. El 90% de las celdas municipio-mes están suprimidas: así de pequeña es la muestra, y así se dice.

---

## Ver el tablero ahora mismo

```bash
node tools/serve.mjs 8642         # -> http://localhost:8642  (release real ya incluido en dashboard/data)
node tools/make_demo_data.mjs     # SOLO para pruebas: sobrescribe el release con datos sinteticos
```

O simplemente abra `dashboard/index.html` con doble clic. Funciona igual, sin servidor y sin internet: los datos se cargan como `.js` (no `.json`) precisamente para que `file://` no los bloquee.

Si corre `make_demo_data.mjs`, el paquete queda marcado `data_is_synthetic: true` y hay que volver a correr `R/11_run_real.R` antes de publicar.

---

## La corrida real

```r
Sys.setenv(ATMDH_VINTAGE = "2026Q3", ATMDH_RELEASE_DATE = "2026-10-31",
           ATMDH_SURVEY_DIR = "_ENTREGAS/2026-11_registros_412")
source("R/11_run_real.R")   # encuesta -> L2 -> cubos -> compuerta -> dashboard/data
```

`run_all.R` sigue siendo la corrida completa con fuentes administrativas; `11_run_real.R` es la cosecha de solo encuesta.

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

## Identidad visual

El símbolo "El Cruce": doce celdas en rombo escalonado, una por nodo; el anillo ocre es Desaguadero y la celda hueca es la celda protegida (n<10). Paleta: Noche `#0B1626`, Hielo `#F3F0E8`, Lago `#0F6B78`, Ocre `#E3A02B`. Tipografía: Bahnschrift. Guía de uso: https://bookcubers2-ux.github.io/andean-transit-migration-data-hub/brand/ . Kit completo (SVG, PNG y PDF) en `brand/`; el generador está en `brand/build/` (`python -I build.py`).

## Datos de referencia (cosecha 2026Q3, actualizada 2026-10-24)

- **Códigos nacionales:** los 13 municipios están verificados contra el INE (Bolivia) y el UBIGEO del INEI (Perú).
- **Población base:** Censo 2024 de Bolivia y Censos Nacionales 2025 del Perú, con año y fuente por municipio.
- **`dictionary/reference/`:** contiene cinco archivos:
  - `events_calendar.csv`: calendario de control, cierres y cambios normativos (45 eventos).
  - `minimum_wage.csv`: salarios mínimos.
  - `admin_flows.csv`: flujo por puesto (INE e INEI).
  - `context_indicators.csv`: indicadores de ACNUR, OIM, PDI y Migraciones.
  - `sources.csv`: la lista de fuentes.
- El tablero los muestra en la vista **Contexto y fuentes**.
- **Base legal:** rige el régimen más estricto, la Ley 29733 del Perú con su reglamento DS 016-2024-JUS. En Bolivia rige el hábeas data constitucional (Art. 130) y el DS 28168 de acceso a la información.

---

Consejo Departamental de la Juventud de Santa Cruz (Ley Departamental N° 31).
