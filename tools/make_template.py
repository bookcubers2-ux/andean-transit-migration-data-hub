"""Genera la plantilla de Excel para entregar los registros de campo al Hub.

Uso: python -I tools/make_template.py [salida.xlsx] [--test]
Las listas desplegables salen de dictionary/codelists.yaml. El argumento --test
llena REGISTROS con filas inventadas, solo para comprobar las formulas.
"""
import os, sys, random
import openpyxl
from openpyxl.styles import Font, PatternFill, Alignment, Border, Side
from openpyxl.worksheet.datavalidation import DataValidation
from openpyxl.formatting.rule import CellIsRule
from openpyxl.utils import get_column_letter as L

ROOT = os.path.normpath(os.path.join(os.path.dirname(os.path.abspath(__file__)), ".."))
OUT = next((a for a in sys.argv[1:] if not a.startswith("--")),
           os.path.join(ROOT, "_ENTREGAS", "00_PLANTILLA", "ATMDH_plantilla_registros.xlsx"))
TEST = "--test" in sys.argv

NOCHE, HIELO, LAGO, OCRE = "0B1626", "F3F0E8", "0F6B78", "E3A02B"
HDR = PatternFill("solid", fgColor=NOCHE)
REQ = PatternFill("solid", fgColor=LAGO)
SOFT = PatternFill("solid", fgColor=HIELO)
thin = Side(style="thin", color="C9C4B6")
BORDER = Border(left=thin, right=thin, top=thin, bottom=thin)
WHITE = Font(bold=True, color="FFFFFF", name="Calibri", size=11)

# ---------------------------------------------------------------- listas
LISTS = {
    "mun_id": [
        ("PE-211101", "Juliaca"), ("PE-210101", "Puno"), ("PE-211301", "Yunguyo"), ("PE-210402", "Desaguadero (Peru)"),
        ("BO-020804", "Desaguadero (Bolivia)"), ("BO-021701", "Copacabana"), ("BO-020105", "El Alto"),
        ("BO-040101", "Oruro"), ("BO-070101", "Santa Cruz de la Sierra"), ("BO-040901", "Sabaya (Pisiga)"),
        ("BO-051501", "Villazon"), ("BO-060301", "Yacuiba"), ("PE-230101", "Tacna"),
        ("BO-030101", "Cochabamba (codigo por verificar)"), ("BO-020101", "La Paz (codigo por verificar)")],
    "consent_mode": ["written", "verbal_witnessed"],
    "node_type": ["border_post", "terminal", "shelter", "municipal_office", "market", "street_survey"],
    "direction": ["inbound", "outbound", "internal", "unknown"],
    "age_band": ["00_04", "05_09", "10_14", "15_19", "20_24", "25_29", "30_34", "35_39", "40_44", "45_49",
                 "50_54", "55_59", "60_64", "65_up"],
    "sex": ["F", "M", "X", "NR"],
    "bool": ["TRUE", "FALSE"],
    "status_rank": ["1", "2", "3", "4", "5", "6"],
    "enforcement_context": ["routine", "operativo", "post_policy_change", "unknown"],
    "isic1": ["A", "C", "F", "G", "H", "I", "N", "T", "OTH"],
    "formality": ["formal_contract", "formal_selfemp", "informal_wage", "informal_own_account", "unpaid", "none"],
    "hours_band": ["lt20", "20_39", "40_48", "gt48"],
    "earnings_band_smn": ["lt050", "050_099", "100_149", "150_199", "ge200", "NR"],
    "job_search_channel": ["family_network", "street_direct", "employer_broker", "ngo_referral", "municipal_office", "digital", "other"],
    "tipo_lugar": ["terminal", "albergue", "parroquia", "otro"],
}

