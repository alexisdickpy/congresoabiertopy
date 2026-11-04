// Pruebas de la coincidencia de votos entre partidos y entre bancadas (lib/coincidencia.js).
import assert from "node:assert/strict";
import { test } from "node:test";

import { csv } from "../../src/lib/calculados.js";
import {
  COLUMNAS_COINCIDENCIA,
  UMBRAL,
  coincidencia,
  coincidenciaEntre,
  escalaDelCuadro,
  NIVELES_CUADRO,
  nivelDe,
  posicionDe,
  posicionesDelPeriodo,
  tablaCoincidencia,
} from "../../src/lib/coincidencia.js";
import { fuente } from "../../src/lib/datos.js";
import { escribirGrupo, leerGrupo } from "../../src/lib/grupoCoincidencia.js";
import { parametroGrupoCoincidencia as nombre } from "../../src/lib/rutas.js";
import { esDeProyectoDeLey, esVotoEmitido, mayoriaDe } from "../../src/lib/legisladores.js";
import { partidoUnificado } from "../../src/lib/partidos.js";
import { indice } from "../../src/lib/ficha.js";

const PERIODO = "2023-2028";
const SENADO = "CAMARA DE SENADORES";
const DIPUTADOS = "CAMARA DE DIPUTADOS";

test("posición de un grupo: su mayoría; empate sin posición; sin votos emitidos no figura", () => {
  assert.equal(posicionDe(mayoriaDe(["SI", "SI", "NO", "AUSENTE"])), "SI");
  assert.equal(posicionDe(mayoriaDe(["NO"])), "NO");
  assert.equal(posicionDe(mayoriaDe(["MOCIÓN 2", "MOCIÓN 2", "MOCIÓN 1"])), "MOCIÓN 2");
  assert.equal(posicionDe(mayoriaDe(["SI", "NO"])), null);
  assert.equal(posicionDe(mayoriaDe(["SI", "SI", "NO", "NO", "ABSTENCIÓN/BLANCO"])), null);
  assert.equal(posicionDe(mayoriaDe(["AUSENTE", "NO VOTA"])), undefined);
  assert.equal(posicionDe(undefined), undefined);
});

test("coincidencia entre dos grupos: solo las votaciones en que los dos tuvieron posición", () => {
  const v = (a, b) => new Map(Object.entries({ a, b }).filter(([, x]) => x !== undefined));
  const posiciones = [
    v("SI", "SI"),
    v("NO", "NO"),
    v("SI", "NO"),
    v("SI", null), // empate de b
    v(null, null),
    v("SI", undefined), // ningún miembro de b emitió voto
    v("ABSTENCIÓN/BLANCO", "ABSTENCIÓN/BLANCO"),
    v("MOCIÓN 1", "MOCIÓN 2"),
    v(undefined, "NO"),
    v("NO", "SI"),
  ];
  const r = coincidenciaEntre(posiciones, "a", "b");
  assert.deepEqual([r.cantidad, r.total, r.texto, r.suficiente], [3, 6, "3 de 6 (50%)", false]);
  assert.deepEqual(coincidenciaEntre(posiciones, "b", "a").texto, r.texto);
  assert.equal(coincidenciaEntre([], "a", "b").total, 0);
  const muchas = Array.from({ length: UMBRAL }, () => v("SI", "SI"));
  assert.equal(coincidenciaEntre(muchas, "a", "b").suficiente, true);
  assert.equal(coincidenciaEntre(muchas.slice(1), "a", "b").suficiente, false);
});

