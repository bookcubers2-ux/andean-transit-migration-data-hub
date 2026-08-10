# =====================================================================
# 03_validate.R  ·  ATMDH / OAMT
# Valida L1 contra el diccionario. Tres niveles: E (rechaza), W (avisa),
# P (plausibilidad a nivel municipio-mes).
# Escribe reports/validation_<vintage>.html, bilingue, por municipio.
#
# Este archivo NO contiene ninguna regla. Las lee de variables.yaml.
# Agregar una regla es editar el YAML, no este archivo.
# =====================================================================

validate_table <- function(df, table_name, dict = DICT, lang = "es") {
  spec <- dict$tables[[table_name]]
  if (is.null(spec)) stop("Tabla no declarada en el diccionario: ", table_name)

  issues <- list()
  add <- function(tier, id, var, rows, msg) {
    if (length(rows) == 0) return(invisible(NULL))
    issues[[length(issues) + 1]] <<- tibble::tibble(
      tier = tier, rule_id = id, table = table_name, variable = var,
      n_rows = length(rows), row_ids = paste(utils::head(rows, 25), collapse = ","),
      message = msg
    )
  }

  for (v in spec$variables) {
    nm <- v$name
    if (isTRUE(v$generated)) next
    if (!nm %in% names(df)) {
      add("E", "E000", nm, 1L,
          sprintf("Falta la columna obligatoria '%s' en %s.", nm, table_name))
      next
    }
    x <- df[[nm]]

    # --- obligatoriedad
    if (isTRUE(v$required)) {
      bad <- which(is.na(x) | (is.character(x) & !nzchar(as.character(x))))
      add("E", "E-REQ", nm, bad, sprintf("'%s' es obligatorio y esta vacio.", nm))
    }
    # --- patron
    if (!is.null(v$pattern)) {
      bad <- which(!is.na(x) & !stringr::str_detect(as.character(x), v$pattern))
      add("E", "E-PAT", nm, bad, sprintf("'%s' no cumple el formato %s.", nm, v$pattern))
    }
    # --- rango numerico
    if (!is.null(v$min) && is.numeric(x)) {
      bad <- which(!is.na(x) & x < as.numeric(v$min))
      add("E", "E-MIN", nm, bad, sprintf("'%s' por debajo del minimo (%s).", nm, v$min))
    }
    if (!is.null(v$max) && is.numeric(x)) {
      bad <- which(!is.na(x) & x > as.numeric(v$max))
      add("E", "E-MAX", nm, bad, sprintf("'%s' por encima del maximo (%s).", nm, v$max))
    }
    # --- fechas
    if (identical(v$type, "date")) {
      d <- suppressWarnings(as.Date(x))
      add("E", "E-DATE", nm, which(is.na(d) & !is.na(x)),
          sprintf("'%s' no es una fecha valida (use AAAA-MM-DD).", nm))
      add("E", "E012", nm, which(!is.na(d) & d > as.Date(RELEASE_DATE)),
          sprintf("'%s' es una fecha futura. Corrija el dia de la entrevista.", nm))
      if (!is.null(v$min)) {
        add("E", "E013", nm, which(!is.na(d) & d < as.Date(v$min)),
            sprintf("'%s' fuera del periodo del proyecto (desde %s).", nm, v$min))
      }
    }
    # --- listas de codigos
    if (identical(v$type, "enum") && !is.null(v$codelist)) {
      allowed <- names(CODELISTS[[v$codelist]])
      bad <- which(!is.na(x) & !(as.character(x) %in% allowed))
      add("E", "E-ENUM", nm, bad,
          sprintf("'%s' fuera de la lista permitida. Valores validos: %s.",
                  nm, paste(allowed, collapse = ", ")))
    }
    # --- claves foraneas
    if (identical(v$type, "fk") && !is.null(v$references)) {
      ref <- strsplit(v$references, ".", fixed = TRUE)[[1]]
      keys <- switch(ref[1],
        dim_municipality = MUNIS$mun_id,
        dim_status       = as.character(STATUS_XW$status_rank),
        dim_occupation   = as.character(OCC_XW$occ_isco2),
        NULL)
      if (!is.null(keys)) {
        bad <- which(!is.na(x) & !(as.character(x) %in% as.character(keys)))
        add("E", "E-FK", nm, bad,
            sprintf("'%s' no existe en %s. Revise la lista de los 12 nodos.", nm, ref[1]))
      }
    }
    # --- avisos declarados en el YAML
    for (r in (v$rules %||% list())) {
      if (!identical(r$tier, "W")) next
      if (identical(r$test, "gt") && is.numeric(x)) {
        add("W", r$id, nm, which(!is.na(x) & x > as.numeric(r$threshold)), r[[paste0("msg_", lang)]])
      }
      if (identical(r$test, "rare_category")) {
        tab <- table(x); rare <- names(tab)[tab < as.numeric(r$threshold)]
        add("W", r$id, nm, which(as.character(x) %in% rare), r[[paste0("msg_", lang)]])
      }
      if (grepl("^value ==", r$test %||% "")) {
        target <- gsub(".*'(.*)'.*", "\\1", r$test)
        add("W", r$id, nm, which(as.character(x) == target), r[[paste0("msg_", lang)]])
      }
    }
  }
  if (length(issues) == 0) return(tibble::tibble())
  dplyr::bind_rows(issues)
}

