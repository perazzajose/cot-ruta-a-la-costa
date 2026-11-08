# COT · Ruta a la Costa — contexto para Claude Code

Juego de manejo de ómnibus de COT para navegador. Hay dos versiones:
- **2D** (`index.html`, Phaser en `lib/phaser.min.js`, código en `src/`).
- **3D** (`index3d.html`, three.js r170 en `lib/three.bundle.min.js`, código en `src3d/`).

El README.md describe la jugabilidad, los controles y el sistema de calidad adaptativa. Leelo antes de cambiar algo.

## Reglas del proyecto (no romper)

- **Se abre con doble clic, sin servidor ni internet.** Nada de `fetch()` a archivos locales, nada de ES modules (`import`/`export`), nada de npm ni bundler. Todo son `<script src>` clásicos que definen globales (`THREE`, `World3D`, `ROUTE3D`, `RutaReal`…), en el orden de `index3d.html`.
- Los datos van como `.js` que asigna a `window` (ver `data/ruta-mvd-chuy.js`), nunca como `.json` cargado en tiempo de ejecución.
- `THREE` es global (r170 + GLTFLoader). En los ejemplos de `docs/GUIA-RENDIMIENTO.md` que usan `import ... from 'three'`, usá `THREE.X`.
- Tiene que andar en PCs modestas: el sistema de calidad adaptativa (`GFX_LEVELS` en `src3d/game3d.js`, meta de 50 FPS) se mantiene y cualquier cosa nueva debe poder degradarse con él.
- No tocar la versión 2D salvo que se pida.
- Créditos y licencias: el ómnibus es CC-BY 4.0 (`assets/bus-g7-license.txt`). El crédito tiene que seguir visible en el título.
- Textos del juego en español rioplatense.

## Rendimiento

Seguir las reglas de @docs/GUIA-RENDIMIENTO.md. En este proyecto:
- No hay física con motor (Rapier/cannon). El manejo es cinemático en `game3d.js` y así se queda salvo que se pida.
- Lo más importante al pasar a ruta real: **chunks + dispose**, **floating origin** (las coordenadas reales llegan a 250 km del origen) e **instancing** de árboles, postes y alambrados.

## Trazado real Montevideo → Chuy

Datos sacados de un mapa de Google My Maps de la línea **152I** (Tres Cruces → Terminal Chuy por Interbalnearia y Ruta 9).

| Archivo | Qué es |
|---|---|
| `data/ruta-mvd-chuy.js` | `window.RUTA_REAL`: 3.649 puntos del trazado y 46 paradas. **Lo usa el juego.** |
| `data/ruta-mvd-chuy.json` | Los mismos datos, para las herramientas. |
| `src3d/rutaReal.js` | Global `RutaReal`: `posicionEn(s)`, `direccionEn(s)`, `rumboEn(s)`, `pendienteEn(s)`, `curvaturaEn(s)`, `tramo(sIni, sFin)` → `CatmullRomCurve3`, `proximaParada(s)`. |
| `tools/MVD_a_Chuy.kml` | KML original exportado de My Maps. |
| `tools/kml_a_ruta.py` | KML → `data/ruta-mvd-chuy.json` + `.js`. |
| `tools/agregar_altura.py` | Agrega la altura real (Open-Meteo, Copernicus DEM 90 m) a los dos archivos. |

**Formato:** metros reales, origen en Tres Cruces (lat -34.89392, lon -56.16705). Ejes: `x` = este, `z` = −norte, `y` = altura. Cada punto tiene `s` (distancia recorrida en m). Cada parada tiene `codigo`, `nombre`, `x/z`, `s` y `km`. Largo total: **342,2 km**.

**Estado:** la altura ya está cargada (`con_altura: true`, de 3 a 80 m). Si se regenera el KML, hay que volver a correr, desde esta carpeta y con internet:

```
py tools/agregar_altura.py data/ruta-mvd-chuy.json
```