# ---------------------------------------------------------------- columnas de REGISTROS
# (nombre, obligatoria, lista, descripcion, ejemplo1, ejemplo2, ejemplo3)
COLS = [
    ("mun_id", True, "mun_id", "Municipio donde se hizo el registro (codigo, elige de la lista)", "BO-020105", "BO-070101", "BO-070101"),
    ("obs_date", True, None, "Dia del registro, escrito AAAA-MM-DD. Nunca una fecha futura", "2026-09-14", "2026-05-21", "2026-05-21"),
    ("consent_version", True, None, "Version del consentimiento que se leyo (ej. v1.0). Sin esto el registro se rechaza", "v1.0", "v1.0", "v1.0"),
    ("consent_mode", True, "consent_mode", "written = firmado; verbal_witnessed = verbal con testigo", "written", "verbal_witnessed", "written"),
    ("interviewer_id", False, None, "Codigo de quien hizo el registro (V01, V02...). Nunca se publica", "V02", "V04", "V04"),
    ("node_type", True, "node_type", "Tipo de lugar donde se hizo", "terminal", "terminal", "shelter"),
    ("direction", True, "direction", "inbound = llega al municipio; outbound = sale; internal; unknown", "inbound", "inbound", "inbound"),
    ("origin_mun_id", True, None, "Municipio anterior que declara. Codigo del municipio, o EXT-XXX si viene de fuera del corredor (EXT-VEN, EXT-COL), o UNK", "PE-210402", "EXT-PER", "PE-210402"),
    ("intended_dest_id", True, None, "Municipio siguiente que declara. Lo que dice la persona, aunque no sea seguro. UNK si no sabe", "BO-070101", "UNK", "BO-070101"),
    ("nat_iso3", True, None, "Nacionalidad, codigo de 3 letras (VEN, COL, PER, BOL...)", "VEN", "COL", "VEN"),
    ("age_band", True, "age_band", "RANGO de edad. Nunca la fecha de nacimiento", "25_29", "35_39", "30_34"),
    ("sex", True, "sex", "F mujer, M hombre, X otra o no binaria, NR prefiere no responder", "F", "M", "F"),
    ("travel_group_size", False, None, "Personas en el grupo de viaje, de 1 a 30", "3", "1", "3"),
    ("has_children_in_group", False, "bool", "TRUE si el grupo viaja con ninos", "TRUE", "FALSE", "TRUE"),
    ("status_rank", False, "status_rank", "Situacion migratoria: 1 sin documentacion, 2 tramite, 3 transito, 4 temporal, 5 con autorizacion laboral, 6 indefinida", "1", "3", "2"),
    ("enforcement_context", True, "enforcement_context", "operativo SOLO si ese dia hubo control migratorio o policial. Si no, routine", "routine", "routine", "routine"),
    ("occ_local_code", False, None, "Codigo de ocupacion de la lista del Hub (ej. 5212 vendedor ambulante). Si no esta, deja vacio y llena occ_verbatim", "5212", "9313", ""),
    ("occ_verbatim", False, None, "Ocupacion con las palabras exactas de la persona. Nunca la 'arregles'", "vende dulces", "peon de obra", "cocinera"),
    ("isic1", False, "isic1", "Sector economico (seccion CIIU). Si no sabes, OTH", "G", "F", "I"),
    ("formality", False, "formality", "Tipo de trabajo. none = sin actividad remunerada", "informal_own_account", "none", "informal_wage"),
    ("hours_band", False, "hours_band", "Horas por semana", "40_48", "", "20_39"),
    ("earnings_band_smn", False, "earnings_band_smn", "TRAMO de ingreso en salarios minimos. Nunca el monto", "lt050", "", "050_099"),
    ("days_to_first_income", False, None, "Dias desde que llego hasta su primer ingreso. 0 = el mismo dia. VACIO si todavia no gana nada", "12", "", "30"),
    ("job_search_channel", False, "job_search_channel", "Como busca o consiguio trabajo", "family_network", "", "ngo_referral"),
    ("has_work_permit", False, "bool", "TRUE si tiene permiso de trabajo", "FALSE", "", "FALSE"),
    ("wage_theft_reported", False, "bool", "TRUE si reporto impago o retencion de salario", "FALSE", "", "FALSE"),
    ("refusal_flags", False, None, "Modulos que la persona se nego a responder (ej. trabajo). Un rechazo es un dato, no un error", "", "trabajo", ""),
]
NCOLS = len(COLS)
FIRST, LAST = 2, 701          # filas de datos: hasta 700 registros

wb = openpyxl.Workbook()

