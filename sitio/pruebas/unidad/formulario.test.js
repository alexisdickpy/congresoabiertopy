// Formulario de contacto (#140): el sitio y el Worker (contacto/) usan los mismos nombres de campo, límites
// y motivos de error, y "Reportar un error" lleva la página y el asunto en la dirección.
import assert from "node:assert/strict";
import { test } from "node:test";

import * as worker from "../../../contacto/formulario.js";
import { AVISOS_DE_ERROR, CAMPOS, CLAVE_PRUEBA_TURNSTILE, claveTurnstile, LIMITES } from "../../src/lib/formulario.js";
import * as rutas from "../../src/lib/rutas.js";
import { textos } from "../textos.js";

test("los campos, límites y motivos de error coinciden con los del Worker", () => {
  assert.deepEqual(CAMPOS, worker.CAMPOS);
  for (const [campo, largo] of Object.entries(LIMITES)) assert.equal(largo, worker.LIMITES[campo], campo);
  for (const [motivo, aviso] of Object.entries(AVISOS_DE_ERROR)) {
    assert.equal(worker.ERRORES[motivo], motivo);
    assert.ok(textos.interaccion.contacto[aviso], `Falta el aviso ${aviso}`);
  }
  assert.ok(textos.interaccion.contacto.errorGeneral);
});

test("la dirección del formulario lleva la página y el asunto, y la del Worker no tiene barra final", () => {
  assert.equal(rutas.formularioContacto(), `${rutas.contacto()}#${rutas.anclaFormulario}`);
  const url = new URL(rutas.formularioContacto({ pagina: "https://ejemplo.test/leyes/?q=a&b", asunto: "Error en Congreso Abierto" }), rutas.sitio);
  assert.equal(url.pathname, rutas.contacto());
  assert.equal(url.searchParams.get(rutas.parametrosContacto.pagina), "https://ejemplo.test/leyes/?q=a&b");
  assert.equal(url.searchParams.get(rutas.parametrosContacto.asunto), "Error en Congreso Abierto");
  assert.equal(url.hash, `#${rutas.anclaFormulario}`);
  assert.equal(rutas.apiContacto(), "/api/contacto");
});

test("sin clave de Turnstile configurada se usa la de prueba", () => {
  assert.equal(claveTurnstile(undefined), CLAVE_PRUEBA_TURNSTILE);
  assert.equal(claveTurnstile({}), CLAVE_PRUEBA_TURNSTILE);
  assert.equal(claveTurnstile({ PUBLIC_TURNSTILE_CLAVE_SITIO: "0x4AAA" }), "0x4AAA");
});
