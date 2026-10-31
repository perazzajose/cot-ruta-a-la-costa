window.game = new Phaser.Game({
  type: Phaser.AUTO,           // WebGL si hay, si no Canvas
  parent: 'game',
  width: W,
  height: H,
  backgroundColor: '#5c9e48',
  scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
  input: { activePointers: 3 },
  render: { powerPreference: 'low-power' },
  scene: [BootScene, TitleScene, PlayScene, ResultScene]
});
