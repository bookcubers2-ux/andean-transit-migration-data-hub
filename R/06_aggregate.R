# =====================================================================
# 06_aggregate.R  ·  ATMDH / OAMT
# L2 -> L3. Construye los cubos. NINGUN cubo pasa de dos ejes de
# categoria, porque con ~28 registros por municipio-mes una tabla de tres
# vias no sobrevive a k=10. Eso no es una limitacion del tablero: es el
# tamano de la muestra, y el tablero lo dice en voz alta.
# =====================================================================

build_cube_flow <- function(events) {
  events |>
    dplyr::count(mun_id, obs_period, name = "n") |>
    tidyr::complete(mun_id = MUNIS$mun_id,
                    obs_period = sort(unique(events$obs_period)),
                    fill = list(n = 0L))
}

build_cube_od <- function(events, period_group = "year") {
  events |>
    dplyr::filter(origin_mun_id != "UNK", intended_dest_id != "UNK") |>
    dplyr::mutate(yr = substr(obs_period, 1, 4)) |>
    dplyr::count(origin_mun_id, intended_dest_id, yr, name = "n")
}

build_cube_labour_sector <- function(spells) {
  spells |> dplyr::count(mun_id, isic1, name = "n") |>
    dplyr::left_join(
      spells |> dplyr::group_by(mun_id, isic1) |>
        dplyr::summarise(top_employer_share = {
          t <- table(employer_hash); if (length(t)) max(t) / sum(t) else NA_real_
        }, contested_share = mean(crosswalk_confidence == "contested"), .groups = "drop"),
      by = c("mun_id", "isic1"))
}

build_cube_formality <- function(spells) {
  spells |> dplyr::count(mun_id, formality, name = "n")
}

build_cube_absorption <- function(spells) {
  spells |>
    dplyr::group_by(mun_id, obs_period) |>
    dplyr::summarise(n = dplyr::n(),
                     absorbed = sum(absorbed_60d, na.rm = TRUE),
                     rate = absorbed / n,
                     median_days = stats::median(days_to_first_income, na.rm = TRUE),
                     .groups = "drop")
}

build_cube_demog <- function(events) {
  events |> dplyr::count(mun_id, age_band, name = "n")
}

build_cube_status <- function(events) {
  events |> dplyr::count(mun_id, status_rank, name = "n")
}

# --- Indicador de cobertura ------------------------------------------
# Estimacion de doble sistema (captura-recaptura) donde el registro
# administrativo y la encuesta municipal cubren el mismo municipio-mes.
# Donde NO se superponen, la cobertura se reporta como desconocida, no
# como uno. Un supuesto no verificable no se disfraza de dato.
build_coverage <- function(events) {
  events |>
    dplyr::group_by(mun_id, obs_period) |>
    dplyr::summarise(
      n_admin  = sum(source_kind == "admin_scrape"),
      n_survey = sum(source_kind == "municipal_survey"),
      n_both   = sum(dual_listed, na.rm = TRUE),
      .groups = "drop") |>
    dplyr::mutate(
      # Chapman: N = (n1+1)(n2+1)/(m+1) - 1
      N_hat = ifelse(n_both > 0, ((n_admin + 1) * (n_survey + 1)) / (n_both + 1) - 1, NA_real_),
      coverage = ifelse(is.na(N_hat), NA_real_, pmin(1, (n_admin + n_survey - n_both) / N_hat)),
      coverage_known = !is.na(coverage))
}

# --- Etiqueta obligatoria --------------------------------------------
# Todo conteo sale marcado como 'registrado', jamas como 'poblacion'.
label_as_recorded <- function(cube) { cube$measure <- "recorded_events"; cube }
