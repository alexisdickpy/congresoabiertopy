# 0001 · Arquitectura técnica

- **Estado:** propuesta, pendiente de aprobación en el PR que cierra #2.
- **Fecha:** 22 de octubre de 2026.
- **Insumos:** [auditoría de la API](../auditoria-datos.md) (sección 11) y [cifras medidas](../auditoria/cifras.json).

## Resumen de la decisión

| Pieza | Decisión |
|---|---|
| Importador | Python 3 con solo la biblioteca estándar |
| Copia propia de los datos | Archivos JSON y CSV versionados en este repositorio, separados por período legislativo |
| Generador del sitio | [Astro](https://astro.build/), salida 100 % estática |
| Búsqueda básica | Índice estático en el navegador con [Pagefind](https://pagefind.app/) |
| Automatización | GitHub Actions: sincronización incremental diaria y completa semanal |
| Publicación | Cloudflare Pages conectado al repositorio (integración con Git) |
| Servidor y base de datos | Ninguno |
| Coste recurrente | Cero, salvo el dominio |

El flujo es una cadena de capas que no se mezclan:

```
API del Congreso ──► importador (Python) ──► datos/ (JSON y CSV) ──► sitio/ (Astro) ──► Cloudflare Pages
                        GitHub Actions           repositorio            compilación en Cloudflare
```

Cada capa solo lee la salida de la anterior. El sitio nunca consulta la API: trabaja con la copia propia.

## Contexto

Lo que pesa en esta decisión, según la auditoría:

- **Volumen chico.** 556 registros de ley (541 números distintos), 1.165 votaciones nominales, 82.680 votos individuales y 127 legisladores vigentes. Normalizados ocupan unos pocos MB.
- **La API no informa cuándo se modificó un registro.** Hay que comparar descargas: incremental cada día y completa cada semana.
- **Paginación particular.** `offset` es el número de página, empezando en 1.
- **El endpoint `votacion/parlamentario/{id}` está roto.** El historial de cada legislador se arma desde el listado general de votaciones.
- **El `idLegislador` cambia en cada legislatura.** No sirve como identificador estable de una persona.
- **Fidelidad a la fuente.** Los valores oficiales se muestran tal como se publican, nunca se sobrescriben. Los cálculos y correcciones propios van aparte y señalados (criterios en #3 y #9).
- **Restricciones acordadas.** Cloudflare Pages, GitHub Actions, coste cero salvo el dominio, sin servidor ni base de datos de pago, sin datos personales de visitantes.
- **Requisitos a futuro.** Rediseño completo por un tercero en la Fase 4 (#14) y legislaturas anteriores en la Fase 5 (#15).

## Límites de los planes gratuitos

Verificados el **22 de octubre de 2026** en la documentación oficial. Deben revisarse si cambia el uso o pasa más de un año.

### Cloudflare Pages (plan Free)

Fuentes: [Limits](https://developers.cloudflare.com/pages/platform/limits/), [Functions pricing](https://developers.cloudflare.com/pages/functions/pricing/), [Direct Upload](https://developers.cloudflare.com/pages/get-started/direct-upload/).

| Límite | Valor | Uso previsto en la Fase 1 |
|---|---|---|
| Compilaciones por mes | 500 | ~30 diarias + PRs y cambios manuales: 40-80 |
| Compilaciones simultáneas | 1 | Suficiente |
| Tiempo máximo de compilación | 20 minutos | Estimado: 1-3 minutos |
| Archivos por despliegue | 20.000 | Estimado: 4.000-6.000 (páginas + índice de búsqueda + descargas) |
| Tamaño máximo por archivo | 25 MiB | El archivo más grande (votos del período en CSV) queda muy por debajo |
| Proyectos por cuenta | 100 | 1 |
| Dominios propios por proyecto | 100 | 1-2 |
| Reglas en `_redirects` | 2.000 estáticas + 100 dinámicas | Reservadas para mantener URLs viejas tras cambios |
| Reglas en `_headers` | 100 | Pocas |
| Peticiones a archivos estáticos | Gratis e ilimitadas | Todo el sitio es estático |
| Functions (código en servidor) | 100.000 peticiones/día (cuota de Workers) | No se usan |

La página de límites no menciona un tope de ancho de banda. Las peticiones a archivos estáticos son gratuitas e ilimitadas.

### GitHub Actions y repositorio (repositorio público)

Fuentes: [Billing](https://docs.github.com/en/actions/administering-github-actions/usage-limits-billing-and-administration), [Actions limits](https://docs.github.com/en/actions/reference/limits), [Events that trigger workflows](https://docs.github.com/en/actions/writing-workflows/choosing-when-your-workflow-runs/events-that-trigger-workflows), [Large files](https://docs.github.com/en/repositories/working-with-files/managing-large-files/about-large-files-on-github).

| Límite | Valor | Uso previsto |
|---|---|---|
| Coste de los minutos | Gratis en repositorios públicos con ejecutores estándar | Sin coste |
| Duración máxima de un trabajo | 6 horas | Diaria: pocos minutos. Semanal: estimado 15-30 minutos (~1.300 consultas, ~130 MB) |
| Trabajos simultáneos | 20 | 1 |
| Intervalo mínimo programado | 5 minutos; puede retrasarse en horas de mucha carga, sobre todo al inicio de cada hora | 1 vez al día, a un minuto no redondo |
| Desactivación automática | Los flujos programados de un repo público se desactivan tras 60 días sin actividad | Se evita: la sincronización hace un commit diario (ver abajo) |
| Peticiones a la API de GitHub con `GITHUB_TOKEN` | 1.000 por hora | Unas pocas por ejecución |
| Almacenamiento de artefactos | 500 MB | No se usan para datos |
| Caché | 10 GB por repositorio | Opcional, para la descarga semanal |
| Tamaño de archivo en el repo | Aviso desde 50 MiB, bloqueo desde 100 MiB | Archivos de pocos MB |
| Tamaño recomendado del repo | Menos de 1 GB (muy recomendable menos de 5 GB) | Unos pocos MB más el historial de cambios |

## Decisiones y alternativas

### 1. Importador: Python con la biblioteca estándar

- **Decisión.** Python 3.10 o posterior, sin dependencias externas, igual que los scripts de la auditoría.
- **Motivos.**
  - Ya está probado contra esta API: paginación, errores 404, codificación y tiempos.
  - Viene instalado en los ejecutores de GitHub Actions; no hay nada que instalar ni actualizar.
  - Sin dependencias externas no hay riesgo de que una biblioteca deje de funcionar.
- **Alternativas descartadas.**
  - *Node.js (el mismo lenguaje del sitio):* unificaría lenguajes, pero obligaría a reescribir lo que ya funciona.
  - *Herramientas de terceros de extracción de datos:* agregan dependencias sin necesidad para este volumen.

### 2. Copia propia: JSON y CSV en el repositorio

- **Decisión.** Los datos normalizados se guardan como archivos de texto en `datos/`, separados por período legislativo y ordenados siempre de la misma manera.
- **Motivos.**
  - El volumen es chico: unos pocos MB.
  - El historial de Git muestra públicamente **qué cambió el Congreso y cuándo**, algo que la API no informa.
  - Los mismos archivos sirven como datos abiertos descargables (#5).
  - Si un día se reemplaza Astro, los datos no se tocan.
- **Formato.**
  - JSON para las entidades con estructura: leyes, votaciones, legisladores, autores.
  - CSV para tablas grandes y planas: votos individuales.
  - Fechas en ISO (`aaaa-mm-dd`) en un campo propio; el texto original de la API se conserva al lado.
  - Orden fijo por identificador, para que una descarga sin cambios produzca exactamente los mismos archivos.
- **La respuesta cruda de la API no se sube** (154 MB y muy repetitiva). Se guarda solo en la caché local y en la caché de GitHub Actions.
- **Alternativas descartadas.**
  - *SQLite:* cómodo para consultas, pero los cambios no se ven en el historial y cada versión agrega un archivo binario entero.
  - *Base de datos alojada (gratuita o de pago):* agrega un servicio, credenciales y un punto de falla sin necesidad.

### 3. Generador del sitio: Astro

- **Decisión.** Astro en modo estático: genera HTML puro en la compilación y no necesita servidor.
- **Motivos.**
  - **Rediseño externo.** Las plantillas y componentes de Astro son casi HTML. Un diseñador, o una herramienta como Google Stitch, puede trabajar en ellas sin conocer la lógica de datos.
  - **Componentes reutilizables.** Una tarjeta de ley, una tabla de votos o un encabezado se definen una sola vez.
  - **Piezas ya hechas.** Mapa del sitio, páginas generadas a partir de los datos e integración con Pagefind.
  - **Sin JavaScript por defecto** en el navegador: páginas rápidas y fáciles de indexar (#10).
  - **Gratuito y muy usado.** Cloudflare Pages lo compila sin configuración especial.
- **Coste.** Suma Node.js como segunda herramienta. Se acepta, porque el beneficio para el rediseño es mayor.
- **Versiones.** Astro, Pagefind y Node.js se fijan a una versión exacta (`package.json`, `package-lock.json` y `.node-version`) para que la compilación sea reproducible.
- **Alternativas descartadas.**
  - *Todo en Python (plantillas Jinja):* un solo lenguaje, pero sin componentes ni piezas ya hechas, y menos práctico para un tercero.
  - *Eleventy, Hugo:* válidos, pero con menos ventajas para un rediseño basado en componentes.
  - *Aplicación de una sola página (React u otra) que lee JSON en el navegador:* peor para buscadores y para compartir enlaces, y más pesada.

### 4. Búsqueda básica: Pagefind

- **Decisión.** Pagefind genera, al final de la compilación, un índice estático a partir de las páginas ya creadas. El navegador descarga solo los fragmentos que necesita.
- **Motivos.** Funciona sin servidor, es gratuito, admite español y no envía las búsquedas a terceros (privacidad).
- **Alternativa descartada.** *Servicios de búsqueda alojados:* tienen coste o límites y envían datos de los visitantes a un tercero.

### 5. Automatización: GitHub Actions

Dos flujos programados, que se implementan en #3 y #4:

1. **Diario** (incremental):
   - descarga `ley/periodo/{período actual}` completo;
   - descarga las votaciones nuevas, desde el mayor `idVotacion` conocido;
   - descarga el detalle solo de los proyectos nuevos.
2. **Semanal** (completo): vuelve a descargar todo el período para detectar correcciones en registros ya existentes.

En ambos casos:

- El importador regenera `datos/` y, si hay cambios, los confirma en `main` con un commit automático.
- Cada ejecución actualiza `datos/estado.json` con la fecha y hora de la última comprobación. Así:
  - el sitio puede mostrar la fecha de actualización que exige la cita de la fuente;
  - el repositorio tiene actividad diaria y GitHub no desactiva los flujos programados a los 60 días.
- Si la API falla o devuelve datos incompletos (por ejemplo, muchos menos registros que la vez anterior), el flujo **no** confirma cambios y queda marcado como fallido. Así no se publica una copia rota.
- **Riesgo a verificar en #4:** que la API del Congreso responda bien desde los servidores de GitHub, que están fuera de Paraguay. Si no responde, la alternativa gratuita es ejecutar la sincronización desde una computadora propia.

### 6. Publicación: Cloudflare Pages conectado al repositorio

- **Decisión.** El proyecto de Cloudflare Pages se conecta al repositorio de GitHub. Cada cambio en `main` (datos nuevos o código) dispara una compilación y publicación en `congreso.alexisdick.com` (#11), desde #128 en `congresoabiertopy.com`.
- **Motivos.**
  - No hay que guardar claves de Cloudflare en GitHub.
  - Cada PR recibe automáticamente una vista previa con su propia dirección, útil para revisar el rediseño.
  - El consumo previsto (40-80 compilaciones al mes) queda lejos del límite de 500.
- **Alternativa descartada.** *Compilar en GitHub Actions y subir con Wrangler (Direct Upload):* más control, pero requiere un token de Cloudflare como secreto. Además, un proyecto creado así no puede pasar después a la integración con Git.

## Estructura de carpetas

```
congresoabiertopy/
├── .github/workflows/        # Sincronización diaria y semanal, pruebas
├── datos/                    # Copia propia publicada (CC BY 4.0)
│   ├── periodos.json         # Registro de períodos legislativos incluidos
│   ├── estado.json           # Última comprobación y última modificación
│   ├── fuente/               # Valores oficiales, tal como los publica el Congreso
│   │   └── 2023-2028/
│   │       ├── leyes.json
│   │       ├── tramitaciones.json   # Agregado en #3: separa el 80 % del peso de leyes.json
│   │       ├── votaciones.json
│   │       ├── votos.csv
│   │       ├── legisladores.json
│   │       └── autores.json
│   └── propios/              # Capa propia, siempre señalada como tal
│       ├── personas.json         # Identificador estable de cada persona y su slug
│       ├── normalizacion.json    # Unificación de nombres de partidos y bancadas
│       ├── etapas-votacion.json  # Clasificación de la etapa de cada votación
│       └── notas.json            # Notas sobre errores u omisiones de la fuente
├── importador/               # Python: descarga, normaliza y escribe datos/
├── sitio/                    # Astro: solo presentación
│   ├── astro.config.mjs
│   ├── package.json
│   ├── public/               # Archivos fijos (favicon, imagen para compartir, _redirects)
│   └── src/
│       ├── estilos/
│       │   ├── tokens.css    # Colores, tipografías, espaciados: único lugar del aspecto visual
│       │   └── base.css      # Estilos generales que usan esos tokens
│       ├── layouts/          # Plantillas de página (estructura común)
│       ├── components/       # Piezas reutilizables (tarjeta de ley, tabla de votos…)
│       ├── pages/            # Rutas: una plantilla por tipo de página
│       └── lib/              # Lectura de datos/ y cálculos para mostrar (sin HTML)
├── scripts/auditoria/        # Scripts de la auditoría (#1)
├── docs/
│   ├── auditoria-datos.md
│   ├── decisiones/           # Registros de decisión como este
│   └── metodologia.md        # Criterios propios (#9)
├── LICENSE, LICENSE-DATOS.md, README.md
└── tmp/                      # Caché local, no se sube
```

Notas:

- `layouts/`, `components/` y `pages/` mantienen los nombres que espera Astro, para no pelear con la herramienta ni con su documentación.
- `datos/fuente/` y `datos/propios/` separan físicamente los valores oficiales de los propios. Así se cumple la regla de fidelidad: un valor oficial nunca se reescribe, y todo lo propio se distingue por su ubicación. El sitio y los datos descargables mantienen esa distinción.

## URLs estables

Las direcciones dependen solo de identificadores que no cambian con el diseño ni con la llegada de nuevos períodos:

| Página | URL | Identificador |
|---|---|---|
| Ley | `/leyes/{número}/` | Número de ley: correlativo nacional, no se reinicia por legislatura (confirmado en #3: ninguno de los 541 números del período figura en otra legislatura entre los 4.368 registros del histórico; el importador lo vuelve a verificar en cada ejecución). Los registros repetidos de un mismo número se agrupan en la misma página. |
| Legislador | `/legisladores/{slug}/` | Slug propio de la persona, por ejemplo `juan-perez`, guardado en `datos/propios/personas.json`. **No** se usa `idLegislador`, porque cambia en cada legislatura. Una vez asignado, el slug no cambia aunque la fuente corrija la escritura del nombre. |
| Votación | `/votaciones/{idVotacion}/` | `idVotacion` de la API, único en todo el histórico. |
| Listados | `/leyes/`, `/legisladores/`, `/buscar/` | Fijos |
| Datos abiertos | `/datos/…` | Mismas rutas que `datos/` en el repositorio |

Reglas:

- Las URLs se definen en un único módulo (`sitio/src/lib/rutas`). Los componentes piden la dirección a ese módulo y nunca la escriben a mano.
- Si alguna vez una URL tiene que cambiar, se agrega una redirección permanente en `public/_redirects`. Las direcciones publicadas no se rompen.

## Cómo se aplica un rediseño externo (Fase 4, #14)

El rediseño toca **solo** `sitio/src/estilos/`, `sitio/src/layouts/` y `sitio/src/components/`, y la parte visual de las plantillas de `pages/`. No toca `datos/`, `importador/` ni `sitio/src/lib/`.

1. **Entrega del diseño.** El tercero (o Google Stitch) entrega pantallas o HTML con estilos para cada tipo de página: inicio, listado de leyes, ficha de ley, ficha de legislador, votación y búsqueda.
2. **Tokens.** Los colores, tipografías, tamaños y espaciados del diseño se pasan a `tokens.css`. Un cambio de identidad visual puede quedarse solo en este archivo.
3. **Componentes y plantillas.** El HTML entregado se traslada a los componentes y layouts existentes. Cada componente recibe los mismos datos que antes (por ejemplo, una ley con su número, título y fecha); solo cambia cómo los muestra.
4. **Rutas sin cambios.** Las rutas salen de `lib/rutas` y los archivos de `pages/` no cambian de nombre, así que todas las URLs se mantienen.
5. **Revisión.** El rediseño se trabaja en una rama propia. Cloudflare genera una vista previa del PR para revisarlo completo antes de integrarlo. Una prueba automática compara la lista de URLs generadas antes y después: si falta alguna, el PR no pasa.

Para que esto funcione desde la Fase 1, el diseño provisional sigue estas reglas:

- ningún color, tipografía ni medida escrito fuera de `tokens.css`;
- ningún cálculo ni lectura de datos dentro de los componentes: todo llega preparado desde `lib/`;
- ningún HTML repetido entre páginas: si se repite, pasa a ser un componente.

## Cómo se suma otro período legislativo (Fase 5, #15)

El período legislativo es un dato, no algo fijo en el código.

1. **Registrar el período.** Se agrega una entrada en `datos/periodos.json` con:
   - su nombre (por ejemplo `2018-2023`) y sus fechas;
   - los identificadores de sus períodos parlamentarios anuales en la API;
   - si es el período vigente.
2. **Importar.** Se ejecuta el importador para ese período. El importador lee la lista de períodos de ese archivo, no de su código, y escribe en `datos/fuente/2018-2023/` con la misma estructura que el período actual.
3. **Unir personas.** Como el `idLegislador` cambia en cada legislatura, se completa la tabla de equivalencias en `datos/propios/personas.json`: cada persona tiene un identificador propio y la lista de sus `idLegislador` por período. Quien ya tenía página conserva su slug y su URL. Su ficha suma el nuevo período.
4. **Compilar.** El sitio recorre todos los períodos de `periodos.json`:
   - las fichas de ley y de votación nuevas aparecen con sus URLs habituales (el número de ley y el `idVotacion` no se repiten entre períodos);
   - los listados y la búsqueda incluyen un filtro por período.
5. **Sincronización.** Los períodos cerrados no cambian. El flujo diario sigue trabajando solo con el período vigente, y el semanal puede revisar los anteriores con menos frecuencia.

**Límite a vigilar.** Con todo el histórico (unas 4.400 leyes, 2.700 votaciones y 1.000 registros de legisladores), las páginas más el índice de búsqueda podrían acercarse a los 20.000 archivos por despliegue. Si eso pasa, hay dos salidas: mostrar las votaciones dentro de la ficha de la ley en lugar de en páginas propias, o agrupar fragmentos del índice. En ambos casos se mantienen las URLs con redirecciones.

## Privacidad y licencias

- El sitio no usa cookies ni recoge datos personales de visitantes. Las estadísticas son de Cloudflare Web Analytics, sin cookies.
- La API incluye correo y teléfono institucionales de los legisladores. Decidido en #8: el sitio los muestra en la ficha de cada legislador; se guardan solo en `legisladores.json`.
- Código bajo AGPL-3.0. Datos derivados bajo CC BY 4.0, con la cita "Origen de los datos: Datos Abiertos Poder Legislativo" y la fecha de actualización tomada de `datos/estado.json`.

## Consecuencias

- **Coste recurrente cero** mientras se mantengan los planes gratuitos de GitHub y Cloudflare. El único gasto es el dominio propio (Fase 4).
- **Dos herramientas:** Python para los datos y Node.js para el sitio. Cada una vive en su carpeta y se comunican solo a través de `datos/`.
- **Historial público de cambios** de los datos oficiales, como efecto secundario de guardarlos en el repositorio.
- **Pasos que dependen de Alexis** (en #11): crear el proyecto en Cloudflare Pages, conectarlo con el repositorio de GitHub y apuntar el subdominio `congreso.alexisdick.com`. No hace falta crear tokens ni secretos.
- **Issues que implementan esta decisión:** #3 (importador), #4 (sincronización), #5 (datos abiertos), #6-#10 (sitio) y #11 (publicación).
