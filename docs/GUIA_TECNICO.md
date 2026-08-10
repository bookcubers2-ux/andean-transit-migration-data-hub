# GUÍA DE UNA PÁGINA · RECOLECCIÓN Y CARGA DE DATOS
### Hub de Datos de Migración de Tránsito Andina (OAMT) · v2.0.0

**Para:** técnicas y técnicos municipales de los 12 nodos del corredor.
**No hace falta** saber estadística ni programación. Si sabe llenar un formulario en el celular, sabe hacer esto.

---

## 1. Antes de empezar: las tres cosas que no se negocian

| | Regla | Por qué |
|---|---|---|
| 1 | **Sin consentimiento no hay registro.** Lea el texto, espere la respuesta, marque `escrito` o `verbal con testigo`. | Un cuestionario sin consentimiento se borra al llegar al sistema. No se puede recuperar después. |
| 2 | **Nunca anote el número de documento, la dirección, el teléfono ni el nombre del empleador.** El formulario no tiene esas casillas. Si alguien le pide agregarlas, diga que no. | Esos datos convertirían la herramienta en un sistema de rastreo. |
| 3 | **La persona puede negarse a cualquier módulo y seguir siendo atendida.** Marque `rechazó` y continúe. | Un rechazo es un dato, no un error. |

---

## 2. Cómo se llena (elija la vía que tenga a mano; el orden de las preguntas es idéntico en las tres)

**Vía A · Celular o tablet, sin internet (la recomendada)**
1. Abra **ODK Collect**. Toque `Formularios en blanco` → `ATMDH / OAMT`.
2. Llene. La app funciona **sin señal**: guarda en el teléfono.
3. Al llegar a un lugar con internet: `Enviar formularios finalizados`. Si falla, no pasa nada, vuelva a intentar mañana. Los datos no se pierden.

**Vía B · Computadora de oficina, sin internet**
1. Abra la plantilla `atmdh_captura.xlsx`. **No agregue, no borre y no mueva columnas.**
2. Use solo las listas desplegables. Si un valor no está en la lista, elija `otro` y avísele a la coordinación.
3. Guarde como `SURVEY__<sumunicipio>__<AAAA-MM>.csv` y entréguelo.

**Vía C · Papel**
Use el formulario impreso. Mismo orden de preguntas. Después alguien lo pasa por la Vía A o B.

---

## 3. Las 7 preguntas donde se cometen todos los errores

| Campo | Qué anotar | Error frecuente |
|---|---|---|
| **Fecha** | El día de HOY, formato `AAAA-MM-DD`. | Poner una fecha futura. El sistema la rechaza. |
| **Rango de edad** | El **rango** (`25 a 29`), nunca la fecha de nacimiento. | Preguntar el año exacto. No se registra. |
| **Municipio anterior** | De dónde viene. Si es fuera del corredor, elija el país. | Dejarlo en blanco. Sin esto no hay mapa de flujos. |
| **Municipio siguiente** | A dónde dice que va. Aunque no esté seguro, **lo que la persona declara**. | Anotar lo que usted supone. |
| **Ocupación** | Elija de la lista. Si no está, escriba las palabras exactas de la persona. | Traducir o "arreglar" lo que dijo. |
| **Días hasta el primer ingreso pagado** | Días desde que llegó a este municipio hasta que ganó su primer peso o sol. `0` si fue el mismo día. En blanco si todavía no gana nada. | Poner `0` cuando en realidad no ha ganado nada. Son cosas distintas. |
| **Contexto del registro** | `rutinario` u `operativo`. Marque **operativo** si ese día hubo control migratorio o policial. | Dejarlo en `rutinario` siempre. Sin este dato el sistema confunde un operativo con una oleada migratoria. |

> **Ingresos:** nunca anote el monto. Elija el **tramo en salarios mínimos**. En un municipio pequeño un monto exacto identifica al empleador.

---

## 4. Cuando reciba el reporte de validación

Cada mes le llega un archivo `validation_AAAAQn.html`. Ábralo con doble clic (es una página web, no necesita internet).

- **Rojo (error):** ese registro **no entró**. Trae el número de fila y qué corregir. Corrija y vuelva a enviar.
- **Amarillo (aviso):** entró, pero confirme el dato. Ejemplo: "grupo de viaje mayor a 12 personas".
- **Azul (plausibilidad):** el mes se ve raro comparado con los anteriores. Ejemplo: "el conteo cambió más de 3 veces". Casi siempre es un operativo o una falla de recolección. Avise cuál de los dos fue.

**Un municipio que reporta cero después de tres meses con datos casi nunca tuvo cero migrantes: casi siempre nadie salió a recolectar.** Si fue así, dígalo. Es información útil, no una falta.

---

## 5. Por qué el tablero a veces dice "n<10"

Cuando una celda tiene menos de 10 personas, el sistema **la tapa con rayas**. No es un error suyo ni un dato perdido: es la regla que impide que alguien identifique a una persona concreta a partir de una cifra pequeña. Su trabajo aparece igual dentro de los totales del municipio y del segmento del corredor.

---

## 6. A quién preguntar

Coordinación técnica del corredor · [contacto] · Consejo Departamental de la Juventud de Santa Cruz.
Ante cualquier duda sobre datos personales, **no adivine: pregunte**. Un dato mal recogido se corrige; un dato que no debió recogerse, no.
