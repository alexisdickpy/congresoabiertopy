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
// - Tabla compacta (#99): una tabla por cámara con una fila por tema y una columna por categoría oficial
//   (SI, NO, ABSTENCIÓN/BLANCO, NO VOTA y AUSENTE), con las mismas celdas de los votos por tema. NO VOTA
//   solo aparece si el partido tiene alguno en esa cámara. Las mociones y otras opciones van juntas en
//   una columna "Otras opciones", cuya cifra es su suma y cuyo detalle nombra cada una con su cifra.

import { claseDeCategoria, ordenarCategorias, posicionCamara, proporcion } from "./ficha.js";
import { listado } from "./legisladores.js";
import { clasePartido, nombreConocido, partidoUnificado, siglaDe } from "./partidos.js";
import { composicion } from "./portada.js";
import * as rutas from "./rutas.js";
import { votosPorTema } from "./votosPorTema.js";

const porTexto = (a, b) => a.localeCompare(b, "es");

/** Columnas fijas de la tabla compacta; las demás categorías van en OTRAS. */
export const COLUMNAS_TABLA = ["SI", "NO", "ABSTENCIÓN/BLANCO", "NO VOTA", "AUSENTE"];
/** Columnas que se muestran aunque el partido no tenga votos en ellas. */
const SIEMPRE = new Set(["SI", "NO", "ABSTENCIÓN/BLANCO", "AUSENTE"]);
/** Clave de la columna de mociones y otras opciones. */
export const OTRAS = "otras";

/**
 * Tablas compactas de un perfil, una por cámara con votos del partido: { camara, nombre, columnas:
 * [{ clave, categoria, clase }], filas: [{ id, nombre, url, datos: null | { votaciones, votos, barra,
 * celdas: { [clave]: { ...proporcion, detalle: [{ categoria, texto }] } } } }] }.
 */
function tablasDe(camaras, temas) {
  return camaras
    .map((c) => {
      const filas = temas.map((t) => {
        const x = t.camaras.find((y) => y.camara === c.camara);
        if (!x) return { id: t.id, nombre: t.nombre, url: t.url, datos: null };
        const celdas = {};
        const otras = [];
        x.categorias.forEach((cat, n) => {
          const celda = x.celdas[n];
          if (COLUMNAS_TABLA.includes(cat)) celdas[cat] = { ...celda, detalle: celda.cantidad ? [{ categoria: cat, texto: celda.texto }] : [] };
          else if (celda.cantidad) otras.push({ categoria: cat, cantidad: celda.cantidad, texto: celda.texto });
        });
        for (const cat of COLUMNAS_TABLA) celdas[cat] ??= { ...proporcion(0, x.votos), detalle: [] };
        celdas[OTRAS] = { ...proporcion(otras.reduce((n, o) => n + o.cantidad, 0), x.votos), detalle: otras.map(({ categoria, texto }) => ({ categoria, texto })) };
        return { id: t.id, nombre: t.nombre, url: t.url, datos: { votaciones: x.votaciones, votos: x.votos, barra: x.barra, celdas } };
      });
      const conDatos = filas.filter((f) => f.datos);
      if (!conDatos.length) return null;
      const usada = (clave) => SIEMPRE.has(clave) || conDatos.some((f) => f.datos.celdas[clave].cantidad > 0);
      const columnas = [
        ...COLUMNAS_TABLA.filter((k) => k !== "NO VOTA" && k !== "AUSENTE").filter(usada).map((k) => ({ clave: k, categoria: k, clase: claseDeCategoria(k) })),
        ...(usada(OTRAS) ? [{ clave: OTRAS, categoria: null, clase: "voto-otro" }] : []),
        ...["NO VOTA", "AUSENTE"].filter(usada).map((k) => ({ clave: k, categoria: k, clase: claseDeCategoria(k) })),
      ];
      return { camara: c.camara, nombre: c.nombre, columnas, filas };
    })
    .filter(Boolean);
}

const porPeriodo = new Map();

/**
 * Perfiles de los partidos de un período:
 * { id, nombre, sigla, nombreConocido, clase, url, textos: [{ camara, texto }], camaras: [{ camara,
 * nombre, legisladores }], legisladores, temas: [{ id, nombre, nombreCorto, url, camaras: [{ camara,
 * votaciones, votos, categorias, celdas, barra }] }], tablas (ver tablasDe), leyenda }.
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
      tablas: tablasDe(camaras, temas),
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
