// Rankings de legisladores por cámara (alcance acordado en #57). Sin HTML. Usa las cifras de la vista
// comparativa (lib/legisladores.js, comparativa), sin recalcularlas, y nunca suma las cámaras. La lista
// de más "rebeldes" está en lib/votosDistintos.js; aquí, el orden común y la de más "ausentes" (cifra
// ausencias, #29).

import { comparativa } from "./legisladores.js";

/** Legisladores por cámara en cada ranking. */
export const CANTIDAD_RANKING = 10;
/** Votaciones nominales en su lista que necesita un legislador para entrar al ranking de ausencias. */
export const MINIMO_VOTACIONES_AUSENCIAS = 50;

/**
 * Hasta `cantidad` filas con al menos `minimo` en el denominador de su cifra (`cifra(fila)`, un objeto
 * de proporcion), de mayor a menor porcentaje. A igual porcentaje, primero la de mayor denominador; si
 * también empatan, queda el orden de entrada (por apellido).
 */
export function masAltos(filas, cifra, { minimo, cantidad = CANTIDAD_RANKING }) {
  return filas
    .map((fila, posicion) => ({ fila, posicion, c: cifra(fila) }))
    .filter(({ c }) => c.total >= minimo)
    .sort((a, b) => b.c.porcentaje - a.c.porcentaje || b.c.total - a.c.total || a.posicion - b.posicion)
    .slice(0, cantidad)
    .map(({ fila }) => fila);
}

/**
 * Ranking de ausencias de una cámara a partir de sus filas de la vista comparativa (en orden por apellido).
 * - filas: hasta `cantidad` legisladores con al menos `minimo` votaciones nominales en su lista, de mayor
 *   a menor porcentaje de votaciones en que figuran como AUSENTE (masAltos).
 * - bajoMinimo: cuántos figuran en menos de `minimo` votaciones nominales.
 */
export function ausenciasDeCamara(filas, { minimo = MINIMO_VOTACIONES_AUSENCIAS, cantidad = CANTIDAD_RANKING } = {}) {
  return {
    filas: masAltos(filas, (f) => f.ausencias, { minimo, cantidad }),
    bajoMinimo: filas.filter((f) => f.ausencias.total < minimo).length,
  };
}

/** Ranking de más "ausentes" de un período, por cámara, en el orden de la vista comparativa. */
export function masAusentes(periodo) {
  return {
    periodo,
    minimo: MINIMO_VOTACIONES_AUSENCIAS,
    camaras: comparativa(periodo).camaras.map((c) => ({ camara: c.camara, votaciones: c.votaciones, ...ausenciasDeCamara(c.filas) })),
  };
}
