// Modelos de los packs (src3d/models/*.js, preparados desde assets/modelos): árboles, arbustos, autos,
// casas y el alfabeto 3D de los carteles de ciudad. Cada modelo se carga UNA vez: las copias en el
// mundo comparten geometría y material (árboles y casas, además, con InstancedMesh desde game3d.js).
// Si un archivo no está, el juego usa los modelos simples de world3d.js.
const Models3D = (() => {
  const parts = {};      // clave -> [{ geo, mat }] en metros, base en y = 0, centrado en x/z
  const sizes = {};      // clave -> THREE.Vector3 (tamaño)
  const glyphs = {};     // letra -> { parts: [{ geo, rim }], w, h }
  let ready = false;

  // Escala y giro de cada modelo para que quede a la medida del juego (frente de los autos hacia -Z).
  const FIT = {
    tree1: { s: 1.15 }, tree2: { s: 1.2 }, tree3: { s: 1.35 },
    pine1: { s: 1.1 }, pine2: { s: 1.0 }, pine3: { s: 1.15 },
    bush1: { s: 1.0 }, bush2: { s: 1.0 },
    house1: { s: 6.5 }, house2: { s: 6.5 }, house3: { s: 6 }, house4: { s: 6 }, house5: { s: 6 },
    sedan: { rot: Math.PI }, hatch: { rot: Math.PI }, suv: { rot: Math.PI }, sport: { rot: Math.PI }, sport2: { rot: Math.PI }, taxi: { rot: Math.PI }
  };
  // Colores de casa de balneario por modelo: [paredes, techo].
  const HOUSE_COLORS = {
    house1: [0xf2ede4, 0xb4532a], house2: [0xe9d8b4, 0x7d5236], house3: [0xfafafa, 0x5f6366],
    house4: [0xf3d9c8, 0xa04428], house5: [0xd9e6ee, 0x8a3b26]
  };

  // Atributos cuantizados (enteros) -> float, para poder hornear la transformación en la geometría.
  function toFloat(geo) {
    for (const name of Object.keys(geo.attributes)) {
      const a = geo.attributes[name];
      if (a.array instanceof Float32Array && !a.isInterleavedBufferAttribute) continue;
      const out = new Float32Array(a.count * a.itemSize);
      for (let i = 0; i < a.count; i++) for (let k = 0; k < a.itemSize; k++) out[i * a.itemSize + k] = a.getComponent(i, k);
      geo.setAttribute(name, new THREE.BufferAttribute(out, a.itemSize));
    }
    return geo;
  }

  function fixMaterial(m) {
    const leaves = m.map && /leaf|leaves|flower/i.test(m.name + ' ' + (m.map.name || ''));
    if (leaves || m.transparent) {
      m.transparent = false;
      m.alphaTest = 0.45;              // hojas recortadas (más barato y sin problemas de orden)
      m.side = THREE.DoubleSide;
    }
    if (m.metalness !== undefined) { m.metalness = 0; m.roughness = Math.max(m.roughness, 0.7); }
    return m;
  }

  // Hornea un nodo raíz (un modelo) a una lista de partes en el espacio del modelo, normalizado.
  function bake(node, fit) {
    node.updateMatrixWorld(true);
    const list = [];
    node.traverse((o) => {
      if (!o.isMesh) return;
      const geo = toFloat(o.geometry.clone());
      geo.applyMatrix4(o.matrixWorld);
      list.push({ geo, mat: fixMaterial(o.material), name: o.material.name || '' });
    });
    const box = new THREE.Box3();
    list.forEach((p) => { p.geo.computeBoundingBox(); box.union(p.geo.boundingBox); });
    const c = box.getCenter(new THREE.Vector3());
    const m = new THREE.Matrix4();
    if (fit && fit.rot) m.makeRotationY(fit.rot);
    m.multiply(new THREE.Matrix4().makeScale(fit ? fit.s || 1 : 1, fit ? fit.s || 1 : 1, fit ? fit.s || 1 : 1));
    m.multiply(new THREE.Matrix4().makeTranslation(-c.x, -box.min.y, -c.z));
    const out = new THREE.Box3();
    list.forEach((p) => { p.geo.applyMatrix4(m); p.geo.computeBoundingBox(); p.geo.computeBoundingSphere(); out.union(p.geo.boundingBox); });
    return { list, size: out.getSize(new THREE.Vector3()) };
  }

  function parse(b64) {
    return new Promise((resolve) => {
      const bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
      new THREE.GLTFLoader().parse(bytes.buffer, '', resolve, () => resolve(null));
    });
  }

  // El alfabeto viene en una grilla (A-I, J-R, S-Z y signos), visto desde atrás: se da vuelta y se
  // reconoce cada letra por su lugar.
  function buildGlyphs(root) {
    const holder = root.getObjectByName('alphabet') || root;
    holder.rotation.y += Math.PI;               // el frente de las letras queda hacia +Z
    holder.updateMatrixWorld(true);
    // Las dos piezas de cada letra (cuerpo y borde) tienen la misma caja: se agrupan por posición.
    const groups = new Map();
    holder.traverse((o) => {
      if (!o.isMesh) return;
      const box = new THREE.Box3().setFromObject(o);
      const key = [box.min.x, box.min.y, box.max.x, box.max.y].map((v) => v.toFixed(2)).join(',');
      if (!groups.has(key)) groups.set(key, { meshes: [], box, cx: (box.min.x + box.max.x) / 2, cy: (box.min.y + box.max.y) / 2, h: box.max.y - box.min.y });
      groups.get(key).meshes.push(o);
    });
    const uniq = [...groups.values()];
    uniq.sort((a, b) => b.cy - a.cy);
    const rows = [];
    uniq.forEach((n) => {
      const row = rows.find((r) => Math.abs(r[0].cy - n.cy) < 0.45);
      if (row) row.push(n); else rows.push([n]);
    });
    rows.sort((a, b) => b[0].cy - a[0].cy);
    const names = ['ABCDEFGHI', 'JKLMNOPQR', 'STUVWXYZ'];
    rows.slice(0, 3).forEach((row, i) => {
      const tall = Math.max(...row.map((n) => n.h));
      const letters = row.filter((n) => n.h > tall * 0.6).sort((a, b) => a.cx - b.cx);
      [...names[i]].forEach((ch, k) => {
        const n = letters[k];
        if (!n) return;
        const list = [];
        n.meshes.forEach((o) => {
          const geo = toFloat(o.geometry.clone());
          geo.applyMatrix4(o.matrixWorld);
          list.push({ geo, rim: (o.material.color && o.material.color.r > 0.5) });
        });
        const box = new THREE.Box3();
        list.forEach((p) => { p.geo.computeBoundingBox(); box.union(p.geo.boundingBox); });
        const t = new THREE.Matrix4().makeTranslation(-box.min.x, -box.min.y, -(box.min.z + box.max.z) / 2);
        list.forEach((p) => { p.geo.applyMatrix4(t); p.geo.computeVertexNormals(); p.geo.computeBoundingSphere(); });
        glyphs[ch] = { parts: list, w: box.max.x - box.min.x, h: box.max.y - box.min.y };
      });
    });
  }

  function load() {
    const src = window.MODELS3D || {};
    const jobs = Object.keys(src).map((cat) => parse(src[cat]).then((gltf) => {
      if (!gltf) return;
      if (cat === 'letters') { buildGlyphs(gltf.scene); return; }
      gltf.scene.children.forEach((node) => {
        if (!node.name) return;
        const b = bake(node, FIT[node.name]);
        if (HOUSE_COLORS[node.name]) {
          // Los materiales del pack son compartidos: cada casa lleva su copia con sus colores.
          const [wall, roof] = HOUSE_COLORS[node.name];
          b.list.forEach((p) => {
            if (/defaultMat/i.test(p.name)) { p.mat = p.mat.clone(); p.mat.color.set(wall); }
            else if (/roof/i.test(p.name)) { p.mat = p.mat.clone(); p.mat.color.set(roof); }
          });
        }
        parts[node.name] = b.list;
        sizes[node.name] = b.size;
      });
    }));
    return Promise.all(jobs).then(() => { ready = true; });
  }

  const has = (key) => ready && !!parts[key];

  // Copia de un modelo como grupo de mallas (comparten geometría y material).
  function instance(key) {
    const g = new THREE.Group();
    parts[key].forEach((p) => { const m = new THREE.Mesh(p.geo, p.mat); m.castShadow = true; g.add(m); });
    return g;
  }

  // ---------- Autos ----------
  const CAR_KEYS = ['sedan', 'sedan', 'hatch', 'suv', 'suv', 'sport', 'sport2', 'taxi'];
  const PAINTABLE = /^(blue|lightblue|white|orange|yellow|red|green|black)$/i;
  const paintCache = {};
  function car(color) {
    const keys = CAR_KEYS.filter(has);
    if (!keys.length) return null;
    const key = keys[Math.floor(Math.random() * keys.length)];
    const g = new THREE.Group();
    let painted = false;
    parts[key].forEach((p) => {
      let mat = p.mat;
      // La primera pintura de la carrocería toma el color pedido (el taxi queda amarillo).
      if (key !== 'taxi' && !painted && PAINTABLE.test(p.name)) {
        const ck = p.mat.uuid + color;
        mat = paintCache[ck] || (paintCache[ck] = Object.assign(p.mat.clone(), {}));
        mat.color.set(color);
        mat.metalness = 0.4;
        mat.roughness = 0.35;
        painted = true;
      }
      const m = new THREE.Mesh(p.geo, mat);
      m.castShadow = true;
      g.add(m);
    });
    const s = sizes[key];
    g.userData = { hw: s.x / 2, hl: s.z / 2, model: key };
    return g;
  }

  // ---------- Carteles de ciudad con letras 3D ----------
  const PALETTE = [0xe53935, 0xfb8c00, 0xfdd835, 0x43a047, 0x1e88e5, 0x8e24aa];
  const bodyMats = PALETTE.map((c) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.45, metalness: 0.05 }));
  const rimMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.5 });
  const hasLetters = () => ready && !!glyphs.A;

  function letters(text, height = 2.6) {
    const clean = text.normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase();
    const ref = glyphs.H ? glyphs.H.h : 1;
    const k = height / ref;
    const g = new THREE.Group();
    let x = 0, n = 0;
    for (const ch of clean) {
      const gl = glyphs[ch];
      if (!gl) { x += height * 0.5; continue; }
      const body = bodyMats[n++ % bodyMats.length];
      gl.parts.forEach((p) => {
        const m = new THREE.Mesh(p.geo, p.rim ? rimMat : body);
        m.scale.setScalar(k);
        m.position.x = x;
        m.castShadow = true;
        g.add(m);
      });
      x += gl.w * k + height * 0.12;
    }
    const w = x - height * 0.12;
    g.children.forEach((m) => { m.position.x -= w / 2; });     // centrado
    g.userData.width = w;
    return g;
  }

  return { load, has, parts: (k) => parts[k], size: (k) => sizes[k], instance, car, letters, hasLetters, get ready() { return ready; } };
})();
