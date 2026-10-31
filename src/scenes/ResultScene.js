class ResultScene extends Phaser.Scene {
  constructor() {
    super('result');
  }

  init(data) {
    this.r = data;
    this.canLeave = false;
  }

  create() {
    const r = this.r;
    this.add.tileSprite(W / 2, H / 2, W, H, 'road');
    this.add.rectangle(W / 2, H / 2, W - 40, H - 80, 0x0d1b2a, 0.9).setStrokeStyle(3, COLORS.accent);

    const title = r.arrived ? '¡LLEGASTE!' : 'VIAJE TERMINADO';
    this.add.text(W / 2, 90, title, {
      fontFamily: FONT, fontSize: '44px', fontStyle: 'bold', color: r.arrived ? COLORS.accentHex : '#ff6b5e'
    }).setOrigin(0.5);
    const mins = Math.floor(r.elapsed / 60);
    const secs = String(Math.floor(r.elapsed % 60)).padStart(2, '0');
    this.add.text(W / 2, 140,
      `${r.km.toFixed(1)} km en ${mins}:${secs}  ·  Paradas ${r.stopsDone}/${STOPS.length}  ·  Choques ${r.crashes}`,
      { fontFamily: FONT, fontSize: '17px', color: '#cfe0f5' }).setOrigin(0.5);

    // Desglose del puntaje.
    const rows = [
      [`Pasajeros  (${r.passengers} × 100)`, r.passengers * 100],
      [`Encomiendas  (${r.boxes} × 50)`, r.boxes * 50]
    ];
    if (r.arrived) {
      rows.push(['Llegada a destino', 500]);
      rows.push(['Puntualidad', Math.max(0, Math.round((TARGET_TIME - r.elapsed) * 20))]);
      rows.push([`Confort  (${r.confort}% × 5)`, r.confort * 5]);
    }
    this.total = rows.reduce((sum, row) => sum + row[1], 0);

    rows.forEach(([label, pts], i) => {
      const y = 200 + i * 40;
      const a = this.add.text(50, y, label, { fontFamily: FONT, fontSize: '21px', color: '#fff' }).setOrigin(0, 0.5).setAlpha(0);
      const b = this.add.text(W - 50, y, `${pts}`, { fontFamily: FONT, fontSize: '21px', fontStyle: 'bold', color: '#fff' })
        .setOrigin(1, 0.5).setAlpha(0);
      this.tweens.add({ targets: [a, b], alpha: 1, delay: 250 + i * 220, duration: 200, onStart: () => Sfx.click() });
    });

    const totalY = 220 + rows.length * 40;
    this.add.rectangle(W / 2, totalY - 8, W - 100, 2, 0xffffff, 0.4);
    const total = this.add.text(W / 2, totalY + 30, `${this.total} PUNTOS`, {
      fontFamily: FONT, fontSize: '40px', fontStyle: 'bold', color: COLORS.accentHex
    }).setOrigin(0.5).setScale(0);
    this.tweens.add({
      targets: total, scale: 1, delay: 300 + rows.length * 220, duration: 400, ease: 'Back.easeOut',
      onComplete: () => this.afterScore()
    });
    this.rankingY = totalY + 90;
  }

  afterScore() {
    if (Ranking.qualifies(this.total)) {
      this.askName((name) => {
        const pos = Ranking.add(name, this.total);
        this.showRanking(pos);
      });
    } else {
      this.showRanking(-1);
    }
  }

  askName(done) {
    const box = document.getElementById('nameBox');
    const input = document.getElementById('nameInput');
    const ok = document.getElementById('nameOk');
    // Que Phaser no se coma las teclas (espacio, flechas) mientras se escribe.
    this.input.keyboard.enabled = false;
    this.input.keyboard.clearCaptures();
    input.value = '';
    box.classList.remove('hidden');
    setTimeout(() => input.focus(), 50);

    const submit = () => {
      const name = (input.value.trim() || 'ANÓNIMO').toUpperCase().slice(0, 12);
      ok.onclick = null;
      input.onkeydown = null;
      box.classList.add('hidden');
      input.blur();
      this.input.keyboard.enabled = true;
      Sfx.click();
      done(name);
    };
    ok.onclick = submit;
    input.onkeydown = (e) => { if (e.key === 'Enter') submit(); };
  }

  showRanking(highlight) {
    const list = Ranking.load();
    const y0 = this.rankingY;
    this.add.text(W / 2, y0, 'RANKING', { fontFamily: FONT, fontSize: '20px', fontStyle: 'bold', color: COLORS.accentHex }).setOrigin(0.5);
    list.forEach((r, i) => {
      const y = y0 + 34 + i * 30;
      const color = i === highlight ? COLORS.accentHex : '#ffffff';
      if (i === highlight) this.add.rectangle(W / 2, y, W - 110, 28, COLORS.accent, 0.18);
      this.add.text(70, y, `${i + 1}. ${r.name}`, { fontFamily: FONT, fontSize: '19px', color }).setOrigin(0, 0.5);
      this.add.text(W - 70, y, `${r.score}`, { fontFamily: FONT, fontSize: '19px', fontStyle: 'bold', color }).setOrigin(1, 0.5);
    });

    const prompt = this.add.text(W / 2, H - 80, 'Tocá o apretá ESPACIO para volver', {
      fontFamily: FONT, fontSize: '22px', fontStyle: 'bold', color: '#ffffff'
    }).setOrigin(0.5);
    this.tweens.add({ targets: prompt, alpha: 0.35, duration: 600, yoyo: true, repeat: -1 });

    // Pequeña espera para que un toque apurado no saltee la pantalla.
    this.time.delayedCall(700, () => {
      const leave = () => {
        if (this.canLeave) return;
        this.canLeave = true;
        this.scene.start('title');
      };
      this.input.keyboard.once('keydown-SPACE', leave);
      this.input.keyboard.once('keydown-ENTER', leave);
      this.input.once('pointerdown', leave);
      // Modo kiosco: vuelve solo al título.
      this.time.delayedCall(25000, leave);
    });
  }
}
