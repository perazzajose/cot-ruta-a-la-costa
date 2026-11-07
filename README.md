# COT · Ruta a la Costa

Juego arcade para navegador. Manejás un ómnibus de COT de Montevideo al Chuy (línea 152I, por la Interbalnearia y Ruta 9), levantás pasajeros en las paradas y llegás en hora sin chocar.

(La versión 2D, `index.html`, todavía es el viaje viejo de Tres Cruces a Punta del Este.)

## Cómo abrirlo

Hacé doble clic en `index.html`. Funciona sin internet y sin instalar nada (Phaser está incluido en `lib/`).
Anda en PCs modestas: los gráficos se dibujan por código y no hay imágenes para descargar.

Para el evento conviene abrirlo en pantalla completa (F11) en Chrome o Edge.

## Versión 3D

Abrí `index3d.html` (también con doble clic y sin internet). Es la misma jugabilidad, pero con la cámara detrás del ómnibus, tránsito en contramano, curvas y lomas. Se puede jugar en la PC y en el celular.

- Se ve realista: el cielo es una foto 360° que también ilumina la escena y se refleja en la pintura y los vidrios, el asfalto y el pasto tienen texturas reales y en calidad alta hay sombras reales.
- La calidad se ajusta sola por pasos. Si no llega a 50 cuadros por segundo, saca primero lo que menos se nota (resolución, tamaño de sombras, sombras, relieve, distancia de dibujo) y vuelve a medir después de cada paso. Lo que funcionó queda guardado en esa PC, así la próxima vez arranca directo ahí. Si en una sesión nueva anda sobrado, prueba subir un paso.
- Para probar la PC del evento: `index3d.html?fps` muestra los cuadros por segundo y el paso de calidad actual.
- Para forzar un nivel fijo: `?q=high`, `?q=medium` o `?q=low`. Para que olvide lo aprendido en esa PC: `?q=reset`.
- Al cargar, el juego compila de antemano los gráficos de todos los objetos ("Preparando gráficos…"), así no hay tirones la primera vez que aparece una parada o un camión.
- Si una PC no tiene aceleración gráfica (WebGL), usá la versión 2D (`index.html`).
- El ranking de la versión 3D es aparte del de la 2D. Se borra igual: **Shift + B** en el título.

