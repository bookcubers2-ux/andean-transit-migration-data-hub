# =====================================================================
# 00_setup.R  ·  ATMDH / OAMT
# Carga el diccionario, define rutas y constantes. No toca datos.
# Loads the dictionary, defines paths and constants. Touches no data.
# =====================================================================

suppressPackageStartupMessages({
  library(yaml)
  library(readr)
  library(dplyr)
  library(tidyr)
  library(stringr)
  library(lubridate)
  library(purrr)
  library(digest)
  library(jsonlite)
})

# --- Rutas -----------------------------------------------------------
ROOT <- normalizePath(file.path(dirname(sys.frame(1)$ofile %||% "."), ".."), mustWork = FALSE)
if (!dir.exists(file.path(ROOT, "dictionary"))) ROOT <- getwd()

PATHS <- list(
  dictionary = file.path(ROOT, "dictionary"),
  crosswalks = file.path(ROOT, "dictionary", "crosswalks"),
  L0_raw     = file.path(ROOT, "data", "00_raw"),        # CONTENEDOR CIFRADO
  L1_staging = file.path(ROOT, "data", "01_staging"),    # CONTENEDOR CIFRADO
  L2_canon   = file.path(ROOT, "data", "02_canonical"),  # CONTENEDOR CIFRADO
  L3_cubes   = file.path(ROOT, "data", "03_cubes"),
  L4_release = file.path(ROOT, "dashboard", "data"),
  reports    = file.path(ROOT, "reports"),
  docs       = file.path(ROOT, "docs")
)
invisible(lapply(PATHS[c("L0_raw","L1_staging","L2_canon","L3_cubes","L4_release","reports")],
                 dir.create, recursive = TRUE, showWarnings = FALSE))

# --- Diccionario: fuente unica de verdad -----------------------------
DICT      <- yaml::read_yaml(file.path(PATHS$dictionary, "variables.yaml"))
CODELISTS <- yaml::read_yaml(file.path(PATHS$dictionary, "codelists.yaml"))
MUNIS     <- readr::read_csv(file.path(PATHS$crosswalks, "municipality_ids.csv"),
                             show_col_types = FALSE)
STATUS_XW <- readr::read_csv(file.path(PATHS$crosswalks, "status_ladder.csv"),
                             show_col_types = FALSE)
OCC_XW    <- dplyr::bind_rows(
  readr::read_csv(file.path(PATHS$crosswalks, "occupation_bo_isco.csv"), show_col_types = FALSE) |>
    dplyr::mutate(country_iso3 = "BOL"),
  readr::read_csv(file.path(PATHS$crosswalks, "occupation_pe_isco.csv"), show_col_types = FALSE) |>
    dplyr::mutate(country_iso3 = "PER")
)

# --- Parametros de divulgacion (leidos, NO codificados aqui) ---------
DISC <- DICT$disclosure
K_ANON      <- DISC$k_anonymity        # 10
ROUND_BASE  <- DISC$rounding_base      # 5
P_RULE      <- DISC$dominance_p_rule   # 0.60
MAX_AXES    <- DISC$max_axes           # 2
NEVER_PUB   <- DISC$never_publish

# --- Vintage ---------------------------------------------------------
# El vintage se pasa por argumento para que la corrida sea reproducible.
# Sin argumento usa la fecha del sistema, lo cual rompe la reproducibilidad
# byte a byte, y por eso avisa.
VINTAGE <- Sys.getenv("ATMDH_VINTAGE", unset = "")
if (!nzchar(VINTAGE)) {
  VINTAGE <- paste0(year(Sys.Date()), "Q", quarter(Sys.Date()))
  message("[setup] ATMDH_VINTAGE no definido. Usando ", VINTAGE,
          ". Para una corrida reproducible: Sys.setenv(ATMDH_VINTAGE='2026Q3')")
}
RELEASE_DATE <- Sys.getenv("ATMDH_RELEASE_DATE", unset = as.character(Sys.Date()))

`%||%` <- function(a, b) if (is.null(a)) b else a

# --- Sal de seudonimizacion, por municipio ---------------------------
# Vive FUERA del repositorio. Cada municipio custodia la suya.
# La ausencia de sal no es un error recuperable: sin ella no hay L2.
salt_path <- Sys.getenv("ATMDH_SALT_FILE", unset = file.path(ROOT, "..", ".atmdh_salts.csv"))
read_salts <- function() {
  if (!file.exists(salt_path)) {
    stop("[setup] No se encuentra el archivo de sales en ", salt_path,
         "\n  Genere uno con R/05_pseudonymize.R::init_salts() y guardelo FUERA del repositorio.")
  }
  readr::read_csv(salt_path, show_col_types = FALSE)
}

message("[setup] Diccionario v", DICT$meta$schema_version,
        " | k=", K_ANON, " | vintage ", VINTAGE,
        " | ", nrow(MUNIS), " municipios en ",
        length(unique(MUNIS$node_id)), " nodos del corredor")