// Recuento a mano de 3 pares en 12 votaciones cada uno, a partir de votos.csv y legisladores.json:
// votos emitidos de cada grupo y su posición (null = empate). Las votaciones son sobre proyectos de ley.
const ANR_A = 'BANCADA DE LA ASOCIACIÓN NACIONAL REPUBLICANA ANR - A "HONOR COLORADO"';
const PLRA_A = "BANCADA DEL PARTIDO LIBERAL RADICAL AUTÉNTICO PLRA - A";
const ANR = "Asociación Nacional Republicana ANR";
const PLRA = "Partido Liberal Radical Auténtico PLRA";
const PDP = "Partido Democrático Progresista PDP";
const PPC = "Partido Participación Ciudadana";
const A_MANO = [
  {
    camara: DIPUTADOS,
    tipo: "bancada",
    campo: "bancada",
    grupos: [ANR_A, PLRA_A],
    votaciones: [
      [104219, { SI: 32 }, { SI: 8 }, "SI", "SI"],
      [104221, { NO: 28 }, { NO: 7 }, "NO", "NO"],
      [104222, { NO: 25, "ABSTENCIÓN/BLANCO": 1 }, { NO: 7 }, "NO", "NO"],
      [104224, { NO: 30 }, { NO: 5, SI: 1 }, "NO", "NO"],
      [104236, { NO: 24, SI: 4 }, { "ABSTENCIÓN/BLANCO": 1, NO: 1 }, "NO", null],
      [104290, { NO: 26 }, { SI: 4 }, "NO", "SI"],
      [104386, { NO: 24 }, { SI: 6, NO: 1 }, "NO", "SI"],
      [104439, { SI: 22 }, { "ABSTENCIÓN/BLANCO": 2, SI: 2 }, "SI", null],
      [104448, { SI: 20, NO: 2, "ABSTENCIÓN/BLANCO": 1 }, { NO: 6 }, "SI", "NO"],
      [104479, { NO: 24, "ABSTENCIÓN/BLANCO": 2, SI: 2 }, { "ABSTENCIÓN/BLANCO": 1 }, "NO", "ABSTENCIÓN/BLANCO"],
      [107887, { SI: 32 }, { NO: 3, SI: 3 }, "SI", null],
      [104225, { SI: 28 }, { SI: 6 }, "SI", "SI"],
    ],
    // Iguales 104219, 104221, 104222, 104224, 104225; distintas 104290, 104386, 104448, 104479; empates 3.
    esperado: [5, 9],
  },
  {
    camara: SENADO,
    tipo: "partido",
    campo: "partidoPolitico",
    grupos: [ANR, PLRA],
    votaciones: [
      [104218, { SI: 18 }, { SI: 7 }, "SI", "SI"],
      [104243, { SI: 26 }, { SI: 7, NO: 2 }, "SI", "SI"],
      [104244, { SI: 3, NO: 2, "ABSTENCIÓN/BLANCO": 1 }, { SI: 6 }, "SI", "SI"],
      [104255, { NO: 19, "ABSTENCIÓN/BLANCO": 1, SI: 3 }, { NO: 8, SI: 1 }, "NO", "NO"],
      [104266, { NO: 24, SI: 1 }, { NO: 6, SI: 3 }, "NO", "NO"],
      [104302, { NO: 7, SI: 9 }, { SI: 2, NO: 5, "ABSTENCIÓN/BLANCO": 1 }, "SI", "NO"],
      [104339, { SI: 7, NO: 14 }, { SI: 8, NO: 1 }, "NO", "SI"],
      [104382, { NO: 8, SI: 6 }, { SI: 4, NO: 3 }, "NO", "SI"],
      [104451, { NO: 4, SI: 3 }, { SI: 4, "ABSTENCIÓN/BLANCO": 1, NO: 1 }, "NO", "SI"],
      [104755, { SI: 20, NO: 1 }, { SI: 3, NO: 3 }, "SI", null],
      [104955, { NO: 8, SI: 2 }, { NO: 2, SI: 2 }, "NO", null],
      [106437, { NO: 10, "ABSTENCIÓN/BLANCO": 1 }, { NO: 4, SI: 4, "ABSTENCIÓN/BLANCO": 1 }, "NO", null],
    ],
    // Iguales 5; distintas 104302, 104339, 104382, 104451; empates del PLRA 3.
    esperado: [5, 9],
  },
  {
    camara: SENADO,
    tipo: "partido",
    campo: "partidoPolitico",
    grupos: [PDP, PPC],
    votaciones: [
      [104218, { SI: 1 }, { SI: 1 }, "SI", "SI"],
      [104243, { NO: 1 }, { NO: 1 }, "NO", "NO"],
      [104244, { SI: 1 }, { SI: 1 }, "SI", "SI"],
      [104246, { NO: 1 }, { NO: 1 }, "NO", "NO"],
      [104255, { NO: 1 }, { NO: 1 }, "NO", "NO"],
      [104266, { SI: 1 }, { SI: 1 }, "SI", "SI"],
      [104267, { NO: 1 }, { NO: 1 }, "NO", "NO"],
      [104269, { NO: 1 }, { NO: 1 }, "NO", "NO"],
      [104270, { NO: 1 }, { NO: 1 }, "NO", "NO"],
      [104302, { NO: 1 }, {}, "NO", undefined],
      [104303, { NO: 1 }, {}, "NO", undefined],
      [104317, {}, { NO: 1 }, undefined, "NO"],
    ],
    // Grupos de una sola persona: su voto es la posición. AUSENTE no da posición.
    esperado: [9, 9],
  },
];

