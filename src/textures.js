// Todas las texturas se dibujan con Canvas 2D al arrancar: cero imágenes que bajar.
// Para usar arte oficial, cargar PNGs con las mismas claves en BootScene.preload().
const Textures = {
  make(scene, key, w, h, draw) {
    if (scene.textures.exists(key)) return;
    const tex = scene.textures.createCanvas(key, w, h);
    draw(tex.context, w, h);
    tex.refresh();
  },

  rr(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    ctx.lineTo(x + w, y + h - r);
    ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    ctx.lineTo(x + r, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - r);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.closePath();
  },

  createAll(scene) {
    const rr = this.rr;

    // Ruta: tile vertical que se repite (240 px = 2 ciclos de líneas discontinuas).
    this.make(scene, 'road', W, 240, (c, w, h) => {
      c.fillStyle = '#5c9e48';
      c.fillRect(0, 0, w, h);
      c.fillStyle = '#4f8f3d';
      for (let i = 0; i < 40; i++) {
        const x = (i * 97) % w;
        const y = (i * 53) % h;
        c.fillRect(x, y, 6, 4);
      }
      c.fillStyle = '#9a958a';
      c.fillRect(ROAD_L - 10, 0, ROAD_R - ROAD_L + 20, h);
      c.fillStyle = '#3b3d42';
      c.fillRect(ROAD_L, 0, ROAD_R - ROAD_L, h);
      c.fillStyle = '#f4f4f4';
      c.fillRect(ROAD_L + 6, 0, 4, h);
      c.fillRect(ROAD_R - 10, 0, 4, h);
      const laneW = (ROAD_R - ROAD_L) / 3;
      for (let k = 1; k < 3; k++) {
        const x = ROAD_L + laneW * k - 2;
        for (let y = 0; y < h; y += 120) c.fillRect(x, y, 4, 60);
      }
    });

    // Ómnibus visto desde arriba, frente hacia arriba.
    this.make(scene, 'bus', 80, 176, (c) => {
      c.fillStyle = 'rgba(0,0,0,0.25)';
      rr(c, 6, 8, 72, 166, 12); c.fill();
      c.fillStyle = '#fbfbfb';
      rr(c, 4, 4, 72, 168, 12); c.fill();
      c.fillStyle = '#2b3a4a';
      rr(c, 8, 6, 64, 20, 8); c.fill();             // parabrisas
      c.fillStyle = '#222';
      c.fillRect(0, 18, 5, 10); c.fillRect(75, 18, 5, 10);  // espejos
      c.fillStyle = COLORS.brandHex;
      c.fillRect(4, 34, 7, 130); c.fillRect(69, 34, 7, 130); // franja lateral
      c.fillStyle = COLORS.accentHex;
      c.fillRect(11, 34, 3, 130); c.fillRect(66, 34, 3, 130);
      c.fillStyle = '#d9dde2';
      rr(c, 22, 112, 36, 40, 6); c.fill();           // equipo de aire
      c.fillStyle = '#b9bfc6';
      for (let i = 0; i < 4; i++) c.fillRect(26, 117 + i * 9, 28, 4);
      c.fillStyle = COLORS.brandHex;
      c.font = 'bold 24px ' + FONT;
      c.textAlign = 'center';
      c.textBaseline = 'middle';
      c.fillText('COT', 40, 66);
      c.fillStyle = '#c0392b';
      c.fillRect(10, 166, 12, 5); c.fillRect(58, 166, 12, 5); // luces traseras
    });

    this.make(scene, 'brake', 80, 30, (c) => {
      const g = c.createRadialGradient(16, 15, 1, 16, 15, 14);
      g.addColorStop(0, 'rgba(255,60,40,0.95)');
      g.addColorStop(1, 'rgba(255,60,40,0)');
      c.fillStyle = g; c.fillRect(0, 0, 32, 30);
      c.translate(48, 0);
      c.fillStyle = g; c.fillRect(0, 0, 32, 30);
    });

    // Autos de distintos colores.
    const carColors = ['#d64541', '#2e86de', '#f5f5f5', '#27ae60', '#8e44ad', '#f39c12', '#34495e', '#16a085'];
    carColors.forEach((col, i) => {
      this.make(scene, 'car' + i, 52, 96, (c) => {
        c.fillStyle = 'rgba(0,0,0,0.25)';
        rr(c, 5, 6, 46, 88, 12); c.fill();
        c.fillStyle = col;
        rr(c, 3, 3, 46, 90, 12); c.fill();
        c.fillStyle = '#25313d';
        rr(c, 8, 20, 36, 16, 5); c.fill();          // parabrisas
        rr(c, 9, 66, 34, 12, 4); c.fill();          // luneta
        c.fillStyle = 'rgba(255,255,255,0.18)';
        rr(c, 9, 38, 34, 26, 4); c.fill();          // techo
        c.fillStyle = '#ffeaa0';
        c.fillRect(7, 4, 9, 4); c.fillRect(36, 4, 9, 4);
        c.fillStyle = '#c0392b';
        c.fillRect(6, 88, 10, 4); c.fillRect(36, 88, 10, 4);
      });
    });
    this.carCount = carColors.length;

    this.make(scene, 'truck', 64, 190, (c) => {
      c.fillStyle = 'rgba(0,0,0,0.25)';
      rr(c, 6, 6, 58, 182, 6); c.fill();
      c.fillStyle = '#c0392b';
      rr(c, 6, 2, 52, 38, 8); c.fill();            // cabina
      c.fillStyle = '#25313d';
      rr(c, 11, 8, 42, 12, 4); c.fill();
      c.fillStyle = '#e8e4da';
      rr(c, 3, 44, 58, 142, 4); c.fill();          // caja
      c.strokeStyle = '#c9c3b5';
      c.lineWidth = 2;
      for (let y = 60; y < 186; y += 18) { c.beginPath(); c.moveTo(6, y); c.lineTo(58, y); c.stroke(); }
      c.fillStyle = '#c0392b';
      c.fillRect(6, 181, 10, 4); c.fillRect(48, 181, 10, 4);
    });

    this.make(scene, 'moto', 26, 50, (c) => {
      c.fillStyle = '#222';
      rr(c, 9, 0, 8, 50, 4); c.fill();
      c.fillStyle = '#e67e22';
      rr(c, 6, 12, 14, 24, 6); c.fill();
      c.fillStyle = '#f1c40f';
      c.beginPath(); c.arc(13, 26, 6, 0, Math.PI * 2); c.fill();  // casco
      c.fillStyle = '#c0392b';
      c.fillRect(10, 46, 6, 3);
    });

    // Decoración del costado.
    this.make(scene, 'tree', 60, 60, (c) => {
      c.fillStyle = 'rgba(0,0,0,0.2)';
      c.beginPath(); c.arc(34, 34, 25, 0, Math.PI * 2); c.fill();
      c.fillStyle = '#2f7a32';
      c.beginPath(); c.arc(30, 30, 25, 0, Math.PI * 2); c.fill();
      c.fillStyle = '#3c9440';
      c.beginPath(); c.arc(24, 24, 14, 0, Math.PI * 2); c.fill();
    });
    this.make(scene, 'pine', 50, 50, (c) => {
      c.fillStyle = '#1f5e33';
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * Math.PI * 2;
        c.beginPath();
        c.moveTo(25, 25);
        c.lineTo(25 + Math.cos(a) * 24, 25 + Math.sin(a) * 24);
        c.lineTo(25 + Math.cos(a + 0.5) * 14, 25 + Math.sin(a + 0.5) * 14);
        c.fill();
      }
      c.fillStyle = '#2b7a44';
      c.beginPath(); c.arc(25, 25, 9, 0, Math.PI * 2); c.fill();
    });
    this.make(scene, 'palm', 64, 64, (c) => {
      c.strokeStyle = '#4c9a2a';
      c.lineWidth = 7;
      c.lineCap = 'round';
      for (let i = 0; i < 7; i++) {
        const a = (i / 7) * Math.PI * 2;
        c.beginPath();
        c.moveTo(32, 32);
        c.quadraticCurveTo(32 + Math.cos(a) * 18, 32 + Math.sin(a) * 18 - 6, 32 + Math.cos(a) * 29, 32 + Math.sin(a) * 29);
        c.stroke();
      }
      c.fillStyle = '#7a5230';
      c.beginPath(); c.arc(32, 32, 6, 0, Math.PI * 2); c.fill();
    });
    this.make(scene, 'bush', 36, 28, (c) => {
      c.fillStyle = '#3f8a3a';
      c.beginPath(); c.ellipse(18, 14, 17, 12, 0, 0, Math.PI * 2); c.fill();
      c.fillStyle = '#e8d44d';
      c.fillRect(10, 9, 3, 3); c.fillRect(22, 15, 3, 3);
    });
    this.make(scene, 'cow', 40, 24, (c) => {
      c.fillStyle = '#f2f2f2';
      rr(c, 4, 4, 28, 16, 7); c.fill();
      c.fillStyle = '#222';
      c.beginPath(); c.arc(14, 10, 4, 0, Math.PI * 2); c.fill();
      c.beginPath(); c.arc(24, 15, 3, 0, Math.PI * 2); c.fill();
      c.fillStyle = '#e9c0b0';
      rr(c, 30, 7, 9, 10, 4); c.fill();
    });

    // Zona de parada pintada en el carril derecho.
    this.make(scene, 'stopzone', 104, 200, (c, w, h) => {
      c.fillStyle = 'rgba(242,183,5,0.28)';
      c.fillRect(0, 0, w, h);
      c.strokeStyle = COLORS.accentHex;
      c.lineWidth = 5;
      c.strokeRect(3, 3, w - 6, h - 6);
      c.save();
      c.beginPath(); c.rect(3, 3, w - 6, h - 6); c.clip();
      c.lineWidth = 6;
      c.strokeStyle = 'rgba(242,183,5,0.55)';
      for (let k = -h; k < w + h; k += 26) { c.beginPath(); c.moveTo(k, 0); c.lineTo(k + h, h); c.stroke(); }
      c.restore();
      c.fillStyle = COLORS.accentHex;
      c.font = 'bold 22px ' + FONT;
      c.textAlign = 'center';
      c.textBaseline = 'middle';
      c.save();
      c.translate(w / 2, h / 2);
      c.fillStyle = 'rgba(0,0,0,0.55)';
      c.fillRect(-48, -16, 96, 32);
      c.fillStyle = COLORS.accentHex;
      c.fillText('PARADA', 0, 1);
      c.restore();
    });

    this.make(scene, 'shelter', 56, 120, (c) => {
      c.fillStyle = 'rgba(0,0,0,0.25)';
      c.fillRect(8, 8, 48, 112);
      c.fillStyle = COLORS.brandHex;
      rr(c, 4, 4, 44, 112, 6); c.fill();
      c.fillStyle = '#d6e4f5';
      c.fillRect(10, 10, 32, 100);
      c.fillStyle = COLORS.accentHex;
      c.beginPath(); c.arc(26, 60, 12, 0, Math.PI * 2); c.fill();
      c.fillStyle = COLORS.brandHex;
      c.font = 'bold 14px ' + FONT;
      c.textAlign = 'center';
      c.textBaseline = 'middle';
      c.fillText('P', 26, 61);
    });

    // Persona desde arriba (se tiñe con colores al azar).
    this.make(scene, 'person', 18, 18, (c) => {
      c.fillStyle = '#ffffff';
      c.beginPath(); c.ellipse(9, 11, 8, 6, 0, 0, Math.PI * 2); c.fill();
      c.fillStyle = '#5a3a22';
      c.beginPath(); c.arc(9, 8, 5, 0, Math.PI * 2); c.fill();
    });

    // Mate: recupera confort.
    this.make(scene, 'mate', 40, 44, (c) => {
      c.fillStyle = 'rgba(255,255,255,0.35)';
      c.beginPath(); c.arc(20, 24, 19, 0, Math.PI * 2); c.fill();
      c.fillStyle = '#8b5a2b';
      c.beginPath(); c.arc(20, 26, 14, 0, Math.PI * 2); c.fill();
      c.fillStyle = '#6aa83a';
      c.beginPath(); c.arc(20, 22, 9, 0, Math.PI * 2); c.fill();
      c.strokeStyle = '#d8d8d8';
      c.lineWidth = 3;
      c.beginPath(); c.moveTo(22, 22); c.lineTo(32, 4); c.stroke();
    });

    // Encomienda: suma puntos.
    this.make(scene, 'box', 40, 40, (c) => {
      c.fillStyle = 'rgba(255,255,255,0.35)';
      c.beginPath(); c.arc(20, 20, 19, 0, Math.PI * 2); c.fill();
      c.fillStyle = '#c8934f';
      c.fillRect(7, 8, 26, 24);
      c.fillStyle = '#a6743a';
      c.fillRect(18, 8, 4, 24);
      c.fillStyle = COLORS.brandHex;
      c.fillRect(7, 18, 26, 4);
    });

    this.make(scene, 'terminal', 360, 70, (c, w, h) => {
      c.fillStyle = '#222';
      c.fillRect(0, 0, 10, h); c.fillRect(w - 10, 0, 10, h);
      c.fillStyle = COLORS.brandHex;
      rr(c, 4, 6, w - 8, 50, 8); c.fill();
      c.fillStyle = '#fff';
      c.font = 'bold 24px ' + FONT;
      c.textAlign = 'center';
      c.textBaseline = 'middle';
      c.fillText('TERMINAL PUNTA DEL ESTE', w / 2, 32);
    });

    this.make(scene, 'finish', ROAD_R - ROAD_L, 24, (c, w, h) => {
      for (let x = 0; x < w; x += 12) {
        for (let y = 0; y < h; y += 12) {
          c.fillStyle = ((x + y) / 12) % 2 ? '#111' : '#fff';
          c.fillRect(x, y, 12, 12);
        }
      }
    });

    this.make(scene, 'btn', 160, 90, (c, w, h) => {
      c.fillStyle = 'rgba(255,255,255,0.18)';
      rr(c, 2, 2, w - 4, h - 4, 18); c.fill();
      c.strokeStyle = 'rgba(255,255,255,0.6)';
      c.lineWidth = 3;
      rr(c, 2, 2, w - 4, h - 4, 18); c.stroke();
    });
  }
};