(En Windows es `py` o `python`. Usa solo la librería estándar de Python. La API corta con error 429 si se le pide rápido; el script espera y reintenta, y tarda unos 2 minutos.)

**Paradas que hay que revisar** (están lejos del trazado del KML):
- `3180 R9 KM 190`: a 2,7 km. Probablemente el punto está mal cargado en el mapa.
- `3290 P. DEL DIABLO` (a 844 m) y `3330 BARRA DE CHUY` (a 3,9 km): el trazado no entra al pueblo. Si el servicio sí entra, hay que agregar ese desvío al KML y regenerar los datos.

**Concuerda con lo actual:** los km reales coinciden con los landmarks de `src3d/route3d.js` (Peaje Pando km 33, Atlántida ~44, Peaje Solís ~80,4, Pan de Azúcar ~97). Los datos de paisaje y carteles se pueden reutilizar y extender para Ruta 9.

## Cómo está hecho hoy el 3D (importante para integrar)

- **Decisión de José (31/10/2026, actualizada 08/11/2026):** el viaje es arcade y **completo** (Tres Cruces → Chuy de una, unos 9 minutos, un solo ranking; no hay selector de tramos). Los km reales sirven solo como referencia, pero las **curvas y las alturas sí van**, sacadas del trazado real. No se hace el modo a escala real con chunks y floating origin.
- La lógica del juego piensa en una ruta **recta**. `World3D.createRoad()` (`src3d/world3d.js`) dibuja un plano de 520 m por perfil (`ib` = 2+2 carriles con doble amarilla, `r9` = 1+1 con amarilla discontinua) y simula el avance desplazando las texturas. `World3D.setProfile()` y `World3D.P` dan el perfil actual.
- Los objetos se ubican con `position.z = -(pos - S.dist)` y `x` = costado (`addWorld`, `placeDeco`, `updateDecos` en `game3d.js`). Choques, paradas y peajes se calculan en ese espacio recto.
- **Curvas y lomas = deformación en el vertex shader** (`src3d/bend3d.js`, global `Bend`). Parchea `ShaderChunk` (`project_vertex`, `worldpos_vertex`, `sprite_vert`), así que vale para todos los materiales, también las sombras. Cada cuadro, `Bend.update()` carga 48 muestras (cada 10 m, desde 60 m atrás) con el corrimiento, el rumbo y la altura relativos al ómnibus. `Bend.at()` hace lo mismo en la CPU, para la cámara.
  - Consecuencias: las mallas largas necesitan vértices a lo largo (la calzada, el pasto, el agua, la zona de parada y los cables de UTE ya los tienen), y los objetos del mundo van con `frustumCulled = false` (`noCull` en `game3d.js`).
  - Un material con su propio `onBeforeCompile` no se deforma (por ejemplo, la librea del ómnibus, que está en d = 0).
- **Jugador** (`#playerBox`, `COMPANIES` y `player` en `game3d.js`, guardado en `cot-ruta-3d-player`): al entrar y después de cada viaje se pide nombre y empresa (COT, Rutas del Sol, CYNSA). La empresa define la skin; el nombre y la empresa van al ranking (`Ranking.add(name, score, company)`). Ya no se pide el nombre al final.
- **Skins del ómnibus** (`SKINS` y `liveryMaterial()` en `world3d.js`; dentro de la empresa se alternan con el botón ÓMNIBUS / tecla O del título):
  - `cot` se pinta por código.
  - `cot925` proyecta una plantilla de Proton (`window.SKIN_TEX.cot925` en `src3d/skinCot925.js`) desde cada lado, con los píxeles de cada panel en `proj`.
  - Skins nuevas: se pintan sobre `assets/plantilla-omnibus/plantilla-en-blanco.png` (vistas ortográficas del modelo, generadas con `tools/generar_plantilla.html`; sus rectángulos = `PLANTILLA` en `world3d.js`) y se convierten con `py tools/skin_a_js.py`, que crea `src3d/skins/<id>.js` (agrega a `window.EXTRA_SKINS`) y su `<script>` antes de `world3d.js`. La luneta toma el recorte de la plantilla (`rearCropTex`). En las skins con imagen, el alero sobre la luneta (u > 0,93, h > 3,45) y lo que asoma de la piel interior por la unión techo-cola toman el color del techo al 90 % del largo; la piel interior no se pinta de negro y los costados no leen el último 5 % de la plantilla (el contorno), si no aparece una franja negra y una muesca en esa unión.
  - `cot` lleva calcos traseros (`rearDecalTex`: "1° Clase", número `number`, disco de 90), como en la foto `src/images (1).jpg`.
  - El garaje (visor) se sacó a pedido: de cerca se notan los defectos del modelo. Los huecos del modelo se tapan con la "segunda piel" interior (`hull` en `busModel.js`, calculada offline con rayos, pintada con la librea) y `hullBoxes`; nunca con placas que asomen.
  - **Ninguna pieza del ómnibus se deforma con `Bend`**: en `loadBus` se clonan sus materiales con un `onBeforeCompile` vacío. Si no, en lomas y curvas la luneta, las ruedas y las molduras se corren respecto de la carrocería.