test("coincidencia: 3 pares calculados a mano en 12 votaciones cada uno", () => {
  const votos = fuente(PERIODO, "votos.csv");
  const oficiales = new Map(fuente(PERIODO, "legisladores.json").map((l) => [l.idLegislador, l]));
  const camaras = posicionesDelPeriodo(PERIODO);
  for (const caso of A_MANO) {
    const c = camaras.find((x) => x.camara === caso.camara);
    const clave = (texto) => (caso.tipo === "partido" ? partidoUnificado(texto).id : texto);
    const [a, b] = caso.grupos.map(clave);
    const subconjunto = [];
    for (const [idVotacion, conteoA, conteoB, posA, posB] of caso.votaciones) {
      const nombre = `${caso.grupos.join(" / ")} en ${idVotacion}`;
      // Los datos siguen siendo los del recuento a mano.
      caso.grupos.forEach((g, n) => {
        const cuenta = {};
        for (const v of votos) {
          if (Number(v.idVotacion) !== idVotacion || !esVotoEmitido(v.sentidoVotacion)) continue;
          if (oficiales.get(Number(v.idLegislador))?.[caso.campo] !== g) continue;
          cuenta[v.sentidoVotacion] = (cuenta[v.sentidoVotacion] ?? 0) + 1;
        }
        assert.deepEqual(cuenta, [conteoA, conteoB][n], `${nombre}, ${g}`);
      });
      const n = c.ids.indexOf(idVotacion);
      assert.ok(n >= 0, `${nombre} no está entre las votaciones de ${caso.camara}`);
      const posiciones = c[caso.tipo][n];
      assert.deepEqual([posiciones.get(a), posiciones.get(b)], [posA, posB], nombre);
      subconjunto.push(posiciones);
    }
    const r = coincidenciaEntre(subconjunto, a, b);
    assert.deepEqual([r.cantidad, r.total], caso.esperado, caso.grupos.join(" / "));
  }
});

test("solo votaciones sobre proyectos de ley, cada una en una sola cámara", () => {
  const i = indice(PERIODO);
  const camaras = posicionesDelPeriodo(PERIODO);
  const ids = camaras.flatMap((c) => c.ids);
  assert.equal(new Set(ids).size, ids.length);
  const deLey = [...i.votos.keys()].filter((id) => i.votaciones.get(id) && esDeProyectoDeLey(i.votaciones.get(id)));
  assert.equal(ids.length, deLey.length);
  for (const c of camaras) {
    for (const id of c.ids) {
      const deOtra = i.votos.get(id).filter((v) => i.legisladores.get(Number(v.idLegislador))?.camaraParlamentario !== c.camara);
      assert.deepEqual(deOtra, [], `Votación ${id} con votos de otra cámara`);
    }
  }
});

