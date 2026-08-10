# =====================================================================
# 02_ingest_survey.R  ·  ATMDH / OAMT
# L0 -> L1 para la encuesta municipal aplicada por tecnicos.
#
# Tres vias de captura, TODAS generadas desde dictionary/variables.yaml
# y todas con el MISMO orden de campos, para que un tecnico pueda pasar
# de una a otra sin volver a capacitarse:
#   1. XLSForm en ODK Collect o KoBoToolbox (cola offline, sincroniza sola)
#   2. plantilla .xlsx bloqueada con desplegables (oficina con solo PC)
#   3. formulario en papel (jornada de campo sin dispositivo)
# =====================================================================

ingest_all_survey <- function(dir = PATHS$L0_raw) {
  files <- list.files(dir, pattern = "^SURVEY__.*\\.(csv|xlsx)$", full.names = TRUE)
  if (!length(files)) return(tibble::tibble())
  purrr::map_dfr(files, read_survey_file)
}

read_survey_file <- function(file) {
  df <- if (grepl("\\.xlsx$", file)) {
    if (!requireNamespace("readxl", quietly = TRUE)) stop("Instale readxl para leer .xlsx")
    readxl::read_excel(file, col_types = "text")
  } else {
    readr::read_csv(file, col_types = readr::cols(.default = "c"), show_col_types = FALSE)
  }

  # Sin consentimiento no hay registro. No se negocia y no se recupera.
  if (!"consent_version" %in% names(df)) {
    stop("[ingest] ", basename(file), " no trae la columna consent_version. ",
         "Un cuestionario sin consentimiento registrado no entra al sistema.")
  }
  n_before <- nrow(df)
  df <- df[!is.na(df$consent_version) & nzchar(df$consent_version), ]
  if (nrow(df) < n_before) {
    message("[ingest] ", n_before - nrow(df), " cuestionarios sin consentimiento, descartados en ",
            basename(file), ". Quedan listados en el reporte de validacion.")
  }

  df$source_id <- "SRC-MUN-SURVEY"
  df$source_kind <- "municipal_survey"
  df$ingested_from <- basename(file)
  df
}

# --- Generacion del XLSForm desde el diccionario ---------------------
# El formulario nunca se escribe a mano. Se genera. Asi la etiqueta que
# ve el tecnico y la regla que corre en R no pueden separarse.
generate_xlsform <- function(table_name = "fact_survey_response",
                             out = file.path(ROOT, "forms", "atmdh_survey.xlsx")) {
  if (!requireNamespace("writexl", quietly = TRUE)) stop("Instale writexl")
  dir.create(dirname(out), showWarnings = FALSE, recursive = TRUE)
  spec <- DICT$tables[[table_name]]

  survey <- purrr::map_dfr(spec$variables, function(v) {
    if (isTRUE(v$generated)) return(NULL)
    type <- switch(v$type,
      date = "date", integer = "integer", numeric = "decimal", logical = "select_one yes_no",
      enum = paste("select_one", v$codelist), "text")
    tibble::tibble(
      type = type, name = v$name,
      `label::Spanish (es)` = v$label_es %||% v$name,
      `label::English (en)` = v$label_en %||% v$name,
      required = if (isTRUE(v$required)) "yes" else "",
      constraint = if (!is.null(v$min) && v$type %in% c("integer","numeric"))
        sprintf(". >= %s and . <= %s", v$min, v$max %||% 1e9) else "",
      `constraint_message::Spanish (es)` =
        if (!is.null(v$rules)) v$rules[[1]][["msg_es"]] %||% "" else ""
    )
  })

  choices <- purrr::map_dfr(names(CODELISTS), function(cl) {
    purrr::imap_dfr(CODELISTS[[cl]], function(lab, code) {
      tibble::tibble(list_name = cl, name = as.character(code),
                     `label::Spanish (es)` = lab$es %||% as.character(lab),
                     `label::English (en)` = lab$en %||% as.character(lab))
    })
  })

  settings <- tibble::tibble(form_title = "ATMDH / OAMT", form_id = "atmdh_survey",
                             version = DICT$meta$schema_version, default_language = "Spanish (es)")

  writexl::write_xlsx(list(survey = survey, choices = choices, settings = settings), out)
  message("[forms] XLSForm generado en ", out,
          " (", nrow(survey), " campos, ", nrow(choices), " opciones).")
  invisible(out)
}
