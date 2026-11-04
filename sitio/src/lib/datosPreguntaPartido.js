// Datos de «Preguntale a un partido» (alcance acordado en #100), preparados al compilar. Sin HTML. El
// cálculo y el HTML de la respuesta están en lib/preguntaPartido.js, que corre también en el navegador.
//
// Criterios (ver docs/metodologia.md):
// - Preguntas y votaciones: las del test de afinidad (lib/testAfinidad.js), con la misma regla de
//   posición (mayoriaDe sobre los votos emitidos del partido, letraDe según votoAFavor).
// - Partido: el partido unificado (#42) que la API registra para cada legislador en el período, no por
//   fecha. Un partido «tiene legisladores registrados» en una votación si alguno figura en su lista
//   oficial, aunque sea como AUSENTE o NO VOTA.
// - Orden de los partidos: el de los perfiles (de más a menos legisladores en ejercicio); los que no
//   tienen perfil van al final, por nombre.

import { indice, valor } from "./ficha.js";
import { esVotoEmitido, mayoriaDe } from "./legisladores.js";
import { posicionDe } from "./coincidencia.js";
import { POSICION } from "./afinidad.js";
import { clasePartido, nombreConocido, partidoUnificado, siglaDe } from "./partidos.js";
import { perfilesDePartidos } from "./perfilPartidos.js";
import { composicion } from "./portada.js";
import { datosDelTest, letraDe } from "./testAfinidad.js";
import { legible } from "./texto.js";
import { textos } from "./contenido.js";

const OPUESTO = { SI: "NO", NO: "SI" };

/** Pregunta sin signos de interrogación: «Crear un registro…» (título) y «crear un registro…» (frase). */
export function titulosDe(pregunta) {
  const titulo = pregunta.trim().replace(/^¿\s*/, "").replace(/\s*\?$/, "");
  return { titulo, frase: titulo.charAt(0).toLocaleLowerCase("es") + titulo.slice(1) };
}

const cache = new Map();

/**
 * { camaras: [{ camara, nombre }], preguntas: [{ id, titulo, frase, numeroLey }], votaciones: [{ id,
 * camara, fecha, fechaTexto, url, pregunta }], partidos: [{ id, sigla, nombre, clase, votos }], textos }.
 * `votos[n]` es, para la votación n, 0 si el partido no tuvo legisladores registrados, o [letra de
 * posición, votos emitidos a favor, votos emitidos en contra, votos emitidos].
 */
export function datosPreguntaPartido(periodo) {
  if (cache.has(periodo)) return cache.get(periodo);
  const test = datosDelTest(periodo);
  const i = indice(periodo);
  const camaras = composicion(periodo).map((c) => ({ camara: c.camara, nombre: c.nombre }));
  const preguntas = test.preguntas.map((p) => ({ id: p.id, ...titulosDe(p.pregunta), numeroLey: p.numeroLey }));
  const votaciones = test.preguntas.flatMap((p, k) =>
    p.votaciones.map((v) => ({ id: v.id, camara: v.camara, fecha: v.fecha, fechaTexto: v.fechaTexto, url: v.url, pregunta: k })),
  );

  const partidos = new Map();
  votaciones.forEach((v, n) => {
    const aFavor = test.preguntas[v.pregunta].votoAFavor;
    const grupos = new Map();
    for (const voto of i.votos.get(v.id) ?? []) {
      const texto = valor(i.legisladores.get(Number(voto.idLegislador))?.partidoPolitico);
      if (!texto) continue;
      const u = partidoUnificado(texto);
      if (!grupos.has(u.id)) grupos.set(u.id, { u, texto, sentidos: [] });
      grupos.get(u.id).sentidos.push(voto.sentidoVotacion);
    }
    for (const { u, texto, sentidos } of grupos.values()) {
      if (!partidos.has(u.id)) {
        partidos.set(u.id, {
          id: u.id,
          sigla: siglaDe(texto),
          nombre: legible(u.nombre) + (nombreConocido(texto) && nombreConocido(texto) !== siglaDe(texto) ? ` (${nombreConocido(texto)})` : ""),
          clase: clasePartido(texto),
          votos: votaciones.map(() => 0),
        });
      }
      const posicion = posicionDe(mayoriaDe(sentidos));
      const emitidos = sentidos.filter(esVotoEmitido);
      partidos.get(u.id).votos[n] = [
        posicion ? letraDe(posicion, aFavor) : POSICION.sinMayoria,
        emitidos.filter((s) => s === aFavor).length,
        emitidos.filter((s) => s === OPUESTO[aFavor]).length,
        emitidos.length,
      ];
    }
  });

  const orden = new Map(perfilesDePartidos(periodo).map((p, k) => [p.id, k]));
  const lista = [...partidos.values()].sort(
    (a, b) => (orden.get(a.id) ?? Infinity) - (orden.get(b.id) ?? Infinity) || a.nombre.localeCompare(b.nombre, "es"),
  );
  const datos = { camaras, preguntas, votaciones, partidos: lista, textos: textos.portada.preguntale };
  cache.set(periodo, datos);
  return datos;
}
