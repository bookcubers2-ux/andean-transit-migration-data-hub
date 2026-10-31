# =====================================================================
# 04_standardize.R  ·  ATMDH / OAMT
# Armonizacion entre jurisdicciones. La parte dificil del problema.
#
# Los crosswalks son artefactos EDITORIALES, no codigo: dos CSV que firman
# un abogado bilingue y un estadistico, versionados, con una columna de
# confianza. Las celdas construidas sobre un mapeo 'contested' se marcan
# en el tablero en lugar de promediarse en silencio.
# =====================================================================

# --- Nombres de puesto -> mun_id canonico ----------------------------
# Los registros escriben el mismo lugar de ocho maneras. Esta tabla es la
# unica autoridad. Un valor no reconocido es un ERROR, nunca un descarte.
PLACE_ALIASES <- c(
  "DESAGUADERO"="", "DESAGUADERO (BOL)"="BO-020804", "PC DESAGUADERO"="BO-020804",
  "P.C. DESAGUADERO"="BO-020804", "DESAGUADERO BOLIVIA"="BO-020804",
  "DESAGUADERO (PER)"="PE-210402", "CF DESAGUADERO"="PE-210402", "DESAGUADERO PERU"="PE-210402",
  "COPACABANA"="BO-021701", "KASANI"="BO-021701", "PC KASANI"="BO-021701",
  "YUNGUYO"="PE-211301", "CF YUNGUYO"="PE-211301",
  "PUNO"="PE-210101", "JULIACA"="PE-211101", "SAN ROMAN"="PE-211101",
  "TACNA"="PE-230101", "SANTA ROSA"="PE-230101", "CF SANTA ROSA"="PE-230101",
  "EL ALTO"="BO-020105", "EL ALTO - LA PAZ"="BO-020105",
  "ORURO"="BO-040101",
  "PISIGA"="BO-040901", "PISIGA BOLIVAR"="BO-040901", "SABAYA"="BO-040901",
  "VILLAZON"="BO-051501", "VILLAZON - POTOSI"="BO-051501",
  "YACUIBA"="BO-060301", "POCITOS"="BO-060301", "SAN JOSE DE POCITOS"="BO-060301",
  "SANTA CRUZ"="BO-070101", "SANTA CRUZ DE LA SIERRA"="BO-070101", "VIRU VIRU"="BO-070101",
  "COCHABAMBA"="BO-030101", "LA PAZ"="BO-020101"
)

normalise_place <- function(x) {
  x |> toupper() |> stringr::str_replace_all("[ÁÀÄÂ]", "A") |>
    stringr::str_replace_all("[ÉÈËÊ]", "E") |>
    stringr::str_replace_all("[ÍÌÏÎ]", "I") |>
    stringr::str_replace_all("[ÓÒÖÔ]", "O") |>
    stringr::str_replace_all("[ÚÙÜÛ]", "U") |>
    stringr::str_replace_all("Ñ", "N") |>
    stringr::str_squish()
}

map_place_to_mun <- function(x, country_hint = NULL) {
  key <- normalise_place(x)
  out <- unname(PLACE_ALIASES[key])
  # 'DESAGUADERO' a secas es ambiguo: es un nodo binacional con dos
  # municipios. Se resuelve con el pais de la fuente, nunca adivinando.
  amb <- which(key == "DESAGUADERO")
  if (length(amb)) {
    if (is.null(country_hint)) {
      stop("[standardize] 'DESAGUADERO' sin pais de origen. Es un nodo binacional ",
           "con dos municipios distintos. Declare el pais en el perfil de la fuente.")
    }
    out[amb] <- ifelse(country_hint[amb] == "BOL", "BO-020804", "PE-210402")
  }
  bad <- which(is.na(out) | !nzchar(out))
  if (length(bad)) {
    stop("[standardize] Lugares no reconocidos: ",
         paste(unique(key[bad]), collapse = " | "),
         "\n  Agreguelos a PLACE_ALIASES en 04_standardize.R. No se descartan filas en silencio.")
  }
  out
}

# --- Ocupacion local -> CIUO-08 a 2 digitos --------------------------
standardise_occupation <- function(occ_local_code, country_iso3) {
  xw <- OCC_XW |> dplyr::select(country_iso3, occ_local_code, occ_isco2, isic1, crosswalk_confidence)
  key <- data.frame(occ_local_code = as.character(occ_local_code),
                    country_iso3 = country_iso3, stringsAsFactors = FALSE)
  res <- dplyr::left_join(key, xw, by = c("occ_local_code", "country_iso3"))
  unmapped <- unique(res$occ_local_code[is.na(res$occ_isco2)])
  if (length(unmapped)) {
    warning("[standardize] Ocupaciones sin mapeo (van a 'OTH' y quedan listadas en el reporte): ",
            paste(unmapped, collapse = ", "))
    res$occ_isco2[is.na(res$occ_isco2)] <- "OTH"
    res$isic1[is.na(res$isic1)] <- "OTH"
    res$crosswalk_confidence[is.na(res$crosswalk_confidence)] <- "contested"
  }
  res
}

# --- Situacion migratoria local -> escalera canonica de 6 -----------
standardise_status <- function(status_local, country_iso3) {
  key <- data.frame(status_local_label = normalise_place(status_local),
                    country_iso3 = country_iso3, stringsAsFactors = FALSE)
  xw <- STATUS_XW |> dplyr::mutate(status_local_label = normalise_place(status_local_label))
  dplyr::left_join(key, xw, by = c("status_local_label", "country_iso3")) |>
    dplyr::select(status_rank, canonical_code, crosswalk_confidence)
}

# --- Periodo canonico: el mes es la unidad temporal minima -----------
to_period <- function(d) format(as.Date(d), "%Y-M%m")
