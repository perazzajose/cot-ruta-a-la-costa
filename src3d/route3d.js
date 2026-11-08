// Tramos del viaje: qué se ve en cada uno. Todo en km de ruta (los mismos que muestran los carteles).
// Para sumar otro tramo alcanza con agregar una entrada acá. Los km son aproximados: se ajustan
// acá sin tocar el código del juego.
//
// profile: 'ib' = Interbalnearia (2 carriles por sentido, doble amarilla al centro).
//          'r9' = Ruta 9 (1 carril por sentido, línea amarilla al centro): para pasar a un camión
//                 hay que salir al carril de los que vienen de frente.
// biomes: paisaje por zonas. weights: qué tan seguido aparece cada decoración (0 = nunca, 4 = mucho;
//         más de 4 = todavía más, como los palmares de butiá).
//         lights: columnas de alumbrado (zonas pobladas). monte: árboles tupidos pegados al alambrado.
//         forest: densidad del bosque extra fuera de las ciudades (0 a 1, por defecto 1).
// landmarks: locality (cartel azul en ménsula; icon: town, beach, plane, fort), arroyo (cartel azul
//         con km), peaje (hay que pasar a 40 km/h o menos), backdrop (cerros al fondo),
//         water (mar o laguna al costado; side 1 = derecha, -1 = izquierda), fortaleza (Santa Teresa),
//         letters (nombre de la ciudad con letras 3D de colores sobre el pasto; side como water).
// real: de qué pedazo del trazado real (data/ruta-mvd-chuy.js, km recorridos desde Tres Cruces) salen
//       las curvas y las lomas. Es solo una referencia: se comprime y se suaviza para el juego.
// stops: paradas (en el carril derecho): un km ("Parada km 150") o { km, name } con el nombre del cartel.
//        Son las paradas reales de la línea 152I (data/ruta-mvd-chuy.js) pasadas a km oficial de ruta.
const ROUTES3D = [
  {
    id: 'ib',
    title: 'Interbalnearia',
    from: 0, to: 97,
    origin: 'Tres Cruces', dest: 'Pan de Azúcar',
    terminal: 'PAN DE AZÚCAR',
    shield: 'IB',
    profile: 'ib',
    real: [0, 97.1],        // la 152I deja la Interbalnearia en Pan de Azúcar y sigue por Ruta 9
    biomes: [
      { from: 0, to: 30, name: 'Ciudad de la Costa', lights: true,
        weights: { house: 4, tree: 2, umbrellaPine: 2, eucalyptus: 1, pine: 1, bush: 2, palm: 1, cow: 0 } },
      { from: 30, to: 52, name: 'Costa de Oro', lights: false,
        weights: { umbrellaPine: 4, eucalyptus: 3, pine: 2, house: 1.5, tree: 1, bush: 1, palm: 0.5, cow: 0.5 } },
      { from: 52, to: 59, name: 'Montes de la Costa de Oro', lights: false, monte: true,
        weights: { pine: 4, eucalyptus: 4, umbrellaPine: 3, tree: 2, bush: 2 } },
      { from: 59, to: 66, name: 'Costa de Oro', lights: false,
        weights: { umbrellaPine: 4, eucalyptus: 3, pine: 2, house: 1.5, tree: 1, bush: 1, palm: 0.5, cow: 0.5 } },
      { from: 66, to: 72, name: 'Montes de la Costa de Oro', lights: false, monte: true,
        weights: { eucalyptus: 4, pine: 3, tree: 3, umbrellaPine: 2, bush: 2 } },
      { from: 72, to: 78, name: 'Costa de Oro', lights: false,
        weights: { umbrellaPine: 4, eucalyptus: 3, pine: 2, house: 1.5, tree: 1, bush: 1, palm: 0.5, cow: 0.5 } },
      { from: 78, to: 94, name: 'Sierras de Maldonado', lights: false,
        weights: { cow: 4, eucalyptus: 2.5, tree: 1.5, bush: 2, pine: 1, umbrellaPine: 0.5, house: 0.3, palm: 0 } },
      { from: 94, to: 999, name: 'Pan de Azúcar', lights: true,
        weights: { house: 4, tree: 2, eucalyptus: 1.5, bush: 1.5, cow: 0.5 } }
    ],
    landmarks: [
      { km: 25, type: 'locality', text: 'Ciudad de la Costa' },
      { km: 26.3, type: 'letters', text: 'Ciudad de la Costa' },
      { km: 32.4, type: 'arroyo', name: 'Aº Pando' },
      { km: 33, type: 'peaje', name: 'Pando' },
      { km: 45, type: 'locality', text: 'Atlántida', icon: 'beach' },
      { km: 46.4, type: 'letters', text: 'Atlántida' },
      { km: 49.5, type: 'arroyo', name: 'Aº Solís Chico' },
      { km: 80.3, type: 'arroyo', name: 'Aº Solís Grande' },
      { km: 81.3, type: 'peaje', name: 'Solís' },
      { km: 91, type: 'locality', text: 'Piriápolis', icon: 'beach' },
      { km: 92.3, type: 'letters', text: 'Piriápolis' },
      { km: 94.5, type: 'locality', text: 'Pan de Azúcar' },
      { km: 95.8, type: 'letters', text: 'Pan de Azúcar' },
      { from: 70, to: 97, type: 'backdrop', model: 'sierra', side: -1 },
      { from: 80, to: 99, type: 'backdrop', model: 'panDeAzucar', side: -1 }
    ],
    stops: [40, { km: 45.5, name: 'Atlántida' }, 50, { km: 61.9, name: 'San Luis' }, 70, { km: 88.3, name: 'Las Flores' }]
  },
  {
    id: 'r9a',
    title: 'Ruta 9 · Tramo 1',
    from: 107, to: 207.5,   // Ruta 9 cuenta los km desde Montevideo por Ruta 8: en Pan de Azúcar ya va por el 107
    origin: 'Pan de Azúcar', dest: 'Rocha',
    terminal: 'TERMINAL ROCHA',
    shield: '9',
    profile: 'r9',
    real: [97.1, 210.5],
    biomes: [
      { from: 0, to: 112, name: 'Campo de Maldonado', lights: false,
        weights: { cow: 4, eucalyptus: 3, tree: 2, bush: 2, house: 0.6, pine: 0.5 } },
      { from: 112, to: 119, name: 'Monte serrano', lights: false, monte: true,
        weights: { tree: 4, eucalyptus: 3, pine: 2, bush: 2, cow: 0.5 } },
      { from: 119, to: 133, name: 'Campo de Maldonado', lights: false,
        weights: { cow: 4, eucalyptus: 3, tree: 2, bush: 2, house: 0.6, pine: 0.5 } },
      { from: 133, to: 142, name: 'San Carlos', lights: true,
        weights: { house: 4, tree: 2, eucalyptus: 1.5, bush: 2, palm: 1, pine: 0.5, cow: 0 } },
      { from: 142, to: 172, name: 'Campo de Maldonado', lights: false,
        weights: { cow: 4, eucalyptus: 3, tree: 2, bush: 2, house: 0.4, butia: 0.3 } },
      { from: 172, to: 200, name: 'Campo de Rocha', lights: false,
        weights: { cow: 3, butia: 2, bush: 2, eucalyptus: 2, reeds: 1.5, pond: 0.8, tree: 1, house: 0.3 } },
      { from: 200, to: 999, name: 'Rocha', lights: true,
        weights: { house: 4, tree: 2, eucalyptus: 1.5, bush: 1.5, palm: 1, butia: 0.5 } }
    ],
    landmarks: [
      { km: 135.5, type: 'locality', text: 'San Carlos' },
      { km: 136.8, type: 'letters', text: 'San Carlos' },
      { km: 140.4, type: 'arroyo', name: 'Aº San Carlos' },
      { km: 164.5, type: 'peaje', name: 'Garzón' },
      { km: 170.2, type: 'arroyo', name: 'Aº Garzón' },
      { km: 189.6, type: 'arroyo', name: 'Aº Sarandí' },
      { km: 202.6, type: 'arroyo', name: 'Aº Rocha' },
      { km: 203.8, type: 'locality', text: 'Rocha' },
      { km: 205, type: 'letters', text: 'Rocha' },
      { from: 107, to: 150, type: 'backdrop', model: 'sierra', side: -1 }
    ],
    stops: [120, 130, { km: 137, name: 'San Carlos' }, 160, 180, { km: 204.7, name: 'Rocha' }]
  },
  {
    id: 'r9b',
    title: 'Ruta 9 · Tramo 2',
    from: 207.5, to: 337.6,
    origin: 'Rocha', dest: 'Chuy',
    terminal: 'TERMINAL CHUY',
    shield: '9',
    profile: 'r9',
    real: [210.5, 342.2],
    biomes: [
      { from: 0, to: 220, name: 'Rocha', lights: true,
        weights: { house: 4, tree: 2, eucalyptus: 1.5, bush: 1.5, palm: 1, butia: 0.5 } },
      { from: 220, to: 248, name: 'Campo de Rocha', lights: false,
        weights: { cow: 4, eucalyptus: 2.5, butia: 1.5, bush: 2, tree: 1, reeds: 1, house: 0.3 } },
      { from: 248, to: 259, name: 'Palmares de Castillos', lights: false, forest: 0.3,
        weights: { butia: 9, cow: 2, bush: 1, reeds: 0.6 } },
      { from: 259, to: 265, name: 'Castillos', lights: true,
        weights: { house: 4, butia: 2, tree: 1.5, palm: 1, bush: 1 } },
      { from: 265, to: 282, name: 'Palmares de Castillos', lights: false, forest: 0.3,
        weights: { butia: 9, cow: 2, bush: 1, reeds: 0.6 } },
      { from: 282, to: 300, name: 'Bañados del Este', lights: false, forest: 0.25,
        weights: { reeds: 4, pond: 3, butia: 1.2, bush: 1, cow: 1 } },
      { from: 300, to: 312, name: 'Parque Santa Teresa', lights: false, monte: true,
        weights: { umbrellaPine: 3, pine: 3, eucalyptus: 3, palm: 1, bush: 1.5 } },
      { from: 312, to: 330, name: 'Laguna Negra', lights: false, forest: 0.5,
        weights: { reeds: 3, butia: 2, pond: 1.5, bush: 1.5, cow: 1 } },
      { from: 330, to: 999, name: 'Chuy', lights: true,
        weights: { house: 4, tree: 2, bush: 1.5, palm: 1, butia: 0.5 } }
    ],
    landmarks: [
      { km: 236.5, type: 'arroyo', name: 'Aº Chafalote' },
      { km: 257.2, type: 'arroyo', name: 'Aº Castillos' },
      { km: 260.3, type: 'locality', text: 'Castillos' },
      { km: 262.5, type: 'letters', text: 'Castillos' },
      { km: 298, type: 'locality', text: 'Punta del Diablo', icon: 'beach' },
      { km: 300.3, type: 'letters', text: 'Punta del Diablo' },
      { km: 304, type: 'locality', text: 'Fortaleza Santa Teresa', icon: 'fort' },
      { km: 306, type: 'fortaleza' },
      { from: 312, to: 326, type: 'water', side: -1, beach: false },
      { km: 315.2, type: 'letters', text: 'La Coronilla' },
      { km: 332.5, type: 'locality', text: 'Chuy' },
      { km: 334.8, type: 'letters', text: 'Chuy' }
    ],
    stops: [{ km: 221, name: 'Emp. Valizas' }, { km: 234.4, name: '19 de Abril' }, { km: 261.6, name: 'Castillos' },
      { km: 280.4, name: 'La Esmeralda' }, { km: 298.1, name: 'Punta del Diablo' }, { km: 314, name: 'La Coronilla' }]
  }
];

