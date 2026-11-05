// Pruebas de la clasificación automática de todos los proyectos de ley (#111) con los datos reales de datos/.
import assert from "node:assert/strict";
import { test } from "node:test";

import { proyectosDeLey } from "../../src/lib/proyectos.js";
import { resumenPorTema } from "../../src/lib/resumenTemas.js";
import { temas } from "../../src/lib/temas.js";

const PERIODO = "2023-2028";

test("hay un solo tema de reserva, al final de la lista: Otros asuntos", () => {
  const reserva = temas().filter((t) => t.reserva);
  assert.equal(reserva.length, 1);
  assert.equal(reserva[0].id, "otros-asuntos");
  assert.equal(temas().at(-1).id, "otros-asuntos");
});

test("todos los proyectos de /proyectos/ tienen al menos un tema y ninguno queda pendiente", () => {
  const ids = new Set(temas().map((t) => t.id));
  for (const p of proyectosDeLey(PERIODO)) {
    assert.ok(p.temas.temas.length > 0, `Proyecto ${p.id} sin tema`);
    assert.equal(p.temas.pendiente, false, `Proyecto ${p.id}`);
    assert.ok(p.temas.filtro.every((id) => ids.has(id)), `Proyecto ${p.id}`);
  }
});

test("el cuadro de temas muestra Otros asuntos solo si tiene leyes o proyectos votados", () => {
  for (const t of resumenPorTema(PERIODO)) {
    if (t.reserva) assert.ok(t.leyes + t.archivados + t.enTramite + t.otros > 0);
    assert.notEqual(t.id, "pendiente");
  }
});