**Créditos:** el ómnibus es ["Marcopolo g7 1200 FREE" de SquielOFICIAL](https://sketchfab.com/3d-models/marcopolo-g7-1200-free-3ccb328bf76f435fa6180936b59a8c90), con licencia [CC-BY 4.0](http://creativecommons.org/licenses/by/4.0/) (ver `assets/bus-g7-license.txt`). Se le quitó el interior, se simplificó (de 256 mil a 35 mil triángulos) y se le pintó la librea de COT por código. La licencia exige mantener este crédito, que también aparece en la pantalla de título. El cielo (kloofendal_48d_partly_cloudy_puresky) y las texturas de asfalto, pasto y arena son de [Poly Haven](https://polyhaven.com), con licencia CC0 (dominio público, sin obligación de dar crédito).

**Ojo con el modelo del ómnibus:** los nombres internos del archivo siguen la convención de los mods de Proton Bus Simulator. El autor lo publica como propio con licencia CC-BY, pero no se pudo confirmar que sea obra suya. Para uso interno alcanza; antes de publicar el juego, conviene confirmarlo o reemplazar el modelo.

Archivos de la versión 3D: `src3d/` (lógica, mundo y librea), `lib/three.bundle.min.js` (three.js r170 con GLTFLoader), `src3d/textures3d.js` (texturas embebidas) y `assets/bus-g7.glb` (el ómnibus procesado, también embebido en `src3d/busModel.js`).

**Cambiar la librea:** los colores, la franja y el logo se dibujan en `liveryMaterial()`, dentro de `src3d/world3d.js`. Si COT pasa el logo oficial en PNG, se puede reemplazar el que está dibujado con texto.

**La ruta, como la real:** el diseño sale de fotos de la Interbalnearia y Ruta 9 (Wikimedia Commons). La Interbalnearia es una sola calzada para los dos sentidos, con doble línea amarilla al centro y 2 carriles por sentido separados por línea blanca discontinua, borde blanco y banquina. Al costado hay postes de UTE con cables, columnas de alumbrado en las zonas pobladas, alambrados y mojones azules de km con el escudo "IB". El tránsito es moderado en los dos sentidos. Por zonas:
- **Ciudad de la Costa (km 0–30):** casas y alumbrado.
- **Costa de Oro (km 30–78):** pinos marítimos y eucaliptos.
- **Sierras de Maldonado (km 78–94):** campo con vacas, la Sierra de las Ánimas y el Cerro Pan de Azúcar con su cruz al fondo.
- **Pan de Azúcar (desde el km 94):** casas y alumbrado. Ahí la 152I deja la Interbalnearia y sigue por Ruta 9.

En el camino aparecen los peajes de **Pando** (km 33) y **Solís** (km 81), los carteles azules de arroyo (Aº Pando, Aº Solís Chico, Aº Solís Grande) y los carteles azules en ménsula de Ciudad de la Costa, Atlántida, Piriápolis y Pan de Azúcar. **En el peaje** hay que pasar a 40 km/h o menos y por un carril: si vas más rápido perdés confort, si pasás por el medio chocás la isleta, y si lo hacés bien sumás 50 puntos.

**Tramos:** el viaje Montevideo → Chuy está dividido en tres tramos, uno después del otro. En la pantalla de título se elige el tramo. Se toca uno y sale directo, o se elige con ← → y se arranca con ESPACIO. El tramo elegido queda guardado y cada tramo tiene su propio ranking. Todos duran lo mismo (unos 2-3 minutos), pero los carteles y el HUD muestran los km reales de la ruta.
- **Interbalnearia:** Tres Cruces → Pan de Azúcar (km 0–97), como se describe arriba.
- **Ruta 9 · Tramo 1:** Pan de Azúcar → Terminal Rocha (km 107–207,5; Ruta 9 cuenta los km desde Montevideo por Ruta 8, por eso arranca en el 107). Pasa por las sierras al fondo, San Carlos y el peaje **Garzón**, y tiene carteles de Aº San Carlos, Aº Garzón, Aº Sarandí y Aº Rocha.
- **Ruta 9 · Tramo 2:** Terminal Rocha → Terminal Chuy (km 207,5–337,6). Pasa por Aº Chafalote, los **palmares de butiá** de Castillos, los **bañados** (pajonales y charcos), Punta del Diablo, la **Fortaleza de Santa Teresa** (a la derecha, con la bandera), la **Laguna Negra** (a la izquierda) y la llegada al Chuy.

**Paradas reales:** todas son paradas reales de la línea 152I, sacadas del mapa de `data/ruta-mvd-chuy.js` y pasadas a km de ruta. Los refugios muestran el nombre: Atlántida, San Luis, Las Flores, San Carlos, Rocha, Emp. Valizas, 19 de Abril, Castillos, La Esmeralda, Punta del Diablo y La Coronilla (las demás, el km).

**Ruta 9 se maneja distinto:** tiene un solo carril por mano, con línea amarilla discontinua al centro. Por tu carril van camiones, autos y motos lentos. Para pasarlos tenés que salir al carril de enfrente, por donde vienen autos y camiones que también se pueden chocar. Si estás en ese carril y se acerca alguien, aparece el aviso "¡VIENE UNO DE FRENTE!". Cada sobrepaso limpio suma 20 puntos.

**Armar otros tramos:** todo lo que aparece en cada tramo está en `src3d/route3d.js` (`ROUTES3D`). Ahí van los km de inicio y fin, el origen y el destino, el perfil de la ruta (`ib` o `r9`) y las zonas de paisaje (con qué tanto aparece cada árbol, casa, vaca, butiá, pajonal o charco; un peso de más de 4 los hace todavía más densos). También van los lugares por km (localidades, arroyos, peajes, cerros, mar o laguna, fortaleza) y las paradas. Los km son aproximados y se ajustan ahí, sin tocar el código del juego. Para sumar un tramo nuevo alcanza con agregar otra entrada.

**Jugador y empresa:** al entrar, el jugador pone su nombre y elige empresa: **COT**, **Rutas del Sol** o **CYNSA**. La empresa define el ómnibus (COT tiene dos, Primera Clase y 925, que se alternan con el botón **ÓMNIBUS** del título o la tecla **O**). El nombre va directo al ranking, que muestra la empresa de cada uno. Después de cada viaje la pantalla vuelve a aparecer con lo anterior cargado, para el próximo jugador. Las empresas y sus skins están en `COMPANIES` (`src3d/game3d.js`).

**Skins:**
- **COT Primera Clase:** librea pintada por código según las fotos del Marcopolo de COT.
- **COT 925:** sale de una plantilla de pintura de Proton Bus Simulator (`src/cot925.zip`). Como esa plantilla se hizo para otro modelo, se **proyecta** sobre el nuestro desde cada lado (costados, techo, cola y frente), calibrada para que sus ventanas coincidan con las del modelo. Lo negro de la plantilla se dibuja como vidrio. La imagen está embebida en `src3d/skinCot925.js` y la calibración de cada panel está en `SKINS` (`src3d/world3d.js`). La plantilla la hizo un modder: si el juego se publica, conviene pedirle permiso y darle crédito.

**Skins de otras empresas** (en `src3d/skins/`):
- **Rutas del Sol:** pintada con IA sobre nuestra plantilla (`assets/rutasdelsolprueba.png`); se pasaron los vidrios a negro puro.
- **CYNSA:** sale de un dibujo de Maílson Amancio Pereira (`assets/cynsaprueba.jpg`, Marcopolo Viaggio G7 1050), recortado y estirado vista por vista a nuestra plantilla. El dibujo pide mantener el crédito, que está en el título. Como es de otro modelo y de baja resolución, las ruedas dibujadas no coinciden del todo y se ve algo borrosa de cerca.
- Son marcas reales: antes de mostrarlas en el evento, confirmar que COT está de acuerdo.

**Hacer una skin nueva (queda tan bien como la de COT):**
1. Abrí `assets/plantilla-omnibus/plantilla-en-blanco.png` en un programa de dibujo (Photoshop, GIMP, Krita, Photopea…). Son vistas exactas de NUESTRO ómnibus, así que todo lo que pintes calza justo:
   - arriba, el costado izquierdo (el frente queda a la izquierda);
   - debajo, el costado derecho, con la puerta (el frente queda a la derecha);
   - después, el techo;
   - abajo a la izquierda, la cola;
   - al lado, el frente.
   `plantilla-ejemplo-cot.png` es la misma plantilla con la librea de COT, como referencia.
2. Pintá encima, sin mover ni estirar nada. Lo que pintes **negro puro** se dibuja como vidrio. La luneta también se puede pintar (por ejemplo, con un logo).
3. Guardala como JPG de 2048 × 2048 (cuadrada) y convertila: `py tools/skin_a_js.py mi-skin.jpg cot_verano "COT Verano"`. El script crea `src3d/skins/cot_verano.js` y lo agrega a `index3d.html`. La skin aparece en el botón ÓMNIBUS.

Si el modelo del ómnibus cambia, la plantilla se regenera abriendo `tools/generar_plantilla.html?blanco` (y `?ejemplo`) y guardando la imagen.

Para sumar otra plantilla de Proton (hecha para otro modelo, calza peor): embeberla igual que `skinCot925.js` y copiar la entrada `cot925` de `SKINS`, ajustando los píxeles de cada panel.

El visor del ómnibus (garaje) se sacó: de cerca y de costado se notaban los defectos del modelo, que en el juego, con la cámara atrás, no se ven.

**Manejo:** el ómnibus se maneja como uno real. Acelera despacio (de 0 a 90 km/h en unos 6 segundos), necesita unos 40 m para frenar del todo y cambia de carril en unos 2 segundos (un toque cambia de carril completo; mantener apretado lo mueve de a poco y al soltar se queda donde está, aunque sea entre dos carriles), con la carrocería inclinándose en las curvas y la trompa hundiéndose al frenar. El aviso de parada aparece con tiempo de sobra para frenar.

**Curvas y lomas:** la ruta tiene curvas y subidas sacadas del trazado real de la línea 152I (`data/ruta-mvd-chuy.js`, con la altura real del terreno). El viaje sigue siendo corto, así que la forma real se comprime y se suaviza: no hay curvas más cerradas que un radio de 350 m ni pendientes de más de 6 %. En las subidas el ómnibus pierde un poco de velocidad y en las bajadas gana, y la carrocería se inclina con la pendiente y en las curvas. El cielo y el sol giran con la ruta. Técnicamente, el juego sigue pensando en una ruta recta (choques, paradas y peajes no cambian), y la placa de video curva y levanta todo al dibujarlo (`src3d/bend3d.js`), así que casi no cuesta rendimiento. Cuánto se curva y cuánto sube se ajusta con `CURVE_GAIN`, `MIN_RADIUS`, `HILL_GAIN` y `MAX_GRADE` en `src3d/game3d.js`.

## Jugar en el celular

El juego se adapta a la pantalla del celular, parado o acostado. Al entrar pregunta **cómo querés manejar**:
- **Con botones:** ◀ ▶ para cambiar de carril y FRENO.
- **Inclinando el celular:** el celular es el volante. Si lo inclinás, el ómnibus se corre hacia ese lado; si lo volvés a poner derecho, se acomoda solo en el carril más cercano. Al salir, el volante se centra en la posición en la que tengas el celular. Si después se corre, tocá el volante dibujado abajo a la izquierda para centrarlo de nuevo. FRENO sigue siendo un botón.

La elección se puede cambiar en el título con el botón **CONTROLES**. En el celular el juego pasa a pantalla completa al salir, tiene un botón de pausa (II) y se pausa solo si cambiás de app. Si el celular no tiene sensor de movimiento o no da permiso, el juego pasa a los botones y avisa.

**Para abrirlo en el celular** hay que publicarlo como página web con **https** (por ejemplo en Vercel o GitHub Pages). Los navegadores no dan el sensor de movimiento en páginas sin https, y en el iPhone además piden permiso la primera vez.

## Controles

| Acción | Teclado | Celular (botones) | Celular (inclinación) |
|---|---|---|---|
| Cambiar de carril | tocar ← → (o A / D) | tocar ◀ ▶ | inclinar el celular |
| Moverse de a poco (quedar entre carriles) | mantener ← → | mantener ◀ ▶ | inclinar poco |
| Frenar | ↓, S o ESPACIO | botón FRENO | botón FRENO |
| Bocina | H | — | — |
| Pausa | P o ESC | botón II | botón II |

## Reglas y puntaje

- **Paradas:** en el carril derecho, frená a 20 km/h o menos sobre la zona amarilla. Cada pasajero da 100 puntos. Si se te pasa una parada, perdés 10 % de confort.
- **Choques:** cada choque resta 30 % de confort. Si el confort llega a 0, el viaje termina.
- **Mate:** recupera 15 % de confort. **Encomienda:** da 50 puntos.
- **Al llegar:** sumás 500 puntos, más un bono de puntualidad (antes de los 3:00) y un bono de confort.

## Para el organizador

- El ranking (top 10) se guarda en el navegador de esa máquina.
- Para borrar el ranking, en la pantalla de título apretá **Shift + B**.
- Después de cada partida, el juego vuelve solo al título a los 25 segundos (modo kiosco).

## Personalizar

- **Números del juego** (velocidades, paradas, duración): están en `src/config.js`.
- **Colores de marca:** se cambian en `COLORS` dentro de `src/config.js`.
- **Logo o arte oficial:** los gráficos están en `src/textures.js`. Para usar PNGs, cargalos en `BootScene` con las mismas claves (`bus`, `car0`, `shelter`, etc.).
