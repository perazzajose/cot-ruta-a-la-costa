class PlayScene extends Phaser.Scene {
  constructor() {
    super('play');
  }

  // El estado de cada viaje se reinicia acá (no en el constructor) para que reiniciar quede limpio.
  init() {
    this.dist = 0;
    this.speed = 0;
    this.elapsed = 0;
    this.score = 0;
    this.passengers = 0;
    this.boxes = 0;
    this.crashes = 0;
    this.confort = 100;
    this.invuln = 0;
    this.stunned = 0;
    this.lane = 1;
    this.touchBrake = false;
    this.paused = false;
    this.ended = false;
    this.world = [];
    this.cars = [];
    this.pickups = [];
    this.stops = STOPS.map((s) => ({ ...s, pos: s.km * PX_PER_KM, spawned: false, done: false, missed: false }));
    this.nextDecoAt = 0;
    this.nextCarAt = PX_PER_KM * 1.2;
    this.nextPickupAt = PX_PER_KM * 4;
    this.nextKmSign = 10;
    this.terminalSpawned = false;
    this.hudCache = {};
  }

  create() {
    this.road = this.add.tileSprite(W / 2, H / 2, W, H, 'road').setDepth(0);
    this.bus = this.add.image(LANES[1], BUS_Y, 'bus').setDepth(5);
    this.brakeLights = this.add.image(LANES[1], BUS_Y + 82, 'brake').setDepth(5).setVisible(false);

    for (let p = -(H - BUS_Y); p < BUS_Y + 100; p += 110) this.spawnDeco(p);
    this.nextDecoAt = BUS_Y + 100;

    this.createHud();
    this.createControls();
    this.toast('¡Buen viaje!  Destino: Punta del Este', '#ffffff', 2200);
  }

  // ---------- Entrada ----------

  createControls() {
    const kb = this.input.keyboard;
    this.keys = kb.addKeys({ down: 'DOWN', s: 'S', space: 'SPACE' });
    kb.on('keydown-LEFT', () => this.changeLane(-1));
    kb.on('keydown-A', () => this.changeLane(-1));
    kb.on('keydown-RIGHT', () => this.changeLane(1));
    kb.on('keydown-D', () => this.changeLane(1));
    kb.on('keydown-H', () => Sfx.horn());
    kb.on('keydown-P', () => this.togglePause());
    kb.on('keydown-ESC', () => this.togglePause());

    // Botones táctiles (también funcionan con mouse).
    const mk = (x, label, onDown, onUp) => {
      const b = this.add.image(x, 900, 'btn').setDepth(10).setAlpha(0.8).setInteractive();
      this.add.text(x, 900, label, { fontFamily: FONT, fontSize: '30px', fontStyle: 'bold', color: '#fff' })
        .setOrigin(0.5).setDepth(11);
      b.on('pointerdown', onDown);
      if (onUp) { b.on('pointerup', onUp); b.on('pointerout', onUp); }
    };
    mk(95, '◀', () => this.changeLane(-1));
    mk(W / 2, 'FRENO', () => { this.touchBrake = true; }, () => { this.touchBrake = false; });
    mk(W - 95, '▶', () => this.changeLane(1));
  }

  changeLane(dir) {
    if (this.ended || this.paused) return;
    const next = Phaser.Math.Clamp(this.lane + dir, 0, 2);
    if (next === this.lane) return;
    this.lane = next;
    this.tweens.killTweensOf(this.bus);
    this.bus.angle = 0;
    this.tweens.add({ targets: this.bus, x: LANES[next], duration: 150, ease: 'Sine.easeOut' });
    this.tweens.add({ targets: this.bus, angle: dir * 7, duration: 75, yoyo: true, ease: 'Sine.easeOut' });
  }

  togglePause() {
    if (this.ended) return;
    this.paused = !this.paused;
    if (this.paused) {
      this.pauseText = this.add.text(W / 2, H / 2, 'PAUSA\n\nP para seguir', {
        fontFamily: FONT, fontSize: '40px', fontStyle: 'bold', color: '#fff', align: 'center',
        backgroundColor: '#0d1b2add', padding: { x: 30, y: 20 }
      }).setOrigin(0.5).setDepth(20);
      this.tweens.pauseAll();
    } else {
      this.pauseText.destroy();
      this.tweens.resumeAll();
    }
  }

  // ---------- Objetos del mundo ----------
  // Cada objeto tiene `pos` (distancia en la ruta). Su y en pantalla sale de la distancia del ómnibus.

  addWorld(obj, pos, offY = 0) {
    obj.pos = pos;
    obj.offY = offY;
    obj.y = BUS_Y - (pos - this.dist) + offY;
    this.world.push(obj);
    return obj;
  }

  spawnPos(extra = 100) {
    return this.dist + BUS_Y + extra;
  }

  spawnDeco(pos) {
    // Del lado derecho no se planta nada encima de un refugio de parada.
    const nearStop = this.stops.some((s) => Math.abs(s.pos - pos) < 160);
    const left = nearStop || Math.random() < 0.5;
    const x = left ? Phaser.Math.Between(18, 78) : Phaser.Math.Between(465, 525);
    const type = Phaser.Utils.Array.GetRandom(['tree', 'tree', 'pine', 'palm', 'bush', 'bush', 'cow']);
    const img = this.add.image(x, 0, type).setDepth(1);
    if (type === 'cow') img.setAngle(Phaser.Math.Between(0, 359));
    this.addWorld(img, pos);
  }

  spawnKmSign(km) {
    const t = this.add.text(452, 0, `km ${km}`, {
      fontFamily: FONT, fontSize: '14px', fontStyle: 'bold', color: '#fff',
      backgroundColor: '#1f6b3a', padding: { x: 4, y: 3 }
    }).setOrigin(0, 0.5).setDepth(2);
    this.addWorld(t, km * PX_PER_KM);
  }

  spawnCars() {
    const p = this.dist / (TRIP_KM * PX_PER_KM);
    const count = Math.random() < 0.15 + 0.45 * p ? 2 : 1;
    // Un carril nunca se ocupa si ya hay un auto cerca del borde superior.
    const free = [0, 1, 2].filter((l) => !this.cars.some((c) => c.lane === l && c.y < 220));
    Phaser.Utils.Array.Shuffle(free);
    for (let i = 0; i < Math.min(count, free.length); i++) {
      const lane = free[i];
      const r = Math.random();
      let key = 'car' + Phaser.Math.Between(0, Textures.carCount - 1);
      if (r < 0.18 && lane > 0) key = 'truck';
      else if (r < 0.3) key = 'moto';
      const car = this.add.image(LANES[lane], 0, key).setDepth(4);
      car.lane = lane;
      car.speed = LANE_SPEED[lane];
      car.hw = car.width / 2 - 4;
      car.hh = car.height / 2 - 6;
      this.addWorld(car, this.spawnPos(240));
      this.cars.push(car);
    }
    const gap = Phaser.Math.Linear(700, 320, p) * Phaser.Math.FloatBetween(0.75, 1.25);
    this.nextCarAt = this.dist + gap;
  }

  spawnPickup() {
    const free = [0, 1, 2].filter((l) => !this.cars.some((c) => c.lane === l && c.y < 260));
    if (free.length) {
      const lane = Phaser.Utils.Array.GetRandom(free);
      const type = this.confort < 85 && Math.random() < 0.55 ? 'mate' : 'box';
      const it = this.add.image(LANES[lane], 0, type).setDepth(3);
      it.kind = type;
      this.tweens.add({ targets: it, scale: 1.15, duration: 400, yoyo: true, repeat: -1 });
      this.addWorld(it, this.spawnPos(60));
      this.pickups.push(it);
    }
    this.nextPickupAt = this.dist + PX_PER_KM * Phaser.Math.FloatBetween(2.2, 3.8);
  }

  spawnStop(stop) {
    stop.spawned = true;
    stop.waiting = Phaser.Math.Between(2, 5);
    stop.zone = this.addWorld(this.add.image(LANES[2], 0, 'stopzone').setDepth(2), stop.pos);
    this.addWorld(this.add.image(500, 0, 'shelter').setDepth(1), stop.pos, -10);
    this.addWorld(this.add.text(492, 0, stop.name.replace('Parada ', ''), {
      fontFamily: FONT, fontSize: '13px', fontStyle: 'bold', color: '#10202a',
      backgroundColor: COLORS.accentHex, padding: { x: 4, y: 2 }
    }).setOrigin(0.5).setDepth(3), stop.pos, -88);
    const tints = [0xe74c3c, 0x3498db, 0x2ecc71, 0xf1c40f, 0x9b59b6, 0xe67e22];
    stop.people = [];
    for (let i = 0; i < stop.waiting; i++) {
      const person = this.add.image(458 + (i % 2) * 14, 0, 'person').setDepth(3).setTint(Phaser.Utils.Array.GetRandom(tints));
      this.addWorld(person, stop.pos, -44 + i * 20);
      stop.people.push(person);
    }
  }

  spawnTerminal() {
    this.terminalSpawned = true;
    const end = TRIP_KM * PX_PER_KM;
    this.addWorld(this.add.image(W / 2, 0, 'finish').setDepth(2), end, 0);
    this.addWorld(this.add.image(W / 2, 0, 'terminal').setDepth(6), end, -60);
  }

  removeFromWorld(obj) {
    const i = this.world.indexOf(obj);
    if (i >= 0) this.world.splice(i, 1);
  }

  // ---------- Bucle principal ----------

  update(time, deltaMs) {
    if (this.paused) return;
    const dt = Math.min(deltaMs, 50) / 1000;

    if (!this.ended) {
      this.elapsed += dt;
      const braking = this.keys.down.isDown || this.keys.s.isDown || this.keys.space.isDown || this.touchBrake;
      if (this.stunned > 0) {
        this.stunned -= dt;
        this.speed = Math.max(0, this.speed - 900 * dt);
      } else if (braking) {
        this.speed = Math.max(0, this.speed - BRAKE * dt);
      } else {
        this.speed = Math.min(MAX_SPEED, this.speed + ACCEL * dt);
      }
      this.brakeLights.setVisible(braking || this.stunned > 0);
    } else {
      this.speed = Math.max(0, this.speed - 450 * dt);
      this.brakeLights.setVisible(this.speed > 0);
    }

    const move = this.speed * dt;
    this.dist += move;
    this.road.tilePositionY -= move;
    this.brakeLights.x = this.bus.x;
    this.brakeLights.angle = this.bus.angle;

    if (this.invuln > 0) {
      this.invuln -= dt;
      this.bus.setAlpha(Math.floor(time / 90) % 2 ? 0.35 : 1);
    } else {
      this.bus.setAlpha(1);
    }

    this.spawnStuff();
    this.updateWorld(dt);

    if (!this.ended) {
      this.checkCars();
      this.checkPickups();
      this.checkStops();
      if (this.dist >= TRIP_KM * PX_PER_KM) this.finish(true);
    }
    this.updateHud();
  }

  spawnStuff() {
    const ahead = this.dist + BUS_Y + 300;
    while (this.nextDecoAt < this.dist + BUS_Y + 100) {
      this.spawnDeco(this.nextDecoAt + 100);
      this.nextDecoAt += Phaser.Math.Between(70, 150);
    }
    if (this.nextKmSign <= TRIP_KM && this.nextKmSign * PX_PER_KM < ahead) {
      this.spawnKmSign(this.nextKmSign);
      this.nextKmSign += 10;
    }
    this.stops.forEach((s) => { if (!s.spawned && s.pos < ahead) this.spawnStop(s); });
    if (!this.terminalSpawned && TRIP_KM * PX_PER_KM < ahead) this.spawnTerminal();

    const nearEnd = this.dist > (TRIP_KM - 2) * PX_PER_KM;
    if (!this.ended && !nearEnd) {
      if (this.dist >= this.nextCarAt) this.spawnCars();
      if (this.dist >= this.nextPickupAt) this.spawnPickup();
    }
  }

  updateWorld(dt) {
    for (let i = this.world.length - 1; i >= 0; i--) {
      const o = this.world[i];
      if (o.speed) o.pos += o.speed * dt;
      o.y = BUS_Y - (o.pos - this.dist) + o.offY;
      if (o.y > H + 220 || (o.speed && o.y < -450)) {
        o.dead = true;
        o.destroy();
        this.world.splice(i, 1);
      }
    }
    this.cars = this.cars.filter((c) => !c.dead);
    this.pickups = this.pickups.filter((c) => !c.dead);
  }

  hitsBus(o, hw, hh) {
    return Math.abs(o.x - this.bus.x) < hw + 30 && Math.abs(o.y - BUS_Y) < hh + 78;
  }

  checkCars() {
    for (const car of this.cars) {
      if (car.y > BUS_Y + 120) car.passed = true;
      if (car.passed || car.hit || this.invuln > 0) continue;
      if (this.hitsBus(car, car.hw, car.hh)) this.crash(car);
    }
  }

  crash(car) {
    car.hit = true;
    this.crashes++;
    this.confort = Math.max(0, this.confort - 30);
    this.speed *= 0.2;
    this.stunned = 0.5;
    this.invuln = 1.8;
    Sfx.crash();
    this.cameras.main.shake(260, 0.012);
    this.cameras.main.flash(120, 255, 80, 60);
    car.setTint(0xff9999);
    this.popup(this.bus.x, BUS_Y - 110, '¡CHOQUE!  -30% confort', '#ff6b5e');
    if (this.confort <= 0) this.finish(false);
  }

  checkPickups() {
    for (const it of this.pickups) {
      if (it.dead || !this.hitsBus(it, 14, 14)) continue;
      it.dead = true;
      this.removeFromWorld(it);
      this.tweens.killTweensOf(it);
      this.tweens.add({ targets: it, scale: 2, alpha: 0, duration: 250, onComplete: () => it.destroy() });
      Sfx.pickup();
      if (it.kind === 'mate') {
        this.confort = Math.min(100, this.confort + 15);
        this.popup(it.x, BUS_Y - 110, '¡Mate! +15% confort', '#9be37a');
      } else {
        this.boxes++;
        this.score += 50;
        this.popup(it.x, BUS_Y - 110, 'Encomienda +50', '#ffd36b');
      }
    }
  }

  checkStops() {
    for (const s of this.stops) {
      if (!s.spawned || s.done || s.missed) continue;
      const dy = s.zone.y - BUS_Y;
      const inLane = Math.abs(this.bus.x - LANES[2]) < 22;
      if (Math.abs(dy) < 130 && inLane && this.speed <= STOP_SPEED) {
        this.board(s);
      } else if (dy > 140) {
        s.missed = true;
        this.confort = Math.max(0, this.confort - 10);
        Sfx.miss();
        this.popup(W / 2, BUS_Y - 150, '¡Se te pasó la parada!', '#ff6b5e');
        this.redrawProgress();
        if (this.confort <= 0) this.finish(false);
      }
    }
  }

  board(s) {
    s.done = true;
    this.passengers += s.waiting;
    this.score += s.waiting * 100;
    Sfx.board();
    s.people.forEach((p, i) => {
      this.removeFromWorld(p);
      this.tweens.add({
        targets: p, x: this.bus.x + 20, y: BUS_Y - 30, scale: 0.4, alpha: 0,
        delay: i * 90, duration: 350, onComplete: () => p.destroy()
      });
    });
    this.popup(W / 2, BUS_Y - 150, `+${s.waiting} pasajeros  (+${s.waiting * 100})`, '#9be37a');
    this.redrawProgress();
  }

  finish(arrived) {
    this.ended = true;
    this.touchBrake = false;
    if (arrived) {
      Sfx.arrive();
      this.toast('¡LLEGASTE A PUNTA DEL ESTE!', COLORS.accentHex, 2000);
    } else {
      Sfx.fail();
      this.toast('Los pasajeros se quejaron...\nViaje terminado', '#ff6b5e', 2000);
    }
    this.time.delayedCall(2200, () => {
      this.scene.start('result', {
        arrived,
        elapsed: this.elapsed,
        passengers: this.passengers,
        boxes: this.boxes,
        confort: Math.round(this.confort),
        crashes: this.crashes,
        stopsDone: this.stops.filter((s) => s.done).length,
        km: Math.min(TRIP_KM, this.dist / PX_PER_KM)
      });
    });
  }

  // ---------- Feedback ----------

  popup(x, y, msg, color) {
    const t = this.add.text(x, y, msg, {
      fontFamily: FONT, fontSize: '24px', fontStyle: 'bold', color, stroke: '#10202a', strokeThickness: 5
    }).setOrigin(0.5).setDepth(9);
    t.x = Phaser.Math.Clamp(x, t.width / 2 + 8, W - t.width / 2 - 8);
    this.tweens.add({ targets: t, y: y - 70, alpha: 0, duration: 1300, ease: 'Cubic.easeOut', onComplete: () => t.destroy() });
  }

  toast(msg, color, ms) {
    const t = this.add.text(W / 2, 400, msg, {
      fontFamily: FONT, fontSize: '30px', fontStyle: 'bold', color, align: 'center',
      stroke: '#10202a', strokeThickness: 6
    }).setOrigin(0.5).setDepth(12).setScale(0.6);
    this.tweens.add({ targets: t, scale: 1, duration: 300, ease: 'Back.easeOut' });
    this.tweens.add({ targets: t, alpha: 0, delay: ms, duration: 400, onComplete: () => t.destroy() });
  }

  // ---------- HUD ----------

  createHud() {
    const st = (size, color = '#fff') => ({ fontFamily: FONT, fontSize: size, fontStyle: 'bold', color });
    this.add.rectangle(W / 2, 62, W, 124, 0x0d1b2a, 0.85).setDepth(10);
    this.hud = {
      km: this.add.text(16, 20, '', st('24px')).setOrigin(0, 0.5).setDepth(11),
      time: this.add.text(W / 2, 20, '', st('24px', COLORS.accentHex)).setOrigin(0.5).setDepth(11),
      speed: this.add.text(W - 16, 20, '', st('24px')).setOrigin(1, 0.5).setDepth(11),
      pax: this.add.text(16, 100, '', st('18px')).setOrigin(0, 0.5).setDepth(11),
      score: this.add.text(W - 16, 100, '', st('18px', COLORS.accentHex)).setOrigin(1, 0.5).setDepth(11),
      banner: this.add.text(W / 2, 160, '', {
        fontFamily: FONT, fontSize: '19px', fontStyle: 'bold', color: '#10202a', align: 'center',
        backgroundColor: COLORS.accentHex, padding: { x: 12, y: 6 }
      }).setOrigin(0.5).setDepth(11).setVisible(false)
    };
    this.add.text(W / 2 - 60, 100, 'CONFORT', st('14px', '#cfe0f5')).setOrigin(1, 0.5).setDepth(11);
    this.confortBar = this.add.graphics().setDepth(11);

    this.progress = this.add.graphics().setDepth(11);
    this.progressBus = this.add.rectangle(20, 58, 14, 20, 0xffffff).setStrokeStyle(2, COLORS.brand).setDepth(12);
    this.redrawProgress();
  }

  redrawProgress() {
    const g = this.progress;
    const x0 = 20, x1 = W - 20, y = 58;
    g.clear();
    g.fillStyle(0x3b3d42, 1).fillRoundedRect(x0, y - 6, x1 - x0, 12, 6);
    this.stops.forEach((s) => {
      const color = s.done ? COLORS.good : s.missed ? COLORS.bad : COLORS.accent;
      g.fillStyle(color, 1).fillCircle(x0 + (s.km / TRIP_KM) * (x1 - x0), y, 7);
    });
    g.fillStyle(0xffffff, 1).fillRect(x1 - 4, y - 12, 8, 24);
  }

  setIf(key, text) {
    if (this.hudCache[key] !== text) {
      this.hudCache[key] = text;
      this.hud[key].setText(text);
    }
  }

  updateHud() {
    const km = Math.min(TRIP_KM, this.dist / PX_PER_KM);
    this.setIf('km', `km ${km.toFixed(1)}`);
    const secs = Math.floor(this.elapsed);
    this.setIf('time', `${Math.floor(secs / 60)}:${String(secs % 60).padStart(2, '0')}`);
    this.setIf('speed', `${Math.round(this.speed * SHOW_KMH)} km/h`);
    this.setIf('pax', `PASAJ. ${this.passengers}`);
    this.setIf('score', `${this.score} pts`);
    this.progressBus.x = 20 + (km / TRIP_KM) * (W - 40);

    const c = Math.round(this.confort);
    if (this.hudCache.confort !== c) {
      this.hudCache.confort = c;
      const g = this.confortBar;
      const color = c > 60 ? COLORS.good : c > 30 ? COLORS.accent : COLORS.bad;
      g.clear();
      g.fillStyle(0x3b3d42, 1).fillRoundedRect(W / 2 - 52, 92, 140, 16, 6);
      g.fillStyle(color, 1).fillRoundedRect(W / 2 - 52, 92, Math.max(8, 1.4 * c), 16, 6);
    }

    // Aviso de próxima parada.
    let msg = '';
    const next = this.stops.find((s) => !s.done && !s.missed);
    if (next && !this.ended) {
      const d = next.pos - this.dist;
      if (d < PX_PER_KM * 1.6) {
        const inZone = next.zone && Math.abs(next.zone.y - BUS_Y) < 140;
        if (inZone && Math.abs(this.bus.x - LANES[2]) >= 22) msg = '¡CARRIL DERECHO! ▶';
        else if (inZone && this.speed > STOP_SPEED) msg = '¡FRENÁ!  (20 km/h o menos)';
        else msg = `${next.name} en ${Math.max(0, Math.round((d / PX_PER_KM) * 100) * 10)} m`;
      }
    }
    if (msg !== this.hudCache.banner) {
      this.hudCache.banner = msg;
      this.hud.banner.setText(msg).setVisible(msg !== '');
    }
  }
}
