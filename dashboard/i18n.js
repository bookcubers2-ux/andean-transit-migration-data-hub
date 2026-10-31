/* =====================================================================
   i18n.js  ·  ATMDH / OAMT
   Espaniol primario, ingles secundario. El idioma se guarda en
   localStorage y no depende de la red.

   Las claves de datos (mun_id, isic1, formality) viven en el
   diccionario y llegan en manifest.codelists. Aqui solo esta el texto
   de la interfaz.
   ===================================================================== */
window.I18N = {
  es: {
    title: 'Hub de Datos de Migracion de Transito Andina',
    subtitle: 'Corredor andino central · Bolivia y Peru · 14 nodos de transito',
    lang: 'EN',
    tabs: { corridor: 'Corredor', labour: 'Mercado laboral', time: 'Serie temporal', model: 'Modelo', context: 'Contexto y fuentes', method: 'Metodologia' },

    indicator: 'Indicador', year: 'Anio', municipality: 'Municipio', all_years: 'Todos los anios',
    ind_flow: 'Eventos registrados',
    ind_absorption: 'Absorcion a 60 dias',
    ind_border: 'Tipo de nodo',

    map_title: 'Corredor de transito',
    map_sub: 'Posiciones reales proyectadas. Sin teselas de mapa base: un municipio sin internet no puede pedirselas a nadie.',
    od_title: 'Flujos declarados entre nodos',
    od_sub: 'Reconstruidos a partir del municipio anterior y del municipio siguiente declarados en la entrevista. Ninguna persona es seguida de un nodo a otro.',
    node_detail: 'Detalle del nodo',
    select_node: 'Seleccione un nodo en el mapa.',
    border_post: 'Paso fronterizo', inland_node: 'Nodo interior',
    segment: 'Segmento', country: 'Pais', pop: 'Poblacion base',
    code_status: 'Codigo nacional', code_verified: 'verificado', code_needs_review: 'pendiente de verificacion',
    events_total: 'Eventos registrados (total)',
    suppressed_months: 'Meses suprimidos por k',

    hero_absorption: 'Absorcion a 60 dias',
    hero_absorption_note: 'Proporcion de personas en edad de trabajar que alcanzan un ingreso pagado dentro de los 60 dias de su llegada. Descriptivo historico, no pronostico.',
    tile_median_days: 'Mediana de dias al primer ingreso',
    tile_informal: 'Trabajo informal',
    tile_suppressed: 'Celdas suprimidas por k',
    tile_events: 'Eventos registrados',
    tile_nodes: 'Nodos del corredor',
    of_cells: 'de {n} celdas publicables',
    across_months: 'en {n} meses, {m} municipios',

    sector_title: 'Composicion sectorial',
    sector_sub: 'Seccion CIIU Rev.4. Un solo eje mas un filtro, porque con esta muestra una tabla de tres vias no sobrevive a k=10.',
    formality_title: 'Formalidad por municipio',
    formality_sub: 'Las celdas suprimidas aparecen rayadas, nunca en blanco ni en cero. Debe verse donde se acaban los datos.',
    days_title: 'Dias hasta el primer ingreso',
    days_sub: 'Distribucion por tramos. El corte de 60 dias es la definicion operativa de absorcion.',

    ts_title: 'Eventos registrados por mes',
    ts_sub: 'La linea gris es la referencia ingenua estacional. Todo modelo debe ganarle, y aqui se ve cuando no lo hace.',
    ts_small_title: 'Los 14 nodos, mismo eje temporal',
    ts_small_sub: 'Escala vertical libre en cada panel; el maximo va rotulado. Santa Cruz y Pisiga no comparten orden de magnitud.',
    series_actual: 'Registrado', series_naive: 'Referencia ingenua', series_forecast: 'Pronostico',

    model_title: 'Pronostico de flujo registrado',
    model_sub: 'Horizonte de 6 meses. Bandas del 80% y del 95%. Nunca se dibuja un punto sin su banda.',
    scorecard_title: 'Tarjeta de calibracion',
    scorecard_sub: 'Retrospectiva por origen movil. Los municipios donde el modelo falla se muestran fallando.',
    coverage_title: 'Cobertura estimada',
    coverage_sub: 'Estimacion de doble sistema donde el registro administrativo y la encuesta municipal se superponen. Donde no se superponen, la cobertura es desconocida y se dice.',
    coverage_unknown: 'Desconocida',
    epistemic_h: 'Lo que este pronostico NO es',
    epi_1: 'Los conteos son <b>eventos registrados</b>, nunca totales de poblacion. Solo se registra a quien interactua con el Estado.',
    epi_2: 'Un pico puede ser un operativo de control, no una oleada migratoria. Sin la covariable de intensidad de control, el modelo pronostica con toda confianza el calendario de la policia.',
    epi_3: 'Esta cosecha pronostica el <b>flujo registrado</b> por municipio y mes. La razon de absorcion a 60 dias se publica como descriptivo historico, junto a la serie de demanda laboral registrada.',
    epi_4: 'La muestra es administrativa y no representativa. La cobertura varia con la intensidad del control, no con el flujo.',
    epi_5: 'No hay pronostico a nivel de persona, en ninguna vista y en ningun nivel de privilegio. Los pronosticos existen solo por municipio y por mes.',
    mase: 'MASE', rmsse: 'RMSSE', cov80: 'Cobertura del 80%', level: 'Nivel medio',
    beats: 'Gana a la ingenua', is_naive: 'El modelo ES la ingenua en esta cosecha',
    cal_good: 'Calibrado', cal_warn: 'Sobreconfiado', cal_bad: 'Mal calibrado',

    method_title: 'Como leer este tablero',
    show_table: 'Ver los numeros en tabla',
    suppressed: 'Suprimido (n<{k})',
    no_data: 'Sin datos publicables',
    sources: 'Fuentes',
    vintage: 'Cosecha',
    footer_k: 'Umbral k = {k}. Redondeo controlado a base {b}. Maximo {a} ejes por celda publicada. Unidad temporal minima: mes. Unidad geografica minima: municipio.',
    footer_linkage: 'No existe clave de persona entre municipios. El movimiento del corredor se reconstruye a nivel agregado a partir del origen y el destino declarados.'
  },

  en: {
    title: 'Andean Transit Migration Data Hub',
    subtitle: 'Central Andean corridor · Bolivia and Peru · 14 transit nodes',
    lang: 'ES',
    tabs: { corridor: 'Corridor', labour: 'Labour market', time: 'Time series', model: 'Model', context: 'Context and sources', method: 'Methodology' },

    indicator: 'Indicator', year: 'Year', municipality: 'Municipality', all_years: 'All years',
    ind_flow: 'Recorded events',
    ind_absorption: '60-day absorption',
    ind_border: 'Node type',

    map_title: 'Transit corridor',
    map_sub: 'Real projected positions. No basemap tiles: a municipality without internet cannot ask anyone for them.',
    od_title: 'Declared flows between nodes',
    od_sub: 'Reconstructed from the previous and next municipality stated in the interview. No person is followed from one node to another.',
    node_detail: 'Node detail',
    select_node: 'Select a node on the map.',
    border_post: 'Border post', inland_node: 'Inland node',
    segment: 'Segment', country: 'Country', pop: 'Baseline population',
    code_status: 'National code', code_verified: 'verified', code_needs_review: 'pending verification',
    events_total: 'Recorded events (total)',
    suppressed_months: 'Months suppressed by k',

    hero_absorption: '60-day absorption',
    hero_absorption_note: 'Share of working-age people reaching paid work within 60 days of arrival. Historical descriptive, not a forecast.',
    tile_median_days: 'Median days to first income',
    tile_informal: 'Informal work',
    tile_suppressed: 'Cells suppressed by k',
    tile_events: 'Recorded events',
    tile_nodes: 'Corridor nodes',
    of_cells: 'of {n} publishable cells',
    across_months: 'across {n} months, {m} municipalities',

    sector_title: 'Sectoral composition',
    sector_sub: 'ISIC Rev.4 section. One axis plus one filter, because at this sample size a three-way table does not survive k=10.',
    formality_title: 'Formality by municipality',
    formality_sub: 'Suppressed cells are hatched, never blank and never zero. You must be able to see where the data stops.',
    days_title: 'Days to first income',
    days_sub: 'Banded distribution. The 60-day cut is the operational definition of absorption.',

    ts_title: 'Recorded events per month',
    ts_sub: 'The grey line is the seasonal-naive benchmark. Any model must beat it, and here you can see when it does not.',
    ts_small_title: 'The 14 nodes, shared time axis',
    ts_small_sub: 'Free vertical scale per panel; each maximum is labelled. Santa Cruz and Pisiga are not the same order of magnitude.',
    series_actual: 'Recorded', series_naive: 'Naive benchmark', series_forecast: 'Forecast',

    model_title: 'Recorded-flow forecast',
    model_sub: '6-month horizon. 80% and 95% bands. A point is never drawn without its band.',
    scorecard_title: 'Calibration scorecard',
    scorecard_sub: 'Rolling-origin backtest. Municipalities where the model fails are shown failing.',
    coverage_title: 'Estimated coverage',
    coverage_sub: 'Dual-system estimate where the administrative register and the municipal survey overlap. Where they do not, coverage is unknown and says so.',
    coverage_unknown: 'Unknown',
    epistemic_h: 'What this forecast is NOT',
    epi_1: 'Counts are <b>recorded events</b>, never population totals. Only those who interact with the state are recorded.',
    epi_2: 'A spike may be an enforcement operation, not a migration surge. Without the enforcement-intensity covariate, the model confidently forecasts the police schedule.',
    epi_3: 'This vintage forecasts <b>recorded flow</b> by municipality and month. The 60-day absorption ratio is published as a historical descriptive, alongside the recorded labour-demand series.',
    epi_4: 'The sample is administrative and non-representative. Coverage varies with enforcement intensity, not with flow.',
    epi_5: 'There is no person-level forecast, in any view and at any privilege level. Forecasts exist only by municipality and by month.',
    mase: 'MASE', rmsse: 'RMSSE', cov80: '80% coverage', level: 'Mean level',
    beats: 'Beats the naive', is_naive: 'The model IS the naive one in this vintage',
    cal_good: 'Calibrated', cal_warn: 'Overconfident', cal_bad: 'Poorly calibrated',

    method_title: 'How to read this dashboard',
    show_table: 'View the numbers as a table',
    suppressed: 'Suppressed (n<{k})',
    no_data: 'No publishable data',
    sources: 'Sources',
    vintage: 'Vintage',
    footer_k: 'Threshold k = {k}. Controlled rounding to base {b}. Maximum {a} axes per published cell. Minimum temporal unit: month. Minimum geographic unit: municipality.',
    footer_linkage: 'There is no cross-municipal person key. Corridor movement is reconstructed at the aggregate level from the declared origin and destination.'
  }
};