test("las cifras de la página se calculan dentro de cada cámara, sin sumar senadores y diputados", () => {
  const r = coincidencia(PERIODO);
  const camaras = posicionesDelPeriodo(PERIODO);
  assert.deepEqual(r.camaras.map((c) => c.camara), [SENADO, DIPUTADOS]);
  for (const p of r.partidos) {
    for (const f of p.filas) {
      f.celdas.forEach((celda, n) => {
        const c = camaras[n];
        const presentes = c.textosPartido.has(p.id) && c.textosPartido.has(f.id);
        if (!presentes) return assert.equal(celda, null, `${p.id} / ${f.id} en ${c.camara}`);
        const otra = coincidenciaEntre(c.partido, p.id, f.id);
        assert.deepEqual([celda.cantidad, celda.total], [otra.cantidad, otra.total]);
        assert.ok(celda.total <= c.votaciones);
      });
    }
  }
  // Cruzada Nacional figura en las dos cámaras con su texto oficial de cada una.
  const cruzada = r.partidos.find((p) => p.id === "partido-cruzada-nacional");
  assert.deepEqual(cruzada.porCamara.map((x) => x?.texto), ["Partido Cruzada Nacional", "CRUZADA NACIONAL"]);
  // Las bancadas solo se comparan con las de su cámara.
  for (const { camara, grupos } of r.bancadas) {
    const c = camaras.find((x) => x.camara === camara);
    const textos = new Set(grupos.map((g) => g.nombre));
    for (const g of grupos) {
      assert.equal(g.filas.length, grupos.length - 1);
      for (const f of g.filas) {
        assert.ok(textos.has(f.nombre));
        assert.equal(f.total, coincidenciaEntre(c.bancada, g.nombre, f.nombre).total);
      }
    }
  }
});

test("orden de las filas: de mayor a menor porcentaje, las de pocas votaciones en común al final", () => {
  for (const { grupos } of coincidencia(PERIODO).bancadas) {
    for (const g of grupos) {
      const suficientes = g.filas.filter((f) => f.suficiente);
      assert.deepEqual(g.filas.slice(0, suficientes.length), suficientes);
      for (let n = 1; n < suficientes.length; n++) assert.ok(suficientes[n - 1].porcentaje >= suficientes[n].porcentaje);
    }
  }
});

test("tabla descargable: un par por cámara, mismas cifras que la página, porcentaje vacío bajo el umbral", () => {
  const filas = tablaCoincidencia(PERIODO);
  const r = coincidencia(PERIODO);
  for (const f of filas) assert.deepEqual(Object.keys(f), COLUMNAS_COINCIDENCIA);
  const claves = filas.map((f) => `${f.camara}|${f.tipoGrupo}|${f.grupoA}|${f.grupoB}`);
  assert.equal(new Set(claves).size, claves.length);
  for (const { camara, grupos } of r.bancadas) {
    const n = grupos.length;
    assert.equal(filas.filter((f) => f.camara === camara && f.tipoGrupo === "bancada").length, (n * (n - 1)) / 2);
  }
  for (const f of filas.filter((x) => x.tipoGrupo === "partido")) {
    const n = r.camaras.findIndex((c) => c.camara === f.camara);
    const celda = r.partidos.find((p) => p.id === f.grupoA).filas.find((x) => x.id === f.grupoB).celdas[n];
    assert.deepEqual([f.coincidencias, f.votacionesEnComun], [celda.cantidad, celda.total]);
    if (f.votacionesEnComun < UMBRAL) assert.equal(f.porcentajeCoincidencia, null);
    else assert.equal(f.porcentajeCoincidencia, Math.round(celda.porcentaje * 1000) / 10);
  }
  assert.ok(csv(COLUMNAS_COINCIDENCIA, filas).startsWith("﻿periodo,camara,tipoGrupo,grupoA"));
});

test("grupo elegido en la dirección: uno desconocido vuelve al primero, que no se escribe", () => {
  const validos = coincidencia(PERIODO).partidos.map((p) => p.valor);
  const [primero, otro] = validos;
  assert.equal(leerGrupo(new URLSearchParams(`${nombre}=${otro}`), nombre, validos), otro);
  assert.equal(leerGrupo(new URLSearchParams(`${nombre}=no-existe`), nombre, validos), primero);
  assert.equal(leerGrupo(new URLSearchParams(""), nombre, validos), primero);
  assert.equal(escribirGrupo(new URLSearchParams("x=1"), nombre, otro, validos).toString(), `x=1&${nombre}=${otro}`);
  assert.equal(escribirGrupo(new URLSearchParams(`${nombre}=${otro}`), nombre, primero, validos).toString(), "");
});

