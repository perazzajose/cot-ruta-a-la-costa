# Guía de rendimiento — Juego de conducción en Three.js

Juego de conducción por ruta, jugable en navegador (PC y celular), con objetivo de **máximo realismo sin sacrificar fluidez**.
Esta guía define las reglas técnicas que debe seguir todo el código del proyecto.

## Objetivos de rendimiento

| Métrica | PC | Celular gama media |
|---|---|---|
| FPS | 60 estables | 30–60 |
| Draw calls por frame | < 300 | < 150 |
| Triángulos en pantalla | < 1.5 M | < 500 k |
| Memoria de texturas (GPU) | < 512 MB | < 256 MB |

Verificar siempre con `renderer.info` y probar en un celular real, no solo en PC.

---

## 1. Reducir draw calls

- Todo objeto repetido (árboles, postes, guardarrails, carteles, líneas de la ruta, conos) va con **`InstancedMesh`**.
- La geometría estática de cada chunk se une con `BufferGeometryUtils.mergeGeometries`.
- Compartir materiales entre objetos. Usar **atlas de texturas** para que muchos objetos usen un solo material.
- No crear un `Mesh` por objeto decorativo.

```js
import { InstancedMesh, Object3D } from 'three';

const dummy = new Object3D();
const arboles = new InstancedMesh(geoArbol, matArbol, CANTIDAD);
for (let i = 0; i < CANTIDAD; i++) {
  dummy.position.set(x[i], y[i], z[i]);
  dummy.rotation.y = Math.random() * Math.PI * 2;
  dummy.scale.setScalar(0.8 + Math.random() * 0.4);
  dummy.updateMatrix();
  arboles.setMatrixAt(i, dummy.matrix);
}
arboles.instanceMatrix.needsUpdate = true;
scene.add(arboles);
```

---

## 2. Mundo por tramos (streaming de chunks)

- La ruta se divide en **chunks** (ej. 200–500 m cada uno).
- Mantener cargados solo N chunks adelante y 1–2 atrás del vehículo.
- Al descartar un chunk: **`.dispose()`** de geometrías, materiales y texturas propias, o devolverlo a un **pool** para reutilizarlo.
- La generación de chunks pesados puede ir en un **Web Worker** para no trabar el hilo principal.

```js
function liberarChunk(chunk) {
  chunk.traverse(obj => {
    if (obj.geometry) obj.geometry.dispose();
    if (obj.material) {
      const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
      mats.forEach(m => {
        for (const key in m) if (m[key]?.isTexture) m[key].dispose();
        m.dispose();
      });
    }
  });
  scene.remove(chunk);
}
```

> No liberar materiales/texturas **compartidos** entre chunks; solo los propios del chunk.

### Floating origin (obligatorio)

Después de ~10 km desde el origen, la precisión de los floats produce temblequeo (jitter) en vértices y cámara.
Cuando el vehículo supera un umbral, se **recentra todo el mundo** restando la posición del auto.

```js
const UMBRAL = 2000; // metros

function revisarOrigen(auto, mundo, fisica) {
  const p = auto.position;
  if (Math.abs(p.x) > UMBRAL || Math.abs(p.z) > UMBRAL) {
    const offset = p.clone();
    offset.y = 0;
    mundo.children.forEach(o => o.position.sub(offset));
    fisica.desplazarTodo(offset); // mover también los cuerpos físicos
    origenGlobal.add(offset);     // guardar para coordenadas reales
  }
}
```

### Niebla y plano lejano

- Usar `scene.fog` (o `FogExp2`) con `camera.far` acorde (ej. 800–1500 m).
- Da sensación de distancia realista y evita dibujar lo que no se ve.

---

## 3. LOD (nivel de detalle)

- Usar `THREE.LOD` en objetos con modelo detallado (vehículos de tráfico, edificios, puentes).
- Árboles y vegetación lejana: **billboards / impostores** (plano con textura que mira a la cámara).
- Esquema sugerido: alto detalle < 50 m, medio < 200 m, impostor < 600 m, nada más allá (lo cubre la niebla).

```js
const lod = new THREE.LOD();
lod.addLevel(modeloAlto, 0);
lod.addLevel(modeloMedio, 50);
lod.addLevel(impostor, 200);
scene.add(lod);
```

---

## 4. Assets livianos

### Modelos
- Formato **glTF / GLB** únicamente.
- Comprimir con **Draco** o **Meshopt**.
- Optimizar con `gltf-transform`:

```bash
npx @gltf-transform/cli optimize entrada.glb salida.glb --compress meshopt --texture-compress ktx2
```

### Texturas
- Formato **KTX2 (Basis Universal)** cargado con `KTX2Loader`.
- Tamaño máximo 1024 px salvo el vehículo del jugador o el asfalto (hasta 2048).
- Dimensiones potencia de 2 y mipmaps activados.
- Asfalto y pasto: texturas **tileables** con `RepeatWrapping`, no texturas gigantes.

---

## 5. Luces, sombras y materiales

- **Una sola** `DirectionalLight` con sombras (el sol) + `HemisphereLight` o un environment map para el ambiente.
- La cámara de sombras **sigue al vehículo** y cubre un área chica (ej. 60×60 m).
- `shadow.mapSize`: 1024 en celular, 2048 en PC.
- Paisaje estático: **iluminación horneada (lightmaps / AO baked)**, no luces en tiempo real.
- Materiales:
  - `MeshStandardMaterial` / `MeshPhysicalMaterial` → solo el auto del jugador y objetos cercanos.
  - `MeshLambertMaterial` / `MeshBasicMaterial` → vegetación, fondo, objetos lejanos.
- Evitar luces puntuales múltiples con sombras (faros: usar `SpotLight` sin sombra o texturas emisivas).