# ================================================================ LEEME
ws = wb.active
ws.title = "LEEME"
lines = [
    ("ATMDH / OAMT  ·  Plantilla de entrega de registros de campo", True),
    ("", False),
    ("QUE ES: la forma exacta en que quiero recibir los registros que ya tienes (los 412 y los que vengan).", False),
    ("", False),
    ("1. Una fila por cuestionario en la hoja REGISTROS. Si hay 412 cuestionarios, hay exactamente 412 filas.", False),
    ("2. Usa las listas desplegables. Si un valor no esta en la lista, deja la celda vacia y dime cual era. No inventes codigos.", False),
    ("3. Las columnas en verde son obligatorias. Las demas se dejan vacias si la persona no respondio (un rechazo es un dato).", False),
    ("4. Fechas como 2026-09-14 (anio-mes-dia). Edad siempre como RANGO, nunca fecha de nacimiento.", False),
    ("5. NUNCA escribas nombre, numero de documento, direccion, telefono ni el nombre del empleador. Esta plantilla no tiene esas columnas.", False),
    ("6. Hoja CAMPANAS: una fila por campana (10 filas). Los totales deben dar 900 y 412.", False),
    ("7. Hoja CONTROL: se llena sola. Te dice cuantos registros hay por municipio y mes, y marca en verde los que llegan a 10.", False),
    ("8. Hoja OTROS: la capacitacion de El Alto, las reuniones con DIGEMIG y el texto del consentimiento.", False),
    ("9. Guarda el archivo y pasame la RUTA. No lo mandes por chat ni lo subas a GitHub: tiene datos de personas.", False),
    ("", False),
    ("Hoja EJEMPLO: tres filas inventadas, solo para ver como se llena. No son datos reales.", False),
]
for i, (t, b) in enumerate(lines, 1):
    c = ws.cell(row=i, column=1, value=t)
    c.font = Font(bold=b, size=14 if b else 11, color=NOCHE, name="Calibri")
    c.alignment = Alignment(wrap_text=True, vertical="top")
ws.column_dimensions["A"].width = 120

# ================================================================ LISTAS
wl = wb.create_sheet("LISTAS")
ranges = {}
for j, (k, vals) in enumerate(LISTS.items(), 1):
    wl.cell(row=1, column=j, value=k).font = WHITE
    wl.cell(row=1, column=j).fill = HDR
    for i, v in enumerate(vals, 2):
        wl.cell(row=i, column=j, value=v if isinstance(v, str) else v[0])
    if k == "mun_id":
        wl.cell(row=1, column=len(LISTS) + 1, value="mun_id (nombre)").font = WHITE
        wl.cell(row=1, column=len(LISTS) + 1).fill = HDR
        for i, v in enumerate(vals, 2):
            wl.cell(row=i, column=len(LISTS) + 1, value=v[1])
    ranges[k] = f"LISTAS!${L(j)}$2:${L(j)}${len(vals) + 1}"
    wl.column_dimensions[L(j)].width = 22
wl.column_dimensions[L(len(LISTS) + 1)].width = 34

# ================================================================ REGISTROS
wr = wb.create_sheet("REGISTROS", 1)
for j, (name, req, lst, desc, *_ex) in enumerate(COLS, 1):
    c = wr.cell(row=1, column=j, value=name)
    c.font = WHITE
    c.fill = REQ if req else HDR
    c.alignment = Alignment(horizontal="center", vertical="center", wrap_text=True)
    c.border = BORDER
    wr.column_dimensions[L(j)].width = max(14, min(26, len(name) + 4))
    for r in range(FIRST, LAST + 1):
        wr.cell(row=r, column=j).number_format = "@"
    if lst:
        dv = DataValidation(type="list", formula1="=" + ranges[lst], allow_blank=True, showErrorMessage=True,
                            errorTitle="Valor fuera de la lista", error="Elige un valor de la lista. Si no esta, deja la celda vacia.")
        wr.add_data_validation(dv)
        dv.add(f"{L(j)}{FIRST}:{L(j)}{LAST}")
wr.row_dimensions[1].height = 34
wr.freeze_panes = "A2"

# ================================================================ EJEMPLO
we = wb.create_sheet("EJEMPLO", 2)
for j, (name, req, lst, desc, *ex) in enumerate(COLS, 1):
    c = we.cell(row=1, column=j, value=name)
    c.font = WHITE; c.fill = REQ if req else HDR; c.border = BORDER
    c.alignment = Alignment(horizontal="center", wrap_text=True)
    we.column_dimensions[L(j)].width = max(14, min(26, len(name) + 4))
    for i, v in enumerate(ex, 2):
        cell = we.cell(row=i, column=j, value=v)
        cell.number_format = "@"
        cell.font = Font(italic=True, color="5A6577")
        cell.fill = SOFT
