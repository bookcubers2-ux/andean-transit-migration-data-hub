# Model card · Capa predictiva del OAMT / ATMDH

**Versión del esquema:** 2.0.0 · **Cosecha:** 2026Q3 · **Alcance:** solo flujo registrado

---

## 1. Lo que esta cosecha SÍ pronostica

Eventos de tránsito **registrados** por municipio y por mes, horizonte de 6 meses, con bandas del 80% y del 95%.

## 2. Lo que esta cosecha NO pronostica, y por qué

**La capacidad de absorción laboral no se pronostica.** La definición operativa es:

> **A(m,t)** = número esperado de llegadas adicionales al municipio *m* en el mes *t* que alcanzan trabajo pagado dentro de 60 días, condicionado a la demanda laboral sectorial observada y a la razón de absorción histórica del municipio.

Esa fórmula necesita `fact_labour_demand` (permisos de trabajo nuevos, registros de puestos de mercado, altas formales, vacantes de obra pública). **Cuatro de los doce nodos todavía no entregan esa serie.** Ajustar el modelo a una variable que no se observa produciría un número con intervalo de confianza y sin contenido, que es exactamente la clase de artefacto que una junta de planificación tomaría en serio. No se hace.

Mientras tanto, la razón de absorción a 60 días se publica como **descriptivo histórico**, rotulada como tal en el tablero, sin proyección.

---

## 3. Modelo publicado en esta cosecha

**Ingenua estacional con deriva.** Es la referencia obligatoria del sistema, y en esta cosecha es también el modelo publicado, porque no hay covariables suficientes para justificar nada más complejo. El tablero lo dice en la tarjeta de calibración: *"el modelo ES la ingenua en esta cosecha"*.

**Modelo principal, listo para la cosecha siguiente** (`R/08_model.R::fit_main`, requiere `glmmTMB`):

- binomial negativa parcialmente agrupada, intercepto aleatorio por municipio (los 12 nodos comparten fuerza, y por eso Pisiga puede estimarse pese a tener ~7 eventos al mes)
- estacionalidad armónica de dos frecuencias
- **rezago distribuido del nodo aguas arriba** (1 y 2 meses). Este es el mecanismo predictivo real: un aumento observado en Desaguadero se propaga al interior con 2 a 6 semanas de retardo. Esa estructura de rezago, estimada del propio panel, es lo que convierte gestión reactiva de frontera en planificación
- **covariable de intensidad de control** (`enforcement_context`). Sin ella el modelo pronostica con toda confianza el calendario de los operativos
- reconciliación jerárquica municipio → segmento del corredor → país (`fable::min_trace`)

---

## 4. Tratamiento honesto de una muestra administrativa y no representativa

| Problema | Qué se hace |
|---|---|
| Los registros solo capturan a quien interactúa con el Estado | Todo conteo se rotula **"eventos registrados"**, nunca "población". La etiqueta está forzada en las cadenas de i18n, no depende de que alguien se acuerde |
| La detección se confunde con el flujo | `enforcement_context` entra como covariable, y la regla de plausibilidad P001 marca todo cambio mayor a 3x mes a mes |
| No se conoce la cobertura | Estimación de doble sistema (Chapman) donde el registro administrativo y la encuesta municipal se superponen. Donde no se superponen, la cobertura se reporta **desconocida**, no uno |
| Los intervalos podrían estar mal calibrados | Retrospectiva por origen móvil, MASE y RMSSE contra la ingenua, y cobertura empírica del intervalo del 80%, publicadas **por municipio** en el propio tablero. Los municipios donde el modelo falla se muestran fallando |
| Un punto sin banda invita a leerlo como certeza | `assert_intervals_present()` detiene el export si falta una banda, y el componente de gráfico no dibuja una línea desnuda |
| Riesgo de que la herramienta se use para focalizar personas | **No hay predicción a nivel de persona en ninguna vista ni en ningún nivel de privilegio.** Los pronósticos existen solo por municipio y por mes. Es una garantía estructural, no una configuración |

---

## 5. Cómo saber que el modelo mejoró

La cosecha siguiente reemplaza a la ingenua **solo si** el modelo principal la supera en MASE en al menos 7 de los 12 nodos **y** su cobertura empírica del 80% cae entre 0,72 y 0,92. Si no, se publica la ingenua otra vez y se dice por qué.

---

## 6. Limitaciones que no se resuelven con más datos

- La muestra es de conveniencia en nodos de tránsito. Nunca será representativa de la población migrante del corredor.
- La razón de absorción se mide sobre quienes siguen localizables a los 60 días, lo que sobrerrepresenta a quienes se quedaron. El sesgo va en dirección conocida (**hacia arriba**) y esa dirección se declara junto a la cifra.
- Sin clave de persona entre municipios (decisión de arquitectura, no limitación técnica), no es posible medir trayectorias individuales a lo largo del corredor. Se decidió que ese costo analítico vale menos que el riesgo de construir un sistema de rastreo.
