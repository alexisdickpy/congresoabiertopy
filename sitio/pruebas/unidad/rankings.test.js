// Pruebas de los rankings (lib/rankings.js): el orden común y la lista de más "ausentes", con su
// mínimo, sus empates y las mismas cifras de la vista comparativa.
import assert from "node:assert/strict";
import { test } from "node:test";

import { proporcion } from "../../src/lib/ficha.js";
import { comparativa } from "../../src/lib/legisladores.js";
import { CANTIDAD_RANKING, MINIMO_VOTACIONES_AUSENCIAS, ausenciasDeCamara, masAltos, masAusentes } from "../../src/lib/rankings.js";

const PERIODO = "2023-2028";

/** Fila sintética de la vista comparativa, solo con lo que usa la lista. */
const fila = (slug, cantidad, total) => ({ slug, ausencias: proporcion(cantidad, total) });

test("masAltos: de mayor a menor porcentaje, con mínimo inclusivo y hasta la cantidad pedida", () => {
  const filas = [fila("a", 10, 100), fila("b", 30, 60), fila("c", 9, 9), fila("d", 1, 50), fila("e", 20, 100)];
  const cifra = (f) => f.ausencias;
  assert.deepEqual(
    masAltos(filas, cifra, { minimo: 50, cantidad: 3 }).map((f) => f.slug),
    ["b", "e", "a"],
  );
  assert.equal(masAltos(filas, cifra, { minimo: 50 }).length, 4, "d entra con justo 50");
  assert.equal(masAltos(filas, cifra, { minimo: 1 }).length, 5);
});

test("ausencias: el mínimo deja fuera a quien figura en pocas votaciones y se informa aparte", () => {
  const filas = [fila("pocas", 9, 17), fila("justo", 10, MINIMO_VOTACIONES_AUSENCIAS), fila("debajo", 40, MINIMO_VOTACIONES_AUSENCIAS - 1), fila("todo", 30, 300)];
  const r = ausenciasDeCamara(filas);
  assert.deepEqual(
    r.filas.map((f) => f.slug),
    ["justo", "todo"],
  );
  assert.equal(r.bajoMinimo, 2);
});

test("ausencias: a igual porcentaje, primero quien figura en más votaciones y después el orden de entrada", () => {
  const filas = [fila("x", 10, 100), fila("y", 20, 200), fila("z", 10, 100), fila("w", 5, 50)];
  assert.deepEqual(
    ausenciasDeCamara(filas).filas.map((f) => f.slug),
    ["y", "x", "z", "w"],
  );
});

test("período 2023-2028: mismas cifras que la vista comparativa, en orden y nadie se pierde", () => {
  const r = masAusentes(PERIODO);
  const comp = comparativa(PERIODO);
  assert.equal(r.minimo, MINIMO_VOTACIONES_AUSENCIAS);
  assert.deepEqual(
    r.camaras.map((c) => [c.camara, c.votaciones]),
    comp.camaras.map((c) => [c.camara, c.votaciones]),
  );
  for (const [i, c] of r.camaras.entries()) {
    const todas = comp.camaras[i].filas;
    assert.equal(c.filas.length, CANTIDAD_RANKING, c.camara);
    for (const f of c.filas) {
      assert.ok(todas.includes(f), `${f.slug} no es una fila de la vista comparativa`);
      assert.ok(f.ausencias.total >= MINIMO_VOTACIONES_AUSENCIAS);
    }
    for (let n = 1; n < c.filas.length; n++) assert.ok(c.filas[n - 1].ausencias.porcentaje >= c.filas[n].ausencias.porcentaje);
    // El último de la lista tiene un porcentaje igual o mayor que cualquiera que alcanza el mínimo y no entra.
    const ultimo = c.filas.at(-1).ausencias.porcentaje;
    for (const f of todas) if (!c.filas.includes(f) && f.ausencias.total >= MINIMO_VOTACIONES_AUSENCIAS) assert.ok(f.ausencias.porcentaje <= ultimo, f.slug);
    assert.equal(todas.filter((f) => f.ausencias.total >= MINIMO_VOTACIONES_AUSENCIAS).length + c.bajoMinimo, todas.length, c.camara);
  }
  // En el Senado, el mínimo deja fuera a quien figura en pocas votaciones con un porcentaje mayor que el primero.
  const senado = r.camaras.find((c) => /SENADORES/.test(c.camara));
  const primero = senado.filas[0].ausencias.porcentaje;
  const fuera = comp.camaras.find((c) => c.camara === senado.camara).filas.filter((f) => f.ausencias.total < MINIMO_VOTACIONES_AUSENCIAS);
  assert.ok(senado.bajoMinimo > 0 && fuera.some((f) => f.ausencias.porcentaje > primero), "El mínimo no cambia la lista del Senado");
});
