# Congreso Abierto

Observatorio legislativo independiente y portal de datos abiertos para explorar las **leyes aprobadas por el Congreso Nacional de Paraguay** y **cómo votó cada diputado, senador, partido y bancada**.

> El sitio está publicado en [congresoabiertopy.com](https://congresoabiertopy.com) y sigue en desarrollo. El avance se sigue en los [Issues](../../issues) de este repositorio.

## Qué ofrece

- Catálogo de leyes sancionadas en el período legislativo 2023-2028, con enlaces a la fuente oficial.
- Ficha de cada ley, con quién la presentó, sus votaciones nominales y el voto de cada legislador, partido y bancada.
- Ficha de cada legislador del período, con su partido, su bancada, sus votos en las votaciones nominales sobre proyectos de ley (hayan llegado a ser ley o no, con filtro por estado oficial del proyecto) y las leyes de su autoría.
- Datos abiertos descargables.

Más adelante se agregarán la clasificación por temas, indicadores de participación en votaciones, un test de afinidad basado en votaciones reales y avisos por Telegram cuando se sancione una nueva ley.

## Fuente de los datos

Todos los datos provienen de la [API de Datos Abiertos Legislativos](https://datosv2.congreso.gov.py/web/api-doc/index.html) del Congreso Nacional de Paraguay y se muestran tal como allí se publican, con sus posibles errores. El proyecto no corrige los valores oficiales. Si un dato parece incorrecto, compárelo con la fuente oficial.

**Origen de los datos: Datos Abiertos Poder Legislativo.** Los datos del Congreso se publican bajo licencia [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/deed.es). Este proyecto es independiente y no tiene vínculo con el Congreso Nacional ni cuenta con su aval.

Los indicadores calculados por este proyecto (porcentajes, agregados por bancada, etc.) se identifican como tales y su método se documenta.

## Datos abiertos

La copia propia de los datos está en [`datos/`](datos/), en JSON y en CSV (para abrir en una planilla), y se actualiza todos los días.

- [Leyes](datos/fuente/2023-2028/leyes.csv), [votaciones](datos/fuente/2023-2028/votaciones.csv), [votos individuales](datos/fuente/2023-2028/votos.csv), [legisladores](datos/fuente/2023-2028/legisladores.csv), [autores](datos/fuente/2023-2028/autores.csv) y [tramitaciones](datos/fuente/2023-2028/tramitaciones.csv) del período 2023-2028.
- [Diccionario de datos](datos/diccionario.md), con lo que significa cada columna y si es un valor oficial o calculado por este proyecto (las columnas propias empiezan con `_propio`).
- [Cómo están organizados los archivos](datos/README.md).

Se pueden reutilizar libremente bajo [CC BY 4.0](LICENSE-DATOS.md), citando "Origen de los datos: Datos Abiertos Poder Legislativo" y la fecha de actualización. Los mismos archivos se pueden descargar desde la página [`/datos/`](https://congreso.alexisdick.com/datos/) del sitio.

## Sitio

El sitio está en [`sitio/`](sitio/). Usa Astro con salida estática y búsqueda con Pagefind, sin servidor ni base de datos. Cómo compilarlo y cómo está organizado se explica en [`sitio/README.md`](sitio/README.md).

Se publica en [congresoabiertopy.com](https://congresoabiertopy.com) con Cloudflare Pages conectado al repositorio, que lo compila y publica solo con cada cambio en `main`.

## Privacidad

Este proyecto no recoge datos personales de quienes lo visitan. Solo se usan estadísticas anónimas de visitas de Cloudflare Web Analytics, sin cookies.

## Licencias

- **Código** con licencia [GNU AGPL-3.0](LICENSE).
- **Datos derivados publicados por este proyecto** con licencia [CC BY 4.0](LICENSE-DATOS.md), con la atribución indicada.

---

Desarrollado por Alexis Dick con asistencia de IA.
