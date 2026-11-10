#!/usr/bin/env python3
"""
Convierte el KML de Google My Maps (recorrido MVD -> Chuy) en un JSON
listo para Three.js.

Uso (desde la carpeta del juego):
    py tools/kml_a_ruta.py tools/MVD_a_Chuy.kml data/ruta-mvd-chuy.json

Escribe dos archivos con los mismos datos:
    data/ruta-mvd-chuy.json  -> para herramientas (agregar_altura.py)
    data/ruta-mvd-chuy.js    -> para el juego: define window.RUTA_REAL
                                (funciona abriendo index.html con doble clic, sin servidor)

Salida (coordenadas en metros, origen = Terminal Tres Cruces):
    x = este (+) / oeste (-)
    z = sur (+) / norte (-)   -> convención de Three.js (norte = -Z)
    y = altura (0 hasta correr agregar_altura.py)
    s = distancia acumulada sobre la ruta, en metros
"""
import json
import math
import sys
import xml.etree.ElementTree as ET

R = 6371008.8  # radio medio de la Tierra (m)
NS = {"k": "http://www.opengis.net/kml/2.2"}


def leer_kml(path):
    raiz = ET.parse(path).getroot()
    linea = None
    paradas = []
    for carpeta in raiz.iter(f"{{{NS['k']}}}Folder"):
        nombre_carpeta = (carpeta.findtext("k:name", default="", namespaces=NS) or "").strip()
        for pm in carpeta.findall("k:Placemark", NS):
            nombre = (pm.findtext("k:name", default="", namespaces=NS) or "").strip()
            ls = pm.find(".//k:LineString/k:coordinates", NS)
            pt = pm.find(".//k:Point/k:coordinates", NS)
            if ls is not None and linea is None:
                linea = [tuple(map(float, c.split(",")[:2])) for c in ls.text.split()]
            elif pt is not None and not nombre_carpeta.startswith("Indicaciones"):
                lon, lat = map(float, pt.text.strip().split(",")[:2])
                paradas.append({"nombre": nombre, "lon": lon, "lat": lat})
    if not linea:
        sys.exit("No se encontró ninguna LineString en el KML.")
    return linea, paradas


def proyectar(lon, lat, lon0, lat0):
    """Proyección sinusoidal local centrada en el origen (error < 0,5 % en 340 km)."""
    x = R * math.radians(lon - lon0) * math.cos(math.radians(lat))
    norte = R * math.radians(lat - lat0)
    return x, -norte  # z = -norte


def ubicar_en_ruta(px, pz, pts, s_acum):
    """Proyecta un punto sobre la polilínea: devuelve (s, distancia_lateral, indice_segmento)."""
    mejor = (float("inf"), 0.0, 0)
    for i in range(len(pts) - 1):
        ax, az = pts[i]
        bx, bz = pts[i + 1]
        dx, dz = bx - ax, bz - az
        L2 = dx * dx + dz * dz
        t = 0.0 if L2 == 0 else max(0.0, min(1.0, ((px - ax) * dx + (pz - az) * dz) / L2))
        qx, qz = ax + t * dx, az + t * dz
        d = math.hypot(px - qx, pz - qz)
        if d < mejor[0]:
            mejor = (d, s_acum[i] + t * math.sqrt(L2), i)
    return mejor[1], mejor[0], mejor[2]


def guardar(datos, salida_json):
    """Guarda el JSON y su gemelo .js (window.RUTA_REAL) para el juego."""
    texto = json.dumps(datos, ensure_ascii=False, separators=(",", ":"))
    with open(salida_json, "w", encoding="utf-8") as f:
        f.write(texto)
    salida_js = salida_json[:-5] + ".js" if salida_json.endswith(".json") else salida_json + ".js"
    with open(salida_js, "w", encoding="utf-8") as f:
        f.write("// Generado por tools/kml_a_ruta.py — no editar a mano.\n")
        f.write("window.RUTA_REAL = " + texto + ";\n")


def main(entrada, salida):
    linea, paradas = leer_kml(entrada)
    lon0, lat0 = linea[0]

    # Puntos de la ruta (quitando duplicados consecutivos)
    pts, lonlat = [], []
    for lon, lat in linea:
        x, z = proyectar(lon, lat, lon0, lat0)
        if pts and math.hypot(x - pts[-1][0], z - pts[-1][1]) < 0.5:
            continue
        pts.append((x, z))
        lonlat.append((lon, lat))

    s_acum = [0.0]
    for i in range(1, len(pts)):
        s_acum.append(s_acum[-1] + math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]))

    # Paradas ubicadas sobre la ruta y ordenadas por distancia recorrida
    vistas = set()
    salida_paradas = []
    for p in paradas:
        clave = (p["nombre"], round(p["lon"], 5), round(p["lat"], 5))
        if clave in vistas:
            continue
        vistas.add(clave)
        x, z = proyectar(p["lon"], p["lat"], lon0, lat0)
        s, lateral, _ = ubicar_en_ruta(x, z, pts, s_acum)
        codigo, _, nombre = p["nombre"].partition(" ")
        salida_paradas.append({
            "codigo": codigo if codigo.isdigit() else None,
            "nombre": nombre if codigo.isdigit() else p["nombre"],
            "lat": p["lat"], "lon": p["lon"],
            "x": round(x, 2), "z": round(z, 2),
            "s": round(s, 1),
            "km": round(s / 1000, 2),
            "desvio_m": round(lateral, 1),  # > ~150 m = la parada está fuera del trazado (entra a terminal/pueblo)
        })
    salida_paradas.sort(key=lambda p: p["s"])

    datos = {
        "nombre": "Montevideo (Tres Cruces) - Chuy, línea 152I por Interbalnearia y Ruta 9",
        "origen": {"lat": lat0, "lon": lon0, "descripcion": "Terminal Tres Cruces"},
        "proyeccion": "sinusoidal local; x=este, z=-norte (Three.js), y=altura",
        "largo_m": round(s_acum[-1], 1),
        "puntos": [
            {"lat": la, "lon": lo, "x": round(x, 2), "y": 0, "z": round(z, 2), "s": round(s, 1)}
            for (lo, la), (x, z), s in zip(lonlat, pts, s_acum)
        ],
        "paradas": salida_paradas,
    }
    guardar(datos, salida)

    print(f"Puntos de ruta: {len(pts)}  |  Largo: {s_acum[-1] / 1000:.1f} km  |  Paradas: {len(salida_paradas)}")
    lejos = [p for p in salida_paradas if p["desvio_m"] > 150]
    if lejos:
        print("Paradas fuera del trazado (> 150 m):")
        for p in lejos:
            print(f"  km {p['km']:>6}  {p['nombre']}  ({p['desvio_m']} m)")


if __name__ == "__main__":
    if len(sys.argv) != 3:
        sys.exit(__doc__)
    main(sys.argv[1], sys.argv[2])
