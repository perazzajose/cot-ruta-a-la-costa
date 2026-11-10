"""Convierte una plantilla pintada del ómnibus en una skin del juego 3D.

Uso (desde la carpeta del juego):
    py tools/skin_a_js.py mi-skin.jpg cot_verano "COT Verano"

- La imagen tiene que estar pintada sobre assets/plantilla-omnibus/plantilla-en-blanco.png
  (cuadrada, mismas proporciones; conviene exportarla como JPG de 2048 x 2048 para que pese poco).
- Lo que se pinte NEGRO PURO se dibuja como vidrio.
- Crea src3d/skins/<id>.js y agrega su <script> en index.html (antes de world3d.js).
Solo usa la librería estándar de Python.
"""
import base64
import pathlib
import re
import sys

ROOT = pathlib.Path(__file__).resolve().parent.parent


def main():
    if len(sys.argv) != 4:
        print(__doc__)
        sys.exit(1)
    src, skin_id, name = pathlib.Path(sys.argv[1]), sys.argv[2], sys.argv[3]
    if not re.fullmatch(r"[a-z0-9_]+", skin_id):
        sys.exit("El id solo puede tener minúsculas, números y _ (por ejemplo: cot_verano).")
    ext = src.suffix.lower()
    mime = {".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".png": "image/png", ".webp": "image/webp"}.get(ext)
    if not mime:
        sys.exit("La imagen tiene que ser .jpg, .png o .webp.")
    data = base64.b64encode(src.read_bytes()).decode("ascii")
    out = ROOT / "src3d" / "skins" / f"{skin_id}.js"
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(
        f"// Skin \"{name}\": plantilla pintada sobre assets/plantilla-omnibus (generada con tools/skin_a_js.py).\n"
        "window.SKIN_TEX = window.SKIN_TEX || {};\n"
        f"window.SKIN_TEX.{skin_id} = 'data:{mime};base64,{data}';\n"
        "(window.EXTRA_SKINS = window.EXTRA_SKINS || []).push("
        f"{{ id: '{skin_id}', name: {name!r}, tex: '{skin_id}' }});\n",
        encoding="utf-8",
    )
    html = ROOT / "index.html"
    text = html.read_text(encoding="utf-8")
    tag = f'  <script src="src3d/skins/{skin_id}.js"></script>\n'
    if tag not in text:
        anchor = '  <script src="src3d/world3d.js"></script>'
        text = text.replace(anchor, tag + anchor, 1)
        html.write_text(text, encoding="utf-8")
    kb = out.stat().st_size // 1024
    print(f"Listo: {out.relative_to(ROOT)} ({kb} KB). Elegila en el juego con el botón ÓMNIBUS.")
    if kb > 1500:
        print("Ojo: pesa mucho. Exportá la imagen como JPG de 2048 x 2048 para que cargue rápido.")


if __name__ == "__main__":
    main()
