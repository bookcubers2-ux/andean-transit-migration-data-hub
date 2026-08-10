# =====================================================================
# 05_pseudonymize.R  ·  ATMDH / OAMT
# Promocion L1 -> L2. Aqui se destruyen los identificadores directos.
#
# DECISION DE ARQUITECTURA (confirmada 2026-08-10):
#   NO existe clave de persona entre municipios.
#   La sal es POR MUNICIPIO, de modo que episode_key deduplica dentro de
#   un municipio y es criptograficamente inutil fuera de el.
#   El movimiento del corredor se reconstruye con origin_mun_id e
#   intended_dest_id a nivel agregado, no siguiendo personas.
# =====================================================================

# Genera el archivo de sales. Se corre UNA vez y el archivo se guarda
# fuera del repositorio, en el equipo del municipio, cifrado.
init_salts <- function(path = salt_path, overwrite = FALSE) {
  if (file.exists(path) && !overwrite) stop("Ya existe ", path, ". No se sobrescribe.")
  salts <- data.frame(
    mun_id = MUNIS$mun_id,
    salt   = vapply(seq_len(nrow(MUNIS)),
                    function(i) paste(format(as.hexmode(sample(0:255, 32, TRUE)), width = 2), collapse = ""),
                    character(1)),
    created = Sys.Date()
  )
  readr::write_csv(salts, path)
  message("[pseudonymize] Sales creadas en ", path,
          "\n  MUEVA este archivo a un contenedor cifrado. No lo versione. Sin el no hay L2.")
  invisible(salts)
}

# HMAC-SHA256 truncado a 16 hex. El documento nunca se guarda.
make_episode_key <- function(document_number, mun_id, salts) {
  s <- salts$salt[match(mun_id, salts$mun_id)]
  if (any(is.na(s))) stop("Municipio sin sal registrada: ",
                          paste(unique(mun_id[is.na(s)]), collapse = ", "))
  vapply(seq_along(document_number), function(i) {
    substr(digest::hmac(key = s[i],
                        object = paste0(toupper(trimws(document_number[i])), "|", mun_id[i]),
                        algo = "sha256"), 1, 16)
  }, character(1))
}

# Promocion completa. Devuelve L2 y BORRA las columnas identificadoras.
promote_to_L2 <- function(l1, salts = read_salts()) {
  direct <- c("document_number", "full_name", "given_name", "family_name",
              "dob", "address", "phone", "email", "gps_lat", "gps_lon", "photo_path")

  stopifnot("mun_id" %in% names(l1))
  if ("document_number" %in% names(l1)) {
    l1$episode_key <- make_episode_key(l1$document_number, l1$mun_id, salts)
  } else if (!"episode_key" %in% names(l1)) {
    # Sin documento: clave aleatoria por registro. No deduplica, y esta bien.
    # Un registro sin documento es un registro que no debe poder enlazarse.
    l1$episode_key <- vapply(seq_len(nrow(l1)),
      function(i) substr(digest::digest(c(Sys.time(), i), algo = "sha256"), 1, 16), character(1))
  }

  # Fecha de nacimiento -> rango de 5 anios. La fecha exacta muere aqui.
  if ("dob" %in% names(l1)) {
    age <- as.numeric(difftime(as.Date(l1$obs_date), as.Date(l1$dob), units = "days")) / 365.25
    l1$age_band <- cut(age, breaks = c(seq(0, 65, by = 5), Inf), right = FALSE,
                       labels = c(sprintf("%02d_%02d", seq(0, 60, 5), seq(4, 64, 5)), "65_up"))
    l1$age_band <- as.character(l1$age_band)
  }

  dropped <- intersect(direct, names(l1))
  l2 <- l1[, setdiff(names(l1), direct), drop = FALSE]

  message("[pseudonymize] L1 -> L2. Identificadores destruidos: ",
          if (length(dropped)) paste(dropped, collapse = ", ") else "(ninguno presente)")
  l2
}

# Verificacion dura: si un identificador directo sobrevive a L2, se detiene.
assert_no_direct_identifiers <- function(l2) {
  banned <- unlist(DICT$disclosure$never_publish)
  present <- intersect(c(banned, "document_number", "dob", "full_name"), names(l2))
  if (length(present)) {
    stop("[pseudonymize] IDENTIFICADORES DIRECTOS EN L2: ",
         paste(present, collapse = ", "), ". La corrida se detiene.")
  }
  invisible(TRUE)
}
