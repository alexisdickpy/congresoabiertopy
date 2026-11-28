"""Pruebas de los formatos derivados (CSV y diccionario) y de su coherencia con la copia de datos/."""

import csv
import io
import json
import unittest
from pathlib import Path

from importador.abiertos import TABLAS, aplanar, diccionario_md, leer_diccionario, sin_documentar, tabla_csv
from importador.transformar import COLUMNAS_VOTOS

DATOS = Path(__file__).resolve().parents[2] / "datos"


def leer_csv(ruta):
    """Lee un CSV como lo haría una planilla: devuelve (columnas, filas)."""
    contenido = ruta.read_bytes()
    assert contenido.startswith(b"\xef\xbb\xbf"), f"{ruta.name} no empieza con BOM"
    lector = csv.reader(io.StringIO(contenido.decode("utf-8-sig"), newline=""))
    columnas = next(lector)
    return columnas, list(lector)


class Aplanar(unittest.TestCase):
    def test_objetos_listas_y_valores(self):
        registro = {
            "id": 1, "activo": True, "vacio": None,
            "proyecto": {"acapite": "Ley «X», con comas", "_propio": {"fecha": "2023-07-01"}},
            "ministerios": ["MINISTERIO A", "MINISTERIO B"],
            "adjuntos": [{"url": "a"}],
            "_propio": {"ids": [3, 4], "ok": False},
        }
        self.assertEqual(aplanar(registro), {
            "id": "1", "activo": "true", "vacio": "",
            "proyecto.acapite": "Ley «X», con comas", "proyecto._propio.fecha": "2023-07-01",
            "ministerios": "MINISTERIO A | MINISTERIO B",
            "_propio.ids": "3 | 4", "_propio.ok": "false",
        })

    def test_orden_de_columnas_identificador_oficiales_y_propias(self):
        registros = [{"b": 1, "idX": 2, "_propio": {"z": 1}, "a": {"_propio": {"c": 1}, "d": 2}}]
        _, columnas = tabla_csv(registros, "idX")
        self.assertEqual(columnas, ["idX", "a.d", "b", "_propio.z", "a._propio.c"])

    def test_campo_con_parte_variable(self):
        diccionario = {"tablas": {"t": {"campos": [{"campo": "_propio.totales.*"}, {"campo": "id"}]}}}
        self.assertEqual(sin_documentar(diccionario, "t", ["id", "_propio.totales.NO VOTA", "_propio.totales.a.b", "otro"]),
                         ["_propio.totales.a.b", "otro"])


class Diccionario(unittest.TestCase):
    def setUp(self):
        self.diccionario = leer_diccionario(DATOS)

    def test_origen_coherente_con_la_ubicacion(self):
        for tabla, t in self.diccionario["tablas"].items():
            for c in t["campos"]:
                self.assertIn(c["origen"], ("oficial", "propio"), c["campo"])
                if "_propio" in c["campo"].split("."):
                    self.assertEqual(c["origen"], "propio", f"{tabla} → {c['campo']}")
                elif t["archivos"][0].startswith("fuente/"):
                    self.assertEqual(c["origen"], "oficial", f"{tabla} → {c['campo']}")

    def test_md_lleva_cita_licencia_y_fecha(self):
        estado = json.loads((DATOS / "estado.json").read_text(encoding="utf-8"))
        md = diccionario_md(self.diccionario, estado)
        self.assertIn("Origen de los datos: Datos Abiertos Poder Legislativo", md)
        self.assertIn("CC BY 4.0", md)
        for p in estado["periodos"].values():
            self.assertIn(p["ultimaModificacion"], md)

    def test_md_publicado_esta_al_dia(self):
        estado = json.loads((DATOS / "estado.json").read_text(encoding="utf-8"))
        self.assertEqual((DATOS / "diccionario.md").read_text(encoding="utf-8"), diccionario_md(self.diccionario, estado),
                         "Regenerar con: python -m importador.abiertos")


class CopiaPublicada(unittest.TestCase):
    """Comprueba los archivos reales de datos/: se leen como planilla y coinciden con los JSON."""

    def setUp(self):
        self.estado = json.loads((DATOS / "estado.json").read_text(encoding="utf-8"))
        self.diccionario = leer_diccionario(DATOS)

    def periodos(self):
        return json.loads((DATOS / "periodos.json").read_text(encoding="utf-8"))["periodos"]

    def test_csv_coinciden_con_json_y_estado(self):
        for periodo in self.periodos():
            carpeta = DATOS / "fuente" / periodo["id"]
            cantidades = self.estado["periodos"][periodo["id"]]["cantidades"]
            for tabla, identificador in TABLAS.items():
                with self.subTest(periodo=periodo["id"], tabla=tabla):
                    registros = json.loads((carpeta / f"{tabla}.json").read_text(encoding="utf-8"))
                    columnas, filas = leer_csv(carpeta / f"{tabla}.csv")
                    self.assertEqual(len(filas), len(registros))
                    self.assertEqual(len(filas), cantidades[tabla])
                    self.assertEqual(columnas[0], identificador)
                    self.assertTrue(all(len(f) == len(columnas) for f in filas))
                    self.assertEqual([f[0] for f in filas], [str(r[identificador]) for r in registros])
                    self.assertEqual(sin_documentar(self.diccionario, tabla, columnas), [])
                    documentados = {c["campo"] for c in self.diccionario["tablas"][tabla]["campos"]
                                    if not c.get("soloJSON") and "*" not in c["campo"]}
                    self.assertEqual(documentados - set(columnas), set(), "campos del diccionario que no están en el CSV")
            columnas, filas = leer_csv(carpeta / "votos.csv")
            self.assertEqual(columnas, COLUMNAS_VOTOS)
            self.assertEqual(len(filas), cantidades["votos"])

    def test_valores_iguales_al_json(self):
        periodo = self.periodos()[0]["id"]
        leyes = json.loads((DATOS / "fuente" / periodo / "leyes.json").read_text(encoding="utf-8"))
        columnas, filas = leer_csv(DATOS / "fuente" / periodo / "leyes.csv")
        for registro, fila in zip(leyes, filas):
            # Un registro puede no traer un campo que otros sí traen (la API lo omite, p. ej. la
            # fechaPublicacion de una ley aún no publicada): en el CSV esa celda queda vacía.
            esperado = {c: "" for c in columnas} | aplanar(registro)
            with self.subTest(idLey=registro["idLey"]):
                self.assertEqual(dict(zip(columnas, fila)), esperado)

    def test_campo_ausente_queda_vacio_en_el_csv(self):
        contenido, columnas = tabla_csv([{"idLey": 1, "fecha": "01/01/2026"}, {"idLey": 2}], "idLey")
        filas = list(csv.reader(io.StringIO(contenido.decode("utf-8-sig"), newline="")))[1:]
        self.assertEqual(columnas, ["idLey", "fecha"])
        self.assertEqual(filas, [["1", "01/01/2026"], ["2", ""]])


if __name__ == "__main__":
    unittest.main()
