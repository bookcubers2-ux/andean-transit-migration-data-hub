# =====================================================================
# 07_disclosure_control.R  ·  ATMDH / OAMT
# LA COMPUERTA. Constraint 3, ejecutable.
#
# El tablero no puede filtrar microdatos porque el tablero nunca los
# recibe. Este archivo es el unico camino de L3 a L4 y aplica, en orden:
#   1. tope de dimensionalidad  (max 2 ejes)
#   2. supresion primaria       (n < k)
#   3. supresion por dominancia (un empleador > 60% de la celda)
#   4. supresion complementaria (contra recuperacion por margenes)
#   5. redondeo controlado      (base 5)
#   6. consistencia entre vintages (contra ataque por diferencia)
# =====================================================================

SUPPRESSED <- NA_integer_   # una celda suprimida es NA, nunca cero

# --- 1. tope de dimensionalidad --------------------------------------
assert_max_axes <- function(cube, axes) {
  if (length(axes) > MAX_AXES) {
    stop("[disclosure] ", length(axes), " ejes solicitados (", paste(axes, collapse = " x "),
         ") y el maximo publicable es ", MAX_AXES, ".\n",
         "  Con ~28 registros por municipio-mes una tabla de tres vias no es publicable. ",
         "No es una restriccion de la herramienta, es el tamano de la muestra.")
  }
  invisible(TRUE)
}

# --- 2 y 3. supresion primaria y por dominancia ----------------------
suppress_primary <- function(cube, n_col = "n", dominance_col = NULL) {
  cube$.sup_primary  <- cube[[n_col]] < K_ANON
  cube$.sup_dominance <- if (!is.null(dominance_col) && dominance_col %in% names(cube)) {
    !is.na(cube[[dominance_col]]) & cube[[dominance_col]] > P_RULE
  } else FALSE
  cube$.suppressed <- cube$.sup_primary | cube$.sup_dominance
  cube
}

# --- 4. supresion complementaria -------------------------------------
# Si en una fila (o columna) queda UNA sola celda suprimida, esa celda se
# recupera restando del margen. Se suprime la siguiente celda mas pequenia
# hasta que cada margen tenga cero o dos o mas supresiones.
suppress_complementary <- function(cube, group_cols, n_col = "n") {
  for (g in group_cols) {
    repeat {
      chk <- cube |>
        dplyr::group_by(dplyr::across(dplyr::all_of(g))) |>
        dplyr::summarise(n_sup = sum(.suppressed), .groups = "drop") |>
        dplyr::filter(n_sup == 1)
      if (nrow(chk) == 0) break
      for (i in seq_len(nrow(chk))) {
        key <- chk[i, g, drop = TRUE]
        idx <- which(cube[[g]] == key & !cube$.suppressed)
        if (length(idx) == 0) break
        target <- idx[which.min(cube[[n_col]][idx])]
        cube$.suppressed[target] <- TRUE
        cube$.sup_complementary <- TRUE
      }
    }
  }
  cube
}

# --- 5. redondeo controlado ------------------------------------------
round_base <- function(x, base = ROUND_BASE) ifelse(is.na(x), NA_integer_, as.integer(round(x / base) * base))

# --- 6. consistencia entre vintages ----------------------------------
# Si una celda estuvo suprimida en un vintage anterior, sigue suprimida.
# De lo contrario, restar dos releases recupera el valor exacto.
apply_release_consistency <- function(cube, key_cols, history_path = NULL) {
  history_path <- history_path %||% file.path(PATHS$L3_cubes, "suppression_history.csv")
  key <- do.call(paste, c(cube[key_cols], sep = "|"))
  if (file.exists(history_path)) {
    hist <- readr::read_csv(history_path, show_col_types = FALSE)
    cube$.suppressed <- cube$.suppressed | (key %in% hist$cell_key)
  }
  new_hist <- data.frame(cell_key = unique(c(
    if (file.exists(history_path)) readr::read_csv(history_path, show_col_types = FALSE)$cell_key else character(0),
    key[cube$.suppressed])), stringsAsFactors = FALSE)
  readr::write_csv(new_hist, history_path)
  cube
}

# --- La compuerta completa -------------------------------------------
publish <- function(cube, axes, key_cols, n_col = "n", dominance_col = NULL,
                    value_cols = NULL, complementary_over = NULL) {
  assert_max_axes(cube, axes)
  cube <- suppress_primary(cube, n_col, dominance_col)
  if (!is.null(complementary_over)) cube <- suppress_complementary(cube, complementary_over, n_col)
  cube <- apply_release_consistency(cube, key_cols)

  out <- cube
  out[[n_col]] <- ifelse(out$.suppressed, SUPPRESSED, round_base(out[[n_col]]))
  for (v in (value_cols %||% character(0))) {
    out[[v]] <- ifelse(out$.suppressed, NA, out[[v]])
  }
  # las columnas de trabajo no salen
  out$.sup_primary <- out$.sup_dominance <- out$.sup_complementary <- NULL
  out$suppressed <- out$.suppressed; out$.suppressed <- NULL

  n_sup <- sum(out$suppressed)
  message(sprintf("[disclosure] %s: %d celdas, %d suprimidas (%.0f%%), k=%d, redondeo base %d",
                  paste(axes, collapse = " x "), nrow(out), n_sup,
                  100 * n_sup / max(nrow(out), 1), K_ANON, ROUND_BASE))
  out
}

# --- Verificacion final antes del export -----------------------------
# Si esto falla, no hay release. Es el mecanismo, no la politica.
assert_publishable <- function(cube, n_col = "n") {
  bad <- which(!is.na(cube[[n_col]]) & cube[[n_col]] < K_ANON & cube[[n_col]] > 0)
  if (length(bad)) {
    stop("[disclosure] ", length(bad), " celdas por debajo de k=", K_ANON,
         " sobrevivieron a la compuerta. EL EXPORT SE DETIENE. Filas: ",
         paste(utils::head(bad, 10), collapse = ", "))
  }
  banned <- intersect(unlist(NEVER_PUB), names(cube))
  if (length(banned)) {
    stop("[disclosure] Variables prohibidas en un cubo publicable: ",
         paste(banned, collapse = ", "), ". EL EXPORT SE DETIENE.")
  }
  invisible(TRUE)
}
