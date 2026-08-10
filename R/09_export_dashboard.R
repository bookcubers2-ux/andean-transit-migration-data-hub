# =====================================================================
# 09_export_dashboard.R  ·  ATMDH / OAMT
# L3 -> L4. La UNICA salida del sistema hacia el mundo.
#
# Se exporta a .js, no a .json, y esa decision es la que hace que el
# tablero funcione de verdad desde una carpeta o un USB: bajo file://
# Chrome y Edge bloquean fetch() de un .json local, pero <script src>
# siempre carga. Un archivo .js que asigna a window.ATMDH no necesita
# servidor, ni internet, ni permisos.
# =====================================================================

js_escape <- function(x) gsub("</", "<\\/", x, fixed = TRUE)

write_js <- function(obj, name, file) {
  json <- jsonlite::toJSON(obj, dataframe = "rows", na = "null", auto_unbox = TRUE, digits = 4)
  txt <- c(
    "/* ATMDH / OAMT - generado por R/09_export_dashboard.R. No editar a mano. */",
    "window.ATMDH = window.ATMDH || {};",
    sprintf("window.ATMDH.%s = %s;", name, js_escape(json))
  )
  writeLines(txt, file.path(PATHS$L4_release, file), useBytes = TRUE)
  invisible(file)
}

export_release <- function(cubes, forecast, scorecard, coverage, geo) {

  # --- La compuerta se verifica aqui, otra vez, antes de escribir -----
  for (nm in names(cubes)) {
    if ("n" %in% names(cubes[[nm]])) assert_publishable(cubes[[nm]], "n")
  }
  assert_intervals_present(forecast)

  manifest <- list(
    schema_version = DICT$meta$schema_version,
    vintage        = VINTAGE,
    release_date   = RELEASE_DATE,
    build          = "public",
    k_anonymity    = K_ANON,
    rounding_base  = ROUND_BASE,
    max_axes       = MAX_AXES,
    min_period     = "month",
    min_geography  = "municipality",
    measure_label  = list(es = "eventos registrados", en = "recorded events"),
    data_is_synthetic = FALSE,
    forecast_scope = list(
      es = "Solo flujo registrado. La capacidad de absorcion NO se pronostica en esta cosecha porque la serie de demanda laboral aun no existe para los doce nodos.",
      en = "Recorded flow only. Absorption capacity is NOT forecast in this vintage because the labour demand series does not yet exist for the twelve nodes."),
    municipalities = MUNIS |> dplyr::select(mun_id, node_id, mun_name_short, mun_name,
                                            country_iso3, adm1_name, corridor_segment,
                                            is_border_post, code_status, lat, lon),
    codelists = CODELISTS[c("corridor_segment","isic1","formality","age_band",
                            "status_ladder","enforcement_context","crosswalk_confidence")],
    sources = lapply(names(SOURCE_PROFILES), function(s) {
      p <- SOURCE_PROFILES[[s]]
      list(source_id = s, publisher = p$publisher, kind = p$kind,
           caveat_es = p$caveat_es, caveat_en = p$caveat_en)
    })
  )

  write_js(manifest,  "manifest",  "manifest.js")
  write_js(geo,       "geo",       "geo.js")
  write_js(cubes,     "cubes",     "cubes.js")
  write_js(forecast,  "forecast",  "forecast.js")
  write_js(scorecard, "scorecard", "scorecard.js")
  write_js(coverage,  "coverage",  "coverage.js")

  sizes <- vapply(list.files(PATHS$L4_release, full.names = TRUE), file.size, numeric(1))
  message(sprintf("[export] Release %s escrito en %s. %d archivos, %.0f KB en total.",
                  VINTAGE, PATHS$L4_release, length(sizes), sum(sizes) / 1024))
  if (sum(sizes) / 1024 > 900) {
    warning("[export] El paquete supera 900 KB. Objetivo: por debajo de 600 KB para hardware debil.")
  }
  invisible(PATHS$L4_release)
}
