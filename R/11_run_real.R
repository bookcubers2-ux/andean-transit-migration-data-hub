# =====================================================================
# 11_run_real.R  ·  ATMDH / OAMT
# Primera cosecha con registros reales de la encuesta municipal.
# De _ENTREGAS/<carpeta>/SURVEY__*.csv al release L4, pasando por la
# compuerta de 07_disclosure_control.R. Los microdatos no salen de aqui.
#
#   Sys.setenv(ATMDH_VINTAGE = "2026Q3", ATMDH_RELEASE_DATE = "2026-10-31",
#              ATMDH_SURVEY_DIR = "_ENTREGAS/2026-11_registros_412")
#   source("R/11_run_real.R")
# =====================================================================

source("R/00_setup.R")
source("R/04_standardize.R")
source("R/06_aggregate.R")
source("R/07_disclosure_control.R")
source("R/08_model.R")
source("R/09_export_dashboard.R")
source("R/10_geo.R")

SURVEY_DIR <- Sys.getenv("ATMDH_SURVEY_DIR", unset = file.path(ROOT, "_ENTREGAS", "2026-11_registros_412"))
CONSENT_DEFAULT <- Sys.getenv("ATMDH_CONSENT_VERSION", unset = "v0.9-")

# --- 1. Ingesta de la encuesta ----------------------------------------
files <- list.files(SURVEY_DIR, pattern = "^SURVEY__.*\\.csv$", full.names = TRUE)
if (!length(files)) stop("[real] Sin archivos SURVEY__*.csv en ", SURVEY_DIR)
raw <- purrr::map_dfr(files, function(f) {
  d <- readr::read_csv(f, col_types = readr::cols(.default = "c"), show_col_types = FALSE,
                       locale = readr::locale(encoding = "UTF-8"))
  d$ingested_from <- basename(f); d
})
message("[real] ", nrow(raw), " cuestionarios leidos de ", length(files), " archivo(s)")

# fechas de Excel (dd/mm/aaaa) a ISO
to_iso <- function(x) {
  x <- trimws(x)
  dmy <- grepl("^\\d{2}/\\d{2}/\\d{4}$", x)
  x[dmy] <- format(as.Date(x[dmy], format = "%d/%m/%Y"), "%Y-%m-%d")
  x
}
raw$obs_date <- to_iso(raw$obs_date)
if (!"consent_version" %in% names(raw)) raw$consent_version <- NA_character_
raw$consent_version[is.na(raw$consent_version) | !nzchar(raw$consent_version)] <- CONSENT_DEFAULT
raw$source_id <- "SRC-MUN-SURVEY"; raw$source_kind <- "municipal_survey"

# --- 2. Validacion minima (E) -----------------------------------------
E <- character(0)
chk <- function(cond, msg) if (any(cond)) E <<- c(E, sprintf("%s: %d filas", msg, sum(cond)))
chk(!raw$mun_id %in% MUNIS$mun_id, "municipio desconocido")
chk(is.na(as.Date(raw$obs_date)) | as.Date(raw$obs_date) > as.Date(RELEASE_DATE), "fecha invalida o futura")
chk(!raw$consent_mode %in% names(CODELISTS$consent_mode), "consent_mode fuera de lista")
chk(!raw$age_band %in% names(CODELISTS$age_band), "age_band fuera de lista")
chk(!raw$sex %in% names(CODELISTS$sex), "sex fuera de lista")
chk(!raw$enforcement_context %in% names(CODELISTS$enforcement_context), "enforcement_context fuera de lista")
chk(!grepl("^((BO|PE)-[0-9]{6}|EXT-[A-Z]{3}|UNK)$", raw$origin_mun_id), "origin_mun_id mal formado")
chk(!grepl("^((BO|PE)-[0-9]{6}|EXT-[A-Z]{3}|UNK)$", raw$intended_dest_id), "intended_dest_id mal formado")
if (length(E)) stop("[real] Validacion con errores:\n  ", paste(E, collapse = "\n  "))
message("[real] Validacion E: 0 errores en ", nrow(raw), " filas")

