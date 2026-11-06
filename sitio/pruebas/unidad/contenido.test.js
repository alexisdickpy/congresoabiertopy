// Los textos editables y la configuración de Pages CMS (.pages.yml) deben coincidir: el editor borra al
// guardar los campos que no figuran en la configuración.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";

import { fill } from "../../src/lib/rellenar.js";
import { textos } from "../textos.js";

const raiz = join(process.cwd(), "..");
const config = readFileSync(join(raiz, ".pages.yml"), "utf-8").replace(/\r/g, "");

/** Nombres de campo de la sección de .pages.yml de un archivo. */
function camposDe(ruta) {
  const inicio = config.indexOf(`path: ${ruta}\n`);
  assert.ok(inicio > 0, `Falta ${ruta} en .pages.yml`);
  const fin = config.indexOf("\n  - name: ", inicio);
  return new Set([...config.slice(inicio, fin === -1 ? undefined : fin).matchAll(/name: "?([\w-]+)/g)].map((m) => m[1]));
}

const claves = (valor) => {
  if (Array.isArray(valor)) return valor.flatMap(claves);
  if (valor && typeof valor === "object") return Object.entries(valor).flatMap(([k, v]) => [k, ...claves(v)]);
  return [];
};

test("cada campo de los textos editables figura en .pages.yml", () => {
  for (const [nombre, contenido] of Object.entries(textos)) {
    const campos = camposDe(`sitio/src/contenido/${nombre}.json`);
    for (const clave of claves(contenido)) assert.ok(campos.has(clave), `Falta ${nombre}.${clave} en .pages.yml`);
  }
});

test("cada campo de los datos propios editables figura en .pages.yml", () => {
  for (const nombre of ["temas", "partidos", "test-afinidad"]) {
    const ruta = `datos/propios/${nombre}.json`;
    const campos = camposDe(ruta);
    const archivo = JSON.parse(readFileSync(join(raiz, ruta), "utf-8"));
    for (const clave of claves(archivo)) assert.ok(campos.has(clave), `Falta ${clave} de ${ruta} en .pages.yml`);
  }
});

// Pages CMS no deja guardar un archivo si una lista con cantidad fija (min/max) tiene otra cantidad: al
// agregar o quitar una sección hay que actualizar .pages.yml (#135).
test("las listas con cantidad fija en .pages.yml tienen esa cantidad de elementos", () => {
  const archivos = [
    ...Object.entries(textos).map(([nombre, contenido]) => [`sitio/src/contenido/${nombre}.json`, contenido]),
    ...["temas", "partidos", "test-afinidad"].map((n) => [`datos/propios/${n}.json`, JSON.parse(readFileSync(join(raiz, `datos/propios/${n}.json`), "utf-8"))]),
  ];
  const listas = (valor, nombre) =>
    !valor || typeof valor !== "object"
      ? []
      : Object.entries(valor).flatMap(([k, v]) => [...(k === nombre && Array.isArray(v) ? [v] : []), ...listas(v, nombre)]);
  let revisadas = 0;
  for (const [ruta, contenido] of archivos) {
    const inicio = config.indexOf(`path: ${ruta}\n`);
    const fin = config.indexOf("\n  - name: ", inicio);
    const seccion = config.slice(inicio, fin === -1 ? undefined : fin);
    for (const m of seccion.matchAll(/- name: (\w+)\n(?:[^\n]*\n){0,4}?\s+list:\n\s+min: (\d+)\n\s+max: (\d+)/g)) {
      const [, nombre, min, max] = m;
      const encontradas = listas(contenido, nombre);
      assert.ok(encontradas.length > 0, `No se encontró la lista ${nombre} de ${ruta}`);
      for (const l of encontradas) assert.ok(l.length >= Number(min) && l.length <= Number(max), `${ruta}: ${nombre} tiene ${l.length} elementos y .pages.yml permite ${min} a ${max}`);
      revisadas++;
    }
  }
  assert.ok(revisadas >= 4, `Solo se revisaron ${revisadas} listas`);
});

test("los datos del Congreso no se editan desde Pages CMS", () => {
  assert.ok(!config.includes("path: datos/fuente"), "datos/fuente no debe estar en .pages.yml");
});

test("una parte automática desconocida detiene la compilación", () => {
  assert.equal(fill("Ley {numero}", { numero: 7 }), "Ley 7");
  assert.throws(() => fill("Ley {numeroo}", { numero: 7 }), /numeroo/);
  assert.throws(() => fill(undefined), /Falta un texto/);
});

test("la cita de la fuente nombra los Datos Abiertos del Poder Legislativo", () => {
  assert.ok(textos.general.sitio.cita.includes("Datos Abiertos Poder Legislativo"));
});
