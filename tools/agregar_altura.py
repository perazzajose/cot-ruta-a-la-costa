#!/usr/bin/env python3
"""
Agrega la altura (y, en metros sobre el nivel del mar) a cada punto y parada
de ruta-mvd-chuy.json usando la API gratuita de elevación de Open-Meteo
(datos Copernicus DEM, 90 m). Sin dependencias: solo Python 3.

Uso (desde la carpeta del juego, con internet):
    py tools/agregar_altura.py data/ruta-mvd-chuy.json

Actualiza data/ruta-mvd-chuy.json y data/ruta-mvd-chuy.js.

Hace ~40 pedidos de 100 puntos cada uno, con 2 s de pausa entre pedidos (tarda unos 2 minutos).
"""
import json
import sys
import time
import urllib.parse
import urllib.request

sys.path.insert(0, __import__("os").path.dirname(__import__("os").path.abspath(__file__)))
from kml_a_ruta import guardar  # noqa: E402

API = "https://api.open-meteo.com/v1/elevation"
LOTE = 100


def alturas(coords):
    lat = ",".join(f"{la:.6f}" for la, _ in coords)
    lon = ",".join(f"{lo:.6f}" for _, lo in coords)
    url = f"{API}?{urllib.parse.urlencode({'latitude': lat, 'longitude': lon})}"
    for intento in range(8):
        try:
            with urllib.request.urlopen(url, timeout=30) as r:
                return json.load(r)["elevation"]
        except Exception as e:  # límite de pedidos u error de red: reintentar
            espera = min(90, 5 * 2 ** intento)  # la API corta con 429 si se le pide rápido
            print(f"  error ({e}); reintento en {espera}s")
            time.sleep(espera)
    sys.exit("No se pudo obtener la altura. Probá de nuevo más tarde.")


def suavizar(valores, ventana=5):
    """Promedio móvil: el DEM tiene ruido de unos metros que se nota al manejar."""
    n, r = len(valores), ventana // 2
    return [sum(valores[max(0, i - r):min(n, i + r + 1)]) / (min(n, i + r + 1) - max(0, i - r)) for i in range(n)]


def main(path):
    with open(path, encoding="utf-8") as f:
        datos = json.load(f)

    elementos = datos["puntos"] + datos["paradas"]
    coords = [(e["lat"], e["lon"]) for e in elementos]
    resultado = []
    for i in range(0, len(coords), LOTE):
        print(f"Altura {i + 1}-{min(i + LOTE, len(coords))} de {len(coords)}")
        resultado += alturas(coords[i:i + LOTE])
        time.sleep(2)

    n = len(datos["puntos"])
    for p, h in zip(datos["puntos"], suavizar(resultado[:n])):
        p["y"] = round(h, 2)
    for p, h in zip(datos["paradas"], resultado[n:]):
        p["y"] = round(h, 2)

    datos["con_altura"] = True
    guardar(datos, path)
    ys = [p["y"] for p in datos["puntos"]]
    print(f"Listo. Altura mínima {min(ys):.0f} m, máxima {max(ys):.0f} m.")


if __name__ == "__main__":
    if len(sys.argv) != 2:
        sys.exit(__doc__)
    main(sys.argv[1])