```js
function actualizarSombra(sol, auto) {
  sol.position.copy(auto.position).add(DIR_SOL); // DIR_SOL = Vector3 constante
  sol.target.position.copy(auto.position);
  sol.target.updateMatrixWorld();
}
```

---

## 6. Configuración del renderer

```js
const esMovil = /Android|iPhone|iPad/i.test(navigator.userAgent);

const renderer = new THREE.WebGLRenderer({
  antialias: !esMovil,
  powerPreference: 'high-performance',
});
renderer.setPixelRatio(Math.min(window.devicePixelRatio, esMovil ? 1.25 : 1.5));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
```

### Resolución dinámica
Si los FPS bajan de forma sostenida, bajar el pixel ratio; si sobran, subirlo.

```js
let pixelRatio = renderer.getPixelRatio();
function ajustarCalidad(fpsPromedio) {
  if (fpsPromedio < 45 && pixelRatio > 0.75) pixelRatio -= 0.1;
  else if (fpsPromedio > 58 && pixelRatio < 1.5) pixelRatio += 0.05;
  renderer.setPixelRatio(pixelRatio);
}
```

### Post-processing
- Usar con moderación. Bloom y SSAO son caros.
- Ofrecer **presets de calidad** (Bajo / Medio / Alto) que activen o desactiven sombras, post-processing, densidad de vegetación y distancia de dibujado.

---

## 7. Física

- Motor: **Rapier (`@dimforge/rapier3d-compat`, WASM)** recomendado; alternativa `cannon-es`.
- Vehículo con **raycast vehicle** (ruedas por raycast, no cilindros físicos).
- **Timestep fijo** (ej. 1/60 s) con acumulador, separado del render.
- Colliders simples: cajas, cápsulas y **heightfield** para el terreno.
- **Nunca** usar la malla visual como collider.
- Solo crear colliders de los chunks cercanos; eliminarlos al descargar el chunk.

```js
const PASO = 1 / 60;
let acumulador = 0;

function loop(dt) {
  acumulador += Math.min(dt, 0.1);
  while (acumulador >= PASO) {
    fisica.step(PASO);
    acumulador -= PASO;
  }
  sincronizarVisuales(acumulador / PASO); // interpolar posición visual
  renderer.render(scene, camera);
}
```

---

## 8. Game loop sin basura (evitar garbage collector)

- **Prohibido** crear objetos dentro del loop (`new Vector3()`, `new Quaternion()`, arrays, closures).
- Declarar temporales reutilizables a nivel de módulo.

```js
// ✅ Bien
const _tmpVec = new THREE.Vector3();
function update() {
  _tmpVec.copy(auto.position).sub(camara.position);
}

// ❌ Mal
function update() {
  const dir = new THREE.Vector3().subVectors(auto.position, camara.position);
}
```

- Usar `renderer.setAnimationLoop` en lugar de `requestAnimationFrame` manual.
- Pausar render y física cuando la pestaña no está visible (`document.visibilitychange`).

---

## 9. Ruta fiel a la realidad

- **Trazado:** exportar la ruta real desde **OpenStreetMap** (Overpass API / GeoJSON).
- **Altimetría:** datos **SRTM** o un heightmap de la zona.
- Convertir lat/lon a metros locales (proyección simple equirectangular o UTM) relativos a un punto de origen.
- Construir la ruta con **`CatmullRomCurve3`** y **extruir** la sección del asfalto (calzada, banquinas, líneas) a lo largo de la curva.
- El terreno a los costados se adapta a la altura de la ruta (aplanar una franja alrededor).
- Colocar señalización, postes kilométricos y guardarrails siguiendo la curva con `getPointAt` / `getTangentAt`.

```js
const curva = new THREE.CatmullRomCurve3(puntosRuta); // Vector3[] en metros
const N = 1000;
for (let i = 0; i <= N; i++) {
  const t = i / N;
  const p = curva.getPointAt(t);
  const tangente = curva.getTangentAt(t);
  // calcular normal lateral y generar vértices de la calzada
}
```

### Dónde está el realismo
El realismo viene más de estos puntos que de la cantidad de polígonos:
1. Iluminación (sol, cielo, tone mapping, environment map).
2. Texturas de calidad (asfalto con desgaste, banquinas, pasto variado).
3. Sonido del motor según RPM, viento, ruedas sobre distintas superficies.
4. Física y "feeling" del manejo (transferencia de peso, suspensión, cámara con inercia).
5. Detalles de la ruta real (señales, curvas, pendientes, peajes, pueblos).

---

## 10. Medición y debugging

- **stats.js** → FPS y ms por frame.
- **`renderer.info`** → draw calls, triángulos, geometrías y texturas en memoria (vigilar que no crezcan sin parar = fuga de memoria).
- **Spector.js** → inspección de cada draw call.
- **Chrome DevTools → Performance / Memory** → cuellos de botella de CPU y fugas.
- Probar periódicamente en un **celular de gama media** real.

```js
setInterval(() => {
  const { calls, triangles } = renderer.info.render;
  const { geometries, textures } = renderer.info.memory;
  console.log({ calls, triangles, geometries, textures });
}, 5000);
```

---

## Checklist antes de cada commit grande

- [ ] Objetos repetidos usan `InstancedMesh`.
- [ ] Chunks descartados liberan memoria (`dispose`) o vuelven al pool.
- [ ] Floating origin activo.
- [ ] Sin `new` dentro del loop.
- [ ] Assets en GLB comprimido + texturas KTX2.
- [ ] Una sola luz con sombras, que sigue al vehículo.
- [ ] Pixel ratio limitado.
- [ ] Física con timestep fijo y colliders simples.
- [ ] `renderer.info` estable tras recorrer varios km.
- [ ] Probado en celular.
