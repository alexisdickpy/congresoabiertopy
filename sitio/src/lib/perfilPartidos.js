// Perfil temático de cada partido (alcance acordado en #93). Sin HTML.
//
// Criterios (ver docs/metodologia.md):
// - Un perfil por partido unificado (#42) con al menos un legislador registrado en el período.
// - Las cifras son las mismas de los votos por tema (lib/votosPorTema.js, #37): para cada tema y cámara,
//   la fila del partido en ese reparto, sin otro cálculo. Cada cámara va por separado y nunca se suman
//   senadores y diputados. Sin cifra única de apoyo.
// - Una cámara sin votos del partido en un tema no aparece en ese tema; un tema sin votos del partido en
//   ninguna cámara queda con la lista de cámaras vacía.
// - Legisladores por cámara: los de la composición actual de la portada (en ejercicio, sin vitalicios).
// - Partido: el que la API registra para el período, no por fecha.
// - Orden: de más a menos legisladores en ejercicio en el Congreso y, a igualdad, por nombre. Es solo un
//   orden; ninguna cifra suma cámaras.

import { claseDeCategoria, ordenarCategorias, posicionCamara } from "./ficha.js";
import { listado } from "./legisladores.js";
import { clasePartido, nombreConocido, partidoUnificado, siglaDe } from "./partidos.js";
import { composicion } from "./portada.js";
import * as rutas from "./rutas.js";
import { votosPorTema } from "./votosPorTema.js";

const porTexto = (a, b) => a.localeCompare(b, "es");

const porPeriodo = new Map();

/**
 * Perfiles de los partidos de un período:
 * { id, nombre, sigla, nombreConocido, clase, url, textos: [{ camara, texto }], camaras: [{ camara,
 * nombre, legisladores }], legisladores, temas: [{ id, nombre, nombreCorto, url, camaras: [{ camara,
 * votaciones, votos, categorias, celdas, barra }] }], leyenda }.
 */
export function perfilesDePartidos(periodo) {
  if (porPeriodo.has(periodo)) return porPeriodo.get(periodo);
  const { enEjercicio, noEjercen } = listado(periodo);
  const grupos = new Map();
  for (const f of [...enEjercicio, ...noEjercen]) {
    const p = partidoUnificado(f.partido);
    if (!p) continue;
    if (!grupos.has(p.id)) grupos.set(p.id, { id: p.id, nombre: p.nombre, textos: new Map() });
    const g = grupos.get(p.id);
    if (!g.textos.has(f.camara)) g.textos.set(f.camara, f.partido);
  }

  const camarasActuales = composicion(periodo);
  const lista = votosPorTema(periodo);

  const perfiles = [...grupos.values()].map((g) => {
    const textos = [...g.textos.entries()]
      .sort(([a], [b]) => posicionCamara(a) - posicionCamara(b) || porTexto(a ?? "", b ?? ""))
      .map(([camara, texto]) => ({ camara, texto }));
    const primero = textos[0].texto;
    const camaras = camarasActuales.map((c) => ({
      camara: c.camara,
      nombre: c.nombre,
      legisladores: c.partidos.filter((p) => p.id === g.id).reduce((n, p) => n + p.cantidad, 0),
    }));
    const temas = lista.map((t) => ({
      id: t.id,
      nombre: t.nombre,
      nombreCorto: t.nombreCorto,
      url: t.url,
      camaras: t.camaras
        .map((c) => {
          const fila = c.partidos.find((f) => f.id === g.id);
          return fila && { camara: c.camara, votaciones: c.votaciones.length, votos: fila.votos, categorias: c.categorias, celdas: fila.celdas, barra: fila.barra };
        })
        .filter(Boolean),
    }));
    // Leyenda de colores: las categorías con algún voto del partido.
    const usadas = temas.flatMap((t) => t.camaras.flatMap((c) => c.categorias.filter((_, n) => c.celdas[n].cantidad > 0)));
    return {
      id: g.id,
      nombre: g.nombre,
      sigla: siglaDe(primero),
      nombreConocido: textos.map((x) => nombreConocido(x.texto)).find(Boolean) ?? null,
      clase: clasePartido(primero),
      url: rutas.partidos(g.id),
      textos,
      camaras,
      legisladores: camaras.reduce((n, c) => n + c.legisladores, 0),
      temas,
      leyenda: ordenarCategorias(usadas).map((c) => ({ categoria: c, clase: claseDeCategoria(c) })),
    };
  });

  perfiles.sort((a, b) => b.legisladores - a.legisladores || porTexto(a.nombre, b.nombre));
  porPeriodo.set(periodo, perfiles);
  return perfiles;
}

/** Identificadores de partido unificado que tienen perfil en el período. */
export const idsConPerfil = (periodo) => new Set(perfilesDePartidos(periodo).map((p) => p.id));

/**
 * Dirección del perfil del partido de un texto oficial, o null si el texto está vacío o el partido no
 * tiene perfil en ese período (por ejemplo, en una legislatura anterior).
 */
export function urlDePerfil(periodo, partidoOficial) {
  const p = partidoUnificado(partidoOficial);
  return p && idsConPerfil(periodo).has(p.id) ? rutas.partidos(p.id) : null;
}
