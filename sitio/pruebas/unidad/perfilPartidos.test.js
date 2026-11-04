// Pruebas del perfil temático de cada partido (lib/perfilPartidos.js, #93) con los datos reales de datos/.
import assert from "node:assert/strict";
import { test } from "node:test";

import { fuente } from "../../src/lib/datos.js";
import { partidoUnificado } from "../../src/lib/partidos.js";
import { idsConPerfil, perfilesDePartidos, urlDePerfil } from "../../src/lib/perfilPartidos.js";
import { composicion } from "../../src/lib/portada.js";
import * as rutas from "../../src/lib/rutas.js";
import { votosPorTema } from "../../src/lib/votosPorTema.js";

const PERIODO = "2023-2028";

test("un perfil por partido unificado con al menos un legislador en el período", () => {
  const perfiles = perfilesDePartidos(PERIODO);
  const esperados = new Set(
    fuente(PERIODO, "legisladores.json")
      .map((l) => partidoUnificado(l.partidoPolitico)?.id)
      .filter(Boolean),
  );
  assert.deepEqual(new Set(perfiles.map((p) => p.id)), esperados);
  assert.equal(perfiles.length, esperados.size);
  for (const p of perfiles) {
    assert.equal(p.url, rutas.partidos(p.id));
    assert.ok(p.textos.length >= 1 && p.textos.length <= 2, p.id);
    assert.equal(new Set(p.textos.map((t) => t.camara)).size, p.textos.length, `${p.id}: un texto por cámara`);
  }
  // Cruzada Nacional reúne sus dos textos oficiales, uno por cámara (#42).
  assert.equal(perfiles.find((p) => p.id === "partido-cruzada-nacional").textos.length, 2);
});

test("las cifras son las mismas de los votos por tema, cámara por cámara", () => {
  const temas = votosPorTema(PERIODO);
  for (const p of perfilesDePartidos(PERIODO)) {
    assert.deepEqual(p.temas.map((t) => t.id), temas.map((t) => t.id), `${p.id}: todos los temas, en el mismo orden`);
    p.temas.forEach((t, n) => {
      const delTema = temas[n];
      assert.equal(t.url, delTema.url);
      // Solo las cámaras con votos del partido, sin sumar cámaras.
      const conVotos = delTema.camaras.filter((c) => c.partidos.some((f) => f.id === p.id));
      assert.deepEqual(t.camaras.map((c) => c.camara), conVotos.map((c) => c.camara));
      t.camaras.forEach((c, k) => {
        const fila = conVotos[k].partidos.find((f) => f.id === p.id);
        assert.equal(c.votaciones, conVotos[k].votaciones.length);
        assert.equal(c.votos, fila.votos);
        assert.deepEqual(c.categorias, conVotos[k].categorias);
        assert.deepEqual(c.celdas, fila.celdas);
        assert.equal(c.celdas.reduce((s, x) => s + x.cantidad, 0), c.votos, `${p.id} ${t.id} ${c.camara}: el denominador son todos sus votos`);
      });
    });
  }
});

test("ANR y PLRA votaron en las dos cámaras en Salud", () => {
  for (const id of ["asociacion-nacional-republicana-anr", "partido-liberal-radical-autentico-plra"]) {
    const p = perfilesDePartidos(PERIODO).find((x) => x.id === id);
    assert.ok(p, id);
    assert.equal(p.temas.find((t) => t.id === "salud").camaras.length, 2, id);
  }
});

test("legisladores en ejercicio por cámara: los de la composición de la portada; orden de más a menos", () => {
  const camaras = composicion(PERIODO);
  const perfiles = perfilesDePartidos(PERIODO);
  for (const p of perfiles) {
    p.camaras.forEach((c, n) => {
      const enComposicion = camaras[n].partidos.filter((x) => x.id === p.id).reduce((s, x) => s + x.cantidad, 0);
      assert.equal(c.legisladores, enComposicion, `${p.id} ${c.camara}`);
    });
  }
  for (let n = 1; n < perfiles.length; n++) assert.ok(perfiles[n - 1].legisladores >= perfiles[n].legisladores);
  assert.equal(perfiles[0].id, "asociacion-nacional-republicana-anr");
  // Cada partido de la composición enlaza a su perfil.
  for (const c of camaras) for (const x of c.partidos.filter((y) => y.id)) assert.ok(idsConPerfil(PERIODO).has(x.id), x.id);
});

test("dirección del perfil a partir del texto oficial", () => {
  assert.equal(urlDePerfil(PERIODO, "Asociación Nacional Republicana ANR"), rutas.partidos("asociacion-nacional-republicana-anr"));
  assert.equal(urlDePerfil(PERIODO, "CRUZADA NACIONAL"), rutas.partidos("partido-cruzada-nacional"));
  assert.equal(urlDePerfil(PERIODO, ""), null);
  assert.equal(urlDePerfil(PERIODO, "Partido que no existe"), null);
  assert.equal(rutas.partidos(), "/partidos/");
  assert.equal(rutas.legisladoresDePartido("x"), "/legisladores/?partido=x");
});
