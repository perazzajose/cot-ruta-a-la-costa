class TitleScene extends Phaser.Scene {
  constructor() {
    super('title');
  }

  create() {
    this.road = this.add.tileSprite(W / 2, H / 2, W, H, 'road');
    this.bus = this.add.image(LANES[1], 770, 'bus');
    this.tweens.add({ targets: this.bus, y: 760, duration: 900, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });

    this.add.rectangle(W / 2, 250, W - 40, 400, 0x0d1b2a, 0.82).setStrokeStyle(3, COLORS.accent);
    this.add.text(W / 2, 100, 'COT', { fontFamily: FONT, fontSize: '34px', fontStyle: 'bold', color: COLORS.accentHex }).setOrigin(0.5);
    this.add.text(W / 2, 150, 'RUTA A LA COSTA', { fontFamily: FONT, fontSize: '46px', fontStyle: 'bold', color: '#ffffff' }).setOrigin(0.5);
    this.add.text(W / 2, 198, 'Tres Cruces  →  Punta del Este', { fontFamily: FONT, fontSize: '22px', color: '#cfe0f5' }).setOrigin(0.5);

    const help = [
      '←  →   cambiar de carril',
      '↓  /  ESPACIO   frenar',
      'Frená en las PARADAS (carril derecho)',
      'para levantar pasajeros.',
      'Agarrá mates y encomiendas, ¡no choques!'
    ];
    this.add.text(W / 2, 330, help.join('\n'), {
      fontFamily: FONT, fontSize: '19px', color: '#ffffff', align: 'center', lineSpacing: 8
    }).setOrigin(0.5);

    this.drawRanking();

    this.prompt = this.add.text(W / 2, 905, 'Tocá o apretá ESPACIO para salir', {
      fontFamily: FONT, fontSize: '24px', fontStyle: 'bold', color: COLORS.accentHex,
      backgroundColor: '#0d1b2acc', padding: { x: 14, y: 8 }
    }).setOrigin(0.5);
    this.tweens.add({ targets: this.prompt, alpha: 0.35, duration: 600, yoyo: true, repeat: -1 });

    const start = () => {
      Sfx.unlock();
      Sfx.click();
      this.scene.start('play');
    };
    this.input.keyboard.once('keydown-SPACE', start);
    this.input.keyboard.once('keydown-ENTER', start);
    this.input.once('pointerdown', start);

    // Para el organizador del evento: Shift + B borra el ranking.
    this.input.keyboard.on('keydown-B', (e) => {
      if (e.shiftKey && window.confirm('¿Borrar todo el ranking?')) {
        Ranking.clear();
        this.scene.restart();
      }
    });
  }

  drawRanking() {
    const list = Ranking.load().slice(0, 5);
    if (!list.length) return;
    this.add.rectangle(W / 2, 560, 300, 36 + list.length * 28, 0x0d1b2a, 0.75);
    this.add.text(W / 2, 560 - (list.length * 28) / 2, 'MEJORES VIAJES', {
      fontFamily: FONT, fontSize: '16px', fontStyle: 'bold', color: COLORS.accentHex
    }).setOrigin(0.5);
    list.forEach((r, i) => {
      const y = 560 - (list.length * 28) / 2 + 28 + i * 28;
      this.add.text(W / 2 - 130, y, `${i + 1}. ${r.name}`, { fontFamily: FONT, fontSize: '18px', color: '#fff' }).setOrigin(0, 0.5);
      this.add.text(W / 2 + 130, y, `${r.score}`, { fontFamily: FONT, fontSize: '18px', color: '#fff' }).setOrigin(1, 0.5);
    });
  }

  update(time, delta) {
    this.road.tilePositionY -= 0.25 * delta;
  }
}
