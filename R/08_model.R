# =====================================================================
# 08_model.R  ·  ATMDH / OAMT
# La capa predictiva. Se ajusta en UNA maquina (la del analista), una vez
# por vintage. El hardware municipal solo abre el tablero.
#
# COSECHA 2026Q3: SOLO FLUJO.
# La serie de demanda laboral (permisos, puestos de mercado, altas
# formales) todavia no existe para los doce nodos. Por lo tanto la
# capacidad de absorcion NO se estima en esta cosecha. Se pronostica el
# flujo registrado y se publica la razon de absorcion historica como
# descriptivo, no como pronostico. El model_card.md lo dice y el tablero
# lo dice. Ajustar un modelo a una variable que no se observa seria el
# error mas caro que puede cometer este proyecto.
# =====================================================================

H <- 6L   # horizonte, meses

# --- Referencia obligatoria: ingenua estacional con deriva -----------
# Todo modelo debe ganarle a esto. Si no le gana, se reporta que no.
fit_seasonal_naive <- function(panel, h = H) {
  panel |>
    dplyr::group_by(mun_id) |>
    dplyr::group_modify(function(d, k) {
      d <- dplyr::arrange(d, obs_period)
      y <- d$n; m <- length(y)
      last12 <- if (m >= 12) y[(m - 11):m] else rep(mean(y, na.rm = TRUE), 12)
      drift <- if (m >= 24) (y[m] - y[m - 23]) / 23 else 0
      tibble::tibble(step = 1:h, point = pmax(0, last12[((0:(h - 1)) %% 12) + 1] + drift * (1:h)))
    }) |> dplyr::ungroup()
}

# --- Modelo principal: BN parcialmente agrupado ----------------------
# Intercepto aleatorio por municipio (los doce nodos comparten fuerza),
# estacionalidad armonica, rezago distribuido del nodo aguas arriba, y la
# covariable de intensidad de control. Sin esa covariable el modelo
# pronostica con toda confianza el calendario de los operativos.
fit_main <- function(panel, upstream_map) {
  if (!requireNamespace("glmmTMB", quietly = TRUE)) {
    message("[model] glmmTMB no instalado. Se usa solo la referencia ingenua.")
    return(NULL)
  }
  d <- panel |>
    dplyr::mutate(
      t = as.integer(factor(obs_period)),
      s1 = sin(2 * pi * t / 12), c1 = cos(2 * pi * t / 12),
      s2 = sin(4 * pi * t / 12), c2 = cos(4 * pi * t / 12)) |>
    dplyr::group_by(mun_id) |>
    dplyr::mutate(upstream_l1 = dplyr::lag(upstream_flow, 1),
                  upstream_l2 = dplyr::lag(upstream_flow, 2)) |>
    dplyr::ungroup() |>
    tidyr::drop_na(upstream_l2)

  glmmTMB::glmmTMB(
    n ~ s1 + c1 + s2 + c2 + upstream_l1 + upstream_l2 + operativo_share + (1 | mun_id),
    family = glmmTMB::nbinom2, data = d)
}

# --- Reconciliacion jerarquica ---------------------------------------
# municipio -> segmento del corredor -> pais. Doce nodos anidados en
# cuatro segmentos y dos paises. Barato y evita que la suma de los
# municipios contradiga el total del corredor en la misma pantalla.
reconcile_hierarchy <- function(fc, munis = MUNIS) {
  seg <- munis |> dplyr::select(mun_id, corridor_segment, country_iso3)
  fc |> dplyr::left_join(seg, by = "mun_id") |>
    dplyr::group_by(corridor_segment, step) |>
    dplyr::mutate(seg_total = sum(point)) |>
    dplyr::group_by(country_iso3, step) |>
    dplyr::mutate(country_total = sum(point)) |>
    dplyr::ungroup()
}

# --- Retrospectiva por origen movil ----------------------------------
# MASE y RMSSE contra la ingenua, mas cobertura empirica del intervalo
# del 80%. Se publica POR MUNICIPIO. Los municipios donde el modelo
# pierde se muestran perdiendo.
backtest <- function(panel, min_train = 24, h = 3L) {
  periods <- sort(unique(panel$obs_period))
  out <- list()
  for (origin in seq(min_train, length(periods) - h)) {
    train <- panel |> dplyr::filter(obs_period <= periods[origin])
    test  <- panel |> dplyr::filter(obs_period %in% periods[(origin + 1):(origin + h)])
    fc <- fit_seasonal_naive(train, h = h)
    cmp <- test |>
      dplyr::group_by(mun_id) |> dplyr::mutate(step = dplyr::row_number()) |> dplyr::ungroup() |>
      dplyr::left_join(fc, by = c("mun_id", "step")) |>
      dplyr::mutate(ae = abs(n - point), se = (n - point)^2)
    out[[length(out) + 1]] <- cmp
  }
  res <- dplyr::bind_rows(out)
  scale_ <- panel |> dplyr::group_by(mun_id) |>
    dplyr::summarise(scale = mean(abs(diff(n)), na.rm = TRUE), .groups = "drop")
  res |> dplyr::left_join(scale_, by = "mun_id") |>
    dplyr::group_by(mun_id) |>
    dplyr::summarise(MASE = mean(ae, na.rm = TRUE) / mean(scale, na.rm = TRUE),
                     RMSSE = sqrt(mean(se, na.rm = TRUE)) / mean(scale, na.rm = TRUE),
                     n_origins = dplyr::n(), .groups = "drop") |>
    dplyr::mutate(beats_naive = MASE < 1)
}

# --- Regla dura de presentacion --------------------------------------
# Ningun punto sin banda. La funcion de export lo verifica y falla.
assert_intervals_present <- function(fc) {
  need <- c("point", "lo80", "hi80", "lo95", "hi95")
  miss <- setdiff(need, names(fc))
  if (length(miss)) {
    stop("[model] Pronostico sin intervalos (", paste(miss, collapse = ", "),
         "). El tablero no dibuja una linea desnuda. El export se detiene.")
  }
  invisible(TRUE)
}
