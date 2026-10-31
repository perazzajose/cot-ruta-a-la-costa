// rutaReal.js — Acceso al trazado real Montevideo → Chuy (data/ruta-mvd-chuy.js).
// Script clásico (sin import/export): usa el THREE global de lib/three.bundle.min.js
// y window.RUTA_REAL. Cargar DESPUÉS de three.bundle.min.js y data/ruta-mvd-chuy.js.
//
// Unidades: metros reales. s = distancia recorrida desde Tres Cruces.
// Ejes Three.js: x = este, z = -norte (norte hacia -Z), y = altura.
// Todas las funciones que se llaman por frame reciben un objeto `destino` para no crear basura.
const RutaReal = (() => {
  const D = window.RUTA_REAL;
  if (!D) { console.warn('RutaReal: falta data/ruta-mvd-chuy.js'); return null; }

  const P = D.puntos;
  const N = P.length;
  const LARGO = D.largo_m;

  // Índice del último punto con P[i].s <= s (búsqueda binaria).
  function indiceEn(s) {
    let lo = 0, hi = N - 1;
    while (lo < hi) {
      const mid = (lo + hi + 1) >> 1;
      if (P[mid].s <= s) lo = mid; else hi = mid - 1;
    }
    return Math.min(lo, N - 2);
  }

  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);

  // Posición sobre el eje de la ruta. `origen` = desplazamiento del floating origin.
  function posicionEn(s, destino, origen) {
    s = clamp(s, 0, LARGO);
    const i = indiceEn(s), a = P[i], b = P[i + 1];
    const t = b.s === a.s ? 0 : (s - a.s) / (b.s - a.s);
    destino.set(a.x + (b.x - a.x) * t, a.y + (b.y - a.y) * t, a.z + (b.z - a.z) * t);
    if (origen) destino.sub(origen);
    return destino;
  }

  // Dirección de avance (vector unitario en XZ) promediada en ±largo m para que no tiemble.
  function direccionEn(s, destino, largo = 15) {
    const i0 = indiceEn(clamp(s - largo, 0, LARGO)), i1 = indiceEn(clamp(s + largo, 0, LARGO)) + 1;
    destino.set(P[i1].x - P[i0].x, 0, P[i1].z - P[i0].z);
    return destino.lengthSq() > 0 ? destino.normalize() : destino.set(0, 0, -1);
  }

  // Ángulo para rotation.y de un objeto que mira hacia -Z en reposo.
  function rumboEn(s) {
    const i0 = indiceEn(clamp(s - 15, 0, LARGO)), i1 = indiceEn(clamp(s + 15, 0, LARGO)) + 1;
    return Math.atan2(-(P[i1].x - P[i0].x), -(P[i1].z - P[i0].z));
  }

  // Pendiente en % (positivo = subida). Útil para el motor y la velocidad del ómnibus.
  function pendienteEn(s, largo = 30) {
    const i0 = indiceEn(clamp(s - largo, 0, LARGO)), i1 = indiceEn(clamp(s + largo, 0, LARGO)) + 1;
    const ds = P[i1].s - P[i0].s;
    return ds > 0 ? ((P[i1].y - P[i0].y) / ds) * 100 : 0;
  }

  // Curvatura aproximada (1/radio, m⁻¹) con signo: + = curva a la derecha.
  function curvaturaEn(s, largo = 40) {
    const i0 = indiceEn(clamp(s - largo, 0, LARGO)), i1 = indiceEn(s), i2 = indiceEn(clamp(s + largo, 0, LARGO)) + 1;
    const ax = P[i1].x - P[i0].x, az = P[i1].z - P[i0].z;
    const bx = P[i2].x - P[i1].x, bz = P[i2].z - P[i1].z;
    const la = Math.hypot(ax, az), lb = Math.hypot(bx, bz);
    if (la === 0 || lb === 0) return 0;
    const giro = Math.atan2(ax * bz - az * bx, ax * bx + az * bz); // ángulo entre tramos
    return -giro / ((la + lb) / 2);
  }

  // Curva suave del tramo [sInicio, sFin] relativa al origen. Para generar la calzada de un chunk
  // (200–500 m). Se llama al crear el chunk, no por frame.
  function tramo(sInicio, sFin, origen) {
    const i0 = Math.max(0, indiceEn(sInicio) - 1), i1 = Math.min(N - 1, indiceEn(sFin) + 2);
    const pts = [];
    for (let i = i0; i <= i1; i++) {
      const v = new THREE.Vector3(P[i].x, P[i].y, P[i].z);
      if (origen) v.sub(origen);
      pts.push(v);
    }
    return new THREE.CatmullRomCurve3(pts, false, 'centripetal');
  }

  // Paradas reales (código y nombre de la línea 152I), ordenadas por s.
  const paradas = D.paradas;
  function proximaParada(s) {
    for (let i = 0; i < paradas.length; i++) if (paradas[i].s > s) return paradas[i];
    return null;
  }

  return {
    datos: D, largo: LARGO, puntos: P, paradas, conAltura: !!D.con_altura,
    indiceEn, posicionEn, direccionEn, rumboEn, pendienteEn, curvaturaEn, tramo, proximaParada,
    km: (s) => s / 1000
  };
})();