const ROUTE3D_COMMON = {
  peajeMaxKmh: 40       // velocidad máxima para pasar el peaje sin perder confort
};

// ---------- Viaje completo Tres Cruces → Chuy (lo que juega el juego) ----------
// Une los tres pedazos de arriba en un solo viaje. Cada pedazo ("segmento") ocupa el mismo largo de juego;
// el perfil de la ruta (ib / r9) y el escudo de los mojones cambian según el segmento. Los km oficiales
// saltan de 97 a 107 en Pan de Azúcar (Ruta 9 cuenta desde Montevideo por Ruta 8).
// Semáforos: cruces con calles laterales (sides: 1 = derecha, -1 = izquierda) en las salidas a las ciudades.
const ROUTE_FULL = (() => {
  const segs = ROUTES3D.map((r) => ({ id: r.id, from: r.from, to: r.to, profile: r.profile, shield: r.shield, real: r.real }));
  const biomes = [], landmarks = [], stops = [];
  ROUTES3D.forEach((r) => {
    r.biomes.forEach((b) => biomes.push(Object.assign({}, b, { from: Math.max(b.from, r.from), to: Math.min(b.to, r.to) })));
    r.landmarks.forEach((m) => landmarks.push(Object.assign({ shield: r.shield, profile: r.profile }, m)));
    r.stops.forEach((s) => stops.push(s));
  });
  const SEMAFOROS = [
    { km: 18, sides: [1, -1], name: 'Lagomar' },
    { km: 22.5, sides: [1, -1], name: 'Solymar' },
    { km: 43.6, sides: [1, -1], name: 'Atlántida' },
    { km: 93.8, sides: [1, -1], name: 'Pan de Azúcar' },
    { km: 134.5, sides: [1, -1], name: 'San Carlos' },
    { km: 201.5, sides: [1, -1], name: 'Rocha' },
    { km: 259.3, sides: [1, -1], name: 'Castillos' },
    { km: 331.2, sides: [1, -1], name: 'Chuy' }
  ];
  SEMAFOROS.forEach((s) => {
    const seg = segs.find((g) => s.km >= g.from && s.km <= g.to) || segs[0];
    landmarks.push(Object.assign({ type: 'semaforo', shield: seg.shield, profile: seg.profile }, s));
  });
  landmarks.sort((a, b) => (a.km ?? a.from) - (b.km ?? b.from));
  return {
    id: 'completo',
    title: 'Montevideo → Chuy',
    from: segs[0].from, to: segs[segs.length - 1].to,
    origin: 'Tres Cruces', dest: 'Chuy',
    terminal: 'TERMINAL CHUY',
    shield: segs[0].shield,
    profile: segs[0].profile,
    real: [segs[0].real[0], segs[segs.length - 1].real[1]],
    segments: segs,
    biomes, landmarks, stops
  };
})();