# --- Plausibilidad, nivel municipio-mes ------------------------------
validate_plausibility <- function(events, lang = "es") {
  rules <- DICT$plausibility_rules
  msg <- function(id) {
    r <- Filter(function(z) identical(z$id, id), rules)[[1]]
    r[[paste0("msg_", lang)]]
  }
  panel <- events |>
    dplyr::count(mun_id, obs_period, name = "n") |>
    dplyr::arrange(mun_id, obs_period) |>
    dplyr::group_by(mun_id) |>
    dplyr::mutate(
      prev = dplyr::lag(n),
      P001 = !is.na(prev) & prev > 0 & abs(log(n / prev)) > log(3),
      nonzero_run = cumsum(dplyr::lag(n, default = 0) > 0),
      P002 = n == 0 & nonzero_run >= 3
    ) |>
    dplyr::ungroup()

  sex <- events |>
    dplyr::group_by(mun_id, obs_period) |>
    dplyr::summarise(share_f = mean(sex == "F", na.rm = TRUE), n = dplyr::n(), .groups = "drop") |>
    dplyr::mutate(P003 = n >= 20 & (share_f < 0.2 | share_f > 0.8))

  dplyr::bind_rows(
    panel |> dplyr::filter(P001) |> dplyr::transmute(tier = "P", rule_id = "P001", mun_id, obs_period, message = msg("P001")),
    panel |> dplyr::filter(P002) |> dplyr::transmute(tier = "P", rule_id = "P002", mun_id, obs_period, message = msg("P002")),
    sex   |> dplyr::filter(P003) |> dplyr::transmute(tier = "P", rule_id = "P003", mun_id, obs_period, message = msg("P003"))
  )
}

# --- Reporte por municipio, bilingue ---------------------------------
write_validation_report <- function(issues, plaus, path = NULL) {
  path <- path %||% file.path(PATHS$reports, sprintf("validation_%s.html", VINTAGE))
  by_mun <- dplyr::count(plaus, mun_id, name = "n_plaus")
  n_err  <- sum(issues$tier == "E"); n_warn <- sum(issues$tier == "W")
  html <- c(
    "<!doctype html><meta charset='utf-8'><title>ATMDH validacion</title>",
    "<style>body{font:14px system-ui;margin:2rem;max-width:60rem}
     table{border-collapse:collapse;width:100%}td,th{border-bottom:1px solid #e1e0d9;padding:.4rem;text-align:left}
     .E{color:#d03b3b;font-weight:600}.W{color:#b07600}.P{color:#2a78d6}</style>",
    sprintf("<h1>Validacion %s</h1><p><b>%d errores</b> (registros rechazados) · %d avisos · %d alertas de plausibilidad.</p>",
            VINTAGE, n_err, n_warn, nrow(plaus)),
    "<p>Cada error trae el numero de fila. Corrija en el formulario y vuelva a enviar. / Each error carries its row number.</p>",
    "<table><tr><th>Nivel</th><th>Regla</th><th>Variable</th><th>Filas</th><th>Mensaje</th></tr>",
    if (nrow(issues)) sprintf("<tr><td class='%s'>%s</td><td>%s</td><td>%s</td><td>%s</td><td>%s</td></tr>",
                              issues$tier, issues$tier, issues$rule_id, issues$variable,
                              issues$row_ids, issues$message) else "",
    "</table>"
  )
  writeLines(html, path)
  message("[validate] ", n_err, " errores / ", n_warn, " avisos / ", nrow(plaus),
          " plausibilidad -> ", path)
  invisible(path)
}