test("cuadro de partidos: por cámara, simétrico, sin la diagonal, mismas cifras que las listas", () => {
  const r = coincidencia(PERIODO);
  const camaras = posicionesDelPeriodo(PERIODO);
  assert.deepEqual(r.cuadros.map((c) => c.camara), [SENADO, DIPUTADOS]);
  for (const cuadro of r.cuadros) {
    const c = camaras.find((x) => x.camara === cuadro.camara);
    assert.deepEqual(cuadro.filas.map((f) => f.id).sort(), [...c.textosPartido.keys()].sort());
    cuadro.filas.forEach((f, i) => {
      assert.equal(f.texto, c.textosPartido.get(f.id));
      assert.equal(f.celdas.length, cuadro.filas.length);
      f.celdas.forEach((celda, j) => {
        if (i === j) return assert.equal(celda, null);
        const espejo = cuadro.filas[j].celdas[i];
        assert.deepEqual([celda.cantidad, celda.total], [espejo.cantidad, espejo.total]);
        const otra = coincidenciaEntre(c.partido, f.id, cuadro.filas[j].id);
        assert.deepEqual([celda.cantidad, celda.total], [otra.cantidad, otra.total]);
        const nivel = nivelDe(celda, escalaDelCuadro(cuadro.filas));
        assert.ok(celda.suficiente ? nivel >= 1 && nivel <= NIVELES_CUADRO : nivel === 0);
      });
    });
  }
  // Escala de cada cuadro: el menor porcentaje es el nivel 1 y el mayor, el último.
  for (const cuadro of r.cuadros) {
    const escala = escalaDelCuadro(cuadro.filas);
    const celdas = cuadro.filas.flatMap((f) => f.celdas).filter((c) => c?.suficiente);
    assert.equal(nivelDe(celdas.find((c) => c.porcentaje === escala.minimo), escala), 1);
    assert.equal(nivelDe(celdas.find((c) => c.porcentaje === escala.maximo), escala), NIVELES_CUADRO);
  }
  const escala = { minimo: 0.5, maximo: 1 };
  assert.equal(nivelDe(null, escala), 0);
  assert.equal(nivelDe({ suficiente: false, porcentaje: 0.9 }, escala), 0);
  assert.deepEqual([0.5, 0.59, 0.6, 0.75, 0.89, 0.9, 1].map((porcentaje) => nivelDe({ suficiente: true, porcentaje }, escala)), [1, 1, 2, 3, 4, 5, 5]);
  assert.equal(nivelDe({ suficiente: true, porcentaje: 0.7 }, { minimo: 0.7, maximo: 0.7 }), NIVELES_CUADRO);
  const filas = (celdas) => [{ celdas }];
  assert.equal(escalaDelCuadro(filas([null, { suficiente: false, porcentaje: 0.2 }])), null);
  assert.deepEqual(escalaDelCuadro(filas([null, { suficiente: true, porcentaje: 0.4 }, { suficiente: false, porcentaje: 0.1 }, { suficiente: true, porcentaje: 0.9 }])), { minimo: 0.4, maximo: 0.9 });
});

test("orden de los grupos: de más a menos legisladores en ejercicio, ANR primero y PLRA segundo", () => {
  const r = coincidencia(PERIODO);
  const vigentes = fuente(PERIODO, "legisladores.json").filter((l) => l._propio?.vigente);
  for (const cuadro of r.cuadros) {
    const deCamara = vigentes.filter((l) => l.camaraParlamentario === cuadro.camara);
    for (const f of cuadro.filas) {
      assert.equal(f.legisladores, deCamara.filter((l) => partidoUnificado(l.partidoPolitico)?.id === f.id).length, f.id);
    }
    const bancas = cuadro.filas.map((f) => f.legisladores);
    assert.deepEqual(bancas, [...bancas].sort((a, b) => b - a));
    assert.deepEqual(cuadro.filas.slice(0, 2).map((f) => f.nombre), [ANR, PLRA]);
  }
  assert.deepEqual(r.partidos.slice(0, 2).map((p) => p.nombre), [ANR, PLRA]);
  // El nombre conocido va entre paréntesis, en el menú y en los dos cuadros.
  const yoCreo = "Movimiento Conciencia Democrática Nacional (Yo Creo)";
  assert.ok(r.partidos.some((p) => p.nombre === yoCreo));
  for (const cuadro of r.cuadros) assert.ok(cuadro.filas.some((f) => f.nombre === yoCreo), cuadro.camara);
  for (const { grupos } of r.bancadas) {
    const miembros = grupos.map((g) => g.legisladores);
    assert.deepEqual(miembros, [...miembros].sort((a, b) => b - a));
  }
});
