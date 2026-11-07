// Ruta a la Costa 3D: misma jugabilidad que la versión 2D, con cámara detrás del ómnibus.
// Unidades en metros. El ómnibus queda en z = 0 y el mundo se mueve hacia +Z.
(() => {
  const { LANE_X } = World3D;
  const LANE_SPEED = [24, 16];          // tránsito por carril (m/s): izquierdo rápido, derecho lento
  const LANES = LANE_X.map((_, i) => i);
  const RIGHT = LANE_X.length - 1;      // carril derecho (paradas)
  const M_PER_KM = 40;                  // ritmo del juego (huecos, avisos): un "km" de juego son 40 m
  const TRIP_M = 5200;                  // todos los tramos duran lo mismo (~2-3 minutos)
  // Física de ómnibus: pesado, acelera despacio, frena con distancia y dobla con inercia.
  const MAX_SPEED = 40;
  const ACCEL = 6.5;                    // 0 a 90 km/h en ~6 s
  const BRAKE = 22;                     // de 90 a 0 en ~1,8 s (unos 36 m)
  const LAT_MAX = 3.0;                  // velocidad lateral máxima (m/s): un cambio de carril tarda ~1,5 s
  const LAT_ACC = 4.5;                  // qué tan rápido gira el volante (m/s²)
  const STOP_SPEED = 9;                 // 20 km/h mostrados
  const KMH = 90 / MAX_SPEED;
  const TARGET_TIME = 180;
  const SPAWN_AHEAD = 280;
  // Ruta 9 (un carril por mano): los que van en nuestro sentido van más lento y los de frente
  // aparecen más lejos, porque se acercan rápido.
  const R9_SPEED = { truck: 12, car: 16, moto: 17 };
  const ONCOMING_AHEAD = 340;

  // ---------- Tramo elegido (route3d.js) ----------
  // Cada tramo se estira a TRIP_M metros: los km de los carteles son los reales de la ruta.
  const TRAMO_KEY = 'cot-ruta-3d-tramo';
  let R = ROUTES3D[0];
  let mPerKm = TRIP_M / (R.to - R.from);
  const kmAt = (pos) => R.from + pos / mPerKm;
  const posAt = (km) => (km - R.from) * mPerKm;
  const twoWay = () => R.profile === 'r9';
  const kmText = (km) => String(Math.round(km * 10) / 10).replace('.', ',');
  try {
    const saved = localStorage.getItem(TRAMO_KEY);
    R = ROUTES3D.find((r) => r.id === saved) || R;
  } catch (e) { /* sin almacenamiento: arranca en el primer tramo */ }

  const $ = (id) => document.getElementById(id);
  const rand = (a, b) => a + Math.random() * (b - a);
  const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];

  // ---------- Render ----------
  // Calidad por pasos (idea tomada de halloween.dev): si el juego no llega a GFX_TARGET fps, se
  // aplica el siguiente paso, se espera, se vuelve a medir, y así. Se saca primero lo que menos se nota.
  // El paso que funcionó se recuerda en esa PC, así la próxima vez arranca directo ahí.
  const GFX_LEVELS = [
    { name: 'máxima', pr: 1.5, shadow: 2048, normals: true },
    { name: 'resolución 1×', pr: 1, shadow: 2048, normals: true },
    { name: 'sombras 1024', pr: 1, shadow: 1024, normals: true },
    { name: 'resolución 0,85×', pr: 0.85, shadow: 1024, normals: true },
    { name: 'sin sombras reales', pr: 0.85, shadow: 0, normals: true },
    { name: 'sin relieve', pr: 0.85, shadow: 0, normals: false },
    { name: 'distancia corta', pr: 0.75, shadow: 0, normals: false, short: true },
    { name: 'mínima', pr: 0.6, shadow: 0, normals: false, short: true, lambert: true }
  ];
  const GFX_PRESETS = { high: 0, medium: 4, low: 7 };
  const GFX_TARGET = 50;
  const GFX_KEY = 'cot-ruta-3d-gfx';
  // ?q=high|medium|low fuerza un nivel fijo; ?q=reset olvida lo aprendido en esta PC.
  const qParam = (location.search.match(/[?&]q=(low|medium|high|reset)/) || [])[1] || (/[?&]low\b/.test(location.search) ? 'low' : null);
  const weak = window.matchMedia('(pointer: coarse)').matches || (navigator.hardwareConcurrency || 4) <= 4;
  const deviceSig = `${screen.width}x${screen.height}@${window.devicePixelRatio || 1}|${navigator.hardwareConcurrency || 0}`;
  let savedLevel = null;
  try {
    if (qParam === 'reset') localStorage.removeItem(GFX_KEY);
    const saved = JSON.parse(localStorage.getItem(GFX_KEY) || 'null');
    if (saved && saved.sig === deviceSig) savedLevel = saved.level;
  } catch (e) { /* sin almacenamiento: se mide cada vez */ }
  const gfx = {
    level: qParam && GFX_PRESETS[qParam] !== undefined ? GFX_PRESETS[qParam] : savedLevel ?? (weak ? GFX_PRESETS.medium : GFX_PRESETS.high),
    auto: !(qParam && GFX_PRESETS[qParam] !== undefined),
    lock: 0                             // mejor nivel permitido en esta sesión
  };
  let pixelRatio = Math.min(window.devicePixelRatio || 1, GFX_LEVELS[gfx.level].pr);
  const renderer = new THREE.WebGLRenderer({ antialias: !GFX_LEVELS[gfx.level].short, powerPreference: 'high-performance' });
  renderer.setPixelRatio(pixelRatio);
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  $('view').appendChild(renderer.domElement);

  // Cielo real (foto 360°) que además ilumina y se refleja en la pintura y los vidrios.
  const scene = new THREE.Scene();
  scene.fog = new THREE.Fog(0xc9d8e6, 90, 330);
  const skyTex = new THREE.TextureLoader().load(TEX3D.sky, (t) => {
    const pmrem = new THREE.PMREMGenerator(renderer);
    scene.environment = pmrem.fromEquirectangular(t).texture;
    pmrem.dispose();
  });
  skyTex.mapping = THREE.EquirectangularReflectionMapping;
  skyTex.colorSpace = THREE.SRGBColorSpace;
  scene.background = skyTex;
  const hemi = new THREE.HemisphereLight(0xdfeeff, 0x5a7a3c, 0.6);
  scene.add(hemi);
  // El sol coincide con el de la foto del cielo: 53° de altura, atrás a la derecha de la cámara.
  const SUN_DIR = new THREE.Vector3(0.475, 0.8, 0.367).normalize();
  const _sunDir = new THREE.Vector3(), _up = new THREE.Vector3(0, 1, 0), _look = new THREE.Vector3();
  const sun = new THREE.DirectionalLight(0xfff1dc, 2.6);
  sun.shadow.mapSize.set(2048, 2048);
  Object.assign(sun.shadow.camera, { left: -24, right: 24, top: 40, bottom: -40, near: 1, far: 180 });
  sun.shadow.bias = -0.0004;
  sun.shadow.normalBias = 0.04;
  scene.add(sun, sun.target);

  const camera = new THREE.PerspectiveCamera(60, 1, 0.5, 1200);
  let portrait = false;
  function resize() {
    const w = window.innerWidth, h = window.innerHeight;
    renderer.setSize(w, h);
    camera.aspect = w / h;
    portrait = w / h < 0.9;
    camera.fov = portrait ? 74 : 58;
    camera.updateProjectionMatrix();
  }
  window.addEventListener('resize', resize);
  resize();

  const road = World3D.createRoad(scene);
  let bus = null;

  // ---------- Estado ----------
  let mode = 'loading';  // loading | title | play | ending | result
  let paused = false;
  let S = null;          // estado del viaje
  const world = [];      // objetos anclados a una distancia de la ruta
  const decos = [];
  const rows = [];
  const backdrops = [];
  const oncoming = [];

  function newRun(attract) {
    return {
      attract, dist: 0, speed: attract ? 22 : 0, elapsed: 0, score: 0, passengers: 0, boxes: 0, crashes: 0,
      latV: 0, roll: 0, pitch: 0, camX: LANE_X[RIGHT] * 0.75, prevSpeed: attract ? 22 : 0,
      confort: 100, invuln: 0, stunned: 0, lane: RIGHT, targetX: LANE_X[RIGHT], busX: LANE_X[RIGHT], shake: 0,
      cars: [], pickups: [],
      stops: R.stops.map((st) => {
        const km = typeof st === 'number' ? st : st.km;
        const name = typeof st === 'number' ? `Parada km ${kmText(km)}` : `Parada ${st.name}`;
        return { km, name, pos: posAt(km), spawned: false, done: false, missed: false };
      }),
      nextCarAt: attract ? 40 : 60, nextOncomingAt: 30, nextPickupAt: 150, nextKmSign: Math.floor(R.from / 10) * 10 + 10,
      terminal: false, autoTimer: 2,
      waters: R.landmarks.filter((l) => l.type === 'water').map((w) => ({ ...w, spawned: false })),
      marks: routeMarks()
    };
  }

  // Con sombras reales no hacen falta las sombras falsas (manchas bajo los vehículos).
  function syncBlobs(obj) {
    const shadows = GFX_LEVELS[gfx.level].shadow > 0;
    obj.traverse((o) => { if (o.userData.isBlob) o.visible = !shadows; });
  }

  function applyGfx(level) {
    gfx.level = level;
    const L = GFX_LEVELS[level];
    pixelRatio = Math.min(window.devicePixelRatio || 1, L.pr);
    renderer.setPixelRatio(pixelRatio);
    const shadows = L.shadow > 0;
    if (shadows && sun.shadow.mapSize.x !== L.shadow) {
      sun.shadow.mapSize.set(L.shadow, L.shadow);
      if (sun.shadow.map) { sun.shadow.map.dispose(); sun.shadow.map = null; }
    }
    const shadowsChanged = renderer.shadowMap.enabled !== shadows;
    renderer.shadowMap.enabled = shadows;
    sun.castShadow = shadows;
    hemi.intensity = L.lambert ? 1.8 : 0.6;
    road.setQuality(L.lambert ? 'low' : L.normals ? 'high' : 'medium');
    // Distancia de dibujo: más niebla, menos lejos y la mitad de los árboles.
    scene.fog.near = L.short ? 60 : 90;
    scene.fog.far = L.short ? 210 : 330;
    camera.far = L.short ? 700 : 1200;    // lejos solo se ven los cerros (sin niebla); el resto lo tapa la niebla
    decos.forEach((d, k) => { d.visible = d.userData.biomeOK !== false && (!L.short || k % 2 === 0); });
    if (shadowsChanged) {
      scene.traverse((o) => { if (o.material) [].concat(o.material).forEach((m) => { m.needsUpdate = true; }); });
    }
    syncBlobs(scene);
    resize();
  }

  function saveGfx() {
    try { localStorage.setItem(GFX_KEY, JSON.stringify({ sig: deviceSig, level: gfx.level })); } catch (e) { /* no se recuerda */ }
  }

  // Con la ruta curvada (bend3d.js) la posición sin deformar no sirve para descartar lo que no se
  // ve: un objeto "fuera de cuadro" puede quedar a la vista en una curva. Lo lejano lo tapa la niebla.
  const noCull = (obj) => { obj.traverse((o) => { o.frustumCulled = false; }); return obj; };

  function addWorld(obj, pos, extra = {}) {
    obj.userData.pos = pos;
    Object.assign(obj.userData, extra);
    syncBlobs(obj);
    noCull(obj);
    obj.position.z = -(pos - S.dist);
    scene.add(obj);
    world.push(obj);
    return obj;
  }

  function disposeTextures(obj) {
    obj.traverse((o) => {
      if (o.userData.ownTex && o.material && o.material.map) o.material.map.dispose();
    });
  }

  function removeWorld(obj) {
    const i = world.indexOf(obj);
    if (i >= 0) world.splice(i, 1);
    scene.remove(obj);
    obj.userData.dead = true;
  }

  function clearWorld() {
    while (world.length) removeWorld(world[0]);
  }

  // ---------- Decoración reciclada ----------
  // Zona del tramo (route3d.js) para un km dado.
  const biomeAt = (km) => R.biomes.find((b) => km >= b.from && km < b.to) || R.biomes[R.biomes.length - 1];
  // ¿Hay mar o laguna de ese lado (1 = derecha, -1 = izquierda) en ese km?
  const waterAt = (km, side) => R.landmarks.some((l) => l.type === 'water' && l.side === side && km >= l.from - 3 && km <= l.to);

  // Árboles, casas, vacas, etc. del otro lado del alambrado. A la derecha desde x = 13; a la
  // izquierda desde 4,8 m después del borde de la calzada (cambia con el perfil). Cada objeto del
  // grupo se muestra o no según cuánto pesa su tipo en la zona donde cae.
  function placeDeco(d, pos) {
    const t = d.userData.type;
    const km = kmAt(pos);
    const near = t === 'pond' ? 10 : 0;      // los charcos son anchos: más lejos del alambrado
    const left = World3D.P.ROAD.l;
    const ranges = {
      1: [13 + near, waterAt(km, 1) ? World3D.WATER_NEAR - 4 : 36 + near],
      [-1]: [-(left - 4.8 - near), waterAt(km, -1) ? World3D.WATER_NEAR - 4 : 45 + near]
    };
    let side = Math.random() < 0.5 ? 1 : -1;
    if (ranges[side][1] < ranges[side][0]) side = -side;
    const [a, b] = ranges[side];
    d.userData.pos = pos;
    d.position.x = side * rand(a, Math.max(a, b));
    d.rotation.y = t === 'house' ? pick([0, Math.PI / 2, Math.PI, -Math.PI / 2]) : rand(0, Math.PI * 2);
    d.scale.setScalar(t === 'house' ? 1 : rand(0.8, 1.25));
    const w = Math.min(1, (biomeAt(km).weights[t] || 0) / 4);
    d.userData.biomeOK = Math.random() < w && ranges[side][1] >= ranges[side][0];
    d.visible = d.userData.biomeOK && (!GFX_LEVELS[gfx.level].short || d.userData.idx % 2 === 0);
  }

  // Decoración de cada tramo: los tipos que usa su paisaje, más copias de los que más pesan.
  // Se arma una vez por tramo y queda guardada (cambiar de tramo en el título no la rehace).
  const decoSets = {};
  function buildDecos() {
    decos.forEach((d) => scene.remove(d));
    decos.length = 0;
    if (!decoSets[R.id]) {
      const maxW = {};
      R.biomes.forEach((b) => Object.entries(b.weights).forEach(([t, w]) => { maxW[t] = Math.max(maxW[t] || 0, w); }));
      const types = [];
      Object.entries(maxW).forEach(([t, w]) => { for (let k = 0; k < Math.ceil(w); k++) types.push(t); });
      types.sort(() => Math.random() - 0.5);
      // Unas 4 copias por unidad de peso: la misma densidad en todos los tramos.
      decoSets[R.id] = Array.from({ length: Math.max(90, Math.round(types.length * 3.75)) }, (_, i) => {
        const t = types[i % types.length];
        const d = noCull(World3D.makeDeco(t));
        d.userData.type = t;
        d.userData.idx = i;
        return d;
      });
    }
    decoSets[R.id].forEach((d) => { scene.add(d); decos.push(d); });
  }

  // Cerros del fondo (Sierra de las Ánimas, Pan de Azúcar...): se acercan y pasan de costado en su tramo.
  const backdropSets = {};
  function buildBackdrops() {
    backdrops.forEach((b) => scene.remove(b.obj));
    backdrops.length = 0;
    if (!backdropSets[R.id]) {
      backdropSets[R.id] = R.landmarks.filter((l) => l.type === 'backdrop').map((l) => {
        const obj = noCull(World3D.makeMountain(l.model));
        obj.visible = false;
        if (l.model === 'sierra') obj.rotation.y = Math.PI / 2;   // la sierra corre paralela a la ruta
        obj.scale.setScalar(l.model === 'sierra' ? 1.3 : 1.5);
        return { ...l, obj };
      });
    }
    backdropSets[R.id].forEach((b) => { scene.add(b.obj); backdrops.push(b); });
  }

  function createDecos() {
    // Filas repetidas: una InstancedMesh por pieza. `lights` = solo en zonas con alumbrado.
    // `left` = a esa distancia del borde izquierdo de la calzada (depende del perfil de la ruta).
    [
      { type: 'post', x: 5.6, gap: 25, n: 13 },
      { type: 'post', left: -0.4, gap: 25, n: 13 },
      { type: 'lightPole', x: 7.0, gap: 50, n: 8, lights: true },
      { type: 'utePole', x: 10.2, gap: 45, n: 9 },
      { type: 'fence', x: 11.5, gap: 10, n: 33 },
      { type: 'fence', left: -2.8, gap: 10, n: 33 }
    ].forEach((r) => {
      r.meshes = World3D.rowParts(r.type).map((p) => {
        const im = new THREE.InstancedMesh(p.geo, p.mat, r.n * p.offs.length);
        im.castShadow = true;
        im.frustumCulled = false;
        scene.add(im);
        return { im, offs: p.offs };
      });
      rows.push(r);
    });
    // Interbalnearia: pocos autos de adorno por los dos carriles que vienen (al otro lado de la
    // doble amarilla). En Ruta 9 los de frente vienen por el carril izquierdo y se pueden chocar
    // (los genera spawnOncoming), así que estos se esconden.
    const ibLanes = World3D.ROAD_PROFILES.ib.ONCOMING_LANES;
    for (let i = 0; i < 4; i++) {
      const car = noCull(World3D.makeCar(pick(World3D.CAR_COLORS)));
      car.rotation.y = Math.PI;
      car.userData.pos = rand(60, 600);
      car.position.x = ibLanes[i % 2];
      scene.add(car);
      oncoming.push(car);
    }
  }

  function resetDecos() {
    decos.forEach((d) => placeDeco(d, S.dist + rand(-25, 300)));
  }

  // Cambia el tramo: perfil de la ruta, paisaje, cerros y ranking.
  function setRoute(id) {
    R = ROUTES3D.find((r) => r.id === id) || ROUTES3D[0];
    mPerKm = TRIP_M / (R.to - R.from);
    World3D.setProfile(R.profile);
    road.setProfile(R.profile);
    // El ranking es por tramo (el de la Interbalnearia conserva la clave de antes).
    Ranking.KEY = 'cot-ruta-3d-ranking' + (R.id === 'ib' ? '' : '-' + R.id);
    buildDecos();
    buildBackdrops();
    buildProfile();
    oncoming.forEach((c) => { c.visible = !twoWay(); });
    try { localStorage.setItem(TRAMO_KEY, R.id); } catch (e) { /* no se recuerda el tramo */ }
  }

  // ---------- Curvas y lomas del tramo ----------
  // Salen del trazado real (data/ruta-mvd-chuy.js) como referencia: el pedazo R.real se comprime a
  // TRIP_M metros, así que los giros y las subidas se atenúan y se suavizan para que se puedan
  // manejar (radio mínimo y pendiente máxima). Sin datos, se usan curvas y lomas suaves inventadas.
  const PROF_STEP = 10;                 // una muestra cada 10 m de juego
  const PROF_PRE = 300, PROF_POST = 1200;
  const CURVE_GAIN = 0.55;              // qué parte del giro real se conserva
  const MIN_RADIUS = 350;               // m: la curva más cerrada del juego
  const HILL_GAIN = 0.9;                // qué parte del desnivel real se conserva
  const MAX_GRADE = 0.06;               // pendiente máxima: 6 %
  let profTh = null, profH = null;

  function smooth(arr, win) {
    const out = new Float32Array(arr.length), r = win >> 1;
    for (let i = 0; i < arr.length; i++) {
      let sum = 0, n = 0;
      for (let k = Math.max(0, i - r); k <= Math.min(arr.length - 1, i + r); k++) { sum += arr[k]; n++; }
      out[i] = sum / n;
    }
    return out;
  }

  function buildProfile() {
    const n = Math.ceil((PROF_PRE + TRIP_M + PROF_POST) / PROF_STEP) + 1;
    let turn = new Float32Array(n), rise = new Float32Array(n);
    const maxTurn = PROF_STEP / MIN_RADIUS, maxRise = PROF_STEP * MAX_GRADE;
    const real = typeof RutaReal !== 'undefined' && RutaReal && R.real;
    if (real) {
      const a = R.real[0] * 1000, b = R.real[1] * 1000, ratio = (b - a) / TRIP_M;
      const sAt = (i) => Math.min(RutaReal.largo, Math.max(0, a + (i * PROF_STEP - PROF_PRE) * ratio));
      const v = new THREE.Vector3();
      // Rumbo real promediado sobre el pedazo de ruta que representa cada muestra.
      const span = Math.max(30, ratio * PROF_STEP);
      const headingAt = (s) => { RutaReal.direccionEn(s, v, span); return Math.atan2(v.x, -v.z); };
      const heightAt = (s) => RutaReal.posicionEn(s, v).y;
      let prevH = headingAt(sAt(0)), prevY = heightAt(sAt(0));
      for (let i = 1; i < n; i++) {
        const s = sAt(i), hd = headingAt(s), y = heightAt(s);
        let dh = hd - prevH;
        dh -= Math.round(dh / (2 * Math.PI)) * 2 * Math.PI;
        turn[i] = Math.max(-maxTurn, Math.min(maxTurn, dh * CURVE_GAIN));
        rise[i] = Math.max(-maxRise, Math.min(maxRise, (y - prevY) * HILL_GAIN));
        prevH = hd;
        prevY = y;
      }
    }
    if (!real || !RutaReal.conAltura) {
      // Lomas suaves inventadas (si todavía no se cargó la altura real).
      for (let i = 1; i < n; i++) rise[i] = maxRise * 0.5 * Math.sin(i / 37) * Math.sin(i / 11.3 + 1);
    }
    if (!real) for (let i = 1; i < n; i++) turn[i] = maxTurn * 0.6 * Math.sin(i / 53) * Math.sin(i / 23 + 2);
    // Suavizado: los giros y las subidas entran y salen de a poco (sin quiebres).
    turn = smooth(smooth(turn, 9), 9);
    rise = smooth(smooth(rise, 7), 7);
    profTh = new Float32Array(n);
    profH = new Float32Array(n);
    for (let i = 1; i < n; i++) {
      profTh[i] = profTh[i - 1] + turn[i];
      profH[i] = profH[i - 1] + rise[i];
    }
  }

  // Rumbo (rad) y altura (m) de la ruta en la posición p del juego.
  function profAt(arr, p) {
    const f = Math.max(0, Math.min(arr.length - 1.001, (p + PROF_PRE) / PROF_STEP));
    const i = Math.floor(f);
    return arr[i] + (arr[i + 1] - arr[i]) * (f - i);
  }
  const headingAt = (p) => profAt(profTh, p);
  const heightAt = (p) => profAt(profH, p);
  // Pendiente (m/m, + = subida) en la posición p.
  const slopeAt = (p) => (heightAt(p + 10) - heightAt(p - 10)) / 20;

  // Las filas no guardan estado: cada copia va a un múltiplo fijo de `gap` metros.
  const _m = new THREE.Matrix4(), _p = new THREE.Vector3(), _q = new THREE.Quaternion(), _s = new THREE.Vector3();
  function updateRows() {
    for (const r of rows) {
      const base = Math.ceil((S.dist - 30) / r.gap) * r.gap;
      for (const { im, offs } of r.meshes) {
        let k = 0;
        const x = r.left !== undefined ? World3D.P.ROAD.l + r.left : r.x;
        for (let i = 0; i < r.n; i++) {
          const pos = base + i * r.gap;
          const z = -(pos - S.dist);
          // Fuera de la zona con alumbrado, la columna se achica a cero (no se dibuja).
          const on = !r.lights || biomeAt(kmAt(pos)).lights;
          for (const o of offs) {
            _p.set(x + o[0], o[1], z + o[2]);
            if (on) _s.set(o[3], o[4], o[5]); else _s.set(0, 0, 0);
            im.setMatrixAt(k++, _m.compose(_p, _q, _s));
          }
        }
        im.instanceMatrix.needsUpdate = true;
      }
    }
  }

  function updateBackdrops() {
    const km = kmAt(S.dist);
    for (const b of backdrops) {
      const t = (km - b.from) / (b.to - b.from);
      b.obj.visible = !S.attract && t >= 0 && t <= 1;
      if (!b.obj.visible) continue;
      // Lejos al costado: entra por el horizonte y termina atrás, como si lo pasáramos.
      b.obj.position.set(b.side * (b.model === 'sierra' ? 600 : 560), 0, -1100 + t * 1400);
    }
  }

  function updateDecos(dt) {
    updateBackdrops();
    updateRows();
    for (const d of decos) {
      if (d.userData.pos < S.dist - 30) placeDeco(d, S.dist + rand(240, 300));
      d.position.z = -(d.userData.pos - S.dist);
    }
    for (const c of oncoming) {
      c.userData.pos -= 30 * dt;
      if (c.userData.pos < S.dist - 30) c.userData.pos = S.dist + rand(300, 600);
      c.position.z = -(c.userData.pos - S.dist);
    }
  }

  // ---------- Spawns ----------
  // Ruta 9: en nuestro carril solo van vehículos lentos (camiones, autos tranquilos, motos).
  function spawnSlowCar() {
    const p = S.dist / TRIP_M;
    const busy = S.cars.some((c) => c.userData.lane === RIGHT && c.position.z < -(SPAWN_AHEAD - 60));
    if (!busy && !S.attract) {
      const r = Math.random();
      const kind = r < 0.45 ? 'truck' : r < 0.6 ? 'moto' : 'car';
      const car = kind === 'truck' ? World3D.makeTruck() : kind === 'moto' ? World3D.makeMoto() : World3D.makeCar(pick(World3D.CAR_COLORS));
      car.position.x = LANE_X[RIGHT];
      addWorld(car, S.dist + SPAWN_AHEAD, { lane: RIGHT, speed: R9_SPEED[kind] * rand(0.9, 1.1) });
      S.cars.push(car);
    }
    S.nextCarAt = S.dist + (150 + 90 * (1 - p)) * rand(0.75, 1.3);
  }

  // Ruta 9: los que vienen de frente, por el carril izquierdo. A veces en fila, a veces con un hueco
  // largo para pasar tranquilo.
  function spawnOncoming() {
    const p = S.dist / TRIP_M;
    const car = Math.random() < 0.25 ? World3D.makeTruck() : World3D.makeCar(pick(World3D.CAR_COLORS));
    car.rotation.y = Math.PI;
    car.position.x = LANE_X[0];
    addWorld(car, S.dist + ONCOMING_AHEAD, { lane: 0, speed: -rand(19, 24), oncoming: true });
    S.cars.push(car);
    const gap = Math.random() < 0.3 ? rand(300, 450) : rand(80, 200);
    S.nextOncomingAt = S.dist + gap * (1 - 0.25 * p);
  }

  function spawnCars() {
    if (twoWay()) { spawnSlowCar(); return; }
    const p = S.dist / TRIP_M;
    // Con 2 carriles, dos autos a la vez cierran la ruta: pasa poco y obliga a frenar.
    const count = Math.random() < 0.03 + 0.07 * p ? 2 : 1;
    const free = LANES.filter((l) => !S.cars.some((c) => c.userData.lane === l && c.position.z < -(SPAWN_AHEAD - 40)));
    free.sort(() => Math.random() - 0.5);
    for (let i = 0; i < Math.min(count, free.length); i++) {
      const lane = free[i];
      const r = Math.random();
      let car;
      if (r < 0.2 && lane === RIGHT) car = World3D.makeTruck();
      else if (r < 0.3) car = World3D.makeMoto();
      else car = World3D.makeCar(pick(World3D.CAR_COLORS));
      car.position.x = LANE_X[lane];
      addWorld(car, S.dist + SPAWN_AHEAD, { lane, speed: LANE_SPEED[lane] });
      S.cars.push(car);
    }
    // Huecos más largos que antes: el ómnibus cambia de carril despacio.
    S.nextCarAt = S.dist + (75 + 55 * (1 - p)) * rand(0.75, 1.25) + (S.attract ? 25 : 0);
  }

  function spawnPickup() {
    const free = LANES.filter((l) => !S.cars.some((c) => c.userData.lane === l && c.position.z < -(SPAWN_AHEAD - 50)));
    if (free.length) {
      const lane = pick(free);
      const kind = S.confort < 85 && Math.random() < 0.55 ? 'mate' : 'box';
      const it = kind === 'mate' ? World3D.makeMate() : World3D.makeParcel();
      it.position.set(LANE_X[lane], 1.2, 0);
      addWorld(it, S.dist + SPAWN_AHEAD - 10, { kind, spin: true });
      S.pickups.push(it);
    }
    S.nextPickupAt = S.dist + M_PER_KM * rand(2.2, 3.8);
  }

  // Lugares del tramo (route3d.js) para un viaje nuevo, más un cartel amarillo 1 km antes de cada peaje.
  function routeMarks() {
    const marks = [];
    R.landmarks.forEach((l) => {
      if (l.type === 'backdrop' || l.type === 'water') return;
      marks.push({ ...l, pos: posAt(l.km), spawned: false });
      if (l.type === 'peaje') marks.push({ type: 'warning', km: l.km - 1, pos: posAt(l.km - 1), l1: 'PEAJE', l2: 'A 1 km' });
    });
    return marks;
  }

  function spawnMark(m) {
    m.spawned = true;
    let obj;
    if (m.type === 'locality') { obj = World3D.makeLocalitySign(m.text, m.icon); obj.position.x = 7.9; }
    else if (m.type === 'arroyo') { obj = World3D.makeArroyoSign(m.name, m.km, R.shield); obj.position.x = 7.6; }
    else if (m.type === 'warning') { obj = World3D.makeWarningSign(m.l1, m.l2); obj.position.x = 7.4; }
    else if (m.type === 'peaje') { obj = World3D.makePeaje(m.name); }
    else if (m.type === 'fortaleza') { obj = World3D.makeFortaleza(); obj.position.x = 75; obj.rotation.y = 0.3; }
    if (obj) m.obj = addWorld(obj, m.pos);
  }

  function spawnStop(stop) {
    stop.spawned = true;
    stop.waiting = 2 + Math.floor(Math.random() * 4);
    stop.zone = addWorld(World3D.makeStopZone(), stop.pos);
    const shelter = World3D.makeShelter(stop.name.replace('Parada ', ''));
    shelter.position.x = 8.3;
    addWorld(shelter, stop.pos);
    stop.people = [];
    for (let i = 0; i < stop.waiting; i++) {
      const person = World3D.makePerson();
      person.position.x = 7.4 + (i % 2) * 0.7;
      person.rotation.y = -Math.PI / 2;
      addWorld(person, stop.pos + 2.4 - i * 1.2);
      stop.people.push(person);
    }
  }

  function spawnStuff() {
    const ahead = S.dist + SPAWN_AHEAD;
    if (!S.attract) {
      if (S.nextKmSign < R.to && posAt(S.nextKmSign) < ahead) {
        const sign = World3D.makeKmSign(S.nextKmSign, R.shield);
        sign.position.x = 7.2;
        addWorld(sign, posAt(S.nextKmSign));
        S.nextKmSign += 10;
      }
      S.stops.forEach((s) => { if (!s.spawned && s.pos < ahead) spawnStop(s); });
      if (!S.terminal && TRIP_M < ahead) {
        S.terminal = true;
        addWorld(World3D.makeTerminal(R.terminal), TRIP_M);
      }
      // Mar o laguna: una sola pieza larga desde donde empieza hasta donde termina (o hasta el final).
      S.waters.forEach((w) => {
        const start = posAt(w.from);
        if (w.spawned || start >= ahead) return;
        w.spawned = true;
        const end = Math.min(posAt(w.to), TRIP_M + 400);
        const len = end - start;
        addWorld(World3D.createWater(len, w.side, w.beach), start + len / 2, { half: len / 2 });
      });
      S.marks.forEach((m) => { if (!m.spawned && m.pos < ahead) spawnMark(m); });
    }
    const nearEnd = S.dist > TRIP_M - 2 * M_PER_KM;
    if (mode !== 'ending' && !nearEnd) {
      if (S.dist >= S.nextCarAt) spawnCars();
      if (twoWay() && S.dist >= S.nextOncomingAt) spawnOncoming();
      if (!S.attract && S.dist >= S.nextPickupAt) spawnPickup();
    }
  }

  // ---------- Animaciones simples ----------
  const anims = [];
  function animate(obj, to, dur, onDone) {
    anims.push({ obj, from: obj.position.clone(), to, scale0: obj.scale.x, t: 0, dur, onDone });
  }
  function updateAnims(dt) {
    for (let i = anims.length - 1; i >= 0; i--) {
      const a = anims[i];
      a.t += dt;
      const k = Math.min(1, a.t / a.dur);
      a.obj.position.lerpVectors(a.from, a.to, k);
      a.obj.scale.setScalar(a.scale0 * (1 - 0.7 * k));
      if (k >= 1) { anims.splice(i, 1); if (a.onDone) a.onDone(); }
    }
  }

  // ---------- Bucle ----------
  const keys = new Set();
  let touchBrake = false;
  let last = performance.now();

  function update(dt) {
    if (!S || !bus) return;
    const playing = mode === 'play';

    if (playing) {
      S.elapsed += dt;
      updateSteer(dt);
      if (control === 'tilt') updateTilt(dt);
      const braking = keys.has('ArrowDown') || keys.has('KeyS') || keys.has('Space') || touchBrake;
      if (S.stunned > 0) {
        S.stunned -= dt;
        S.speed = Math.max(0, S.speed - 60 * dt);
      } else if (braking) {
        S.speed = Math.max(0, S.speed - BRAKE * dt);
      } else {
        // La aceleración cae a medida que sube la velocidad, como un motor cargado.
        S.speed = Math.min(MAX_SPEED, S.speed + ACCEL * (1 - 0.55 * S.speed / MAX_SPEED) * dt);
      }
      bus.userData.setBrake(braking || S.stunned > 0);
      // En las subidas el ómnibus pierde velocidad y en las bajadas gana (sin pasar la máxima).
      S.speed = Math.max(0, Math.min(MAX_SPEED, S.speed - 9.8 * slopeAt(S.dist) * 0.45 * dt));
    } else if (mode === 'ending') {
      S.speed = Math.max(0, S.speed - 12 * dt);
      bus.userData.setBrake(S.speed > 0);
    } else if (S.attract && mode === 'title' && !twoWay()) {
      // Piloto automático para la pantalla de título (en Ruta 9 se queda en su carril).
      S.autoTimer -= dt;
      const danger = S.cars.some((c) => c.userData.lane === S.lane && c.position.z < 0 && c.position.z > -40);
      if (danger || S.autoTimer < 0) {
        const opts = [S.lane - 1, S.lane + 1].filter((l) => l >= 0 && l <= RIGHT &&
          !S.cars.some((c) => c.userData.lane === l && Math.abs(c.position.z) < 25));
        if (opts.length) { S.lane = pick(opts); S.targetX = LANE_X[S.lane]; }
        S.autoTimer = rand(2, 4);
      }
    }

    S.dist += S.speed * dt;
    road.scroll(S.dist);
    // Curvas y lomas (bend3d.js).
    Bend.update(S.dist, headingAt, heightAt);
    const slope = slopeAt(S.dist);
    const curve = (headingAt(S.dist + 10) - headingAt(S.dist - 10)) / 20;

    // Dirección con inercia: la velocidad lateral sigue al carril elegido de a poco, sin pasarse.
    // Parado casi no se puede mover de costado (un ómnibus no hace "strafe").
    const err = S.targetX - S.busX;
    const steer = Math.min(1, 0.2 + S.speed / 14);
    const want = Math.max(-LAT_MAX, Math.min(LAT_MAX, err * 1.6)) * steer;
    const prevLat = S.latV;
    S.latV += Math.max(-LAT_ACC * dt, Math.min(LAT_ACC * dt, want - S.latV));
    S.busX += S.latV * dt;
    bus.position.x = S.busX;
    const latAcc = (S.latV - prevLat) / Math.max(dt, 0.001);
    const longAcc = (S.speed - S.prevSpeed) / Math.max(dt, 0.001);
    S.prevSpeed = S.speed;
    // Rumbo según la velocidad lateral; balanceo y cabeceo con resorte (la carrocería se inclina y vuelve).
    bus.rotation.y = -Math.atan2(S.latV, Math.max(S.speed, 6));
    const rollTarget = Math.max(-0.05, Math.min(0.05, S.latV * 0.009 + latAcc * 0.006 + curve * S.speed * S.speed * 0.006));
    const pitchTarget = Math.max(-0.025, Math.min(0.025, longAcc * 0.0012));
    S.roll += (rollTarget - S.roll) * Math.min(1, dt * 2.5);
    S.pitch += (pitchTarget - S.pitch) * Math.min(1, dt * 3);
    bus.rotation.z = S.roll;
    bus.rotation.x = S.pitch + Math.atan(slope);
    bus.position.y = S.speed > 1 ? Math.sin(S.dist * 0.7) * 0.012 : 0;

    if (S.invuln > 0) {
      S.invuln -= dt;
      bus.visible = Math.floor(S.invuln * 11) % 2 === 0;
    } else {
      bus.visible = true;
    }

    spawnStuff();

    for (let i = world.length - 1; i >= 0; i--) {
      const o = world[i];
      const u = o.userData;
      if (u.speed) u.pos += u.speed * dt;
      o.position.z = -(u.pos - S.dist);
      if (u.spin) { o.rotation.y += dt * 2; o.position.y = 1.2 + Math.sin(S.elapsed * 4 + u.pos) * 0.2; }
      const behind = u.half ? o.position.z - u.half > 30 : o.position.z > 30;
      if (behind || (u.speed && o.position.z < -(SPAWN_AHEAD + 80))) {
        disposeTextures(o);
        removeWorld(o);
      }
    }
    S.cars = S.cars.filter((c) => !c.userData.dead);
    S.pickups = S.pickups.filter((c) => !c.userData.dead);
    updateDecos(dt);
    updateAnims(dt);

    if (playing) {
      checkCars();
      checkPickups();
      checkStops();
      checkPeajes();
      if (S.dist >= TRIP_M) finish(true);
    }

    // La sombra del sol sigue al ómnibus (cubre solo la zona cercana para que sea nítida).
    // El cielo y el sol giran con el rumbo de la ruta: en una curva el sol cambia de lado de a poco.
    const heading = headingAt(S.dist);
    scene.backgroundRotation.y = scene.environmentRotation.y = heading;
    _sunDir.copy(SUN_DIR).applyAxisAngle(_up, heading);
    sun.target.position.set(S.busX, 0, -14);
    sun.position.copy(sun.target.position).addScaledVector(_sunDir, 90);

    // Cámara detrás del ómnibus.
    S.shake = Math.max(0, S.shake - dt * 2.5);
    const sh = S.shake * S.shake;
    S.camX += (S.busX * 0.75 - S.camX) * Math.min(1, dt * 2.2);
    // La cámara va sobre la ruta deformada: sigue las curvas y las lomas.
    if (portrait) Bend.at(-20, S.camX + rand(-sh, sh), 10.5 + rand(-sh, sh), camera.position);
    else Bend.at(-18, S.camX + rand(-sh, sh), 8.6 + rand(-sh, sh), camera.position);
    camera.lookAt(Bend.at(portrait ? 18 : 24, S.camX * 1.1, portrait ? -2 : 1, _look));

    if (mode === 'play' || mode === 'ending') updateHud();
  }

  function busHits(o, hw, hl) {
    return Math.abs(o.position.x - S.busX) < hw + bus.userData.halfW - 0.1 &&
      Math.abs(o.position.z) < hl + bus.userData.len / 2 - 0.3;
  }

  function checkCars() {
    for (const car of S.cars) {
      const u = car.userData;
      if (car.position.z > 10 && !u.passed) {
        u.passed = true;
        // Ruta 9: pasar a uno lento sin chocarlo suma puntos.
        if (twoWay() && !u.oncoming && !u.hit) {
          S.score += 20;
          popup('Sobrepaso +20', '#9be37a');
        }
      }
      if (u.passed || u.hit || S.invuln > 0) continue;
      if (busHits(car, u.hw, u.hl)) crash(car);
    }
  }

  function crash(car) {
    if (car) {
      car.userData.hit = true;
      car.userData.speed += Math.sign(car.userData.speed) * 6;   // el auto chocado sigue de largo
    }
    S.crashes++;
    S.confort = Math.max(0, S.confort - 30);
    S.speed *= 0.2;
    S.stunned = 0.5;
    S.invuln = 1.8;
    S.shake = 1;
    Sfx.crash();
    flash();
    popup('¡CHOQUE!  -30% confort', '#ff6b5e');
    if (S.confort <= 0) finish(false);
  }

  function checkPickups() {
    for (const it of S.pickups) {
      if (it.userData.dead || !busHits(it, 0.5, 0.5)) continue;
      removeWorld(it);
      Sfx.pickup();
      if (it.userData.kind === 'mate') {
        S.confort = Math.min(100, S.confort + 15);
        popup('¡Mate! +15% confort', '#9be37a');
      } else {
        S.boxes++;
        S.score += 50;
        popup('Encomienda +50', '#ffd36b');
      }
    }
  }

  function checkStops() {
    for (const s of S.stops) {
      if (!s.spawned || s.done || s.missed) continue;
      const dz = s.zone.position.z;
      const inLane = Math.abs(S.busX - LANE_X[RIGHT]) < 0.5;
      if (Math.abs(dz) < 10 && inLane && S.speed <= STOP_SPEED) {
        board(s);
      } else if (dz > 9) {
        s.missed = true;
        S.confort = Math.max(0, S.confort - 10);
        Sfx.miss();
        popup('¡Se te pasó la parada!', '#ff6b5e');
        drawProgress();
        if (S.confort <= 0) finish(false);
      }
    }
  }

  // Peaje: la isleta del medio se choca si pasás entre carriles, y hay que cruzar a 40 km/h o menos.
  function checkPeajes() {
    for (const m of S.marks) {
      if (m.type !== 'peaje' || !m.obj || m.done) continue;
      const u = m.obj.userData;
      const dz = m.obj.position.z;
      const reach = u.halfLen + bus.userData.len / 2;
      if (!m.hit && S.invuln <= 0 && Math.abs(dz) < reach &&
        u.islands.some((ix) => Math.abs(S.busX - ix) < u.islandHalf + bus.userData.halfW - 0.05)) {
        m.hit = true;
        crash(null);
      }
      if (!m.checked && dz > -1) {          // el ómnibus está pasando por las cabinas
        m.checked = true;
        const kmh = Math.round(S.speed * KMH);
        if (kmh > ROUTE3D_COMMON.peajeMaxKmh + 2) {
          S.confort = Math.max(0, S.confort - 10);
          Sfx.miss();
          popup(`¡Muy rápido en el peaje! (${kmh} km/h)  -10% confort`, '#ff6b5e');
          if (S.confort <= 0) finish(false);
        } else if (!m.hit) {
          S.score += 50;
          Sfx.pickup();
          popup(`Peaje ${m.name} bien pasado  +50`, '#9be37a');
        }
      }
      if (dz > reach + 5) m.done = true;
    }
  }

  function board(s) {
    s.done = true;
    S.passengers += s.waiting;
    S.score += s.waiting * 100;
    Sfx.board();
    s.people.forEach((p, i) => {
      const i0 = world.indexOf(p);
      if (i0 >= 0) world.splice(i0, 1);
      setTimeout(() => {
        animate(p, new THREE.Vector3(S.busX + 1.4, 0.3, -4.5), 0.45, () => scene.remove(p));
      }, i * 110);
    });
    popup(`+${s.waiting} pasajeros  (+${s.waiting * 100})`, '#9be37a');
    drawProgress();
  }

  function finish(arrived) {
    mode = 'ending';
    touchBrake = false;
    $('banner').classList.add('hidden');
    if (arrived) {
      Sfx.arrive();
      toast(`¡LLEGASTE A ${R.dest.toUpperCase()}!`, '#f2b705');
    } else {
      Sfx.fail();
      toast('Los pasajeros se quejaron...<br>Viaje terminado', '#ff6b5e');
    }
    setTimeout(() => showResult(arrived), 2300);
  }

  function frame(now) {
    const realDt = (now - last) / 1000;
    const dt = Math.min(0.05, realDt);
    last = now;
    if (!paused) update(dt);
    renderer.render(scene, camera);
    adaptGfx(realDt);
  }

  // Mide con el tiempo real entre cuadros. Después de cada cambio espera un momento (para que
  // se acomode) y recién ahí mide; si sigue por debajo del objetivo, aplica el siguiente paso.
  const fpsBox = /[?&]fps\b/.test(location.search) ? $('fps') : null;
  if (fpsBox) fpsBox.classList.remove('hidden');
  const meter = { frames: 0, time: 0, settle: 1, shown: 0, showFrames: 0 };
  function adaptGfx(realDt) {
    if (realDt <= 0 || realDt > 0.5) return;            // pestaña oculta o pausa del navegador
    if (fpsBox) {
      meter.shown += realDt;
      meter.showFrames++;
      if (meter.shown >= 0.5) {
        fpsBox.textContent = `${Math.round(meter.showFrames / meter.shown)} fps · paso ${gfx.level}: ${GFX_LEVELS[gfx.level].name}`;
        meter.shown = 0;
        meter.showFrames = 0;
      }
    }
    if (!gfx.auto || mode !== 'play' || paused) return;
    if (meter.settle > 0) { meter.settle -= realDt; return; }
    meter.frames++;
    meter.time += realDt;
    if (meter.time < 2.5) return;
    const fps = meter.frames / meter.time;
    meter.frames = 0;
    meter.time = 0;
    // Si anda sobrado 30 s seguidos, prueba un paso mejor (sirve si un tirón suelto lo dejó bajo).
    // Nunca sube a un nivel del que ya bajó en esta sesión, para no oscilar.
    meter.good = fps >= 58 ? (meter.good || 0) + 2.5 : 0;
    if (meter.good >= 30 && gfx.level > gfx.lock) {
      applyGfx(gfx.level - 1);
      saveGfx();
      meter.good = 0;
      meter.settle = 1;
      console.info(`[gráficos] ${fps.toFixed(0)} fps de sobra → paso ${gfx.level}: ${GFX_LEVELS[gfx.level].name}`);
      return;
    }
    if (fps >= GFX_TARGET || gfx.level >= GFX_LEVELS.length - 1) return;
    applyGfx(gfx.level + 1);
    gfx.lock = gfx.level;
    saveGfx();
    meter.settle = 1;
    console.info(`[gráficos] ${fps.toFixed(0)} fps < ${GFX_TARGET} → paso ${gfx.level}: ${GFX_LEVELS[gfx.level].name}`);
  }

  // Compila de antemano los shaders de todo lo que puede aparecer (idea de halloween.dev):
  // sin esto, la primera parada o el primer camión producen un tirón mientras se compilan.
  function prewarm() {
    const warm = new THREE.Group();
    const items = [
      World3D.makeCar(0xb3121b, 'sedan'), World3D.makeCar(0x1e5aa8, 'hatch'), World3D.makeCar(0xf2f2f2, 'suv'),
      World3D.makeTruck(), World3D.makeMoto(), World3D.makeStopZone(), World3D.makeShelter('km 0'),
      World3D.makePerson(), World3D.makeMate(), World3D.makeParcel(), World3D.makeKmSign(0),
      World3D.makeTerminal('X'), World3D.createWater(40), World3D.createWater(40, -1, false), World3D.makeArroyoSign("Aº", 1),
      World3D.makeLocalitySign("A"), World3D.makeWarningSign("A", "B"), World3D.makePeaje("x"), World3D.makeMountain("sierra"),
      World3D.makeMountain("panDeAzucar"), World3D.makeFortaleza(), World3D.makeDeco('pond')
    ];
    items.forEach((o, i) => { o.position.set(((i % 5) - 2) * 7, 0, -35 - Math.floor(i / 5) * 18); warm.add(o); });
    syncBlobs(warm);
    scene.add(warm);
    camera.position.set(0, 8, 18);
    camera.lookAt(0, 0, -40);
    const finishWarm = () => {
      renderer.render(scene, camera);      // un cuadro real: también compila las sombras
      scene.remove(warm);
      disposeTextures(warm);
    };
    const compile = renderer.compileAsync ? renderer.compileAsync(scene, camera) : Promise.resolve();
    return compile.then(finishWarm, finishWarm);
  }

  // ---------- HUD y mensajes ----------
  const hudCache = {};
  function setText(id, text) {
    if (hudCache[id] !== text) { hudCache[id] = text; $(id).textContent = text; }
  }

  function drawProgress() {
    const bar = $('progress');
    bar.querySelectorAll('.dot').forEach((d) => d.remove());
    S.stops.forEach((s) => {
      const d = document.createElement('div');
      d.className = 'dot' + (s.done ? ' done' : s.missed ? ' missed' : '');
      d.style.left = (s.pos / TRIP_M) * 100 + '%';
      bar.appendChild(d);
    });
  }

  function updateHud() {
    const km = Math.min(R.to, kmAt(S.dist));
    setText('hKm', `km ${km.toFixed(1)}`);
    const secs = Math.floor(S.elapsed);
    setText('hTime', `${Math.floor(secs / 60)}:${String(secs % 60).padStart(2, '0')}`);
    setText('hSpeed', `${Math.round(S.speed * KMH)} km/h`);
    setText('hPax', `PASAJ. ${S.passengers}`);
    setText('hScore', `${S.score} pts`);
    $('hBus').style.left = Math.min(1, S.dist / TRIP_M) * 100 + '%';
    const c = Math.round(S.confort);
    if (hudCache.confort !== c) {
      hudCache.confort = c;
      const fill = $('hConfort');
      fill.style.width = c + '%';
      fill.style.background = c > 60 ? '#3fbf5f' : c > 30 ? '#f2b705' : '#e0453a';
    }

    let msg = '';
    const next = S.stops.find((s) => !s.done && !s.missed);
    const peaje = S.marks.find((m) => m.type === 'peaje' && !m.checked);
    const peajeFirst = peaje && (!next || peaje.pos < next.pos);
    // Metros reales hasta un lugar, redondeados a 10 m (los km del tramo están estirados a TRIP_M).
    const realM = (d) => Math.max(0, Math.round((d / mPerKm) * 100) * 10);
    // Ruta 9: si estás en el carril de enfrente y se acerca alguien, es lo primero que se avisa.
    const headOn = twoWay() && S.busX < 0.6 &&
      S.cars.some((c) => c.userData.oncoming && !c.userData.hit && c.position.z < 0 && c.position.z > -200);
    if (headOn && mode === 'play') {
      msg = '¡VIENE UNO DE FRENTE!  Volvé a tu carril ▶';
    } else if (peajeFirst && mode === 'play') {
      const d = peaje.pos - S.dist;
      const max = ROUTE3D_COMMON.peajeMaxKmh;
      const islands = peaje.obj ? peaje.obj.userData.islands : [];
      if (d < M_PER_KM * 4) {
        if (d < M_PER_KM * 1.5 && islands.some((ix) => Math.abs(S.busX - ix) < 1.3)) msg = '¡Elegí un carril! Hay una isleta en el medio';
        else if (d < M_PER_KM * 1.5 && S.speed * KMH > max) msg = `¡FRENÁ!  Peaje a ${max} km/h`;
        else msg = `Peaje ${peaje.name} en ${realM(d)} m · máx. ${max} km/h`;
      }
    } else if (next && mode === 'play') {
      const d = next.pos - S.dist;
      if (d < M_PER_KM * 4) {   // aviso con tiempo: frenar un ómnibus lleva ~40 m
        const inZone = next.zone && Math.abs(next.zone.position.z) < 14;
        if (inZone && Math.abs(S.busX - LANE_X[RIGHT]) >= 0.5) msg = '¡CARRIL DERECHO! ▶';
        else if (inZone && S.speed > STOP_SPEED) msg = '¡FRENÁ!  (20 km/h o menos)';
        else msg = `${next.name} en ${realM(d)} m`;
      }
    }
    if (hudCache.banner !== msg) {
      hudCache.banner = msg;
      $('banner').textContent = msg;
      $('banner').classList.toggle('hidden', !msg);
    }
  }

  function popup(text, color) {
    const el = document.createElement('div');
    el.className = 'popup';
    el.textContent = text;
    el.style.color = color;
    document.body.appendChild(el);
    setTimeout(() => el.remove(), 1300);
  }

  let toastTimer = 0;
  function toast(html, color) {
    const el = $('toast');
    el.innerHTML = html;
    el.style.color = color;
    el.style.opacity = 1;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { el.style.transition = 'opacity 0.4s'; el.style.opacity = 0; }, 2000);
    el.style.transition = 'none';
  }

  function flash() {
    const el = document.createElement('div');
    el.style.cssText = 'position:fixed;inset:0;background:rgba(255,80,60,0.45);pointer-events:none;transition:opacity 0.25s';
    document.body.appendChild(el);
    requestAnimationFrame(() => { el.style.opacity = 0; });
    setTimeout(() => el.remove(), 300);
  }

  // ---------- Pantallas ----------
  function show(id, on) { $(id).classList.toggle('hidden', !on); }

  function rankTable(el, highlight, max) {
    const list = Ranking.load().slice(0, max);
    el.innerHTML = '';
    if (!list.length) return;
    const cap = el.createCaption();
    cap.textContent = `${max <= 5 ? 'MEJORES VIAJES' : 'RANKING'} · ${R.origin} → ${R.dest}`;
    list.forEach((r, i) => {
      const tr = el.insertRow();
      if (i === highlight) tr.className = 'me';
      const c1 = tr.insertCell();
      c1.textContent = `${i + 1}. ${r.name} `;
      const co = COMPANIES.find((c) => c.id === r.company);
      if (co) { const sp = document.createElement('span'); sp.className = 'co'; sp.textContent = co.name; c1.appendChild(sp); }
      tr.insertCell().textContent = r.score;
    });
  }

  function goTitle() {
    mode = 'title';
    paused = false;
    clearWorld();
    S = newRun(true);
    resetDecos();
    show('hud', false); show('touch', false); show('banner', false); show('resultScreen', false); show('pauseScreen', false);
    show('bPause', false);
    renderTitle();
    show('titleScreen', true);
    $('toast').style.opacity = 0;
  }

  // Selector de tramo en el título: un botón por tramo de route3d.js.
  const TIPS = {
    ib: 'Pasá los peajes a 40 km/h o menos, por tu carril.',
    r9: 'Ruta 9 tiene un carril por mano: para pasar a un camión salí al carril de enfrente cuando no venga nadie.'
  };
  function renderTitle() {
    $('titleTip').textContent = TIPS[R.profile] || '';
    // Textos según cómo se juega: teclado, botones en pantalla o celular como volante.
    $('titleHelp').innerHTML = !touchUI ? '← → tocá para cambiar de carril, mantené para moverte de a poco<br>↓ / ESPACIO frenar'
      : control === 'tilt' ? 'Incliná el celular como un volante para cambiar de carril<br>FRENO para frenar'
      : '◀ ▶ tocá para cambiar de carril, mantené para moverte de a poco<br>FRENO para frenar';
    $('titlePrompt').textContent = touchUI ? 'Tocá un tramo para salir' : 'Tocá un tramo, o elegilo con ← → y apretá ESPACIO';
    $('titleControl').textContent = `CONTROLES: ${control === 'tilt' ? 'INCLINACIÓN' : 'BOTONES'}`;
    $('titleSkin').textContent = skinButtonText();
    show('titleSkin', company().skins.length > 1);
    $('titlePlayer').textContent = player.chosen ? `${player.name} · ${company().name.toUpperCase()} (CAMBIAR)` : 'ELEGÍ NOMBRE Y EMPRESA';
    show('titleControl', touchUI);
    const box = $('tramos');
    box.innerHTML = '';
    ROUTES3D.forEach((r) => {
      const b = document.createElement('button');
      b.className = 'tramo' + (r.id === R.id ? ' on' : '');
      b.innerHTML = `<b>${r.title}</b><span>${r.origin} → ${r.dest}</span>`;
      // Tocar un tramo sale directo por ese tramo (modo kiosco: un solo toque).
      b.addEventListener('pointerdown', (e) => {
        e.stopPropagation();
        if (mode !== 'title') return;
        if (r.id !== R.id) chooseRoute(r.id);
        startGame();
      });
      box.appendChild(b);
    });
    rankTable($('titleRank'), -1, 5);
  }

  function chooseRoute(id) {
    if (id === R.id) return;
    setRoute(id);
    clearWorld();
    S = newRun(true);
    resetDecos();
    renderTitle();
  }

  function cycleRoute(d) {
    const i = ROUTES3D.indexOf(R);
    Sfx.click();
    chooseRoute(ROUTES3D[(i + d + ROUTES3D.length) % ROUTES3D.length].id);
  }

  function startGame() {
    // En el celular, la primera vez se elige cómo manejar y después se sale.
    if (!player.chosen) { openPlayer(startGame); return; }
    if (touchUI && !controlChosen) { openControls(startGame); return; }
    Sfx.unlock();
    Sfx.click();
    clearWorld();
    S = newRun(false);
    steer.dir = 0;
    resetDecos();
    Object.keys(hudCache).forEach((k) => delete hudCache[k]);
    show('titleScreen', false); show('hud', true); show('touch', touchUI); show('bPause', touchUI);
    $('touch').classList.toggle('tilt', control === 'tilt');
    $('pauseHint').textContent = touchUI ? 'Tocá para seguir' : 'P para seguir';
    if (touchUI) goFullscreen();
    if (control === 'tilt') {
      tilt.calib = true;                    // el volante se centra como lo tenga al salir
      tilt.idle = 0;
      setTimeout(checkSensor, 2000);
    }
    drawProgress();
    meter.frames = 0; meter.time = 0; meter.settle = 1.5;
    mode = 'play';
    toast(`¡Buen viaje!<br>Destino: ${R.dest}`, '#ffffff');
  }

  let canLeave = false;
  function showResult(arrived) {
    mode = 'result';
    show('hud', false); show('touch', false); show('banner', false); show('bPause', false);
    const mins = Math.floor(S.elapsed / 60);
    const secs = String(Math.floor(S.elapsed % 60)).padStart(2, '0');
    const stopsDone = S.stops.filter((s) => s.done).length;
    const confort = Math.round(S.confort);
    $('rTitle').textContent = arrived ? '¡LLEGASTE!' : 'VIAJE TERMINADO';
    $('rTitle').style.color = arrived ? '#f2b705' : '#ff6b5e';
    const kmDone = Math.min(R.to, kmAt(S.dist)) - R.from;
    $('rStats').textContent = `${R.origin} → ${R.dest} · ${kmDone.toFixed(1)} km en ${mins}:${secs} · Paradas ${stopsDone}/${S.stops.length} · Choques ${S.crashes}`;
    const rows = [
      [`Pasajeros (${S.passengers} × 100)`, S.passengers * 100],
      [`Encomiendas (${S.boxes} × 50)`, S.boxes * 50]
    ];
    if (arrived) {
      rows.push(['Llegada a destino', 500]);
      rows.push(['Puntualidad', Math.max(0, Math.round((TARGET_TIME - S.elapsed) * 20))]);
      rows.push([`Confort (${confort}% × 5)`, confort * 5]);
    }
    const total = rows.reduce((a, r) => a + r[1], 0);
    const table = $('rRows');
    table.innerHTML = '';
    rows.forEach(([label, pts]) => {
      const tr = table.insertRow();
      tr.insertCell().textContent = label;
      tr.insertCell().textContent = pts;
    });
    $('rTotal').textContent = `${total} PUNTOS`;
    $('rRank').innerHTML = '';
    show('rPrompt', false);
    show('resultScreen', true);
    canLeave = false;

    const done = (highlight) => {
      rankTable($('rRank'), highlight, 10);
      show('rPrompt', true);
      setTimeout(() => { canLeave = true; }, 700);
      clearTimeout(showResult.timer);
      showResult.timer = setTimeout(() => { if (mode === 'result') leaveResult(); }, 25000);
    };
    if (Ranking.qualifies(total)) done(Ranking.add(player.name || 'JUGADOR', total, player.company));
    else done(-1);
  }

  // Después de cada viaje vuelve al título y pide el próximo jugador (el anterior queda cargado).
  function leaveResult() {
    goTitle();
    openPlayer(null);
  }

  function togglePause() {
    if (mode !== 'play') return;
    paused = !paused;
    show('pauseScreen', paused);
  }

  // Dirección: un toque cambia de carril completo; mantener apretado mueve el ómnibus de a poco
  // y al soltar se queda donde está (también entre dos carriles).
  const TAP_TIME = 0.22;                // más que esto apretado ya es "mantener"
  const steer = { dir: 0, held: 0 };
  const clampX = (x) => Math.max(LANE_X[0], Math.min(LANE_X[RIGHT], x));

  function nextLaneX(x, dir) {
    if (dir > 0) return LANE_X.find((l) => l > x + 0.4) ?? LANE_X[RIGHT];
    return [...LANE_X].reverse().find((l) => l < x - 0.4) ?? LANE_X[0];
  }

  function steerPress(dir) {
    if (mode !== 'play' || paused) return;
    steer.dir = dir;
    steer.held = 0;
    S.targetX = nextLaneX(S.targetX, dir);
  }

  function steerRelease(dir) {
    if (steer.dir !== dir) return;
    if (steer.held > TAP_TIME && mode === 'play') {
      // Se frena el movimiento lateral donde soltó, con un poco de anticipación por la inercia.
      S.targetX = clampX(S.busX + S.latV * 0.35);
    }
    steer.dir = 0;
  }

  function updateSteer(dt) {
    if (!steer.dir) return;
    steer.held += dt;
    if (steer.held > TAP_TIME) S.targetX = clampX(S.busX + steer.dir * 1.2);
  }

  // ---------- Jugador: nombre y empresa ----------
  // Al entrar, el jugador pone su nombre (va al ranking) y elige empresa. La empresa define el ómnibus:
  // si tiene más de una skin, el botón ÓMNIBUS del título alterna entre las suyas.
  const SKINS = World3D.SKINS;
  const COMPANIES = [
    { id: 'cot', name: 'COT', color: '#f26b1d', skins: ['cot', 'cot925'] },
    { id: 'rutas_del_sol', name: 'Rutas del Sol', color: '#1f6fd1', skins: ['rutas_del_sol'] },
    { id: 'cynsa', name: 'CYNSA', color: '#e0301e', skins: ['cynsa'] }
  ].map((c) => ({ ...c, skins: c.skins.filter((id) => SKINS.some((s) => s.id === id && s.available)) }))
    .filter((c) => c.skins.length);
  const PLAYER_KEY = 'cot-ruta-3d-player';
  const player = { name: '', company: COMPANIES[0].id, skin: COMPANIES[0].skins[0], chosen: false };
  try {
    const saved = JSON.parse(localStorage.getItem(PLAYER_KEY) || 'null');
    if (saved) {
      player.name = String(saved.name || '').slice(0, 12);
      if (COMPANIES.some((c) => c.id === saved.company)) player.company = saved.company;
      const co = COMPANIES.find((c) => c.id === player.company);
      player.skin = co.skins.includes(saved.skin) ? saved.skin : co.skins[0];
    }
  } catch (e) { /* sin almacenamiento: se arranca de cero */ }
  const company = () => COMPANIES.find((c) => c.id === player.company) || COMPANIES[0];
  const savePlayer = () => {
    try { localStorage.setItem(PLAYER_KEY, JSON.stringify({ name: player.name, company: player.company, skin: player.skin })); } catch (e) { /* no se recuerda */ }
  };
  let afterPlayer = null;

  function renderCompanies() {
    const box = $('companies');
    box.innerHTML = '';
    COMPANIES.forEach((c) => {
      const btn = document.createElement('button');
      btn.className = 'choice' + (c.id === player.company ? ' on' : '');
      btn.innerHTML = `<b>${c.name}</b><i style="background:${c.color}"></i>`;
      btn.addEventListener('click', () => pickCompany(c.id));
      box.appendChild(btn);
    });
  }
  function pickCompany(id) {
    if (id !== player.company) {
      player.company = id;
      player.skin = company().skins[0];
    }
    if (bus) bus.userData.setSkin(player.skin);
    Sfx.unlock();
    Sfx.click();
    renderCompanies();
  }
  function openPlayer(next) {
    afterPlayer = next;
    $('playerName').value = player.name;
    $('playerName').classList.remove('bad');
    renderCompanies();
    show('playerBox', true);
    if (!touchUI) setTimeout(() => { $('playerName').focus(); $('playerName').select(); }, 50);
  }
  function confirmPlayer() {
    const name = $('playerName').value.trim().toUpperCase().slice(0, 12);
    if (!name) { $('playerName').classList.add('bad'); $('playerName').focus(); Sfx.miss(); return; }
    player.name = name;
    player.chosen = true;
    savePlayer();
    $('playerName').blur();
    Sfx.unlock();
    Sfx.click();
    show('playerBox', false);
    if (bus) bus.userData.setSkin(player.skin);
    renderTitle();
    const next = afterPlayer;
    afterPlayer = null;
    if (next) next();
  }
  $('playerOk').addEventListener('click', confirmPlayer);
  $('playerName').addEventListener('keydown', (e) => { if (e.key === 'Enter') confirmPlayer(); });
  $('playerName').addEventListener('input', () => $('playerName').classList.remove('bad'));
  $('playerBox').addEventListener('pointerdown', (e) => e.stopPropagation());
  $('titlePlayer').addEventListener('pointerdown', (e) => { e.stopPropagation(); if (mode === 'title') openPlayer(null); });

  // Botón del título: solo si la empresa tiene más de un ómnibus (COT: Primera Clase y 925).
  function skinButtonText() {
    const s = SKINS.find((k) => k.id === player.skin) || SKINS[0];
    return `ÓMNIBUS: ${s.name.toUpperCase()}${touchUI ? '' : ' (O)'}`;
  }
  function cycleSkin() {
    const list = company().skins;
    if (list.length < 2) return;
    player.skin = list[(list.indexOf(player.skin) + 1) % list.length];
    savePlayer();
    if (bus) bus.userData.setSkin(player.skin);
    Sfx.unlock();
    Sfx.click();
    $('titleSkin').textContent = skinButtonText();
  }
  $('titleSkin').addEventListener('pointerdown', (e) => { e.stopPropagation(); if (mode === 'title') cycleSkin(); });

  // ---------- Controles en el celular: botones o inclinación ----------
  // Al entrar desde un celular se elige cómo manejar. Con "inclinación" el celular es el volante:
  // se mide hacia dónde queda "arriba" (la gravedad) en el plano de la pantalla, así anda parado,
  // acostado o un poco recostado. Inclinado, el ómnibus se corre de a poco hacia ese lado; derecho,
  // se acomoda solo en el carril más cercano (así es fácil quedar justo en la parada).
  const CONTROL_KEY = 'cot-ruta-3d-control';
  const TILT_DEAD = 4, TILT_FULL = 24;     // grados: zona muerta y giro máximo
  let control = 'buttons', controlChosen = false, afterControl = null;
  try { if (localStorage.getItem(CONTROL_KEY) === 'tilt') control = 'tilt'; } catch (e) { /* se usan botones */ }
  const tilt = { raw: null, zero: 0, sign: 0, seen: 0, idle: 0, calib: false, shown: 999, listening: false };

  function onMotion(e) {
    const g = e.accelerationIncludingGravity;
    if (!g || g.x === null || g.y === null) return;
    tilt.seen = performance.now();
    // Pasar del sistema del celular al de la pantalla (si está acostado, la pantalla está girada).
    const so = screen.orientation && typeof screen.orientation.angle === 'number' ? screen.orientation.angle : (window.orientation || 0);
    const a = (so * Math.PI) / 180;
    let X = g.x * Math.cos(a) - g.y * Math.sin(a);
    let Y = g.x * Math.sin(a) + g.y * Math.cos(a);
    // Algunos celulares dan la gravedad con el signo al revés: se detecta con el celular derecho.
    if (!tilt.sign && Math.abs(Y) > 4) tilt.sign = Y < 0 ? -1 : 1;
    if (!tilt.sign) return;
    X *= tilt.sign;
    Y *= tilt.sign;
    if (Math.hypot(X, Y) < 2.5) return;      // casi acostado sobre la mesa: no se sabe el giro
    const deg = (Math.atan2(-X, Y) * 180) / Math.PI;
    tilt.raw = tilt.raw === null ? deg : tilt.raw + (deg - tilt.raw) * 0.35;
  }

  const nearestLane = (x) => LANE_X.reduce((b, l) => (Math.abs(l - x) < Math.abs(b - x) ? l : b), LANE_X[0]);

  function updateTilt(dt) {
    if (tilt.raw === null) return;
    if (tilt.calib) { tilt.zero = Math.max(-30, Math.min(30, tilt.raw)); tilt.calib = false; }
    const a = tilt.raw - tilt.zero, m = Math.abs(a);
    if (m > TILT_DEAD) {
      const v = Math.sign(a) * Math.min(1, (m - TILT_DEAD) / (TILT_FULL - TILT_DEAD));
      S.targetX = clampX(S.busX + v * 1.6);
      tilt.idle = 0;
    } else if ((tilt.idle += dt) > 0.2) {
      S.targetX = nearestLane(S.busX + S.latV * 0.3);
    }
    // El volante dibujado gira como el celular.
    const r = Math.round(Math.max(-90, Math.min(90, a)));
    if (r !== tilt.shown) { tilt.shown = r; $('wheel').firstElementChild.style.transform = `rotate(${r}deg)`; }
  }

  // Si a los 2 s de salir no llegó ningún dato del sensor, se pasa a botones.
  function checkSensor() {
    if (mode !== 'play' || control !== 'tilt' || performance.now() - tilt.seen < 1500) return;
    control = 'buttons';
    $('touch').classList.remove('tilt');
    toast('Este celular no manda datos del sensor:<br>usá los botones', '#ffd36b');
  }

  function askMotion() {
    const DM = window.DeviceMotionEvent;
    if (!DM) return Promise.resolve(false);
    // iPhone: hay que pedir permiso, y solo se puede al tocar un botón.
    if (typeof DM.requestPermission === 'function') return DM.requestPermission().then((r) => r === 'granted', () => false);
    return Promise.resolve(true);
  }

  function openControls(next) {
    afterControl = next;
    $('cButtons').classList.toggle('last', control === 'buttons');
    $('cTilt').classList.toggle('last', control === 'tilt');
    show('controlBox', true);
  }

  function chooseControl(kind) {
    Sfx.unlock();
    Sfx.click();
    const done = (k, note) => {
      control = k;
      controlChosen = true;
      try { localStorage.setItem(CONTROL_KEY, k); } catch (e) { /* no se recuerda */ }
      show('controlBox', false);
      renderTitle();
      if (note) toast(note, '#ffd36b');
      const next = afterControl;
      afterControl = null;
      if (next) next();
    };
    if (kind !== 'tilt') { done('buttons'); return; }
    askMotion().then((ok) => {
      if (!ok) { done('buttons', 'No hay permiso para el sensor:<br>vas con botones'); return; }
      if (!tilt.listening) { window.addEventListener('devicemotion', onMotion); tilt.listening = true; }
      done('tilt');
    });
  }

  // Pantalla completa en el celular (y con el celular de volante, que no se dé vuelta la imagen).
  function goFullscreen() {
    const el = document.documentElement;
    if (document.fullscreenElement || !el.requestFullscreen) return;
    el.requestFullscreen({ navigationUI: 'hide' }).then(() => {
      if (control === 'tilt' && screen.orientation && screen.orientation.lock) screen.orientation.lock(screen.orientation.type).catch(() => {});
    }, () => { /* el navegador no lo permite: se sigue igual */ });
  }

  $('cButtons').addEventListener('click', () => chooseControl('buttons'));
  $('cTilt').addEventListener('click', () => chooseControl('tilt'));
  $('titleControl').addEventListener('pointerdown', (e) => { e.stopPropagation(); if (mode === 'title') openControls(null); });
  $('wheel').addEventListener('pointerdown', (e) => {
    e.preventDefault();
    if (tilt.raw === null) return;
    tilt.zero = tilt.raw;
    popup('Volante centrado', '#ffffff');
  });
  $('bPause').addEventListener('pointerdown', (e) => { e.preventDefault(); togglePause(); });
  // Si se cambia de app o se apaga la pantalla, el juego queda en pausa.
  document.addEventListener('visibilitychange', () => { if (document.hidden && mode === 'play' && !paused) togglePause(); });

  // ---------- Entrada ----------
  // Mientras se escribe el nombre (o está abierta la pantalla del jugador) el juego no toma las teclas.
  const typing = () => (document.activeElement && document.activeElement.tagName === 'INPUT') || !$('playerBox').classList.contains('hidden');

  // Los botones en pantalla solo aparecen en dispositivos táctiles.
  let touchUI = window.matchMedia('(pointer: coarse)').matches;
  window.addEventListener('pointerdown', (e) => {
    if (e.pointerType === 'touch' && !touchUI) {
      touchUI = true;
      if (mode === 'play') { show('touch', true); show('bPause', true); }
      if (mode === 'title') renderTitle();
    }
  }, true);

  window.addEventListener('keydown', (e) => {
    if (typing()) return;
    if (['ArrowLeft', 'ArrowRight', 'ArrowDown', 'ArrowUp', 'Space'].includes(e.code)) e.preventDefault();
    if (e.repeat) return;
    keys.add(e.code);
    if (e.code === 'ArrowLeft' || e.code === 'KeyA') steerPress(-1);
    if (e.code === 'ArrowRight' || e.code === 'KeyD') steerPress(1);
    if (e.code === 'KeyH') Sfx.horn();
    if (e.code === 'KeyP' || e.code === 'Escape') togglePause();
    const confirm = e.code === 'Space' || e.code === 'Enter';
    if (mode === 'title' && e.code === 'KeyO') cycleSkin();
    if (mode === 'title' && (e.code === 'ArrowLeft' || e.code === 'KeyA')) cycleRoute(-1);
    if (mode === 'title' && (e.code === 'ArrowRight' || e.code === 'KeyD')) cycleRoute(1);
    if (confirm && mode === 'title') startGame();
    else if (confirm && mode === 'result' && canLeave) leaveResult();
    // Para el organizador del evento: Shift + B borra el ranking.
    if (e.code === 'KeyB' && e.shiftKey && mode === 'title' && window.confirm('¿Borrar todo el ranking?')) {
      Ranking.clear();
      rankTable($('titleRank'), -1, 5);
    }
  });
  window.addEventListener('keyup', (e) => {
    keys.delete(e.code);
    if (e.code === 'ArrowLeft' || e.code === 'KeyA') steerRelease(-1);
    if (e.code === 'ArrowRight' || e.code === 'KeyD') steerRelease(1);
  });
  window.addEventListener('blur', () => { keys.clear(); touchBrake = false; steerRelease(steer.dir); });

  $('titleScreen').addEventListener('pointerdown', () => { if (mode === 'title') startGame(); });
  $('resultScreen').addEventListener('pointerdown', () => { if (mode === 'result' && canLeave) leaveResult(); });
  $('pauseScreen').addEventListener('pointerdown', togglePause);

  const hold = (el, down, up) => {
    el.addEventListener('pointerdown', (e) => { e.preventDefault(); down(); });
    if (up) ['pointerup', 'pointerleave', 'pointercancel'].forEach((t) => el.addEventListener(t, up));
  };
  hold($('bLeft'), () => steerPress(-1), () => steerRelease(-1));
  hold($('bRight'), () => steerPress(1), () => steerRelease(1));
  hold($('bBrake'), () => { touchBrake = true; }, () => { touchBrake = false; });

  // ---------- Arranque ----------
  bus = World3D.loadBus((root) => {
    scene.add(root);
    syncBlobs(root);
    root.userData.setSkin(player.skin);
    $('loading').textContent = 'Preparando gráficos…';
    // Se espera un cuadro para que se vea el mensaje antes de compilar.
    requestAnimationFrame(() => prewarm().then(() => {
      $('loading').remove();
      goTitle();
      // Lo primero: nombre y empresa; en el celular, después, cómo manejar.
      openPlayer(touchUI ? () => openControls(null) : null);
      renderer.setAnimationLoop(frame);
    }));
  });
  createDecos();
  setRoute(R.id);
  S = newRun(true);
  resetDecos();
  applyGfx(gfx.level);

  // Para depurar desde la consola.
  window.game3d = {
    get state() { return S; }, get mode() { return mode; }, get gfx() { return { ...gfx, name: GFX_LEVELS[gfx.level].name }; },
    scene, camera, renderer, TRIP_M, applyGfx, get route() { return R; }, setRoute: chooseRoute,
    kmAt, posAt, resetDecos, headingAt, heightAt, get tilt() { return { ...tilt, control }; }
  };
})();