- **Modelos de los packs** (`src3d/models3d.js`, global `Models3D`; datos en `src3d/models/*.js` = `window.MODELS3D`, generados con `tools/preparar_modelos.mjs` desde `assets/modelos/`): `Models3D.load()` es asíncrono; en el arranque (`modelsReady` en `game3d.js`) se rearma la decoración con ellos.
  - Árboles/casas: `DECO_MODELS` en `game3d.js`. Esos tipos son objetos sin malla (proxies) y se dibujan con un `InstancedMesh` por parte (`buildPools`/`updatePools`, con `count` = visibles). Biomas con `monte: true` los ponen tupidos junto al alambrado.
  - Autos: `World3D.makeCar` usa `Models3D.car(color)` si están cargados.
  - Letras: `Models3D.letters(text)` arma el cartel con geometrías compartidas (alfabeto reconocido por posición en la grilla). Landmarks `type: 'letters'`; `placeDeco` deja libre el frente del cartel.
  - El Enter del nombre del jugador hace `stopPropagation` (si no, arrancaba el viaje).
- **Curvas y lomas** (`buildProfile()` en `game3d.js`): cada segmento toma su pedazo `real` (km recorridos del KML) y lo comprime a `SEG_M`. Del trazado saca el rumbo y la altura, y los atenúa con `CURVE_GAIN`, `MIN_RADIUS` (350 m), `HILL_GAIN` y `MAX_GRADE` (6 %). Después los suaviza. Sin datos usa curvas y lomas inventadas.
  - En las subidas el ómnibus pierde velocidad y en las bajadas gana. Se inclina con la pendiente y en las curvas. El cielo, los reflejos y el sol giran con el rumbo.