# --- 3. Promocion a L2: sin documento, clave aleatoria por registro ----
l2 <- raw |>
  dplyr::mutate(
    episode_key = vapply(seq_len(dplyr::n()), function(i)
      substr(digest::digest(c(Sys.time(), i, runif(1)), algo = "sha256"), 1, 16), character(1)),
    obs_period = to_period(obs_date),
    status_rank = suppressWarnings(as.integer(status_rank)),
    days_to_first_income = suppressWarnings(as.integer(days_to_first_income)),
    absorbed_60d = !is.na(days_to_first_income) & days_to_first_income <= 60,
    has_labour = !is.na(days_to_first_income) | (!is.na(formality) & nzchar(formality)),
    employer_hash = NA_character_)
l2 <- l2[, setdiff(names(l2), c("interviewer_id", "occ_verbatim")), drop = FALSE]
dir.create(PATHS$L2_canon, recursive = TRUE, showWarnings = FALSE)
saveRDS(l2, file.path(PATHS$L2_canon, "fact_transit_event.rds"))

l2$country_iso3 <- "BOL"
occ <- suppressWarnings(standardise_occupation(l2$occ_local_code, l2$country_iso3))
l2$occ_isco2 <- occ$occ_isco2
l2$crosswalk_confidence <- ifelse(is.na(l2$occ_local_code) | !nzchar(l2$occ_local_code), NA, occ$crosswalk_confidence)
spells <- l2 |> dplyr::filter(has_labour) |>
  dplyr::mutate(crosswalk_confidence = ifelse(is.na(crosswalk_confidence), "exact", crosswalk_confidence),
                isic1 = ifelse(is.na(isic1) | !nzchar(isic1), "OTH", isic1),
                formality = ifelse(is.na(formality) | !nzchar(formality), "none", formality))
saveRDS(spells, file.path(PATHS$L2_canon, "fact_labour_spell.rds"))
message("[real] L2: ", nrow(l2), " eventos, ", nrow(spells), " episodios laborales")

# --- 4. Cubos -----------------------------------------------------------
PERIODS <- {
  rng <- range(as.Date(l2$obs_date)); m <- seq(as.Date(format(rng[1], "%Y-%m-01")), rng[2], by = "month")
  format(m, "%Y-M%m")
}
flow_raw <- l2 |> dplyr::count(mun_id, obs_period, name = "n") |>
  tidyr::complete(mun_id = MUNIS$mun_id, obs_period = PERIODS, fill = list(n = 0L)) |>
  dplyr::arrange(mun_id, obs_period)
od_raw <- build_cube_od(l2)
sector_raw <- spells |> dplyr::count(mun_id, isic1, name = "n") |>
  dplyr::left_join(spells |> dplyr::group_by(mun_id, isic1) |>
    dplyr::summarise(top_employer_share = NA_real_,
                     contested_share = mean(crosswalk_confidence == "contested"), .groups = "drop"),
    by = c("mun_id", "isic1"))
formality_raw <- build_cube_formality(spells)
absorption_raw <- build_cube_absorption(spells) |> dplyr::mutate(rate = round(rate, 3))
demog_raw <- build_cube_demog(l2)
status_raw <- l2 |> dplyr::filter(!is.na(status_rank)) |> dplyr::count(mun_id, status_rank, name = "n")
days_raw <- spells |> dplyr::filter(!is.na(days_to_first_income)) |>
  dplyr::mutate(days_band = dplyr::case_when(days_to_first_income <= 30 ~ "000_030",
    days_to_first_income <= 60 ~ "031_060", days_to_first_income <= 120 ~ "061_120",
    days_to_first_income <= 240 ~ "121_240", TRUE ~ "241_up")) |>
  dplyr::count(mun_id, days_band, name = "n")

