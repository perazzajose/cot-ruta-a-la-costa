// Constructores del mundo 3D realista. Usa materiales PBR (MeshStandardMaterial) que reflejan
// el cielo, texturas reales de Poly Haven y geometrías compartidas para no recargar la placa.
const World3D = (() => {
  // Perfiles de ruta uruguaya (según fotos). El lado derecho es igual en los dos; cambia el izquierdo.
  // Interbalnearia: banquina | 2 carriles que vienen | doble amarilla | nuestros 2 carriles | banquina.
  // Ruta 9: banquina | 1 carril que viene | línea amarilla | nuestro carril | banquina. El ómnibus
  // se puede mover por los dos carriles: el izquierdo es el de los que vienen de frente.
  const LANE_X = [-1.8, 1.8];                 // carriles por los que se mueve el ómnibus
  const ROAD_PROFILES = {
    ib: { id: 'ib', CENTER_X: -3.6, ONCOMING_LANES: [-5.4, -9.0], ROAD: { l: -12.2, r: 5.2 } },
    r9: { id: 'r9', CENTER_X: 0, ONCOMING_LANES: [-1.8], ROAD: { l: -5.2, r: 5.2 } }
  };
  let P = ROAD_PROFILES.ib;                   // perfil actual (lo cambia setProfile)
  const BRAND = 0x1b4f9c;
  const ACCENT = 0xf2b705;

  // ---------- Materiales ----------
  const matCache = {};
  function std(color, rough = 0.8, metal = 0, extra = {}) {
    const key = [color, rough, metal, JSON.stringify(extra)].join('|');
    return matCache[key] || (matCache[key] = new THREE.MeshStandardMaterial({ color, roughness: rough, metalness: metal, ...extra }));
  }
  const paint = (color) => std(color, 0.32, 0.45);
  const GLASS = new THREE.MeshStandardMaterial({ color: 0x0d141c, roughness: 0.06, metalness: 0.5 });
  const TIRE = std(0x151515, 0.9);
  const RIM = std(0xb8bcc2, 0.3, 0.9);
  const TAIL = new THREE.MeshStandardMaterial({ color: 0x8a0f0f, emissive: 0x6a0505, roughness: 0.4 });
  const HEAD = new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0x666655, roughness: 0.2 });
  const basic = (opts) => new THREE.MeshBasicMaterial(opts);

  function loadTex(dataUri, repeat, srgb = true) {
    const t = new THREE.TextureLoader().load(dataUri);
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    if (repeat) t.repeat.set(repeat[0], repeat[1]);
    if (srgb) t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = 8;
    return t;
  }

  function canvasTex(w, h, draw) {
    const c = document.createElement('canvas');
    c.width = w;
    c.height = h;
    draw(c.getContext('2d'), w, h);
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = 8;
    return t;
  }

  function textTex(text, opts = {}) {
    const { w = 256, h = 64, bg = '#1f6b3a', color = '#ffffff', font = 'bold 38px Arial', border = null } = opts;
    return canvasTex(w, h, (c) => {
      c.fillStyle = bg;
      c.fillRect(0, 0, w, h);
      if (border) { c.strokeStyle = border; c.lineWidth = 6; c.strokeRect(3, 3, w - 6, h - 6); }
      c.fillStyle = color;
      c.font = font;
      c.textAlign = 'center';
      c.textBaseline = 'middle';
      c.fillText(text, w / 2, h / 2 + 2);
    });
  }

  // ---------- Geometrías compartidas ----------
  const G = {
    box: new THREE.BoxGeometry(1, 1, 1),
    cable: new THREE.BoxGeometry(1, 1, 1, 1, 1, 9),     // con cortes a lo largo: se curva con la ruta
    tire: new THREE.CylinderGeometry(1, 1, 1, 16).rotateZ(Math.PI / 2),
    trunk: new THREE.CylinderGeometry(0.14, 0.24, 1, 7),
    blobby: new THREE.IcosahedronGeometry(1, 1),
    cone: new THREE.ConeGeometry(1, 1, 8),
    person: new THREE.CylinderGeometry(0.2, 0.24, 1.1, 8),
    head: new THREE.SphereGeometry(0.15, 10, 8)
  };

  // Sombra falsa (para calidades sin sombras reales).
  const blobMat = basic({
    map: canvasTex(64, 64, (c) => {
      const g = c.createRadialGradient(32, 32, 4, 32, 32, 32);
      g.addColorStop(0, 'rgba(0,0,0,0.6)');
      g.addColorStop(1, 'rgba(0,0,0,0)');
      c.fillStyle = g;
      c.fillRect(0, 0, 64, 64);
    }),
    transparent: true,
    depthWrite: false
  });
  function blob(w, l) {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, l), blobMat);
    m.rotation.x = -Math.PI / 2;
    m.position.y = 0.03;
    m.renderOrder = 1;
    m.userData.isBlob = true;
    return m;
  }

  function mesh(geo, mat, x = 0, y = 0, z = 0, sx = 1, sy = 1, sz = 1) {
    const m = new THREE.Mesh(geo, mat);
    m.position.set(x, y, z);
    m.scale.set(sx, sy, sz);
    m.castShadow = true;
    return m;
  }
  const boxMesh = (mat, w, h, l, x = 0, y = 0, z = 0) =>
    mesh(G.box, typeof mat === 'number' ? std(mat) : mat, x, y, z, w, h, l);

  // Perfil lateral (x = largo, y = alto) extruido a lo ancho. El frente queda hacia -Z.
  function profileGeo(points, width, bevel = 0.06) {
    const s = new THREE.Shape(points.map(([x, y]) => new THREE.Vector2(x, y)));
    const g = new THREE.ExtrudeGeometry(s, {
      depth: width - bevel * 2, bevelEnabled: bevel > 0, bevelThickness: bevel, bevelSize: bevel, bevelSegments: 2, curveSegments: 4
    });
    g.translate(0, 0, -(width - bevel * 2) / 2);
    g.rotateY(-Math.PI / 2);
    g.computeVertexNormals();
    return g;
  }

  // ---------- Ruta y suelo ----------
  const TILE_M = 12;     // largo del tile de las líneas pintadas (trazo de 4 m cada 12 m)
  const ASPHALT_M = 7;   // metros que cubre una repetición del asfalto
  const GRASS_M = 14;

  // Líneas de la calzada, en metros de mundo: bordes [l, r], banquinas más claras y líneas
  // { x, dash, yellow, double }. Doble amarilla al centro y blancas entre carriles y en los bordes.
  function markingsTexture({ l, r }, shoulders, lines) {
    const PX = 20;
    const w = Math.round((r - l) * PX);
    const t = canvasTex(w, TILE_M * PX, (c, W, H) => {
      c.clearRect(0, 0, W, H);
      c.fillStyle = 'rgba(205,200,190,0.16)';
      shoulders.forEach(([a, b]) => c.fillRect((a - l) * PX, 0, (b - a) * PX, H));
      lines.forEach(({ x, dash, yellow, double }) => {
        c.fillStyle = yellow ? 'rgba(242,190,20,0.95)' : 'rgba(242,242,236,0.94)';
        const px = (x - l) * PX;
        if (double) { c.fillRect(px - 5, 0, 3, H); c.fillRect(px + 2, 0, 3, H); }
        else if (dash) c.fillRect(px - 2, 0, 4, 4 * PX);
        else c.fillRect(px - 2.5, 0, 5, H);
      });
    });
    t.wrapT = THREE.RepeatWrapping;
    return t;
  }

  // Líneas de cada perfil: banquinas y líneas pintadas.
  function profileMarks(p) {
    const { ROAD, CENTER_X, ONCOMING_LANES } = p;
    if (p.id === 'r9') {
      // Ruta 9: bordes blancos y una línea amarilla discontinua al centro (se puede pasar).
      const edgeL = ONCOMING_LANES[0] - 1.8, edgeR = LANE_X[1] + 1.8;
      return markingsTexture(ROAD, [[ROAD.l, edgeL], [edgeR, ROAD.r]], [
        { x: edgeL }, { x: CENTER_X, yellow: true, dash: true }, { x: edgeR }
      ]);
    }
    const edgeL = ONCOMING_LANES[1] - 1.8, edgeR = LANE_X[1] + 1.8;
    return markingsTexture(ROAD, [[ROAD.l, edgeL], [edgeR, ROAD.r]], [
      { x: edgeL }, { x: (ONCOMING_LANES[0] + ONCOMING_LANES[1]) / 2, dash: true },
      { x: CENTER_X, yellow: true, double: true },
      { x: (LANE_X[0] + LANE_X[1]) / 2, dash: true }, { x: edgeR }
    ]);
  }

  function createRoad(scene) {
    const LEN = 520;
    // El asfalto se repite cada ASPHALT_M metros: la textura se arma para la calzada más ancha
    // y la angosta usa el mismo material con su propio ancho de UV.
    const W = ROAD_PROFILES.ib.ROAD.r - ROAD_PROFILES.ib.ROAD.l;
    const asphalt = loadTex(TEX3D.asphalt, [W / ASPHALT_M, LEN / ASPHALT_M]);
    const asphaltN = loadTex(TEX3D.asphaltNormal, [W / ASPHALT_M, LEN / ASPHALT_M], false);
    const grass = loadTex(TEX3D.grass, [800 / GRASS_M, 800 / GRASS_M]);
    const grassN = loadTex(TEX3D.grassNormal, [800 / GRASS_M, 800 / GRASS_M], false);

    // Dos juegos de materiales: PBR (alta/media) y Lambert (baja).
    const mats = {
      road: {
        hi: new THREE.MeshStandardMaterial({ map: asphalt, normalMap: asphaltN, color: 0x8a8a8a, roughness: 0.92 }),
        mid: new THREE.MeshStandardMaterial({ map: asphalt, color: 0x8a8a8a, roughness: 0.92 }),
        low: new THREE.MeshLambertMaterial({ map: asphalt, color: 0x8a8a8a })
      },
      grass: {
        hi: new THREE.MeshStandardMaterial({ map: grass, normalMap: grassN, color: 0xb4d890, roughness: 1 }),
        mid: new THREE.MeshStandardMaterial({ map: grass, color: 0xb4d890, roughness: 1 }),
        low: new THREE.MeshLambertMaterial({ map: grass, color: 0xb4d890 })
      }
    };

    // Con vértices cada pocos metros a lo largo, para que la ruta se pueda curvar (bend3d.js).
    const plane = (w, l, mat, x, y, z, segW = 1, segL = Math.ceil(l / 5)) => {
      const m = new THREE.Mesh(new THREE.PlaneGeometry(w, l, segW, segL), mat);
      m.rotation.x = -Math.PI / 2;
      m.position.set(x, y, z);
      m.receiveShadow = true;
      scene.add(m);
      return m;
    };
    const zc = -LEN / 2 + 40;
    const ground = plane(800, 800, mats.grass.hi, 0, -0.03, -300, 20, 80);

    // Una calzada por perfil. Normalmente se ve una sola; en el cambio de perfil (Pan de Azúcar) se ven
    // las dos, cortadas con un plano en el punto del cambio (la de atrás hasta ahí, la de adelante desde ahí).
    const decks = {};
    Object.values(ROAD_PROFILES).forEach((p) => {
      const w = p.ROAD.r - p.ROAD.l;
      const cx = (p.ROAD.l + p.ROAD.r) / 2;
      const deckMats = { hi: mats.road.hi.clone(), mid: mats.road.mid.clone(), low: mats.road.low.clone() };
      const clip = new THREE.Plane(new THREE.Vector3(0, 0, 1), 1e6);
      Object.values(deckMats).forEach((m) => { m.clippingPlanes = [clip]; });
      const road = plane(w, LEN, deckMats.hi, cx, 0, zc);
      // Recorta la UV para que el asfalto tenga la misma escala en las dos calzadas.
      const uv = road.geometry.attributes.uv;
      for (let i = 0; i < uv.count; i++) uv.setX(i, uv.getX(i) * (w / W));
      const marks = profileMarks(p);
      marks.repeat.set(1, LEN / TILE_M);
      const marksMat = new THREE.MeshStandardMaterial({ map: marks, transparent: true, roughness: 0.7, depthWrite: false });
      marksMat.clippingPlanes = [clip];
      const lines = plane(w, LEN, marksMat, cx, 0.012, zc);
      lines.renderOrder = 1;
      decks[p.id] = { road, lines, marks, mats: deckMats, clip };
    });
    let quality = 'hi';

    return {
      // El movimiento de la ruta es solo desplazar las texturas.
      scroll(dist) {
        asphalt.offset.y = asphaltN.offset.y = dist / ASPHALT_M;
        Object.values(decks).forEach((d) => { d.marks.offset.y = dist / TILE_M; });
        grass.offset.y = grassN.offset.y = dist / GRASS_M;
      },
      setQuality(q) {
        quality = q === 'high' ? 'hi' : q === 'medium' ? 'mid' : 'low';
        Object.values(decks).forEach((d) => { d.road.material = d.mats[quality]; });
        ground.material = mats.grass[quality];
      },
      setProfile(id) {
        Object.entries(decks).forEach(([k, d]) => {
          d.road.visible = d.lines.visible = k === id;
          d.clip.set(d.clip.normal.set(0, 0, 1), 1e6);       // sin corte
        });
      },
      // Cambio de perfil a la vista: la calzada "behind" hasta zCut y la "ahead" desde zCut hacia adelante
      // (z del mundo; adelante es -z). Con el mismo perfil a los dos lados, es setProfile.
      setSplit(behind, ahead, zCut) {
        if (behind === ahead) { this.setProfile(behind); return; }
        Object.entries(decks).forEach(([k, d]) => {
          d.road.visible = d.lines.visible = k === behind || k === ahead;
          if (k === behind) d.clip.normal.set(0, 0, 1), d.clip.constant = -zCut;      // queda z >= zCut
          else if (k === ahead) d.clip.normal.set(0, 0, -1), d.clip.constant = zCut;  // queda z <= zCut
        });
      }
    };
  }

  // Agua al costado: el mar con playa (llegando a la costa) o una laguna con orilla de pajonal
  // (Laguna Negra). side: 1 = derecha, -1 = izquierda.
  const WATER_NEAR = 26;                 // a partir de acá (desde el centro) ya no hay decoración
  function createWater(lengthM, side = 1, beach = true) {
    const g = new THREE.Group();
    const sandTex = loadTex(TEX3D.sand, [2, lengthM / 14]);
    const segs = Math.max(1, Math.ceil(lengthM / 10));
    const shore = new THREE.Mesh(new THREE.PlaneGeometry(28, lengthM, 1, segs), new THREE.MeshStandardMaterial({
      map: sandTex, color: beach ? 0xf0e2c0 : 0x8f9a62, roughness: 1
    }));
    shore.rotation.x = -Math.PI / 2;
    shore.position.set(side * (WATER_NEAR + 14), 0.02, 0);
    shore.receiveShadow = true;
    const water = new THREE.Mesh(new THREE.PlaneGeometry(500, lengthM, 10, segs), new THREE.MeshStandardMaterial({
      color: beach ? 0x1b5f8c : 0x2c4a52, roughness: beach ? 0.08 : 0.05, metalness: 0.1
    }));
    water.rotation.x = -Math.PI / 2;
    water.position.set(side * (WATER_NEAR + 278), 0.01, 0);
    g.add(shore, water);
    return g;
  }

  // ---------- Vehículos ----------
  const CAR_COLORS = [0xb3121b, 0x1e5aa8, 0xf2f2f2, 0x1c1c1e, 0x8c9095, 0x5b6770, 0x2f6b3c, 0xd9d4c7, 0x7a1f2b];

  // Perfiles: [carrocería baja], [habitáculo de vidrio], alto del techo, largo, ancho.
  const PROFILES = {
    sedan: {
      len: 4.6, width: 1.8,
      body: [[-2.3, 0.32], [-2.3, 0.72], [-2.1, 0.86], [-1.2, 0.98], [1.6, 1.0], [2.25, 0.95], [2.3, 0.72], [2.3, 0.32]],
      cabin: [[-1.2, 0.96], [-0.45, 1.42], [0.85, 1.44], [1.62, 0.98]],
      wheels: [-1.45, 1.4]
    },
    hatch: {
      len: 4.0, width: 1.75,
      body: [[-2.0, 0.32], [-2.0, 0.72], [-1.8, 0.88], [-1.0, 1.0], [1.95, 1.02], [2.0, 0.72], [2.0, 0.32]],
      cabin: [[-1.0, 0.98], [-0.25, 1.45], [1.55, 1.46], [1.96, 1.0]],
      wheels: [-1.3, 1.3]
    },
    suv: {
      len: 4.7, width: 1.9,
      body: [[-2.35, 0.42], [-2.35, 0.9], [-2.15, 1.08], [-1.3, 1.18], [2.3, 1.2], [2.35, 0.9], [2.35, 0.42]],
      cabin: [[-1.3, 1.16], [-0.6, 1.78], [2.15, 1.8], [2.3, 1.18]],
      wheels: [-1.5, 1.5]
    }
  };
  const profileCache = {};
  function carGeos(kind) {
    if (profileCache[kind]) return profileCache[kind];
    const p = PROFILES[kind];
    const cabin = p.cabin;
    return (profileCache[kind] = {
      body: profileGeo(p.body, p.width, 0.08),
      cabin: profileGeo(cabin, p.width - 0.16, 0.05),
      // Techo pintado encima del vidrio.
      roof: profileGeo([[cabin[1][0] + 0.12, cabin[1][1] - 0.02], [cabin[1][0] + 0.12, cabin[1][1] + 0.03],
        [cabin[2][0] - 0.1, cabin[2][1] + 0.03], [cabin[2][0] - 0.1, cabin[2][1] - 0.02]], p.width - 0.12, 0.03)
    });
  }

  function addWheels(g, zs, halfTrack, r = 0.34, w = 0.24) {
    zs.forEach((z) => {
      [-1, 1].forEach((side) => {
        g.add(mesh(G.tire, TIRE, side * halfTrack, r, z, w, r, r));
        g.add(mesh(G.tire, RIM, side * (halfTrack + 0.01), r, z, w * 0.9, r * 0.6, r * 0.6));
      });
    });
  }

  // Los vehículos miran hacia -Z; la cola queda del lado +Z, mirando a la cámara.
  function makeCar(color, kind) {
    // Con los modelos del pack cargados (models3d.js) se usan esos; si no, los simples de acá.
    if (typeof Models3D !== 'undefined' && Models3D.ready && !kind) {
      const mc = Models3D.car(color);
      if (mc) {
        mc.add(blob(mc.userData.hw * 2 + 0.8, mc.userData.hl * 2 + 1));
        return mc;
      }
    }
    kind = kind || ['sedan', 'sedan', 'hatch', 'suv'][Math.floor(Math.random() * 4)];
    const p = PROFILES[kind];
    const geos = carGeos(kind);
    const g = new THREE.Group();
    const pm = paint(color);
    g.add(mesh(geos.body, pm), mesh(geos.cabin, GLASS), mesh(geos.roof, pm));
    addWheels(g, p.wheels, p.width / 2 - 0.12);
    const back = p.len / 2 + 0.005;
    const tailY = p.body[p.body.length - 2][1] - 0.12;
    g.add(boxMesh(TAIL, 0.42, 0.13, 0.04, -p.width / 2 + 0.32, tailY, back), boxMesh(TAIL, 0.42, 0.13, 0.04, p.width / 2 - 0.32, tailY, back));
    g.add(boxMesh(HEAD, 0.36, 0.1, 0.04, -p.width / 2 + 0.3, 0.68, -back), boxMesh(HEAD, 0.36, 0.1, 0.04, p.width / 2 - 0.3, 0.68, -back));
    g.add(boxMesh(std(0x111111, 0.6), p.width - 0.3, 0.22, 0.05, 0, 0.42, back));   // paragolpes
    g.add(blob(p.width + 0.8, p.len + 1));
    g.userData = { hw: p.width / 2, hl: p.len / 2 };
    return g;
  }

  const cabGeo = profileGeo([[-0.9, 0.55], [-0.9, 2.2], [-0.6, 3.0], [1.4, 3.05], [1.4, 0.55]], 2.45, 0.08);
  const cabGlassGeo = profileGeo([[-0.88, 2.15], [-0.62, 2.9], [0.2, 2.92], [0.2, 2.15]], 2.5, 0.02);
  function makeTruck() {
    const g = new THREE.Group();
    const cabColor = paint([0xc0392b, 0x1e5aa8, 0xeeeeee, 0x2f6b3c][Math.floor(Math.random() * 4)]);
    const cab = mesh(cabGeo, cabColor, 0, 0, -4.9);
    const glass = mesh(cabGlassGeo, GLASS, 0, 0, -4.9);
    g.add(cab, glass);
    g.add(boxMesh(std(0xe6e3dc, 0.55, 0.2), 2.55, 3.0, 8.6, 0, 2.1, 0.75));          // caja
    g.add(boxMesh(std(0xcfcac0, 0.6, 0.3), 2.56, 0.12, 8.6, 0, 3.55, 0.75));
    g.add(boxMesh(std(0x2a2a2a, 0.8), 2.2, 0.35, 10.5, 0, 0.75, -0.2));             // chasis
    addWheels(g, [-4.3, 2.4, 3.7], 1.05, 0.5, 0.36);
    g.add(boxMesh(TAIL, 0.4, 0.2, 0.04, -1.0, 0.95, 5.06), boxMesh(TAIL, 0.4, 0.2, 0.04, 1.0, 0.95, 5.06));
    g.add(boxMesh(std(0xd8b400, 0.5), 2.3, 0.18, 0.04, 0, 0.6, 5.06));
    g.add(blob(3.4, 12));
    g.userData = { hw: 1.28, hl: 5.9 };
    return g;
  }

  function makeMoto() {
    const g = new THREE.Group();
    g.add(mesh(G.tire, TIRE, 0, 0.32, -0.7, 0.12, 0.32, 0.32), mesh(G.tire, TIRE, 0, 0.32, 0.7, 0.14, 0.32, 0.32));
    g.add(boxMesh(paint(0xd35400), 0.32, 0.35, 1.0, 0, 0.75, -0.05));
    g.add(boxMesh(std(0x222222, 0.7), 0.3, 0.12, 0.7, 0, 0.98, 0.3));
    g.add(boxMesh(std(0x2c3e50, 0.8), 0.42, 0.7, 0.32, 0, 1.4, 0.2));                // piloto
    const helmet = mesh(G.head, paint(0xf1c40f), 0, 1.95, 0.12, 1.4, 1.4, 1.5);
    g.add(helmet);
    g.add(boxMesh(TAIL, 0.16, 0.1, 0.04, 0, 0.9, 0.82));
    g.add(blob(1.1, 2.4));
    g.userData = { hw: 0.4, hl: 1.0 };
    return g;
  }

  // ---------- Optimización ----------
  // Une todas las piezas de un objeto estático en una sola malla con colores por vértice:
  // un árbol pasa de 5 dibujos a 1.
  const BAKED_MAT = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.92, flatShading: true });
  function bake(group) {
    group.updateMatrixWorld(true);
    const parts = [];
    let total = 0;
    group.traverse((o) => {
      if (!o.isMesh) return;
      const g = o.geometry.index ? o.geometry.toNonIndexed() : o.geometry.clone();
      g.applyMatrix4(o.matrixWorld);
      parts.push({ g, c: o.material.color });
      total += g.attributes.position.count;
    });
    const pos = new Float32Array(total * 3);
    const nor = new Float32Array(total * 3);
    const col = new Float32Array(total * 3);
    let k = 0;
    for (const { g, c } of parts) {
      const n = g.attributes.position.count;
      pos.set(g.attributes.position.array, k * 3);
      nor.set(g.attributes.normal.array, k * 3);
      for (let i = 0; i < n; i++) col.set([c.r, c.g, c.b], (k + i) * 3);
      k += n;
      g.dispose();
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
    geo.computeBoundingSphere();
    const m = new THREE.Mesh(geo, BAKED_MAT);
    m.castShadow = true;
    return m;
  }

  // Piezas de las filas repetidas (se dibujan con instancing: todas las copias en un solo dibujo).
  // Cada offset: [x, y, z, ancho, alto, largo].
  function rowParts(type) {
    if (type === 'post') {
      return [
        { geo: G.box, mat: std(0xeeeeee, 0.6), offs: [[0, 0.5, 0, 0.14, 1.0, 0.14]] },
        { geo: G.box, mat: std(0xd23b2f, 0.4), offs: [[0, 0.88, 0, 0.15, 0.12, 0.15]] }
      ];
    }
    const galv = std(0xb9bfc5, 0.35, 0.85);
    if (type === 'guardrail') {
      // Guardarraíl metálico (defensa de doble onda) con postes cada 4 m.
      return [
        { geo: G.box, mat: galv, offs: [[0, 0.42, 0, 0.14, 0.84, 0.14]] },
        { geo: G.box, mat: galv, offs: [[0.08, 0.62, -2, 0.05, 0.32, 4.02]] }
      ];
    }
    if (type === 'utePole') {
      // Poste de madera de UTE con cruceta y tres cables al siguiente poste (45 m).
      return [
        { geo: G.box, mat: std(0x5b4632, 0.95), offs: [[0, 4.5, 0, 0.26, 9, 0.26], [0, 8.4, 0, 1.7, 0.12, 0.12]] },
        { geo: G.cable, mat: std(0x2a2a2a, 0.6, 0.4), offs: [-0.75, 0, 0.75].map((x) => [x, 8.5, -22.5, 0.025, 0.025, 45]) }
      ];
    }
    if (type === 'lightPole') {
      // Columna de alumbrado en el cantero, con brazos hacia las dos calzadas.
      return [
        { geo: G.box, mat: galv, offs: [[0, 5, 0, 0.2, 10, 0.2], [0, 10, 0, 4.6, 0.12, 0.14]] },
        { geo: G.box, mat: std(0xe9edf0, 0.3, 0.2, { emissive: 0x333322 }), offs: [[-2.3, 9.9, 0, 0.7, 0.18, 0.35], [2.3, 9.9, 0, 0.7, 0.18, 0.35]] }
      ];
    }
    // Alambrado de campo: poste de madera y tres hilos de 10 m.
    return [
      { geo: G.box, mat: std(0x7a6148, 0.95), offs: [[0, 0.65, 0, 0.12, 1.3, 0.12]] },
      { geo: G.box, mat: std(0x9aa0a6, 0.4, 0.8), offs: [0.45, 0.8, 1.15].map((y) => [0, y, -5, 0.015, 0.015, 10]) }
    ];
  }

  // ---------- Decoración ----------
  const LEAF = [0x3d6b2e, 0x4a7a34, 0x56843c, 0x35602a].map((c) => std(c, 0.95, 0, { flatShading: true }));
  const EUCA = [0x6b8a5a, 0x5f7f52, 0x768f63].map((c) => std(c, 0.95, 0, { flatShading: true }));
  const BARK = std(0x6b5440, 0.95);
  const EUCA_BARK = std(0xc9bfae, 0.9);
  const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];

  function makeDeco(type) {
    const g = new THREE.Group();
    if (type === 'tree') {
      g.add(mesh(G.trunk, BARK, 0, 1.3, 0, 1.3, 2.6, 1.3));
      for (let i = 0; i < 4; i++) {
        const s = 1.3 + Math.random() * 0.8;
        g.add(mesh(G.blobby, pick(LEAF), (Math.random() - 0.5) * 1.6, 3.2 + Math.random() * 1.2, (Math.random() - 0.5) * 1.6, s, s * 0.85, s));
      }
    } else if (type === 'eucalyptus') {
      // Eucaliptos: típicos de los montes al costado de las rutas uruguayas.
      const h = 9 + Math.random() * 5;
      g.add(mesh(G.trunk, EUCA_BARK, 0, h / 2, 0, 1.1, h, 1.1));
      for (let i = 0; i < 4; i++) {
        const s = 1.4 + Math.random() * 0.7;
        g.add(mesh(G.blobby, pick(EUCA), (Math.random() - 0.5) * 2.2, h * 0.7 + i * 1.1, (Math.random() - 0.5) * 2.2, s, s * 1.5, s));
      }
    } else if (type === 'pine') {
      g.add(mesh(G.trunk, BARK, 0, 1, 0, 1, 2, 1));
      g.add(mesh(G.cone, pick(LEAF), 0, 3.6, 0, 2.0, 4.6, 2.0));
      g.add(mesh(G.cone, pick(LEAF), 0, 5.4, 0, 1.4, 3.2, 1.4));
    } else if (type === 'palm') {
      g.add(mesh(G.trunk, std(0x8b6b45, 0.9), 0, 3, 0, 0.9, 6, 0.9));
      const leafMat = std(0x4f8a2c, 0.8, 0, { side: THREE.DoubleSide });
      for (let i = 0; i < 7; i++) {
        const pivot = new THREE.Group();
        pivot.position.set(0, 5.9, 0);
        pivot.rotation.y = (i / 7) * Math.PI * 2;
        const leaf = mesh(G.box, leafMat, 0, 0, 1.3, 0.55, 0.05, 2.8);
        leaf.rotation.x = 0.5;
        pivot.add(leaf);
        g.add(pivot);
      }
    } else if (type === 'bush') {
      g.add(mesh(G.blobby, pick(LEAF), 0, 0.5, 0, 1.2, 0.8, 1.2));
      g.add(mesh(G.blobby, pick(LEAF), 0.7, 0.4, 0.3, 0.8, 0.6, 0.8));
    } else if (type === 'umbrellaPine') {
      // Pino marítimo (copa ancha y chata), típico de la Costa de Oro.
      const h = 8 + Math.random() * 4;
      const trunk = mesh(G.trunk, BARK, 0.4, h / 2, 0, 1.2, h, 1.2);
      trunk.rotation.z = -0.08;
      g.add(trunk);
      for (let i = 0; i < 5; i++) {
        const s = 1.6 + Math.random() * 0.9;
        g.add(mesh(G.blobby, pick(LEAF), 0.8 + (Math.random() - 0.5) * 3.4, h + Math.random() * 0.6, (Math.random() - 0.5) * 3.4, s * 1.3, s * 0.45, s * 1.3));
      }
    } else if (type === 'house') {
      // Casa de balneario: paredes de color, techo a dos aguas de teja o chapa.
      const walls = pick([0xf2ede4, 0xe9d8b4, 0xd9e6ee, 0xf3d9c8, 0xe0c9a6, 0xffffff]);
      const roofCol = pick([0xb4532a, 0xa04428, 0x5f6366, 0xc0612d]);
      const w = 6 + Math.random() * 3, d = 7 + Math.random() * 3, hh = 2.8;
      g.add(boxMesh(std(walls, 0.9), w, hh, d, 0, hh / 2, 0));
      const roof = new THREE.Shape([new THREE.Vector2(-w / 2 - 0.4, 0), new THREE.Vector2(w / 2 + 0.4, 0), new THREE.Vector2(0, 1.9)]);
      const roofGeo = new THREE.ExtrudeGeometry(roof, { depth: d + 0.6, bevelEnabled: false });
      roofGeo.translate(0, hh, -(d + 0.6) / 2);
      g.add(mesh(roofGeo, std(roofCol, 0.8)));
      g.add(boxMesh(std(0x3b4650, 0.3), 1.2, 1.1, 0.05, -w / 4, 1.5, d / 2 + 0.01), boxMesh(std(0x3b4650, 0.3), 1.2, 1.1, 0.05, w / 4, 1.5, d / 2 + 0.01));
      g.add(boxMesh(std(0x6b4a2b, 0.8), 0.9, 2.0, 0.05, 0, 1.0, -d / 2 - 0.01));
    } else if (type === 'cow') {
      const hide = std(0xf0ece4, 0.9);
      const spots = std(0x1f1a17, 0.9);
      g.add(boxMesh(hide, 0.75, 0.75, 1.7, 0, 1.0, 0));
      g.add(boxMesh(spots, 0.77, 0.45, 0.6, 0, 1.1, -0.15), boxMesh(spots, 0.6, 0.4, 0.4, 0.1, 1.15, 0.5));
      g.add(boxMesh(hide, 0.4, 0.42, 0.55, 0, 1.25, -1.05));
      g.add(boxMesh(std(0xd9a89a, 0.8), 0.32, 0.22, 0.12, 0, 1.12, -1.36));
      [[-0.25, -0.6], [0.25, -0.6], [-0.25, 0.6], [0.25, 0.6]].forEach(([x, z]) => g.add(boxMesh(hide, 0.16, 0.65, 0.16, x, 0.32, z)));
    } else if (type === 'butia') {
      // Palma butiá (palmares de Rocha): tronco grueso y rugoso, hojas gris verdosas arqueadas.
      const h = 3.5 + Math.random() * 2.5;
      const lean = (Math.random() - 0.5) * 0.12;
      const trunk = mesh(G.trunk, std(0x6f6253, 0.95), 0, h / 2, 0, 2.2, h, 2.2);
      trunk.rotation.z = lean;
      g.add(trunk);
      g.add(mesh(G.blobby, std(0x655848, 0.95), -lean * h, h, 0, 0.6, 0.5, 0.6));     // base de las hojas
      const frond = std(pick([0x7f9a78, 0x8aa283, 0x76916f]), 0.85, 0, { side: THREE.DoubleSide });
      for (let i = 0; i < 16; i++) {
        const pivot = new THREE.Group();
        pivot.position.set(-lean * h, h + 0.1, 0);
        pivot.rotation.y = (i / 16) * Math.PI * 2 + Math.random() * 0.3;
        // Dos tramos por hoja: sube y después cae, como el arco de la butiá.
        const rise = 0.35 + (i % 4) * 0.18;       // hojas de adentro más paradas
        const L1 = 1.8, L2 = 1.7, drop = 0.75;
        const up = mesh(G.box, frond, 0, Math.sin(rise) * L1 / 2, Math.cos(rise) * L1 / 2, 0.24, 0.03, L1);
        up.rotation.x = -rise;
        const ez = Math.cos(rise) * L1, ey = Math.sin(rise) * L1;
        const down = mesh(G.box, frond, 0, ey - Math.sin(drop) * L2 / 2, ez + Math.cos(drop) * L2 / 2, 0.18, 0.03, L2);
        down.rotation.x = drop;
        pivot.add(up, down);
        g.add(pivot);
      }
    } else if (type === 'reeds') {
      // Pajonal de bañado (paja brava y juncos).
      for (let i = 0; i < 9; i++) {
        const s = 0.5 + Math.random() * 0.5;
        const c = mesh(G.cone, std(pick([0x9a9a5a, 0x7f8a4a, 0xb0a66a, 0x6f7f45]), 0.95, 0, { flatShading: true }),
          (Math.random() - 0.5) * 3.2, s * 1.1, (Math.random() - 0.5) * 3.2, s * 0.9, s * 2.2, s * 0.9);
        g.add(c);
      }
    } else if (type === 'pond') {
      // Charco de bañado con juncos alrededor.
      const r = 5 + Math.random() * 4;
      const water = mesh(new THREE.CylinderGeometry(1, 1, 0.04, 14), std(0x5f8296, 0.15), 0, 0.06, 0, r, 1, r * 0.6);
      water.castShadow = false;
      g.add(water);
      for (let i = 0; i < 10; i++) {
        const a = (i / 10) * Math.PI * 2 + Math.random() * 0.4;
        const s = 0.4 + Math.random() * 0.5;
        g.add(mesh(G.cone, std(pick([0x7f8a4a, 0x9a9a5a, 0x6f7f45]), 0.95, 0, { flatShading: true }),
          Math.cos(a) * r * 1.02, s * 1.1, Math.sin(a) * r * 0.62, s, s * 2.2, s));
      }
    }
    return bake(g);
  }

  // ---------- Fortaleza de Santa Teresa ----------
  // Muralla de piedra en estrella (cinco baluartes), garitas en las puntas y bandera uruguaya.
  function makeFortaleza() {
    const g = new THREE.Group();
    const stone = std(0x9d927f, 0.95, 0, { flatShading: true });
    const pts = [];
    for (let i = 0; i < 10; i++) {
      const a = (i / 10) * Math.PI * 2 - Math.PI / 2;
      const r = i % 2 ? 23 : 34;
      pts.push(new THREE.Vector2(Math.cos(a) * r, Math.sin(a) * r));
    }
    const wallGeo = new THREE.ExtrudeGeometry(new THREE.Shape(pts), { depth: 7, bevelEnabled: false });
    wallGeo.rotateX(-Math.PI / 2);
    g.add(mesh(wallGeo, stone));
    // Parapeto más oscuro arriba de la muralla.
    const topGeo = new THREE.ExtrudeGeometry(new THREE.Shape(pts.map((p) => p.clone().multiplyScalar(1.01))), { depth: 0.6, bevelEnabled: false });
    topGeo.rotateX(-Math.PI / 2);
    g.add(mesh(topGeo, std(0x847a69, 0.95, 0, { flatShading: true }), 0, 7, 0));
    // Garitas en la punta de cada baluarte.
    const sentry = std(0xe9e2d2, 0.9);
    for (let i = 0; i < 10; i += 2) {
      const a = (i / 10) * Math.PI * 2 - Math.PI / 2;
      const x = Math.cos(a) * 33, z = -Math.sin(a) * 33;
      g.add(mesh(new THREE.CylinderGeometry(1, 1, 1, 10), sentry, x, 8.5, z, 1.1, 2.4, 1.1));
      g.add(mesh(new THREE.SphereGeometry(1, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2), sentry, x, 9.7, z, 1.2, 1.1, 1.2));
    }
    // Mástil con la bandera.
    g.add(boxMesh(std(0xdfe3e6, 0.4, 0.5), 0.25, 16, 0.25, 0, 8, 0));
    const flagTex = canvasTex(180, 120, (c, W, H) => {
      c.fillStyle = '#ffffff';
      c.fillRect(0, 0, W, H);
      c.fillStyle = '#1f4fa0';
      for (let k = 1; k < 9; k += 2) c.fillRect(0, (k * H) / 9, W, H / 9);
      c.fillStyle = '#ffffff';
      c.fillRect(0, 0, W * 0.4, (H * 5) / 9);
      c.fillStyle = '#f2b705';
      c.beginPath(); c.arc(W * 0.2, (H * 5) / 18, H * 0.13, 0, Math.PI * 2); c.fill();
    });
    const flag = new THREE.Mesh(new THREE.PlaneGeometry(4.5, 3), new THREE.MeshStandardMaterial({ map: flagTex, side: THREE.DoubleSide, roughness: 0.8 }));
    flag.position.set(0, 14.3, 2.3);
    flag.rotation.y = -Math.PI / 2;    // de frente a la ruta (la fortaleza queda a la derecha), flameando hacia atrás
    flag.userData.ownTex = true;
    g.add(flag);
    return g;
  }

  // ---------- Señalización uruguaya (según fotos de la Interbalnearia y Ruta 9) ----------
  const SIGN_BLUE = '#1f5fae';

  // Escudo de ruta: contorno blanco con punta abajo y el número/sigla adentro.
  function drawShield(c, cx, cy, s, label) {
    c.save();
    c.translate(cx, cy);
    c.beginPath();
    c.moveTo(-s * 0.45, -s * 0.5);
    c.lineTo(s * 0.45, -s * 0.5);
    c.lineTo(s * 0.45, s * 0.12);
    c.lineTo(0, s * 0.5);
    c.lineTo(-s * 0.45, s * 0.12);
    c.closePath();
    c.lineWidth = s * 0.07;
    c.strokeStyle = '#ffffff';
    c.stroke();
    c.fillStyle = '#ffffff';
    c.font = `bold ${Math.round(s * (label.length > 1 ? 0.36 : 0.5))}px Arial`;
    c.textAlign = 'center';
    c.textBaseline = 'middle';
    c.fillText(label, 0, -s * 0.06);
    c.restore();
  }

  function signTex(w, h, draw, bg = SIGN_BLUE) {
    return canvasTex(w, h, (c) => {
      c.fillStyle = bg;
      c.fillRect(0, 0, w, h);
      c.strokeStyle = bg === SIGN_BLUE ? '#ffffff' : '#111111';
      c.lineWidth = 8;
      c.strokeRect(8, 8, w - 16, h - 16);
      c.fillStyle = bg === SIGN_BLUE ? '#ffffff' : '#111111';
      c.textBaseline = 'middle';
      draw(c);
    });
  }

  // Cartel sobre dos postes, mirando a la cámara (el tránsito viene desde +Z).
  function postSign(tex, w, h, y) {
    const g = new THREE.Group();
    const post = std(0xd9dcdf, 0.5, 0.3);
    g.add(boxMesh(post, 0.1, y, 0.1, -w * 0.35, y / 2, 0), boxMesh(post, 0.1, y, 0.1, w * 0.35, y / 2, 0));
    const board = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshStandardMaterial({ map: tex, roughness: 0.45 }));
    board.position.set(0, y + h / 2 - 0.1, 0.06);
    board.userData.ownTex = true;
    g.add(board);
    return g;
  }

  // Mojón de km: azul con el escudo de la ruta y "Km 40".
  function makeKmSign(km, shield = 'IB') {
    const tex = signTex(256, 128, (c) => {
      drawShield(c, 64, 64, 80, shield);
      c.font = 'bold 50px Arial';
      c.textAlign = 'left';
      c.fillText(`Km ${km}`, 112, 66);
    });
    return postSign(tex, 1.6, 0.8, 1.5);
  }

  // Cartel de arroyo como el de la foto (Aº Chafalote ⑨ Km 236,500).
  function makeArroyoSign(name, km, shield = 'IB') {
    const [whole, frac] = String(km.toFixed(3)).split('.');
    const tex = signTex(512, 256, (c) => {
      c.font = 'bold 72px Arial';
      c.textAlign = 'center';
      c.fillText(name, 256, 76);
      drawShield(c, 120, 176, 92, shield);
      c.textAlign = 'left';
      c.font = 'bold 60px Arial';
      c.fillText(`Km ${whole}`, 196, 178);
      c.font = 'bold 34px Arial';
      c.fillText(frac, 196 + c.measureText(`Km ${whole}`).width * 1.78 + 6, 160);
    });
    return postSign(tex, 2.6, 1.3, 1.4);
  }

  // Cartel azul en ménsula sobre la banquina con pictograma y nombre (como "La Esmeralda").
  function makeLocalitySign(text, icon = 'town') {
    const g = new THREE.Group();
    const pole = std(0xdfe3e6, 0.4, 0.5);
    g.add(boxMesh(pole, 0.32, 7, 0.32, 0, 3.5, 0));
    g.add(boxMesh(pole, 3.4, 0.22, 0.22, -1.6, 6.7, 0));
    const tex = signTex(640, 192, (c) => {
      c.fillStyle = '#ffffff';
      c.fillRect(28, 28, 136, 136);
      c.strokeStyle = SIGN_BLUE;
      c.fillStyle = SIGN_BLUE;
      c.lineWidth = 9;
      if (icon === 'plane') {
        c.beginPath(); c.moveTo(96, 44); c.lineTo(106, 92); c.lineTo(150, 112); c.lineTo(106, 108); c.lineTo(100, 140);
        c.lineTo(116, 150); c.lineTo(76, 150); c.lineTo(92, 140); c.lineTo(86, 108); c.lineTo(42, 112); c.lineTo(86, 92); c.closePath(); c.fill();
      } else if (icon === 'beach') {
        c.beginPath(); c.arc(96, 150, 50, Math.PI, 0); c.stroke();
        c.beginPath(); c.moveTo(96, 150); c.lineTo(96, 60); c.stroke();
        c.beginPath(); c.arc(126, 64, 16, 0, Math.PI * 2); c.fill();
      } else if (icon === 'fort') {
        // Muralla con almenas y una garita.
        c.fillRect(44, 104, 104, 48);
        for (let x = 44; x < 148; x += 26) c.fillRect(x, 90, 14, 16);
        c.fillRect(82, 60, 28, 46);
        c.beginPath(); c.arc(96, 60, 14, Math.PI, 0); c.fill();
      } else {
        c.fillRect(56, 96, 80, 56);
        c.beginPath(); c.moveTo(46, 100); c.lineTo(96, 52); c.lineTo(146, 100); c.closePath(); c.fill();
      }
      c.fillStyle = '#ffffff';
      c.textAlign = 'left';
      c.font = `bold ${text.length > 14 ? 50 : 66}px Arial`;
      c.fillText(text, 188, 100);
    });
    const panel = new THREE.Mesh(new THREE.PlaneGeometry(3.6, 1.08), new THREE.MeshStandardMaterial({ map: tex, roughness: 0.45 }));
    panel.position.set(-2.1, 7.25, 0.14);
    panel.userData.ownTex = true;
    g.add(panel);
    return g;
  }

  // Advertencia amarilla (como "A 500 m ROTONDA").
  function makeWarningSign(line1, line2) {
    const tex = signTex(320, 200, (c) => {
      c.textAlign = 'center';
      c.font = 'bold 52px Arial';
      c.fillText(line1, 160, 70);
      c.font = 'bold 58px Arial';
      c.fillText(line2, 160, 140);
    }, '#f2c200');
    return postSign(tex, 1.6, 1.0, 1.3);
  }

  // ---------- Peaje (como el de Pando: techo sobre la ruta, isletas y cabinas) ----------
  const stripesTex = canvasTex(64, 64, (c) => {
    c.fillStyle = '#f2c200';
    c.fillRect(0, 0, 64, 64);
    c.fillStyle = '#111';
    for (let k = -64; k < 128; k += 32) { c.beginPath(); c.moveTo(k, 0); c.lineTo(k + 16, 0); c.lineTo(k + 80, 64); c.lineTo(k + 64, 64); c.fill(); }
  });
  stripesTex.wrapS = stripesTex.wrapT = THREE.RepeatWrapping;

  function tollPlaza(g, { l, r }, islandXs, name) {
    const cx = (l + r) / 2, w = r - l + 1.2;
    const white = std(0xf2f3f4, 0.6);
    g.add(boxMesh(white, w, 0.7, 11, cx, 6.4, 0));
    const fascia = new THREE.Mesh(new THREE.PlaneGeometry(w, 0.9), new THREE.MeshStandardMaterial({
      map: textTex(`PEAJE ${name.toUpperCase()}`, { w: 1024, h: 80, bg: '#1d3f6e', font: 'bold 52px Arial' }), roughness: 0.5
    }));
    fascia.position.set(cx, 6.4, 5.52);
    fascia.userData.ownTex = true;
    g.add(fascia);
    const curb = std(0xb9b6ae, 0.9);
    const bumper = new THREE.MeshStandardMaterial({ map: stripesTex, roughness: 0.6 });
    islandXs.forEach((x) => {
      // Isleta angosta: el ómnibus (2,5 m) tiene que pasar por su carril de 3,6 m sin tocarla.
      g.add(boxMesh(curb, 0.7, 0.25, 15, x, 0.125, 0));
      g.add(boxMesh(white, 0.62, 2.4, 2.4, x, 1.45, 0));                // cabina
      g.add(boxMesh(GLASS, 0.64, 0.9, 1.6, x, 1.9, 0));
      g.add(boxMesh(bumper, 0.7, 0.9, 0.5, x, 0.7, 7.3));               // defensa rayada al frente
      g.add(boxMesh(std(0xc8ccd0, 0.4, 0.6), 0.35, 5.8, 0.35, x, 3.1, -4));
      g.add(boxMesh(std(0xc8ccd0, 0.4, 0.6), 0.35, 5.8, 0.35, x, 3.1, 4));
    });
  }

  function makePeaje(name) {
    const g = new THREE.Group();
    // Un solo techo sobre toda la ruta. Isletas: en las banquinas, entre los carriles de cada
    // sentido y sobre la línea amarilla del centro.
    const { ROAD, CENTER_X, ONCOMING_LANES } = P;
    const middles = P.id === 'r9' ? [CENTER_X] : [(ONCOMING_LANES[0] + ONCOMING_LANES[1]) / 2, CENTER_X, 0];
    tollPlaza(g, ROAD, [ROAD.l + 0.5, ...middles, ROAD.r - 0.4], name);
    // Las que puede chocar el ómnibus (también las del lado de contramano).
    g.userData.islands = middles.filter((x) => x > ROAD.l + 1 && x < LANE_X[1]);
    g.userData.islandHalf = 0.3;
    g.userData.halfLen = 7.5;
    return g;
  }

  // ---------- Cruce con semáforo (salidas a las ciudades) ----------
  // Calles laterales que salen de la ruta (sides: 1 = derecha, -1 = izquierda), línea de detención antes
  // del cruce y semáforo en ménsula sobre nuestros carriles. El frente del semáforo mira al ómnibus (+z).
  // userData.setLight('green' | 'yellow' | 'red') cambia las luces.
  function makeCrossing(profileId, sides = [1, -1]) {
    const p = ROAD_PROFILES[profileId] || ROAD_PROFILES.ib;
    const g = new THREE.Group();
    const asphalt = std(0x3a3b3d, 0.95);
    const STREET_W = 8, STREET_L = 70;
    sides.forEach((side) => {
      const edge = side > 0 ? p.ROAD.r : p.ROAD.l;
      const st = new THREE.Mesh(new THREE.PlaneGeometry(STREET_L, STREET_W, 14, 2), asphalt);
      st.rotation.x = -Math.PI / 2;
      st.position.set(edge + side * STREET_L / 2, 0.006, 0);
      st.receiveShadow = true;
      g.add(st);
      // Cordones de la calle.
      [-1, 1].forEach((k) => g.add(boxMesh(std(0xb9b6ae, 0.9), STREET_L, 0.15, 0.25, edge + side * STREET_L / 2, 0.075, k * (STREET_W / 2 + 0.12))));
    });
    // Línea de detención en nuestros carriles, antes del cruce.
    const ourL = profileId === 'r9' ? 0 : p.CENTER_X;
    const stop = new THREE.Mesh(new THREE.PlaneGeometry(p.ROAD.r - 1.6 - ourL, 0.6, 2, 1), std(0xf2f2ec, 0.6));
    stop.rotation.x = -Math.PI / 2;
    stop.position.set((ourL + p.ROAD.r - 1.6) / 2, 0.02, STREET_W / 2 + 2);
    g.add(stop);
    // Semáforo: columna en la banquina derecha y brazo sobre nuestros carriles.
    const steel = std(0x5d6670, 0.4, 0.6);
    const poleX = p.ROAD.r + 0.8, poleZ = STREET_W / 2 + 2.5;
    g.add(boxMesh(steel, 0.25, 6.2, 0.25, poleX, 3.1, poleZ));
    const armL = poleX - (ourL + 1.2);
    g.add(boxMesh(steel, armL, 0.16, 0.16, poleX - armL / 2, 6.0, poleZ));
    const lamps = {};
    const head = (x, y) => {
      g.add(boxMesh(std(0x1a1a1a, 0.7), 0.75, 2.1, 0.4, x, y, poleZ + 0.1));
      [['red', 0.65, 0xff2a1a], ['yellow', 0, 0xffc81a], ['green', -0.65, 0x2fd35a]].forEach(([k, dy, col]) => {
        const m = new THREE.MeshStandardMaterial({ color: 0x202020, emissive: col, emissiveIntensity: 0, roughness: 0.3 });
        const lamp = new THREE.Mesh(new THREE.CylinderGeometry(0.26, 0.26, 0.08, 14).rotateX(Math.PI / 2), m);
        lamp.position.set(x, y + dy, poleZ + 0.3);
        g.add(lamp);
        (lamps[k] = lamps[k] || []).push(m);
      });
    };
    head(ourL + 1.8, 4.9);         // colgado sobre los carriles
    head(poleX - 0.05, 3.3);       // en la columna, a la altura de la vista
    g.userData.setLight = (state) => {
      Object.entries(lamps).forEach(([k, ms]) => ms.forEach((m) => { m.emissiveIntensity = k === state ? 1.6 : 0; }));
    };
    g.userData.setLight('green');
    g.userData.stopZ = STREET_W / 2 + 2;    // línea de detención (z local; el ómnibus viene desde +z)
    g.userData.streetW = STREET_W;
    return g;
  }

  // ---------- Sierras al fondo (Sierra de las Ánimas, Cerro Pan de Azúcar) ----------
  function makeMountain(kind) {
    const g = new THREE.Group();
    const mat = (c) => new THREE.MeshStandardMaterial({ color: c, roughness: 1, flatShading: true, fog: false });
    const bump = (geo, amp) => {
      const p = geo.attributes.position;
      for (let i = 0; i < p.count; i++) {
        const y = p.getY(i);
        if (y > 0.5) {
          p.setX(i, p.getX(i) * (1 + (Math.random() - 0.5) * amp));
          p.setZ(i, p.getZ(i) * (1 + (Math.random() - 0.5) * amp));
          p.setY(i, y * (1 + (Math.random() - 0.5) * amp * 0.5));
        }
      }
      geo.computeVertexNormals();
      return geo;
    };
    if (kind === 'panDeAzucar') {
      // Cerro cónico con la cruz en la cima.
      const cone = new THREE.Mesh(bump(new THREE.ConeGeometry(120, 95, 14, 5).translate(0, 47.5, 0), 0.12), mat(0x5d7458));
      g.add(cone);
      const cross = mat(0xe8ecef);
      const v = new THREE.Mesh(G.box, cross); v.scale.set(1.4, 13, 1.4); v.position.y = 101;
      const h = new THREE.Mesh(G.box, cross); h.scale.set(7, 1.4, 1.4); h.position.y = 104;
      g.add(v, h);
    } else {
      // Sierra: varios cerros bajos y redondeados en hilera.
      for (let i = 0; i < 6; i++) {
        const r = 60 + Math.random() * 60, hgt = 30 + Math.random() * 35;
        const hill = new THREE.Mesh(bump(new THREE.SphereGeometry(1, 12, 6, 0, Math.PI * 2, 0, Math.PI / 2), 0.15), mat(i % 2 ? 0x617a5c : 0x58704f));
        hill.scale.set(r, hgt, r * 0.8);
        hill.position.set(i * 95 - 240 + Math.random() * 30, 0, Math.random() * 60);
        g.add(hill);
      }
    }
    g.traverse((o) => { if (o.isMesh) o.renderOrder = -1; });
    return g;
  }

  // ---------- Paradas ----------
  const stopZoneTex = canvasTex(128, 512, (c, W, H) => {
    c.fillStyle = 'rgba(242,183,5,0.28)';
    c.fillRect(0, 0, W, H);
    c.save();
    c.beginPath(); c.rect(6, 6, W - 12, H - 12); c.clip();
    c.strokeStyle = 'rgba(242,183,5,0.55)';
    c.lineWidth = 10;
    for (let k = -H; k < W + H; k += 34) { c.beginPath(); c.moveTo(k, 0); c.lineTo(k + H, H); c.stroke(); }
    c.restore();
    c.strokeStyle = '#f2b705';
    c.lineWidth = 8;
    c.strokeRect(4, 4, W - 8, H - 8);
    c.save();
    c.translate(W / 2, H / 2);
    c.fillStyle = 'rgba(0,0,0,0.6)';
    c.fillRect(-56, -26, 112, 52);
    c.fillStyle = '#f2b705';
    c.font = 'bold 28px Arial';
    c.textAlign = 'center';
    c.textBaseline = 'middle';
    c.fillText('PARADA', 0, 2);
    c.restore();
  });
  const stopZoneMat = new THREE.MeshStandardMaterial({ map: stopZoneTex, transparent: true, depthWrite: false, roughness: 0.8 });

  function makeStopZone() {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(3.4, 16, 1, 4), stopZoneMat);
    m.rotation.x = -Math.PI / 2;
    m.position.set(LANE_X[LANE_X.length - 1], 0.02, 0);
    m.renderOrder = 2;
    m.receiveShadow = true;
    return m;
  }

  function makeShelter(name) {
    const g = new THREE.Group();
    const metal = std(BRAND, 0.35, 0.6);
    const sidewalk = boxMesh(std(0xa7a49c, 0.95), 2.6, 0.2, 6, 0, 0.1, 0);
    sidewalk.receiveShadow = true;
    g.add(sidewalk);
    [[-0.9, -2.6], [-0.9, 2.6], [0.9, -2.6], [0.9, 2.6]].forEach(([x, z]) => g.add(boxMesh(metal, 0.12, 2.6, 0.12, x, 1.3, z)));
    g.add(boxMesh(new THREE.MeshStandardMaterial({ color: 0xcfe3f2, roughness: 0.05, metalness: 0.2, transparent: true, opacity: 0.35 }),
      0.05, 2.0, 5.2, 0.95, 1.3, 0));
    g.add(boxMesh(metal, 2.5, 0.14, 6.1, 0, 2.68, 0));
    g.add(boxMesh(std(0x6b5440, 0.9), 0.5, 0.08, 3.5, 0.55, 0.65, 0));                  // banco
    const label = new THREE.Sprite(new THREE.SpriteMaterial({
      map: textTex(name, { w: 256, h: 64, bg: '#f2b705', color: '#10202a', font: `bold ${name.length > 12 ? 25 : name.length > 9 ? 29 : 34}px Arial` }), depthWrite: false
    }));
    label.scale.set(4, 1, 1);
    label.position.set(0, 4.0, 0);
    label.userData.ownTex = true;
    g.add(label);
    return g;
  }

  const SHIRTS = [0xc0392b, 0x2e6da4, 0x2e8b57, 0xe0b31c, 0x7d4e9e, 0xd9822b, 0xeeeeee];
  const SKIN = [0xe0ac80, 0xc68b62, 0x8d5a3b, 0xf1c8a5].map((c) => std(c, 0.7));
  function makePerson() {
    const g = new THREE.Group();
    g.add(mesh(G.person, std(pick([0x2c3e50, 0x34495e, 0x4b4b4b, 0x1f3a5f]), 0.9), 0, 0.42, 0, 0.9, 0.75, 0.9)); // pantalón
    g.add(mesh(G.person, std(pick(SHIRTS), 0.85), 0, 1.05, 0, 1, 0.55, 1));
    g.add(mesh(G.head, pick(SKIN), 0, 1.52, 0));
    return g;
  }

  // ---------- Pickups ----------
  function makeMate() {
    const g = new THREE.Group();
    g.add(mesh(G.blobby, std(0x7b4a24, 0.5), 0, 0, 0, 0.45, 0.5, 0.45));
    g.add(mesh(new THREE.CylinderGeometry(0.28, 0.28, 0.06, 14), std(0x6aa83a, 0.9), 0, 0.42, 0));
    const straw = boxMesh(std(0xd8d8d8, 0.2, 1), 0.05, 0.8, 0.05, 0.15, 0.7, 0);
    straw.rotation.z = -0.35;
    g.add(straw);
    return g;
  }

  function makeParcel() {
    const g = new THREE.Group();
    g.add(boxMesh(std(0xb98a4f, 0.9), 0.9, 0.7, 0.9));
    g.add(boxMesh(std(BRAND, 0.5), 0.92, 0.15, 0.92));
    g.add(boxMesh(std(0x9c7140, 0.8), 0.15, 0.72, 0.92));
    return g;
  }

  // ---------- Llegada ----------
  function makeTerminal(name = 'TERMINAL') {
    const g = new THREE.Group();
    const finishTex = canvasTex(256, 32, (c, W, H) => {
      for (let x = 0; x < W; x += 16) for (let y = 0; y < H; y += 16) {
        c.fillStyle = ((x + y) / 16) % 2 ? '#111' : '#fff';
        c.fillRect(x, y, 16, 16);
      }
    });
    const { ROAD } = P;
    const cx = (ROAD.l + ROAD.r) / 2, half = (ROAD.r - ROAD.l) / 2;
    const line = new THREE.Mesh(new THREE.PlaneGeometry(7.2, 1.6), new THREE.MeshStandardMaterial({ map: finishTex, roughness: 0.7 }));
    line.rotation.x = -Math.PI / 2;
    line.position.y = 0.03;
    g.add(line);
    const steel = std(0x5d6670, 0.35, 0.8);
    g.add(boxMesh(steel, 0.4, 7, 0.4, ROAD.l, 3.5, 0), boxMesh(steel, 0.4, 7, 0.4, ROAD.r, 3.5, 0));
    const banner = new THREE.Mesh(new THREE.PlaneGeometry(half * 2, 1.8), new THREE.MeshStandardMaterial({
      map: textTex(name, { w: 1024, h: 144, bg: '#1b4f9c', font: `bold ${half < 6 ? 72 : 62}px Arial` }), roughness: 0.5
    }));
    banner.position.set(cx, 6.2, 0);
    banner.userData.ownTex = true;
    g.add(banner);
    return g;
  }

  // ---------- Ómnibus ----------
  // Skins: la librea se pinta por posición en un shader, con colores y logo por skin.
  // Para agregar una skin nueva: sumar una entrada con available: true, sus colores y su logo.
  const SKINS = [
    {
      id: 'cot', name: 'COT Primera Clase', available: true, logo: 'cot', number: '986',
      colors: { white: '#f2f2f0', orange: '#f26b1d', red: '#c9201a', yellow: '#f7b80f', black: '#0a0b0d' }
    },
    {
      // Plantilla de pintura (Proton Bus Simulator) proyectada desde cada lado. Píxeles de la imagen
      // original (3000 px). Cada costado se calibró haciendo coincidir sus ventanas con las del modelo.
      id: 'cot925', name: 'COT 925', available: true, tex: 'cot925',
      proj: {
        left: [14, 2998, 8, 756],        // costado izquierdo: x del frente, x de la cola, y del techo, y del faldón
        right: [2986, 0, 1298, 2052],    // costado derecho (el frente queda a la derecha de la imagen)
        sideY: [3.8, 0.33],              // altura real del techo y del faldón en esos paneles
        roof: [2888, 22, 778, 1288],     // techo: x del frente, x de la cola, y del lado izquierdo, y del derecho
        rear: [2280, 2998, 2040, 2808],  // cola vista de atrás: x izquierda, x derecha, y arriba, y abajo
        rearY: [3.62, 0.62],
        front: [2288, 1528, 2140, 2754, 2985],   // frente visto de frente: x izq., x der., filas: arriba, fin del parabrisas, abajo
        frontY: [3.75, 1.55, 0.35]
      }
    },
  ];
  // Plantilla hecha desde NUESTRO modelo (assets/plantilla-omnibus/): vistas ortográficas exactas, así
  // lo que se pinta encima calza justo. Para una skin nueva: { id, name, available: true, tex: id, proj: PLANTILLA }.
  const PLANTILLA = {
    left: [0, 3000, 0, 900], right: [3000, 0, 900, 1800], sideY: [4.3, 0],
    roof: [0, 3000, 2400, 1800],
    rear: [0, 700, 2400, 3000], rearY: [4.0, 0.3],
    front: [800, 1500, 2400, 2700, 3000], frontY: [4.0, 2.15, 0.3]
  };
  // Skins extra (src3d/skins/*.js las agregan con World3D.addSkin antes de que cargue el juego).
  (window.EXTRA_SKINS || []).forEach((s) => SKINS.push({ available: true, proj: PLANTILLA, ...s }));
  const LOCKED_COLORS = { white: '#c9cdd1', orange: '#b4b9be', red: '#a7acb2', yellow: '#bfc3c7', black: '#15171a' };

  function cotLogoTex() {
    return canvasTex(1024, 256, (c, W, H) => {
      c.clearRect(0, 0, W, H);
      c.save();
      c.transform(1, 0, -0.22, 1, 40, 0);                  // itálica
      c.fillStyle = '#f26b1d';
      c.font = 'bold 230px Arial Black, Arial, sans-serif';
      c.textBaseline = 'middle';
      c.fillText('COT', 40, H / 2 + 10);
      c.fillStyle = '#8a8a8a';
      c.font = 'italic 64px Georgia, serif';
      c.fillText('1° Clase', 640, H / 2 + 70);
      c.restore();
    });
  }
  const LOGOS = { cot: cotLogoTex };

  // Imágenes de skins (window.SKIN_TEX, cargadas desde src3d/skinXXX.js). Se cargan una vez.
  const skinTexCache = {};
  function skinTex(id, onReady) {
    if (skinTexCache[id]) {
      if (onReady) { if (skinTexCache[id].image && skinTexCache[id].image.width) onReady(); else skinTexCache[id].userData.wait.push(onReady); }
      return skinTexCache[id];
    }
    const src = window.SKIN_TEX && window.SKIN_TEX[id];
    if (!src) return null;
    const t = new THREE.TextureLoader().load(src, () => { t.userData.wait.forEach((f) => f()); t.userData.wait = []; });
    t.userData.wait = onReady ? [onReady] : [];
    t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = 8;
    return (skinTexCache[id] = t);
  }
  const logoCache = {};

  // Malla de la luneta que sigue la curva de la cola: por cada columna se lanza un rayo
  // desde atrás al borde de abajo y al de arriba del vidrio, y se interpola entre los dos
  // (en el medio está el hueco de la ventana, así que no se usan rayos ahí).
  function conformRearGlass(model, { halfW, y0, y1, yTop = y1, gap = 0.025, cols = 20, rows = 6 }) {
    model.updateMatrixWorld(true);
    const ray = new THREE.Raycaster();
    const dir = new THREE.Vector3(0, 0, -1);
    const hitZ = (x, y) => {
      ray.set(new THREE.Vector3(x, y, 20), dir);
      const h = ray.intersectObject(model, true)[0];
      return h && h.point.z > 5 ? h.point.z : null;
    };
    const columns = [];
    for (let i = 0; i <= cols; i++) {
      const x = -halfW + (2 * halfW * i) / cols;
      const zb = hitZ(x, y0), zt = hitZ(x, y1);
      if (zb !== null && zt !== null) columns.push({ x, zb, zt });
    }
    if (columns.length < 2) return null;
    const pos = [], uv = [], idx = [];
    // Hasta y1 sigue la curva; de y1 a yTop sube recto para tapar el espacio bajo el alero.
    const ys = [];
    for (let j = 0; j <= rows; j++) ys.push(y0 + (y1 - y0) * (j / rows));
    if (yTop > y1) ys.push(yTop);
    columns.forEach(({ x, zb, zt }) => {
      ys.forEach((y) => {
        const t = Math.min(1, (y - y0) / (y1 - y0));
        pos.push(x, y, zb + (zt - zb) * t + gap);
        uv.push((x + halfW) / (2 * halfW), (y - y0) / (y1 - y0));
      });
    });
    rows = ys.length - 1;
    for (let i = 0; i < columns.length - 1; i++) {
      for (let j = 0; j < rows; j++) {
        const a = i * (rows + 1) + j, b = a + rows + 1;
        idx.push(a, b, b + 1, a, b + 1, a + 1);
      }
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    geo.setIndex(idx);
    geo.computeVertexNormals();
    return geo;
  }

  // Tubo cerrado a partir de los radios de BUS_MODEL_INFO.hull (secciones a lo largo de z).
  // tail: sección extra al final (m). rearClip [y, z]: arriba de y, la cola no pasa de z (queda detrás de la luneta).
  function hullGeometry({ yc, na, z0, dz, r, tail = 0, rearClip = null }) {
    const pos = [], idx = [];
    if (tail) r = [...r, r[r.length - 1].map((v) => v * 0.96)];
    const zAt = (s) => (s < r.length - 1 || !tail ? z0 + s * dz : z0 + (s - 1) * dz + tail);
    r.forEach((row, s) => {
      const z = zAt(s);
      row.forEach((cm, k) => {
        const a = (k / na) * Math.PI * 2, d = cm / 100;
        const y = yc + Math.sin(a) * d;
        pos.push(Math.cos(a) * d, y, rearClip && y > rearClip[0] ? Math.min(z, rearClip[1]) : z);
      });
    });
    const S = r.length;
    for (let s = 0; s < S - 1; s++) {
      for (let k = 0; k < na; k++) {
        const a = s * na + k, b = s * na + ((k + 1) % na), c = a + na, d = b + na;
        idx.push(a, c, b, b, c, d);
      }
    }
    // Tapas en las puntas (abanico desde el eje).
    [[0, -1], [S - 1, 1]].forEach(([s, dir]) => {
      const ci = pos.length / 3;
      pos.push(0, yc, zAt(s));
      for (let k = 0; k < na; k++) {
        const a = s * na + k, b = s * na + ((k + 1) % na);
        if (dir > 0) idx.push(ci, a, b); else idx.push(ci, b, a);
      }
    });
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    geo.setIndex(idx);
    geo.computeVertexNormals();
    return geo;
  }

  // Vidrio trasero oscuro con el logo encima (COT grande y "1° Clase" debajo).
  const rearGlassCache = {};
  function rearGlassTex(logo) {
    if (rearGlassCache[logo]) return rearGlassCache[logo];
    if (!logoCache[logo]) logoCache[logo] = LOGOS[logo]();
    const src = logoCache[logo].image;
    return (rearGlassCache[logo] = canvasTex(512, 256, (c, W, H) => {
      c.fillStyle = '#0d141c';
      c.fillRect(0, 0, W, H);
      c.drawImage(src, 0, 20, 615, 216, 120, 22, 330, 116);    // "COT" grande, como en la foto ("1° Clase" va en la chapa)
    }));
  }

  // Calcos de la cola sobre la chapa (foto trasera): "1° Clase" bajo la luneta, número del coche a los
  // costados y disco de velocidad máxima. Lienzo = cola de x -1,14 a 1,14 m y de h 2,4 (arriba) a 1,2 m.
  const rearDecalCache = {};
  function rearDecalTex(number) {
    if (rearDecalCache[number]) return rearDecalCache[number];
    return (rearDecalCache[number] = canvasTex(512, 270, (c, W, H) => {
      c.clearRect(0, 0, W, H);
      const yAt = (h) => ((2.4 - h) / 1.2) * H;
      c.save();
      c.fillStyle = '#3a3a3a';
      c.font = 'italic 34px Georgia, serif';
      c.textAlign = 'center';
      c.textBaseline = 'middle';
      c.fillText('1° Clase', W * 0.55, yAt(2.23));
      c.fillStyle = '#ffffff';
      c.font = 'bold 30px Arial';
      c.fillText(number, W * 0.2, yAt(1.78));
      c.fillText(number, W * 0.8, yAt(1.78));
      c.beginPath(); c.arc(W * 0.8, yAt(1.47), 20, 0, Math.PI * 2);
      c.fillStyle = '#ffffff'; c.fill();
      c.lineWidth = 6; c.strokeStyle = '#d01818'; c.stroke();
      c.fillStyle = '#111'; c.font = 'bold 20px Arial';
      c.fillText('90', W * 0.8, yAt(1.47) + 1);
      c.restore();
    }));
  }

  // Recorta de la plantilla de una skin la zona de la luneta, con la misma cuenta que usa el shader.
  const rearCropCache = {};
  function rearCropTex(skin, rg) {
    if (rearCropCache[skin.id]) return rearCropCache[skin.id];
    const img = skinTexCache[skin.tex] && skinTexCache[skin.tex].image;
    if (!img || !img.width) return null;
    const pr = skin.proj, k = img.width / 3000, g = rg || { halfW: 1.05, y0: 2.5, y1: 3.4 };
    const px = (x) => (pr.rear[0] + ((x + 1.14) / 2.28) * (pr.rear[1] - pr.rear[0])) * k;
    const py = (h) => (pr.rear[2] + ((pr.rearY[0] - h) / (pr.rearY[0] - pr.rearY[1])) * (pr.rear[3] - pr.rear[2])) * k;
    return (rearCropCache[skin.id] = canvasTex(512, 256, (c, W, H) => {
      c.drawImage(img, px(-g.halfW), py(g.y1), px(g.halfW) - px(-g.halfW), py(g.y0) - py(g.y1), 0, 0, W, H);
    }));
  }

  // Coordenadas del modelo preparado: metros, frente en -Z, ruedas en y = 0, +X = lado derecho (puerta).
  function liveryMaterial(len) {
    const mat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.28, metalness: 0.25 });
    const uniforms = {
      uBusLen: { value: len },
      uLogo: { value: null },
      uLogoOn: { value: 0 },
      uRearDecal: { value: null },
      uRearDecalOn: { value: 0 },
      uLogoZR: { value: new THREE.Vector2(-2.6, 1.6) },   // lado derecho: al medio
      uLogoZL: { value: new THREE.Vector2(-4.3, -0.5) },  // lado izquierdo: detrás de la rueda delantera
      uLogoY: { value: new THREE.Vector2(1.38, 2.32) },
      uBrake: { value: 0 },
      uTexMode: { value: 0 },
      uSkin: { value: null },
      uTL: { value: new THREE.Vector4() }, uTR: { value: new THREE.Vector4() }, uSideY: { value: new THREE.Vector2() },
      uTRoof: { value: new THREE.Vector4() }, uTRear: { value: new THREE.Vector4() }, uRearY: { value: new THREE.Vector2() },
      uTFront: { value: new THREE.Vector2() }, uFrontRows: { value: new THREE.Vector3() }, uFrontY: { value: new THREE.Vector3() },
      uWhite: { value: new THREE.Color() },
      uOrange: { value: new THREE.Color() },
      uRed: { value: new THREE.Color() },
      uYellow: { value: new THREE.Color() },
      uBlack: { value: new THREE.Color() }
    };
    mat.onBeforeCompile = (sh) => {
      Object.assign(sh.uniforms, uniforms);
      sh.vertexShader = 'varying vec3 vBusPos;\nvarying vec3 vBusNormal;\n' + sh.vertexShader.replace(
        '#include <begin_vertex>', '#include <begin_vertex>\nvBusPos = position;\nvBusNormal = normal;');
      sh.fragmentShader = `varying vec3 vBusPos;
varying vec3 vBusNormal;
uniform float uBusLen;
uniform sampler2D uLogo;
uniform float uLogoOn;
uniform sampler2D uRearDecal;
uniform float uRearDecalOn;
uniform vec2 uLogoZR;
uniform vec2 uLogoZL;
uniform vec2 uLogoY;
uniform float uBrake;
uniform vec3 uWhite;
uniform vec3 uOrange;
uniform vec3 uRed;
uniform vec3 uYellow;
uniform vec3 uBlack;
uniform float uTexMode;
uniform sampler2D uSkin;
uniform vec4 uTL;
uniform vec4 uTR;
uniform vec2 uSideY;
uniform vec4 uTRoof;
uniform vec4 uTRear;
uniform vec2 uRearY;
uniform vec2 uTFront;
uniform vec3 uFrontRows;
uniform vec3 uFrontY;
vec3 skinPx(float x, float y) { return texture2D(uSkin, vec2(x / 3000.0, 1.0 - y / 3000.0)).rgb; }
vec3 overlay(vec3 col, vec2 uv) {
  if (uLogoOn < 0.5 || uv.x <= 0.0 || uv.x >= 1.0 || uv.y <= 0.0 || uv.y >= 1.0) return col;
  vec4 t = texture2D(uLogo, uv);
  return mix(col, t.rgb, t.a);
}
` + sh.fragmentShader
        .replace('vec4 diffuseColor = vec4( diffuse, opacity );', `vec4 diffuseColor = vec4( diffuse, opacity );
float glassMask = 0.0;
float lightMask = 0.0;
float headMask = 0.0;
{
  vec3 p = vBusPos;
  vec3 nrm = normalize(vBusNormal);
  float u = (p.z + uBusLen * 0.5) / uBusLen;   // 0 = frente, 1 = cola
  float h = p.y;
  float side = step(0.5, abs(nrm.x));
  // Cola por posición (no por normal): las esquinas inclinadas no cambian de regla a mitad de camino.
  float rearFace = step(0.965, u) * step(-0.2, nrm.z);
  vec3 col = uWhite;
  if (uTexMode > 0.5) {
    // Skin con imagen: cada cara toma el color del panel que la mira (costado, techo, cola o frente).
    float uu = clamp(u, 0.0, 0.95);                   // el borde de atrás de la plantilla es el contorno: no se usa
    float fv = clamp((uSideY.x - h) / (uSideY.x - uSideY.y), 0.0, 1.0);
    if (rearFace > 0.5) {
      // La cola del modelo es más angosta que la de la plantilla: se usa el ancho de la cola (±1,14 m).
      float rx = clamp((p.x + 1.14) / 2.28, 0.03, 0.97);   // sin el contorno del borde de la plantilla
      float rv = clamp((uRearY.x - h) / (uRearY.x - uRearY.y), 0.0, 1.0);
      col = skinPx(mix(uTRear.x, uTRear.y, rx), mix(uTRear.z, uTRear.w, rv));
    } else if (u < 0.045 && nrm.z < -0.35) {
      float fx = clamp((1.28 - p.x) / 2.56, 0.0, 1.0);
      float row = h > uFrontY.y
        ? mix(uFrontRows.x, uFrontRows.y, clamp((uFrontY.x - h) / (uFrontY.x - uFrontY.y), 0.0, 1.0))
        : mix(uFrontRows.y, uFrontRows.z, clamp((uFrontY.y - h) / (uFrontY.y - uFrontY.z), 0.0, 1.0));
      col = skinPx(mix(uTFront.x, uTFront.y, fx), row);
    } else if (nrm.y > 0.75 && h > 3.5) {
      col = skinPx(mix(uTRoof.x, uTRoof.y, uu), mix(uTRoof.z, uTRoof.w, clamp((p.x + 1.28) / 2.56, 0.0, 1.0)));
    } else if (p.x < 0.0) {
      col = skinPx(mix(uTL.x, uTL.y, uu), mix(uTL.z, uTL.w, fv));
    } else {
      col = skinPx(mix(uTR.x, uTR.y, uu), mix(uTR.z, uTR.w, fv));
    }
    // Lo negro de la plantilla son vidrios: brillantes. (El marrón es oscuro pero no negro.)
    float lum = dot(col, vec3(0.3, 0.59, 0.11));
    glassMask = (1.0 - smoothstep(0.003, 0.012, lum)) * step(1.5, h) * step(h, 3.75);
    if (u < -0.004 && h > 1.9) col = vec3(0.015);                     // espejos negros
    // Alero sobre la luneta (unión del techo con la cola): con el color del techo. Si no, toma el borde
    // de la vista lateral de la plantilla (vidrio negro) estirado en la esquina.
    if (u > 0.93 && h > 3.45) { col = skinPx(mix(uTRoof.x, uTRoof.y, 0.9), mix(uTRoof.z, uTRoof.w, 0.5)); glassMask = 0.0; }
    // El alero en sí (u > 0,95) va de vidrio negro, como una visera que sigue a la luneta; solo lo que mira
    // al cielo queda del color del techo. Pintado entero del techo, sus triángulos sueltos (el modelo está
    // roto en esa unión) se veían como una franja blanca y gris rota sobre la luneta.
    // Desde u > 0,96 va negro todo, también lo que mira al cielo: así el techo termina en un borde parejo
    // y las puntas sueltas de las esquinas quedan dentro de lo negro (de costado parece vidrio envolvente).
    if (u > 0.95 && h > 3.3 && (nrm.y <= 0.5 || u > 0.96)) { col = vec3(0.0); glassMask = 1.0; }
  } else {
  // Costados: zona naranja-roja que sube hacia atrás, filete blanco y franja amarilla.
  float B = 0.62 + smoothstep(0.22, 0.9, u) * 1.6;
  float Y = B + 0.06 + mix(0.1, 0.3, smoothstep(0.15, 0.7, u));
  if (h < Y) col = uYellow;
  if (h < B + 0.06) col = uWhite;
  if (h < B) col = mix(uOrange, uRed, smoothstep(0.45, 1.0, u));
  if (u < 0.05 && h < 1.05) col = uOrange;                          // paragolpes
  // Parante trasero rojo (las ventanas terminan antes de la cola).
  if (u > 0.93 && h > 2.2) col = uRed;
  // Vidrios: banda lateral y parabrisas.
  float win = step(2.3, h) * step(h, 3.4) * step(0.115, u) * step(u, 0.93) * side;
  float wind = step(u, 0.115) * step(1.55, h) * step(h, 3.62);
  // Cola (foto trasera): toda roja, luneta grande, ranura negra, franja amarilla y blanca abajo a la derecha.
  float rearWin = rearFace * step(2.4, h) * step(h, 3.55) * step(abs(p.x), 1.12);
  if (rearFace > 0.5) {
    col = mix(uOrange, uRed, 0.8);
    float sx = (p.x + 1.25) / 2.5;                                     // 0 = izquierda, 1 = derecha (vista de atrás)
    float sw = 0.35 + sx * 1.05;
    if (sx > 0.6 && h > 0.62 && h < sw && h > sw - 0.3) col = uYellow;
    if (sx > 0.6 && h > 0.62 && h <= sw - 0.3 && h > sw - 0.38) col = uWhite;
    if (abs(p.x) < 0.34 && h > 0.55 && h < 0.9) col = vec3(0.8, 0.8, 0.78);   // patente
    if (h < 0.62) col = vec3(0.012, 0.013, 0.015);                     // paragolpes y patente oscuros
    if (h > 1.93 && h < 2.1 && abs(p.x) < 0.78) col = uBlack;          // ranura bajo la luneta
    vec2 dv = vec2((p.x + 1.14) / 2.28, (h - 1.2) / 1.2);
    if (uRearDecalOn > 0.5 && dv.x > 0.0 && dv.x < 1.0 && dv.y > 0.0 && dv.y < 1.0) {
      vec4 dc = texture2D(uRearDecal, dv);
      col = mix(col, dc.rgb, dc.a);
    }
  }
  // Hueco sobre la luneta (hasta el alero): mismo negro brillante, así se ve una luneta continua.
  float rearTop = step(0.95, u) * step(3.1, h) * step(h, 3.66) * step(abs(p.x), 1.1);
  glassMask = max(max(win, wind), max(rearWin, rearTop));
  col = mix(col, uBlack, glassMask);
  // Línea del techo: naranja que pasa a rojo hacia atrás.
  if (h > 3.38 && h < 3.6 && abs(nrm.x) > 0.3 && u < 0.92) col = mix(uOrange, uRed, smoothstep(0.5, 1.0, u));
  if (u > 0.9 && h > 3.3 && nrm.y < 0.8 && rearTop < 0.5) col = uRed;               // alero trasero rojo parejo
  if (u < -0.004 && h > 1.9) col = uOrange;                          // espejos
  // Logo en los costados (se lee de izquierda a derecha de los dos lados). El de atrás va en el vidrio.
  if (abs(nrm.x) > 0.6) {
    vec2 zr = nrm.x > 0.0 ? uLogoZR : uLogoZL;
    float lu = (p.z - zr.x) / (zr.y - zr.x);
    if (nrm.x > 0.0) lu = 1.0 - lu;
    col = overlay(col, vec2(lu, (h - uLogoY.x) / (uLogoY.y - uLogoY.x)));
  }
  }
#ifdef IS_HULL
  if (u > 0.9 && h > 1.95 && h < 3.7 && uTexMode < 0.5) { col = vec3(0.004, 0.005, 0.006); glassMask = 1.0; }
  // Con skin de imagen, lo que asoma por la unión del techo y la cola va oscuro, como la sombra del alero:
  // pintado del color del techo, sus triángulos sueltos se veían blancos sobre la luneta (parecía roto).
  if (uTexMode > 0.5 && u > 0.9 && h > 3.45) { col = vec3(0.012, 0.013, 0.015); glassMask = 0.0; }
#endif
  // Luces traseras verticales en las esquinas y faros delanteros.
  lightMask = rearFace * step(0.9, abs(p.x)) * step(0.85, h) * step(h, 2.15);
  headMask = step(u, 0.03) * step(nrm.z, -0.5) * step(0.8, h) * step(h, 1.12) * step(0.62, abs(p.x));
  col = mix(col, vec3(0.16, 0.003, 0.002), lightMask);
  col = mix(col, vec3(0.78, 0.82, 0.88), headMask);
  diffuseColor.rgb = col;
}`)
        .replace('#include <roughnessmap_fragment>', '#include <roughnessmap_fragment>\nroughnessFactor = mix(roughnessFactor, 0.05, glassMask);')
        .replace('#include <metalnessmap_fragment>', '#include <metalnessmap_fragment>\nmetalnessFactor = mix(metalnessFactor, 0.7, glassMask);')
        .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
totalEmissiveRadiance += lightMask * mix(vec3(0.25, 0.0, 0.0), vec3(3.0, 0.15, 0.08), uBrake);
totalEmissiveRadiance += headMask * vec3(0.6);`);
    };

    // Cambia colores y logo sin recompilar el shader.
    mat.userData.setSkin = (id) => {
      const skin = SKINS.find((s) => s.id === id) || SKINS[0];
      const pr = skin.available && skin.tex && skinTex(skin.tex) ? skin.proj : null;
      uniforms.uTexMode.value = pr ? 1 : 0;
      if (pr) {
        uniforms.uSkin.value = skinTex(skin.tex);
        uniforms.uTL.value.set(...pr.left);
        uniforms.uTR.value.set(...pr.right);
        uniforms.uSideY.value.set(...pr.sideY);
        uniforms.uTRoof.value.set(...pr.roof);
        uniforms.uTRear.value.set(...pr.rear);
        uniforms.uRearY.value.set(...pr.rearY);
        uniforms.uTFront.value.set(pr.front[0], pr.front[1]);
        uniforms.uFrontRows.value.set(pr.front[2], pr.front[3], pr.front[4]);
        uniforms.uFrontY.value.set(...pr.frontY);
      }
      const colors = skin.available && skin.colors ? skin.colors : LOCKED_COLORS;
      ['white', 'orange', 'red', 'yellow', 'black'].forEach((k) => {
        uniforms['u' + k[0].toUpperCase() + k.slice(1)].value.set(colors[k]);
      });
      const logo = skin.available && skin.logo && LOGOS[skin.logo];
      if (logo && !logoCache[skin.logo]) logoCache[skin.logo] = logo();
      uniforms.uLogo.value = logo ? logoCache[skin.logo] : null;
      uniforms.uRearDecal.value = skin.number ? rearDecalTex(skin.number) : null;
      uniforms.uRearDecalOn.value = skin.number ? 1 : 0;
      uniforms.uLogoOn.value = logo ? 1 : 0;
    };
    mat.userData.setSkin(SKINS[0].id);
    mat.userData.uniforms = uniforms;
    return mat;
  }

  // Carga el modelo embebido (BUS_GLB_BASE64). Un modelo genérico se escala a 12 m y se le
  // agregan franjas y logos; uno preparado (BUS_MODEL_INFO.prepared) se usa tal cual con la librea.
  function loadBus(onReady) {
    const info = (typeof BUS_MODEL_INFO !== 'undefined' && BUS_MODEL_INFO) || {};
    const root = new THREE.Group();
    const finish = (model, len, halfW, liveryMat) => {
      root.add(model);
      root.add(blob(halfW * 2 + 1.2, len + 1.6));
      root.traverse((o) => { if (o.isMesh && !o.userData.isBlob) o.castShadow = true; });
      // Ninguna pieza del ómnibus se deforma con las curvas (bend3d.js), igual que la carrocería
      // (que tiene su propio shader): si no, en lomas y curvas la luneta, las ruedas y las molduras
      // se corren respecto de la carrocería. Se clonan porque materiales como TIRE los comparten los autos.
      const keepStraight = function () { /* ómnibus: sin deformar */ };
      const cloned = new Map();
      root.traverse((o) => {
        if (!o.isMesh || o.userData.isBlob || o.material.onBeforeCompile !== THREE.Material.prototype.onBeforeCompile) return;
        if (!cloned.has(o.material)) {
          const m = o.material.clone();
          m.onBeforeCompile = keepStraight;
          cloned.set(o.material, m);
          if (liveryMat && liveryMat.userData.rearGlass === o.material) liveryMat.userData.rearGlass = m;
        }
        o.material = cloned.get(o.material);
      });
      if (liveryMat) {
        const u = liveryMat.userData.uniforms;
        root.userData = {
          len, halfW,
          setBrake: (on) => { u.uBrake.value = on ? 1 : 0; },
          setSkin: (id) => {
            liveryMat.userData.setSkin(id);
            const rg = liveryMat.userData.rearGlass;
            if (rg) {
              const skin = SKINS.find((s) => s.id === id) || SKINS[0];
              rg.map = skin.available && skin.logo ? rearGlassTex(skin.logo) : null;
              if (skin.available && skin.tex) {
                rg.map = rearCropTex(skin, info.rearGlass);
                // Si la imagen todavía no cargó, se vuelve a aplicar cuando esté.
                if (!rg.map) skinTex(skin.tex, () => root.userData.setSkin(id));
              }
              rg.color.set(rg.map ? 0xffffff : 0x0d141c);
              rg.needsUpdate = true;
            }
          }
        };
        root.userData.setSkin(SKINS[0].id);
        onReady(root);
        return;
      }
      {
        // Franjas y logos COT sobre la carrocería genérica.
        const stripeLen = len * 0.82;
        [-1, 1].forEach((side) => {
          const x = side * (halfW + 0.012);
          root.add(boxMesh(paint(BRAND), 0.02, 0.22, stripeLen, x, 0.95, 0.4));
          root.add(boxMesh(paint(ACCENT), 0.02, 0.08, stripeLen, x, 0.78, 0.4));
          const logo = new THREE.Mesh(new THREE.PlaneGeometry(2.4, 0.6), new THREE.MeshStandardMaterial({
            map: textTex('COT', { w: 256, h: 64, bg: '#ffffff', color: '#1b4f9c', font: 'bold 52px Arial' }), roughness: 0.4
          }));
          logo.position.set(x + side * 0.01, 1.45, 2.6);
          logo.rotation.y = side * Math.PI / 2;
          root.add(logo);
        });
      }
      const rear = new THREE.Mesh(new THREE.PlaneGeometry(1.8, 0.5), new THREE.MeshStandardMaterial({
        map: textTex('COT', { w: 256, h: 64, bg: '#1b4f9c', color: '#ffffff', font: 'bold 50px Arial' }), roughness: 0.4
      }));
      rear.position.set(0, info.rearLogoY || 1.0, len / 2 + 0.03);
      root.add(rear);
      const brakeMat = new THREE.MeshStandardMaterial({ color: 0x661010, emissive: 0x220000, roughness: 0.4 });
      const ly = info.brakeY || 0.75;
      root.add(boxMesh(brakeMat, 0.5, 0.25, 0.05, -halfW + 0.45, ly, len / 2 + 0.03));
      root.add(boxMesh(brakeMat, 0.5, 0.25, 0.05, halfW - 0.45, ly, len / 2 + 0.03));
      root.userData = { len, halfW, setBrake: (on) => brakeMat.color.setHex(on ? 0xff2a1a : 0x661010), setSkin: () => {} };
      root.traverse((o) => { if (o.isMesh && !o.userData.isBlob) o.castShadow = true; });
      onReady(root);
    };

    const fallback = () => {
      const m = new THREE.Group();
      m.add(boxMesh(paint(0xfbfbfb), 2.6, 3.1, 12, 0, 1.9, 0));
      m.add(boxMesh(GLASS, 2.62, 0.9, 10, 0, 2.6, 0.3));
      finish(m, 12, 1.3);
    };

    try {
      const bytes = Uint8Array.from(atob(BUS_GLB_BASE64), (c) => c.charCodeAt(0));
      new THREE.GLTFLoader().parse(bytes.buffer, '', (gltf) => {
        const model = gltf.scene;
        if (info.prepared) {
          const len = info.length || 12;
          const livery = info.livery === 'cot' ? liveryMaterial(len) : paint(0xf4f4f2);
          const grille = std(0x141517, 0.7, 0.15);   // molduras: poco brillo (de cerca se ven facetadas)
          model.traverse((o) => {
            if (!o.isMesh) return;
            const name = o.material.name || '';
            if (/tyre|borracha/i.test(name)) o.material = TIRE;
            else if (/rendergrade/i.test(name)) o.material = grille;
            else if (/vidro/i.test(name)) o.material = GLASS;
            else o.material = livery;
          });
          // Vidrios que el modelo no trae (sin ellos se ve el hueco hacia el interior).
          // Cada vidrio es un cuadrilátero [abajo-izq, abajo-der, arriba-der, arriba-izq] en metros.
          // La luneta (z > 0) lleva el logo de la skin sobre el vidrio, como en la foto trasera.
          const glassMat = GLASS.clone();
          glassMat.side = THREE.DoubleSide;
          const rearGlassMat = glassMat.clone();
          rearGlassMat.color.set(0xffffff);
          // Siempre por delante de la carrocería que tiene detrás (evita el parpadeo en los bordes).
          rearGlassMat.polygonOffset = true;
          rearGlassMat.polygonOffsetFactor = -2;
          rearGlassMat.polygonOffsetUnits = -2;
          // La luneta se calca sobre la cola (curva) antes de agregar vidrios y rellenos,
          // así los rayos solo tocan la carrocería.
          if (info.rearGlass) {
            const rg = conformRearGlass(model, info.rearGlass);
            if (rg) model.add(new THREE.Mesh(rg, rearGlassMat));
          }
          // Segunda piel interior con la misma librea: tapa los agujeros del modelo.
          // Usa los mismos uniforms (cambia de skin junto con la carrocería); IS_HULL pinta de vidrio
          // la tapa trasera a la altura de la ventana, que en el modelo baja más que la luneta.
          if (info.hull) {
            const hullMat = livery.clone();
            hullMat.onBeforeCompile = livery.onBeforeCompile;
            hullMat.defines = { IS_HULL: 1 };
            hullMat.side = THREE.DoubleSide;
            model.add(new THREE.Mesh(hullGeometry(info.hull), hullMat));
            // Bloques oscuros extra por dentro (el paragolpes baja más que la segunda piel).
            (info.hullBoxes || []).forEach(([x0, x1, y0, y1, z0, z1]) => {
              const m = new THREE.Mesh(G.box, std(0x0b0c0e, 0.8));
              m.scale.set(x1 - x0, y1 - y0, z1 - z0);
              m.position.set((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2);
              model.add(m);
            });
          }
          (info.glass || []).forEach((q) => {
            const geo = new THREE.BufferGeometry();
            geo.setAttribute('position', new THREE.Float32BufferAttribute(q.flat(), 3));
            geo.setAttribute('uv', new THREE.Float32BufferAttribute([0, 0, 1, 0, 1, 1, 0, 1], 2));
            geo.setIndex([0, 1, 2, 0, 2, 3]);
            geo.computeVertexNormals();
            model.add(new THREE.Mesh(geo, q[0][2] > 0 ? rearGlassMat : glassMat));
          });
          if (info.livery === 'cot') livery.userData.rearGlass = rearGlassMat;
          const box = new THREE.Box3().setFromObject(model);
          finish(model, len, (box.max.x - box.min.x) / 2 * 0.95, info.livery === 'cot' ? livery : null);
          return;
        }
        // Pasar a PBR para que la carrocería refleje el cielo.
        model.traverse((o) => {
          if (o.isMesh && o.material && !o.material.isMeshStandardMaterial) {
            const old = o.material;
            o.material = new THREE.MeshStandardMaterial({ map: old.map || null, color: old.color || 0xffffff, roughness: 0.35, metalness: 0.3 });
          } else if (o.isMesh && !info.painted) {
            o.material.roughness = Math.min(o.material.roughness, 0.4);
            o.material.metalness = Math.max(o.material.metalness, 0.25);
          }
        });
        const size = new THREE.Box3().setFromObject(model).getSize(new THREE.Vector3());
        const length = Math.max(size.x, size.z);
        if (size.x > size.z) model.rotation.y = Math.PI / 2;     // dejar el largo sobre Z
        const s = 12 / length;
        model.scale.setScalar(s);
        model.rotation.y += info.frontPlusZ === false ? 0 : Math.PI;  // el frente tiene que mirar a -Z
        const box = new THREE.Box3().setFromObject(model);
        const c = box.getCenter(new THREE.Vector3());
        model.position.x -= c.x;
        model.position.z -= c.z;
        model.position.y -= box.min.y;
        const width = (size.x > size.z ? size.z : size.x) * s;
        finish(model, 12, (width / 2) * (info.bodyWidthFactor || 0.86));
      }, fallback);
    } catch (e) {
      fallback();
    }
    return root;
  }

  return {
    LANE_X, ROAD_PROFILES, CAR_COLORS, SKINS, WATER_NEAR,
    get P() { return P; },
    setProfile(id) { P = ROAD_PROFILES[id] || ROAD_PROFILES.ib; },
    createRoad, createWater, makeCar, makeTruck, makeMoto, makeDeco, rowParts, makeKmSign,
    makeArroyoSign, makeLocalitySign, makeWarningSign, makePeaje, makeMountain, makeFortaleza,
    makeStopZone, makeShelter, makePerson, makeMate, makeParcel, makeTerminal, loadBus, makeCrossing
  };
})();