we.cell(row=6, column=1, value="Filas inventadas. No son datos reales. No las copies a REGISTROS.").font = Font(bold=True, color="B4372D")
we.row_dimensions[1].height = 34

# ================================================================ DICCIONARIO
wd = wb.create_sheet("DICCIONARIO", 3)
for j, h in enumerate(["columna", "obligatoria", "valores permitidos", "que es"], 1):
    c = wd.cell(row=1, column=j, value=h); c.font = WHITE; c.fill = HDR
for i, (name, req, lst, desc, *_ex) in enumerate(COLS, 2):
    wd.cell(row=i, column=1, value=name).font = Font(bold=True)
    wd.cell(row=i, column=2, value="SI" if req else "no")
    vals = ", ".join(v if isinstance(v, str) else v[0] for v in LISTS[lst]) if lst else "texto o numero, como se indica"
    wd.cell(row=i, column=3, value=vals).alignment = Alignment(wrap_text=True, vertical="top")
    wd.cell(row=i, column=4, value=desc).alignment = Alignment(wrap_text=True, vertical="top")
for col, w in zip("ABCD", (24, 12, 70, 80)):
    wd.column_dimensions[col].width = w

# ================================================================ CAMPANAS
wc = wb.create_sheet("CAMPANAS", 4)
heads = ["campana_n", "fecha", "ciudad", "mun_id", "tipo_lugar", "lugar", "personas_alcanzadas", "registros_con_consentimiento", "voluntarios"]
for j, h in enumerate(heads, 1):
    c = wc.cell(row=1, column=j, value=h); c.font = WHITE; c.fill = HDR; c.border = BORDER
    c.alignment = Alignment(horizontal="center", wrap_text=True)
    wc.column_dimensions[L(j)].width = 20
wc.column_dimensions["F"].width = 36
dv1 = DataValidation(type="list", formula1="=" + ranges["mun_id"], allow_blank=True); wc.add_data_validation(dv1); dv1.add("D2:D11")
dv2 = DataValidation(type="list", formula1="=" + ranges["tipo_lugar"], allow_blank=True); wc.add_data_validation(dv2); dv2.add("E2:E11")
for r in range(2, 12):
    wc.cell(row=r, column=1, value=r - 1)
    wc.cell(row=r, column=2).number_format = "@"
wc.cell(row=12, column=6, value="TOTAL").font = Font(bold=True)
wc.cell(row=12, column=7, value="=SUM(G2:G11)").font = Font(bold=True)
wc.cell(row=12, column=8, value="=SUM(H2:H11)").font = Font(bold=True)
wc.cell(row=13, column=6, value="Debe dar")
wc.cell(row=13, column=7, value=900); wc.cell(row=13, column=8, value=412)
wc.cell(row=14, column=6, value="Revision")
wc.cell(row=14, column=7, value='=IF(G12=G13,"OK","NO COINCIDE")')
wc.cell(row=14, column=8, value='=IF(H12=H13,"OK","NO COINCIDE")')
wc.cell(row=15, column=6, value="Tasa de consentimiento")
wc.cell(row=15, column=8, value='=IF(G12=0,"",H12/G12)'); wc.cell(row=15, column=8).number_format = "0.0%"
wc.cell(row=17, column=1, value="lugar = el sitio (terminal, parroquia, albergue). Nunca el nombre de una persona.").font = Font(italic=True, color="5A6577")

# ================================================================ CONTROL
wk = wb.create_sheet("CONTROL", 5)
months = ["2026-03", "2026-04", "2026-05", "2026-06", "2026-07", "2026-08", "2026-09", "2026-10"]
wk.cell(row=1, column=1, value="Cuantos registros hay por municipio y mes (se llena sola desde REGISTROS)").font = Font(bold=True, size=13, color=NOCHE)
wk.cell(row=2, column=1, value="Verde = 10 o mas: ese dato se puede publicar. Ambar = menos de 10: el tablero lo ocultara (n<10).").font = Font(italic=True, color="5A6577")
hdrs = ["mun_id", "municipio"] + months + ["otros meses", "TOTAL"]
for j, h in enumerate(hdrs, 1):
    c = wk.cell(row=4, column=j, value=h); c.font = WHITE; c.fill = HDR; c.border = BORDER
    c.alignment = Alignment(horizontal="center")
    wk.column_dimensions[L(j)].width = 14 if j > 2 else (12 if j == 1 else 34)