- **El viaje es Montevideo → Chuy (línea 152I). No tiene nada que ver con Punta del Este** (lo pidió José).
- **Segmentos** (`ROUTES3D` en `src3d/route3d.js`), seguidos: Interbalnearia Tres Cruces → Pan de Azúcar (km 0–97), Ruta 9 Pan de Azúcar → Terminal Rocha (km 107–207,5; Ruta 9 cuenta desde Montevideo por Ruta 8) y Terminal Rocha → Terminal Chuy (km 207,5–337,6). `real` de cada uno: [0, 97,1], [97,1, 210,5] y [210,5, 342,2] km del KML. **`ROUTE_FULL`** (al final de `route3d.js`) los une: `segments`, y biomas, landmarks (cada uno con su `shield` y `profile`) y paradas juntos. Es lo único que usa el juego (`const R = ROUTE_FULL`). Ranking: `cot-ruta-3d-ranking-completo`.
- La distancia está **comprimida**: cada segmento se estira a `SEG_M = 5200` m de juego (`TRIP_M = 15600`, `TARGET_TIME = 540`). `kmAt(pos)` y `posAt(km)` son por segmento (`SEGS`, con `p0`/`p1`/`mPerKm`) y pasan a km oficiales (los de los carteles; el hueco 97–107 no existe en metros de juego). `profileAt(pos)`, `roadAt(pos)` y `twoWay(pos)` dan el perfil en cada lugar: filas, decoración, tránsito y autos de adorno usan el perfil **de su posición**, no el del ómnibus. `M_PER_KM = 40` queda solo como ritmo.
- **Cambio de perfil** (Pan de Azúcar, `PROFILE_CHANGES`): `updateRoadProfile()` llama a `road.setSplit(behind, ahead, zCut)` (`createRoad` en `world3d.js`): se ven las dos calzadas, cada una con su material y un plano de corte (`renderer.localClippingEnabled = true`). Los autos de nuestro carril izquierdo pasan al derecho antes del cambio y los de frente que llegan a la Interbalnearia siguen por los carriles de enfrente sin choque (`updateTraffic`).
- **Semáforos** (landmarks `type: 'semaforo'`, lista `SEMAFOROS` en `ROUTE_FULL`; modelo `World3D.makeCrossing(profile, sides)` con `userData.setLight`): `updateCrossings` (amarillo cuando el ómnibus está a < 175 m, rojo mínimo 6 s y hasta que estuvo 3 s parado, `m.wait` = 80 %), `spawnSideCar` (uno dobla al carril derecho, otro cruza), `updateTraffic` (los autos frenan en el rojo y detrás del de adelante) y `checkCrossings` (pasar en rojo −15 % confort, esperar +40). Decoración, alambrado y postes se sacan de las calles con `crossingNear(pos)`.
- **Bosque extra** fuera de las ciudades: `FOREST_N` proxies con `userData.forest` en el mismo set de decoración, con pools propios **sin sombra**. Densidad por bioma con `forest` (0–1). Medido: ~380–430 mil triángulos en zonas de bosque (nivel medio), unos 110–180 dibujos.
- `finish()` solo actúa una vez por viaje (antes, varias penalidades en el mismo cuadro agregaban varias entradas al ranking).
- Depuración: `game3d.step(dt)` avanza la simulación sin dibujar (las pruebas en Chrome sin GPU van a 2-3 FPS).
- Las paradas de los tramos son las reales de la 152I, pasadas a **km oficial** interpolando entre las paradas "IB KM n" / "R9 KM n" (sin la 3180). La `s` del KML y los mojones difieren hasta ~10 km en Ruta 9.

## Celular

- Es responsive (media queries en `index3d.html` para pantallas angostas y para poca altura). Al entrar en un dispositivo táctil se abre `#controlBox`: **botones** o **inclinación**. La elección queda en `localStorage` (`cot-ruta-3d-control`) y se cambia con el botón CONTROLES del título.
- La inclinación usa `devicemotion` (`accelerationIncludingGravity`), no `deviceorientation`, porque los ángulos se traban con el celular parado. La gravedad se pasa al plano de la pantalla según `screen.orientation.angle`, y el signo invertido de algunos celulares se detecta solo. El volante se centra al salir.
  - Inclinado mueve `S.targetX` de a poco; derecho, se acomoda en el carril más cercano (`updateTilt` en `game3d.js`).
  - En iPhone se pide `DeviceMotionEvent.requestPermission()` al tocar el botón. Hace falta https.
- En el celular: pantalla completa al salir, botón de pausa `#bPause`, pausa automática en `visibilitychange`.

## Ideas pendientes

- La versión 2D (`index.html`) sigue siendo Tres Cruces → Punta del Este. No se tocó porque no se pidió.

- La Coronilla como cartel de localidad en Ruta 9 (Rocha → Chuy).
- Revisar con fotos o el mapa los km aproximados de arroyos, del peaje Garzón y de la Fortaleza.
- Medir con `?fps` en la PC del evento: la deformación agrega muy poco, pero ahora todo se dibuja sin descarte por cámara.
