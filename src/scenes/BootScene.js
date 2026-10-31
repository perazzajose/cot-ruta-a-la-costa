class BootScene extends Phaser.Scene {
  constructor() {
    super('boot');
  }

  create() {
    Textures.createAll(this);
    this.scene.start('title');
  }
}
