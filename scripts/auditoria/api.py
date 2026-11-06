"""Cliente mínimo de la API de Datos Abiertos Legislativos (v2) con caché en disco.

Cada respuesta se guarda tal cual en tmp/auditoria/cache/ para que el análisis
pueda repetirse sin volver a consultar la API. Solo usa la biblioteca estándar.
"""

import json
import time
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path

BASE = "https://datosv2.congreso.gov.py/web/api"
RAIZ = Path(__file__).resolve().parents[2]
CACHE = RAIZ / "tmp" / "auditoria" / "cache"
USER_AGENT = "congresoabiertopy/auditoria (+https://github.com/alexisdickpy/congresoabiertopy)"
PAUSA = 0.3  # segundos entre consultas, para no sobrecargar el servidor


def _archivo_cache(ruta, params):
    nombre = ruta.strip("/").replace("/", "_")
    if params:
        nombre += "__" + "_".join(f"{k}-{v}" for k, v in sorted(params.items()))
    return CACHE / f"{nombre}.json"


def obtener(ruta, params=None, reintentos=3):
    """Devuelve el JSON completo ({codigoEstado, mensaje, datos}) de una ruta de la API.

    Usa la caché si existe. Una respuesta 404 de la API ("Dato/s no encontrado/s")
    se guarda y devuelve como cualquier otra.
    """
    params = params or {}
    archivo = _archivo_cache(ruta, params)
    if archivo.exists():
        return json.loads(archivo.read_bytes().decode("utf-8"))

    url = f"{BASE}/{ruta.strip('/')}"
    if params:
        url += "?" + urllib.parse.urlencode(params)
    ultimo_error = None
    for intento in range(reintentos):
        try:
            peticion = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
            with urllib.request.urlopen(peticion, timeout=300) as r:
                cuerpo = r.read()
            break
        except urllib.error.HTTPError as e:
            # La API responde 404 con un cuerpo JSON válido cuando no hay datos.
            cuerpo = e.read()
            if cuerpo.strip().startswith(b"{"):
                break
            ultimo_error = e
        except (urllib.error.URLError, TimeoutError, ConnectionError) as e:
            ultimo_error = e
        time.sleep(2 * (intento + 1))
    else:
        raise RuntimeError(f"No se pudo obtener {url}: {ultimo_error}")

    datos = json.loads(cuerpo.decode("utf-8"))
    CACHE.mkdir(parents=True, exist_ok=True)
    archivo.write_bytes(cuerpo)
    time.sleep(PAUSA)
    return datos


def paginar(ruta, tam_pagina=100, extra=None):
    """Recorre un listado paginado. En esta API `offset` es el número de página (desde 1)."""
    pagina = 1
    while True:
        params = {"offset": pagina, "limit": tam_pagina, **(extra or {})}
        respuesta = obtener(ruta, params)
        datos = respuesta.get("datos") or []
        if not datos:
            return
        yield from datos
        if len(datos) < tam_pagina:
            return
        pagina += 1
