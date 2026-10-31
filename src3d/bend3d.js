// Curvas y lomas sin cambiar la lógica del juego. El juego sigue pensando en una ruta recta
// (x = costado, z = -distancia hacia adelante). Al dibujar, cada vértice se lleva a la ruta
// curva y con altura según la distancia d delante del ómnibus. Se hace en el vertex shader de
// todos los materiales de three.js (también las sombras y los sprites), así que no cuesta nada
// en la CPU.
//
// Cada cuadro, el juego carga N muestras cada STEP metros (desde D0), relativas al ómnibus:
//   x = corrimiento lateral del eje, y = cuánto se "acorta" el eje hacia adelante por la curva,
//   z = rumbo (rad, + = a la derecha), w = altura.
// Con todo en 0 no hay deformación (por eso el ómnibus, que tiene su propio shader, no se toca).
// Cargar después de three.bundle.min.js y antes de crear materiales.
const Bend = (() => {
  const N = 48, STEP = 10, D0 = -60;
  const samples = Array.from({ length: N }, () => new THREE.Vector4());
  const uniform = { value: samples };

  const glsl = `
#define BEND_N ${N}
#define BEND_STEP ${STEP.toFixed(1)}
#define BEND_D0 ${D0.toFixed(1)}
uniform vec4 uBend[BEND_N];
vec3 bendWorld(vec3 p) {
  float d = -p.z;
  float f = (d - BEND_D0) / BEND_STEP;
  vec4 s;
  if (f >= float(BEND_N - 1)) {
    // Más allá de la última muestra sigue derecho con el último rumbo (cerros del fondo).
    s = uBend[BEND_N - 1];
    float e = d - (BEND_D0 + float(BEND_N - 1) * BEND_STEP);
    s.x += e * sin(s.z);
    s.y += e * (1.0 - cos(s.z));
  } else if (f <= 0.0) {
    s = uBend[0];
    float e = d - BEND_D0;
    s.x += e * sin(s.z);
    s.y += e * (1.0 - cos(s.z));
  } else {
    int i = int(floor(f));
    s = mix(uBend[i], uBend[i + 1], f - float(i));
  }
  float c = cos(s.z), sn = sin(s.z);
  return vec3(s.x + p.x * c, p.y + s.w, -d + s.y + p.x * sn);
}
`;
  const C = THREE.ShaderChunk;
  C.clipping_planes_pars_vertex += glsl;
  // Los shaders del cielo también usan project_vertex pero no tienen bendWorld: ahí queda igual.
  C.project_vertex = C.project_vertex.replace('mvPosition = modelViewMatrix * mvPosition;',
    '#ifdef BEND_N\nvec4 bendW = modelMatrix * mvPosition;\nbendW.xyz = bendWorld(bendW.xyz);\nmvPosition = viewMatrix * bendW;\n' +
    '#else\nmvPosition = modelViewMatrix * mvPosition;\n#endif');
  // La posición de mundo se usa para las sombras: tiene que coincidir con la deformada.
  C.worldpos_vertex = C.worldpos_vertex.replace('worldPosition = modelMatrix * worldPosition;',
    'worldPosition = modelMatrix * worldPosition;\n\t#ifdef BEND_N\n\tworldPosition.xyz = bendWorld(worldPosition.xyz);\n\t#endif');
  C.sprite_vert = C.sprite_vert.replace('vec4 mvPosition = modelViewMatrix[ 3 ];',
    'vec4 mvPosition = viewMatrix * vec4(bendWorld(modelMatrix[ 3 ].xyz), 1.0);');
  // Todos los materiales comparten el mismo uniform (un material con su propio onBeforeCompile
  // queda sin deformar).
  THREE.Material.prototype.onBeforeCompile = function (shader) { shader.uniforms.uBend = uniform; };

  // Lo mismo en la CPU, para la cámara: deja en `out` el punto deformado de (x, y, -d).
  function at(d, x, y, out) {
    let f = (d - D0) / STEP, s, e = 0;
    if (f >= N - 1) { s = samples[N - 1]; e = d - (D0 + (N - 1) * STEP); }
    else if (f <= 0) { s = samples[0]; e = d - D0; }
    else {
      const i = Math.floor(f), t = f - i, a = samples[i], b = samples[i + 1];
      const th = a.z + (b.z - a.z) * t;
      out.set(a.x + (b.x - a.x) * t + x * Math.cos(th), y + a.w + (b.w - a.w) * t, -d + a.y + (b.y - a.y) * t + x * Math.sin(th));
      return out;
    }
    const sx = s.x + e * Math.sin(s.z), sy = s.y + e * (1 - Math.cos(s.z));
    return out.set(sx + x * Math.cos(s.z), y + s.w, -d + sy + x * Math.sin(s.z));
  }

  // Arma las muestras a partir del perfil del tramo. heading(p) y height(p) devuelven el rumbo y
  // la altura en la posición p del juego; pos = dónde está el ómnibus.
  function update(pos, heading, height) {
    const k0 = Math.round(-D0 / STEP);         // índice de la muestra en d = 0
    const th0 = heading(pos), h0 = height(pos);
    samples[k0].set(0, 0, 0, 0);
    // Hacia adelante y hacia atrás se integra el eje con el rumbo del medio de cada paso.
    for (let k = k0 + 1; k < N; k++) {
      const a = samples[k - 1], d = D0 + k * STEP;
      const th = heading(pos + d) - th0, thm = (a.z + th) / 2;
      samples[k].set(a.x + STEP * Math.sin(thm), a.y + STEP * (1 - Math.cos(thm)), th, height(pos + d) - h0);
    }
    for (let k = k0 - 1; k >= 0; k--) {
      const b = samples[k + 1], d = D0 + k * STEP;
      const th = heading(pos + d) - th0, thm = (b.z + th) / 2;
      samples[k].set(b.x - STEP * Math.sin(thm), b.y - STEP * (1 - Math.cos(thm)), th, height(pos + d) - h0);
    }
  }

  return { N, STEP, D0, samples, update, at };
})();
