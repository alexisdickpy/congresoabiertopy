// Pruebas de «Preguntale a un partido» (#100) con los datos reales de datos/.
import assert from "node:assert/strict";
import { test } from "node:test";

import { POSICION } from "../../src/lib/afinidad.js";
import { datosPreguntaPartido, titulosDe } from "../../src/lib/datosPreguntaPartido.js";
import { htmlRespuesta, respuesta, TODAS } from "../../src/lib/preguntaPartido.js";
import { datosDelTest, posicionCombinada } from "../../src/lib/testAfinidad.js";

const PERIODO = "2023-2028";

test("mismas preguntas y votaciones que el test de afinidad", () => {
  const datos = datosPreguntaPartido(PERIODO);
  const t = datosDelTest(PERIODO);
  assert.deepEqual(datos.preguntas.map((p) => p.id), t.preguntas.map((p) => p.id));
  assert.deepEqual(datos.votaciones.map((v) => v.id), t.preguntas.flatMap((p) => p.votaciones.map((v) => v.id)));
  for (const p of datos.preguntas) {
    assert.ok(!p.titulo.startsWith("¿") && !p.titulo.endsWith("?"), p.id);
    assert.equal(p.frase.slice(1), p.titulo.slice(1));
  }
  assert.deepEqual(titulosDe("¿Dar almuerzo escolar?"), { titulo: "Dar almuerzo escolar", frase: "dar almuerzo escolar" });
});

test("la posición de cada partido en cada pregunta es la misma del test", () => {
  const datos = datosPreguntaPartido(PERIODO);
  const t = datosDelTest(PERIODO);
  for (const p of t.partidos) {
    const nuestro = datos.partidos.find((x) => x.id === p.id);
    assert.ok(nuestro, p.id);
    datos.preguntas.forEach((_, k) => {
      const letras = datos.votaciones.map((v, n) => (v.pregunta === k && nuestro.votos[n] ? nuestro.votos[n][0] : null)).filter(Boolean);
      assert.equal(posicionCombinada(letras), p.posiciones[k], `${p.id} pregunta ${k}`);
    });
  }
  for (const p of datos.partidos) {
    for (const v of p.votos.filter(Boolean)) {
      const [letra, aFavor, enContra, emitidos] = v;
      assert.ok(aFavor + enContra <= emitidos, p.id);
      if (letra === POSICION.favor) assert.ok(aFavor > enContra, p.id);
      if (letra === POSICION.contra) assert.ok(enContra > aFavor, p.id);
    }
  }
});

test("la respuesta cuenta por cámara, sin sumar cámaras, y la comparación usa la misma cuenta", () => {
  const datos = datosPreguntaPartido(PERIODO);
  for (const p of datos.partidos) {
    for (const opcion of [TODAS, ...datos.preguntas.map((q) => q.id)]) {
      const r = respuesta(datos, p.id, opcion);
      const camaras = new Set(r.camaras.map((c) => c.camara));
      assert.equal(camaras.size, r.camaras.length, "una entrada por cámara");
      for (const c of r.camaras) {
        assert.equal(c.favor + c.contra + c.sin, c.total, `${p.id} ${opcion} ${c.camara}`);
        assert.equal(c.total, r.lista.filter((v) => v.camara === c.camara).length);
        const enComparacion = r.comparacion.find((x) => x.camara === c.camara).partidos.find((x) => x.id === p.id);
        assert.deepEqual(enComparacion.cuenta, c);
      }
      assert.equal(r.lista.length, r.camaras.reduce((n, c) => n + c.total, 0));
    }
  }
});

test("todas las propuestas reúnen las votaciones de cada pregunta", () => {
  const datos = datosPreguntaPartido(PERIODO);
  const p = datos.partidos[0];
  const todas = respuesta(datos, p.id, TODAS);
  for (const c of todas.camaras) {
    const porPregunta = datos.preguntas.map((q) => respuesta(datos, p.id, q.id).camaras.find((x) => x.camara === c.camara)?.favor ?? 0);
    assert.equal(c.favor, porPregunta.reduce((n, x) => n + x, 0), c.camara);
  }
});

test("el HTML escapa los textos y enlaza cada votación", () => {
  const datos = datosPreguntaPartido(PERIODO);
  const html = htmlRespuesta(datos, datos.partidos[0].id, TODAS);
  for (const v of respuesta(datos, datos.partidos[0].id, TODAS).lista) assert.ok(html.includes(`href="${v.url}"`), v.url);
  const raro = { ...datos, preguntas: datos.preguntas.map((q) => ({ ...q, titulo: "<b>x</b>" })) };
  assert.ok(!htmlRespuesta(raro, datos.partidos[0].id, TODAS).includes("<b>x</b>"));
});