# --- 5. LA COMPUERTA -----------------------------------------------------
cubes <- list(
  flow       = publish(flow_raw,       c("mun_id","obs_period"), c("mun_id","obs_period")),
  od         = publish(od_raw,         c("origin_mun_id","intended_dest_id"), c("origin_mun_id","intended_dest_id","yr")),
  sector     = publish(sector_raw,     c("mun_id","isic1"), c("mun_id","isic1"),
                       value_cols = c("top_employer_share","contested_share"), complementary_over = "mun_id"),
  formality  = publish(formality_raw,  c("mun_id","formality"), c("mun_id","formality"), complementary_over = "mun_id"),
  absorption = publish(absorption_raw, c("mun_id","obs_period"), c("mun_id","obs_period"),
                       value_cols = c("rate","median_days","absorbed")),
  demog      = publish(demog_raw,      c("mun_id","age_band"), c("mun_id","age_band"), complementary_over = "mun_id"),
  status     = publish(status_raw,     c("mun_id","status_rank"), c("mun_id","status_rank"), complementary_over = "mun_id"),
  days_dist  = publish(days_raw,       c("mun_id","days_band"), c("mun_id","days_band"), complementary_over = "mun_id")
)
# agregados de segmento y corredor (pasan k por construccion; se redondean)
seg <- MUNIS |> dplyr::select(mun_id, corridor_segment)
cubes$segment_flow <- flow_raw |> dplyr::left_join(seg, by = "mun_id") |>
  dplyr::group_by(corridor_segment, obs_period) |> dplyr::summarise(n = sum(n), .groups = "drop") |>
  dplyr::mutate(n = ifelse(n > 0 & n < K_ANON, NA_integer_, round_base(n)), suppressed = is.na(n))
cubes$corridor_flow <- flow_raw |> dplyr::group_by(obs_period) |> dplyr::summarise(n = sum(n), .groups = "drop") |>
  dplyr::mutate(n = round_base(n), suppressed = FALSE)

# --- 6. Pronostico: ingenua con bandas. Historia corta, se declara. ----
H <- 6L
next_periods <- function(last, h) {
  y <- as.integer(substr(last, 1, 4)); m <- as.integer(substr(last, 7, 8))
  vapply(seq_len(h), function(k) { mm <- m + k; yy <- y + (mm - 1) %/% 12; mm <- (mm - 1) %% 12 + 1
    sprintf("%d-M%02d", yy, mm) }, character(1))
}
fc <- flow_raw |> dplyr::group_by(mun_id) |> dplyr::group_modify(function(d, k) {
  y <- d$n; m <- length(y)
  base <- if (m >= 12) y[(m - 11):m] else rep(mean(y), 12)
  drift <- if (m >= 24) (y[m] - y[m - 23]) / 23 else 0
  s <- if (m >= 2) stats::sd(y) else 0; s <- ifelse(is.na(s), 0, s)
  tibble::tibble(step = 1:H, obs_period = next_periods(d$obs_period[m], H),
    point = pmax(0, round(base[((0:(H - 1)) %% 12) + 1] + drift * (1:H))),
    sd = s * sqrt(1:H))
}) |> dplyr::ungroup() |>
  dplyr::mutate(lo80 = pmax(0, round(point - 1.2816 * sd)), hi80 = round(point + 1.2816 * sd),
                lo95 = pmax(0, round(point - 1.96 * sd)), hi95 = round(point + 1.96 * sd)) |>
  dplyr::select(-sd)
assert_intervals_present(fc)

n_months <- length(PERIODS)
scorecard <- flow_raw |> dplyr::group_by(mun_id) |>
  dplyr::summarise(mean_level = round(mean(n)), .groups = "drop") |>
  dplyr::mutate(MASE = NA_real_, RMSSE = NA_real_, coverage80 = NA_real_, n_origins = 0L, beats_naive = NA,
                note_es = sprintf("Serie de %d meses: la retrospectiva exige 24. Sin calibracion todavia.", n_months),
                note_en = sprintf("%d-month series: the backtest needs 24. No calibration yet.", n_months))

coverage <- MUNIS |> dplyr::transmute(mun_id, coverage_known = FALSE, coverage = NA_real_, coverage_lo = NA_real_,
  note_es = "Sin conteo independiente en este municipio-mes. Cobertura desconocida, no asumida.",
  note_en = "No independent count for this municipality-month. Coverage unknown, not assumed.")

