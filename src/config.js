// Constantes globales del juego. Todo lo "tuneable" vive acá.
const W = 540;
const H = 960;

const ROAD_L = 105;
const ROAD_R = 435;
const LANES = [160, 270, 380];        // centro de cada carril (izq, centro, der)
const LANE_SPEED = [340, 270, 200];   // velocidad del tránsito por carril (px/s)
const BUS_Y = 760;                    // posición fija del ómnibus en pantalla

const PX_PER_KM = 600;                // a velocidad máxima se recorre 1 km por segundo
const MAX_SPEED = 600;
const ACCEL = 260;
const BRAKE = 750;
const STOP_SPEED = 135;               // hay que ir a 20 km/h o menos para levantar pasajeros
const SHOW_KMH = 90 / MAX_SPEED;      // conversión px/s -> km/h mostrados

const TRIP_KM = 130;
const TARGET_TIME = 180;              // segundos: llegar antes da puntos de puntualidad

const STOPS = [
  { km: 23, name: 'Parada km 23' },
  { km: 40, name: 'Parada km 40' },
  { km: 82, name: 'Parada km 82' },
  { km: 90, name: 'Parada km 90' },
  { km: 109.6, name: 'Parada km 109,6' },
  { km: 115, name: 'Parada km 115' }
];

const COLORS = {
  brand: 0x1b4f9c,
  brandHex: '#1b4f9c',
  accent: 0xf2b705,
  accentHex: '#f2b705',
  good: 0x3fbf5f,
  bad: 0xe0453a
};

const FONT = 'Arial, Helvetica, sans-serif';
