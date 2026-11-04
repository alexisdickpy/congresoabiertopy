// «Preguntale a un partido» (alcance acordado en #100): cálculo y HTML de la respuesta. Sin acceso a
// archivos: lo usan la portada al compilar (respuesta inicial) y el navegador al cambiar los menús. Los
// datos los prepara lib/datosPreguntaPartido.js.
//
// Criterios (ver docs/metodologia.md):
// - Las votaciones son las del test de afinidad. La posición del partido en cada votación es la de
//   lib/testAfinidad.js: la categoría con más votos entre los votos emitidos de sus legisladores, y «a
//   favor» es el voto que la pregunta indica en votoAFavor.
// - Cuentan las votaciones en que el partido tuvo legisladores registrados, aunque ninguno haya emitido
//   voto. Cada cámara va por separado; nunca se suman.

import { fill } from "./rellenar.js";
import { POSICION } from "./afinidad.js";

/** Valor del menú de propuestas que reúne todas las preguntas del test. */
export const TODAS = "todas";

const escapar = (t) => String(t).replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;");
const numero = (n) => n.toLocaleString("es-PY");
/** Clave de la cuenta de cada letra de posición. */
const claveDe = (letra) => (letra === POSICION.favor ? "favor" : letra === POSICION.contra ? "contra" : "sin");

/** Cuenta de una lista de votaciones para un partido, cámara por cámara (solo las cámaras con votaciones). */
function porCamara(datos, partido, votaciones) {
  return datos.camaras
    .map((c) => {
      const cuenta = { camara: c.camara, nombre: c.nombre, total: 0, favor: 0, contra: 0, sin: 0 };
      for (const v of votaciones) {
        const voto = partido.votos[v.n];
        if (v.camara !== c.camara || !voto) continue;
        cuenta.total++;
        cuenta[claveDe(voto[0])]++;
      }
      return cuenta;
    })
    .filter((c) => c.total > 0);
}

/**
 * Respuesta para un partido y una opción del menú (TODAS o el id de una pregunta): { partido, opcion,
 * camaras: [{ camara, nombre, total, favor, contra, sin }], lista: [votación con su voto], comparacion:
 * [{ camara, nombre, partidos: [{ ...partido, cuenta }] }] }.
 */
export function respuesta(datos, idPartido, opcion) {
  const partido = datos.partidos.find((p) => p.id === idPartido) ?? datos.partidos[0];
  const elegida = datos.preguntas.findIndex((p) => p.id === opcion);
  const indices = elegida === -1 ? datos.preguntas.map((_, k) => k) : [elegida];
  const votaciones = datos.votaciones.map((v, n) => ({ ...v, n })).filter((v) => indices.includes(v.pregunta));
  const lista = votaciones
    .filter((v) => partido.votos[v.n])
    .map((v) => ({ ...v, voto: partido.votos[v.n], pregunta: datos.preguntas[v.pregunta] }))
    .sort((a, b) => (b.fecha ?? "").localeCompare(a.fecha ?? "") || a.camara.localeCompare(b.camara, "es"));
  const comparacion = datos.camaras
    .map((c) => ({
      camara: c.camara,
      nombre: c.nombre,
      partidos: datos.partidos.map((p) => ({ ...p, cuenta: porCamara(datos, p, votaciones).find((x) => x.camara === c.camara) })).filter((p) => p.cuenta),
    }))
    .filter((c) => c.partidos.length);
  return { partido, opcion: elegida === -1 ? TODAS : opcion, camaras: porCamara(datos, partido, votaciones), lista, comparacion };
}

const POSICIONES = { favor: "posicionFavor", contra: "posicionContra", sin: "posicionSinMayoria" };

/** Texto de la posición del partido en una votación. */
function textoPosicion(tx, voto) {
  if (voto[3] === 0) return { clase: "sin", texto: tx.posicionSinVotos };
  const clave = claveDe(voto[0]);
  return { clase: clave, texto: tx[POSICIONES[clave]] };
}

