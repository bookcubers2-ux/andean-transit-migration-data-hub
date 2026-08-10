# =====================================================================
# run_all.R  ·  ATMDH / OAMT
# Corrida completa, de la fuente al tablero.
#
# Para alguien que no escribio este codigo:
#   1. Instale R (>= 4.2).
#   2. Abra R en esta carpeta.
#   3. source("run_all.R")
#   En Windows, doble clic en make.bat hace lo mismo.
#
# Para una corrida reproducible byte a byte, fije el vintage antes:
#   Sys.setenv(ATMDH_VINTAGE = "2026Q3", ATMDH_RELEASE_DATE = "2026-09-30")
# =====================================================================

message("=== ATMDH / OAMT ===")

source("R/00_setup.R")
source("R/01_ingest_admin.R")
source("R/02_ingest_survey.R")
source("R/03_validate.R")
source("R/04_standardize.R")
source("R/05_pseudonymize.R")
source("R/06_aggregate.R")
source("R/07_disclosure_control.R")
source("R/08_model.R")
source("R/09_export_dashboard.R")

# --- 1. Ingesta ------------------------------------------------------
admin  <- ingest_all_admin()
survey <- ingest_all_survey()

if (nrow(admin) == 0 && nrow(survey) == 0) {
  message("\n[run_all] Sin datos en data/00_raw/.")
  message("[run_all] Para ver el sistema completo funcionando con datos sinteticos:")
  message("           source('R/99_make_synthetic.R'); make_synthetic_release()")
  message("[run_all] Los datos sinteticos quedan marcados como tales en el tablero.")
  quit_early <- TRUE
} else quit_early <- FALSE

if (!quit_early) {

  # --- 2. Validacion (antes de tocar nada mas) -----------------------
  iss_e <- validate_table(admin,  "fact_transit_event")
  iss_s <- validate_table(survey, "fact_survey_response")
  issues <- dplyr::bind_rows(iss_e, iss_s)

  rejected <- issues |> dplyr::filter(tier == "E")
  if (nrow(rejected)) {
    message("[run_all] ", sum(rejected$n_rows), " registros rechazados. ",
            "Se continua con el resto y el reporte lista cada fila.")
  }

  # --- 3. Estandarizacion --------------------------------------------
  l1 <- admin |>
    dplyr::mutate(
      mun_id    = map_place_to_mun(mun_raw, country_hint = substr(source_id, 5, 7)),
      obs_period = to_period(obs_date))

  # --- 4. Seudonimizacion. Los identificadores mueren aqui. ----------
  l2 <- promote_to_L2(l1)
  assert_no_direct_identifiers(l2)

  plaus <- validate_plausibility(l2)
  write_validation_report(issues, plaus)

  # --- 5. Cubos ------------------------------------------------------
  spells <- readRDS(file.path(PATHS$L2_canon, "fact_labour_spell.rds"))

  cubes_raw <- list(
    flow       = build_cube_flow(l2),
    od         = build_cube_od(l2),
    sector     = build_cube_labour_sector(spells),
    formality  = build_cube_formality(spells),
    absorption = build_cube_absorption(spells),
    demog      = build_cube_demog(l2),
    status     = build_cube_status(l2)
  )

  # --- 6. LA COMPUERTA -----------------------------------------------
  cubes <- list(
    flow       = publish(cubes_raw$flow,      c("mun_id","obs_period"), c("mun_id","obs_period")),
    od         = publish(cubes_raw$od,        c("origin_mun_id","intended_dest_id"),
                         c("origin_mun_id","intended_dest_id","yr")),
    sector     = publish(cubes_raw$sector,    c("mun_id","isic1"), c("mun_id","isic1"),
                         dominance_col = "top_employer_share", complementary_over = "mun_id"),
    formality  = publish(cubes_raw$formality, c("mun_id","formality"), c("mun_id","formality"),
                         complementary_over = "mun_id"),
    absorption = publish(cubes_raw$absorption, c("mun_id","obs_period"), c("mun_id","obs_period"),
                         value_cols = c("rate","median_days","absorbed")),
    demog      = publish(cubes_raw$demog,     c("mun_id","age_band"), c("mun_id","age_band"),
                         complementary_over = "mun_id"),
    status     = publish(cubes_raw$status,    c("mun_id","status_rank"), c("mun_id","status_rank"),
                         complementary_over = "mun_id")
  )

  # --- 7. Modelo (esta cosecha: solo flujo) --------------------------
  panel     <- cubes_raw$flow
  fc_naive  <- fit_seasonal_naive(panel)
  scorecard <- backtest(panel)
  coverage  <- build_coverage(l2)

  # --- 8. Export -----------------------------------------------------
  geo <- build_geo(MUNIS)
  export_release(cubes, fc_naive, scorecard, coverage, geo)

  # --- 9. La compuerta, como prueba ----------------------------------
  testthat::test_dir("tests/testthat")
  message("\n[run_all] Listo. Abra dashboard/index.html.")
}