# --- 7. Export (manifest a medida: la historia corta y el consentimiento se declaran)
geo <- build_geo(MUNIS)
for (nm in names(cubes)) if ("n" %in% names(cubes[[nm]])) assert_publishable(cubes[[nm]], "n")
n_sup <- sum(cubes$flow$suppressed)
manifest <- list(
  schema_version = DICT$meta$schema_version, vintage = VINTAGE, release_date = RELEASE_DATE, build = "public",
  k_anonymity = K_ANON, rounding_base = ROUND_BASE, max_axes = MAX_AXES, min_period = "month",
  min_geography = "municipality", data_is_synthetic = FALSE, n_events = nrow(l2), n_labour_spells = nrow(spells),
  consent_version = CONSENT_DEFAULT, periods = PERIODS,
  measure_label = list(es = "eventos registrados", en = "recorded events"),
  forecast_scope = list(
    es = sprintf("Primera cosecha con registros reales: %d cuestionarios con consentimiento (%s) en %d municipios, de %s a %s. El pronostico es la referencia ingenua sobre una serie de %d meses; la calibracion por municipio se publica cuando haya 24.", nrow(l2), CONSENT_DEFAULT, length(unique(l2$mun_id)), PERIODS[1], PERIODS[n_months], n_months),
    en = sprintf("First vintage with real records: %d consented questionnaires (%s) in %d municipalities, %s to %s. The forecast is the naive benchmark on a %d-month series; town-by-town calibration is published once there are 24.", nrow(l2), CONSENT_DEFAULT, length(unique(l2$mun_id)), PERIODS[1], PERIODS[n_months], n_months)),
  municipalities = MUNIS |> dplyr::select(mun_id, node_id, mun_name_short, mun_name, country_iso3, adm1_name,
    corridor_segment, is_border_post, code_status, national_code, pop_baseline, pop_year, pop_source),
  sources = list(
    list(source_id = "SRC-MUN-SURVEY", publisher = "Encuesta municipal del Hub (voluntarios capacitados)", kind = "municipal_survey",
         caveat_es = "Muestra de conveniencia en terminales, albergues, mercados y via publica. No es representativa de la poblacion migrante.",
         caveat_en = "Convenience sample at terminals, shelters, markets and street points. Not representative of the migrant population."),
    list(source_id = "SRC-BO-INE-EFLUVI", publisher = "INE Bolivia y Direccion General de Migracion (SICOF)", kind = "published_aggregate",
         caveat_es = "Solo registra a quien se presenta ante la autoridad migratoria. La cobertura sube durante operativos.",
         caveat_en = "Records only those who present to the migration authority. Coverage rises during enforcement operations."),
    list(source_id = "SRC-PE-INEI-MIGRACIONES", publisher = "INEI y Superintendencia Nacional de Migraciones (Peru)", kind = "published_aggregate",
         caveat_es = "Publicacion trimestral por oficina de control migratorio. Edad y sexo a nivel nacional.",
         caveat_en = "Quarterly publication by migration control office. Age and sex at national level."),
    list(source_id = "SRC-REF-CONTEXT", publisher = "ACNUR, OIM DTM, PDI Chile, INEI, INE Bolivia", kind = "published_aggregate",
         caveat_es = "Indicadores de contexto publicados por las fuentes. Ver la vista Contexto y fuentes.",
         caveat_en = "Context indicators published by the sources. See the Context and sources view."))
)
ref_dir <- file.path(PATHS$dictionary, "reference")
rd <- function(f) readr::read_csv(file.path(ref_dir, f), col_types = readr::cols(.default = "c"), show_col_types = FALSE)
reference <- list(events = rd("events_calendar.csv") |> dplyr::select(-dplyr::any_of("verification")),
                  minimum_wage = rd("minimum_wage.csv"), admin_flows = rd("admin_flows.csv"),
                  context = rd("context_indicators.csv"), sources = rd("sources.csv"))
write_js(manifest, "manifest", "manifest.js"); write_js(geo, "geo", "geo.js"); write_js(cubes, "cubes", "cubes.js")
write_js(fc, "forecast", "forecast.js"); write_js(scorecard, "scorecard", "scorecard.js")
write_js(coverage, "coverage", "coverage.js"); write_js(reference, "reference", "reference.js")
message(sprintf("[real] Release %s: %d eventos, %d celdas municipio-mes, %d suprimidas (%.0f%%). Escrito en %s",
                VINTAGE, nrow(l2), nrow(cubes$flow), n_sup, 100 * n_sup / nrow(cubes$flow), PATHS$L4_release))
testthat::test_dir("tests/testthat")