/** HTML de la respuesta (textos de contenido/portada.json, sección preguntale, dentro de los datos). */
export function htmlRespuesta(datos, idPartido, opcion) {
  const tx = datos.textos;
  const r = respuesta(datos, idPartido, opcion);
  if (!r.camaras.length) return `<p>${escapar(fill(tx.sinVotaciones, { partido: r.partido.sigla }))}</p>`;

  const resumen = r.camaras
    .map(
      (c) => `<div class="resumen-camara" data-camara="${escapar(c.camara)}">
  <p class="cifra-respuesta"><b>${numero(c.favor)}</b> ${escapar(fill(tx.deTotal, { total: numero(c.total) }))}</p>
  <p>${escapar(fill(tx.cifraCamara, { camara: c.nombre, partido: r.partido.sigla }))}</p>
  <p class="chico texto-suave">${escapar(fill(tx.detalleCamara, { contra: numero(c.contra), sin: numero(c.sin) }))}</p>
</div>`,
    )
    .join("");

  const lista = r.lista
    .map((v) => {
      const p = textoPosicion(tx, v.voto);
      const nombreCamara = datos.camaras.find((c) => c.camara === v.camara)?.nombre ?? v.camara;
      return `<li data-votacion-pregunta="${v.id}">
  <p class="chico texto-suave">${escapar(v.fechaTexto ?? "")} · ${escapar(nombreCamara)} · ${escapar(fill(tx.ley, { numero: v.pregunta.numeroLey }))}</p>
  <p><a href="${escapar(v.url)}">${escapar(v.pregunta.titulo)}</a></p>
  <p><span class="posicion-partido posicion-${p.clase}">${escapar(p.texto)}</span> <span class="chico texto-suave">${escapar(fill(tx.votosDelPartido, { aFavor: numero(v.voto[1]), enContra: numero(v.voto[2]), emitidos: numero(v.voto[3]) }))}</span></p>
</li>`;
    })
    .join("");

  const ancho = (n, total) => `${Math.round((n / total) * 10000) / 100}%`;
  const comparacion = r.comparacion
    .map(
      (c) => `<div class="comparacion-camara">
  <h4>${escapar(c.nombre)}</h4>
  <ul class="barras-respuesta">${c.partidos
    .map((p) => {
      const k = p.cuenta;
      const elegido = p.id === r.partido.id;
      return `<li${elegido ? ' class="elegido" aria-current="true"' : ""}><span class="nombre-barra"><span class="pip ${escapar(p.clase)}"></span> ${escapar(p.sigla)}</span><span class="barra-respuesta" role="img" aria-label="${escapar(fill(tx.etiquetaBarra, { partido: p.sigla, favor: numero(k.favor), contra: numero(k.contra), sin: numero(k.sin), total: numero(k.total) }))}"><span class="posicion-favor" style="width:${ancho(k.favor, k.total)}"></span><span class="posicion-contra" style="width:${ancho(k.contra, k.total)}"></span><span class="posicion-sin" style="width:${ancho(k.sin, k.total)}"></span></span><span class="cifra-barra">${numero(k.favor)}/${numero(k.total)}</span></li>`;
    })
    .join("")}</ul>
</div>`,
    )
    .join("");

  return `<div class="resumen-respuesta">${resumen}</div>
<div class="detalle-respuesta">
  <section class="votaciones-respuesta">
    <h3>${escapar(fill(tx.lasVotaciones, { partido: r.partido.sigla }))}</h3>
    <ul class="lista-respuesta">${lista}</ul>
  </section>
  <section class="comparacion-respuesta">
    <h3>${escapar(tx.comparacion)}</h3>
    <p class="chico texto-suave">${escapar(tx.comparacionExplicacion)}</p>
    ${comparacion}
  </section>
</div>`;
}
