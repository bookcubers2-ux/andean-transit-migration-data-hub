# =====================================================================
# 10_geo.R  ·  ATMDH / OAMT
# Geometria proyectada para la vista espacial.
#
# NO hay teselas de mapa base. Un municipio sin internet no puede pedir
# teselas a nadie, y un servidor de teselas es exactamente el tipo de
# dependencia que mato los disenios anteriores. En su lugar, R proyecta
# la geometria UNA vez, en tiempo de build, y el tablero dibuja SVG.
#
# Proyeccion: equirrectangular con correccion por coseno de la latitud
# central del corredor. A esta escala (7 grados de latitud) la distorsion
# es de pocos milimetros en pantalla y no requiere sf ni PROJ.
# =====================================================================

VIEWBOX <- c(w = 1000, h = 1400)
PAD     <- 90

project_corridor <- function(lat, lon, lat0 = -18.5) {
  x <- lon * cos(lat0 * pi / 180)
  y <- -lat
  list(x = x, y = y)
}

fit_to_viewbox <- function(x, y, w = VIEWBOX[["w"]], h = VIEWBOX[["h"]], pad = PAD) {
  sx <- (w - 2 * pad) / diff(range(x)); sy <- (h - 2 * pad) / diff(range(y))
  s  <- min(sx, sy)
  list(
    x = pad + (x - min(x)) * s + ((w - 2 * pad) - diff(range(x)) * s) / 2,
    y = pad + (y - min(y)) * s + ((h - 2 * pad) - diff(range(y)) * s) / 2,
    scale = s
  )
}

# Capas de referencia. Cuando el proyecto tenga los shapefiles del INE y
# del INEI, esta funcion se reemplaza por una lectura con sf +
# rmapshaper::ms_simplify(keep = 0.02) y el resto del sistema no cambia.
# Mientras tanto son polilineas gruesas, suficientes para orientar la
# lectura y honestas sobre lo que son.
REFERENCE_LAYERS <- list(
  border_bo_pe = matrix(c(
    -69.65,-17.30, -69.30,-16.90, -69.10,-16.60, -69.05,-16.35, -69.15,-16.20,
    -69.05,-16.05, -68.85,-15.90, -69.00,-15.60, -69.40,-15.25, -69.60,-14.95
  ), ncol = 2, byrow = TRUE),
  border_bo_cl = matrix(c(
    -69.55,-17.60, -69.15,-18.20, -68.95,-18.95, -68.65,-19.25, -68.55,-19.85,
    -68.40,-20.50, -68.20,-21.30, -67.90,-22.00
  ), ncol = 2, byrow = TRUE),
  border_bo_ar = matrix(c(
    -66.05,-22.10, -65.60,-22.09, -65.00,-22.10, -64.30,-22.05, -63.70,-22.00, -62.85,-22.00
  ), ncol = 2, byrow = TRUE),
  lake_titicaca = matrix(c(
    -69.95,-15.55, -69.60,-15.30, -69.20,-15.45, -68.95,-15.75, -68.85,-16.10,
    -69.05,-16.30, -69.25,-16.20, -69.55,-16.05, -69.85,-15.80, -69.95,-15.55
  ), ncol = 2, byrow = TRUE)
)

build_geo <- function(munis = MUNIS) {
  all_lon <- c(munis$lon, unlist(lapply(REFERENCE_LAYERS, function(m) m[, 1])))
  all_lat <- c(munis$lat, unlist(lapply(REFERENCE_LAYERS, function(m) m[, 2])))
  p  <- project_corridor(all_lat, all_lon)
  fit <- fit_to_viewbox(p$x, p$y)

  idx <- seq_len(nrow(munis))
  nodes <- munis |>
    dplyr::mutate(x = round(fit$x[idx], 1), y = round(fit$y[idx], 1)) |>
    dplyr::select(mun_id, node_id, mun_name_short, country_iso3, corridor_segment,
                  is_border_post, x, y, lat, lon)

  off <- nrow(munis)
  layers <- list()
  for (nm in names(REFERENCE_LAYERS)) {
    m <- REFERENCE_LAYERS[[nm]]
    k <- seq_len(nrow(m)) + off
    layers[[nm]] <- data.frame(x = round(fit$x[k], 1), y = round(fit$y[k], 1))
    off <- off + nrow(m)
  }

  list(viewbox = list(w = VIEWBOX[["w"]], h = VIEWBOX[["h"]]),
       nodes = nodes, layers = layers,
       note = list(
         es = "Geometria de referencia esquematica. Reemplazar por los limites del INE (Bolivia) y del INEI (Peru) cuando esten disponibles. Las posiciones de los nodos son coordenadas reales proyectadas.",
         en = "Schematic reference geometry. Replace with INE (Bolivia) and INEI (Peru) boundaries when available. Node positions are real projected coordinates."))
}
