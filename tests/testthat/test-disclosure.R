# =====================================================================
# test-disclosure.R  ·  ATMDH / OAMT
# LA COMPUERTA, COMO PRUEBA. Si algo aqui falla, no hay release.
# Esto es el mecanismo que hace cumplir la restriccion 3. No es una
# declaracion de politica: es un test que bloquea el build.
# =====================================================================

test_that("ninguna celda publicada queda por debajo de k", {
  for (f in list.files(PATHS$L4_release, pattern = "^cubes\\.js$", full.names = TRUE)) {
    txt <- paste(readLines(f, warn = FALSE), collapse = "\n")
    json <- sub("^.*window\\.ATMDH\\.cubes = ", "", txt)
    json <- sub(";\\s*$", "", json)
    cubes <- jsonlite::fromJSON(json, simplifyDataFrame = TRUE)
    for (nm in names(cubes)) {
      cu <- cubes[[nm]]
      if (!is.data.frame(cu) || !"n" %in% names(cu)) next
      bad <- cu$n[!is.na(cu$n) & cu$n > 0 & cu$n < K_ANON]
      expect_equal(length(bad), 0,
        info = sprintf("Cubo '%s': %d celdas por debajo de k=%d.", nm, length(bad), K_ANON))
    }
  }
})

test_that("ninguna variable prohibida aparece en el paquete publicado", {
  banned <- unlist(DICT$disclosure$never_publish)
  for (f in list.files(PATHS$L4_release, pattern = "\\.js$", full.names = TRUE)) {
    txt <- paste(readLines(f, warn = FALSE), collapse = "\n")
    hits <- banned[vapply(banned, function(b) grepl(b, txt, fixed = TRUE), logical(1))]
    expect_equal(length(hits), 0,
      info = sprintf("%s contiene variables prohibidas: %s",
                     basename(f), paste(hits, collapse = ", ")))
  }
})

test_that("ningun cubo publicado supera el tope de dos ejes", {
  reserved <- c("n","rate","median_days","suppressed","measure","value","point",
                "lo80","hi80","lo95","hi95","step","absorbed","top_employer_share",
                "contested_share","coverage","coverage_known","N_hat")
  txt <- paste(readLines(file.path(PATHS$L4_release, "cubes.js"), warn = FALSE), collapse = "\n")
  cubes <- jsonlite::fromJSON(sub(";\\s*$", "", sub("^.*window\\.ATMDH\\.cubes = ", "", txt)))
  for (nm in names(cubes)) {
    cu <- cubes[[nm]]
    if (!is.data.frame(cu)) next
    axes <- setdiff(names(cu), c(reserved, "mun_id", "obs_period", "yr"))  # yr es eje temporal, como obs_period
    expect_lte(length(axes), MAX_AXES,
      label = sprintf("Cubo '%s' con ejes: %s", nm, paste(axes, collapse = ", ")))
  }
})

test_that("ningun pronostico se publica sin banda de incertidumbre", {
  txt <- paste(readLines(file.path(PATHS$L4_release, "forecast.js"), warn = FALSE), collapse = "\n")
  fc <- jsonlite::fromJSON(sub(";\\s*$", "", sub("^.*window\\.ATMDH\\.forecast = ", "", txt)))
  expect_true(all(c("point","lo80","hi80","lo95","hi95") %in% names(fc)))
  expect_true(all(fc$hi95 >= fc$lo95, na.rm = TRUE))
  expect_true(all(fc$hi80 <= fc$hi95, na.rm = TRUE))
})

test_that("el periodo minimo publicado es el mes, nunca el dia", {
  txt <- paste(readLines(file.path(PATHS$L4_release, "cubes.js"), warn = FALSE), collapse = "\n")
  expect_false(grepl("\\d{4}-\\d{2}-\\d{2}", txt),
               label = "Se encontro una fecha diaria en un cubo publicado")
})
