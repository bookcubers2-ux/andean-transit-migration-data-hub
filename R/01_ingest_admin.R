# =====================================================================
# 01_ingest_admin.R  ·  ATMDH / OAMT
# L0 -> L1 para registros administrativos publicos.
# Doce municipios, dos paises, formatos inconsistentes. El trabajo real
# esta en los perfiles de fuente, no en el codigo de lectura.
# =====================================================================

# Cada fuente declara su perfil: como se llama cada columna alla, como se
# llama aca, y que advertencia de cobertura acompania a todo dato suyo.
# Agregar una fuente nueva es agregar un perfil, no tocar la funcion.
SOURCE_PROFILES <- list(
  "SRC-BO-DIGEMIG" = list(
    publisher = "Direccion General de Migracion (Bolivia)",
    kind = "admin_scrape", encoding = "latin1", sep = ";", date_format = "%d/%m/%Y",
    map = c(obs_date = "FECHA", mun_raw = "PUESTO", nat_raw = "NACIONALIDAD",
            sex_raw = "SEXO", dob = "FECHA_NAC", status_raw = "CATEGORIA"),
    caveat_es = "Solo registra a quien se presenta ante la autoridad migratoria. La cobertura sube durante operativos y baja fuera de ellos.",
    caveat_en = "Records only those who present to the migration authority. Coverage rises during enforcement operations and falls outside them."
  ),
  "SRC-PE-MIGRACIONES" = list(
    publisher = "Superintendencia Nacional de Migraciones (Peru)",
    kind = "admin_scrape", encoding = "UTF-8", sep = ",", date_format = "%Y-%m-%d",
    map = c(obs_date = "fecha_registro", mun_raw = "puesto_control", nat_raw = "pais_nac",
            sex_raw = "sexo", dob = "fec_nacimiento", status_raw = "calidad_migratoria"),
    caveat_es = "Publicacion mensual con rezago de hasta 60 dias. Los ultimos dos meses de cada serie son preliminares.",
    caveat_en = "Monthly publication with up to a 60-day lag. The last two months of any series are preliminary."
  ),
  "SRC-MUN-PERMISOS" = list(
    publisher = "Registros municipales de licencias y puestos de mercado",
    kind = "admin_transfer", encoding = "UTF-8", sep = ",", date_format = "%Y-%m-%d",
    map = c(obs_date = "fecha", mun_raw = "municipio", isic_raw = "rubro", value = "cantidad"),
    caveat_es = "PENDIENTE. Cuatro de los doce nodos aun no entregan esta serie. Ver model_card.md: la primera cosecha es solo de flujo.",
    caveat_en = "PENDING. Four of the twelve nodes do not yet deliver this series. See model_card.md: the first vintage is flow-only."
  )
)

read_admin_source <- function(file, source_id) {
  p <- SOURCE_PROFILES[[source_id]]
  if (is.null(p)) stop("Fuente sin perfil declarado: ", source_id)

  raw <- readr::read_delim(file, delim = p$sep, locale = readr::locale(encoding = p$encoding),
                           show_col_types = FALSE, col_types = readr::cols(.default = "c"))

  missing <- setdiff(unname(p$map), names(raw))
  if (length(missing)) {
    stop("[ingest] La fuente ", source_id, " cambio de estructura. Faltan: ",
         paste(missing, collapse = ", "),
         "\n  Actualice el perfil en 01_ingest_admin.R antes de continuar. ",
         "No renombre columnas a mano en el archivo original.")
  }

  out <- tibble::as_tibble(raw[unname(p$map)])
  names(out) <- names(p$map)
  out$obs_date  <- as.Date(out$obs_date, format = p$date_format)
  out$source_id <- source_id
  out$ingested_from <- basename(file)
  out
}

ingest_all_admin <- function(dir = PATHS$L0_raw) {
  files <- list.files(dir, pattern = "\\.(csv|txt)$", full.names = TRUE, recursive = TRUE)
  if (!length(files)) {
    message("[ingest] Sin archivos en ", dir, ". Use R/99_make_synthetic.R para una corrida de prueba.")
    return(tibble::tibble())
  }
  # convencion de nombres: <SOURCE_ID>__<lo-que-sea>.csv
  purrr::map_dfr(files, function(f) {
    sid <- sub("__.*$", "", basename(f))
    read_admin_source(f, sid)
  })
}