rng_m = f"REGISTROS!$A${FIRST}:$A${LAST}"
rng_d = f"REGISTROS!$B${FIRST}:$B${LAST}"
for i, (mid, name) in enumerate(LISTS["mun_id"], 5):
    wk.cell(row=i, column=1, value=mid); wk.cell(row=i, column=2, value=name)
    for j, mth in enumerate(months, 3):
        c = wk.cell(row=i, column=j, value=f'=COUNTIFS({rng_m},$A{i},{rng_d},"{mth}*")')
        c.border = BORDER; c.alignment = Alignment(horizontal="center")
    last_m = 2 + len(months)
    wk.cell(row=i, column=last_m + 2, value=f'=COUNTIFS({rng_m},$A{i})').font = Font(bold=True)
    wk.cell(row=i, column=last_m + 1, value=f"={L(last_m + 2)}{i}-SUM(C{i}:{L(last_m)}{i})")
    for jj in (last_m + 1, last_m + 2):
        wk.cell(row=i, column=jj).alignment = Alignment(horizontal="center")
tr = 5 + len(LISTS["mun_id"])
wk.cell(row=tr, column=2, value="TOTAL").font = Font(bold=True)
for j in range(3, 2 + len(months) + 3):
    wk.cell(row=tr, column=j, value=f"=SUM({L(j)}5:{L(j)}{tr - 1})").font = Font(bold=True)
    wk.cell(row=tr, column=j).alignment = Alignment(horizontal="center")
wk.cell(row=tr + 2, column=2, value="Filas llenas en REGISTROS")
wk.cell(row=tr + 2, column=3, value=f'=COUNTA(REGISTROS!$A${FIRST}:$A${LAST})')
wk.cell(row=tr + 3, column=2, value="Debe dar")
wk.cell(row=tr + 3, column=3, value=412)
wk.cell(row=tr + 4, column=2, value="Revision")
wk.cell(row=tr + 4, column=3, value=f'=IF(C{tr + 2}=C{tr + 3},"OK","NO COINCIDE")')
wk.cell(row=tr + 5, column=2, value="Registros sin municipio de la lista")
wk.cell(row=tr + 5, column=3, value=f'=C{tr + 2}-{L(2 + len(months) + 2)}{tr}')
green = PatternFill("solid", bgColor="B7E1C1", fgColor="B7E1C1")
amber = PatternFill("solid", bgColor="FCE4B2", fgColor="FCE4B2")
area = f"C5:{L(2 + len(months))}{tr - 1}"
wk.conditional_formatting.add(area, CellIsRule(operator="greaterThanOrEqual", formula=["10"], fill=green))
wk.conditional_formatting.add(area, CellIsRule(operator="between", formula=["1", "9"], fill=amber))

# ================================================================ OTROS
wo = wb.create_sheet("OTROS", 6)
blocks = [
    ("Capacitacion de El Alto", ["fecha", "lugar", "personas_capacitadas", "cargos (ej. tecnico municipal)", "quien la dio"]),
    ("Reuniones con DIGEMIG", ["n", "fecha", "lugar o medio", "quienes asistieron (cargos)", "que se acordo"]),
    ("Texto del consentimiento", ["consent_version", "fecha de la version", "idioma", "texto completo (pega abajo o adjunta el PDF)"]),
]
row = 1
for title, cols in blocks:
    wo.cell(row=row, column=1, value=title).font = Font(bold=True, size=12, color=NOCHE)
    row += 1
    for j, h in enumerate(cols, 1):
        c = wo.cell(row=row, column=j, value=h); c.font = WHITE; c.fill = HDR; c.border = BORDER
    row += 4 if "Reuniones" not in title else 5
    row += 1
for col in "ABCDE":
    wo.column_dimensions[col].width = 34

# ---------------------------------------------------------------- prueba
if TEST:
    random.seed(7)
    muns = [m for m, _ in LISTS["mun_id"][:9]] + ["BO-030101"]
    for r in range(FIRST, FIRST + 60):
        mid = random.choice(muns)
        d = f"2026-0{random.choice([3,4,5,6,7,8,9])}-1{random.randint(0,9)}"
        wr.cell(row=r, column=1, value=mid)
        wr.cell(row=r, column=2, value=d)

os.makedirs(os.path.dirname(OUT), exist_ok=True)
wb.save(OUT)
print("guardado:", OUT)
