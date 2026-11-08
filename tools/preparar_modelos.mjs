// Junta los modelos elegidos de los packs en un GLB por categoría (texturas compartidas y achicadas)
// y los embebe como JS: window.MODELS3D.<categoría> = 'data:...base64'. Cada modelo queda como un nodo
// raíz con su nombre clave (por ejemplo "tree1"), para buscarlo en el juego.
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { mergeDocuments, unpartition, dedup, prune, textureCompress, quantize } from '@gltf-transform/functions';
import sharp from 'sharp';
import fs from 'fs';
import { fileURLToPath } from 'url';

// Uso (herramienta aparte, NO la usa el juego): descomprimir los .zip de assets/modelos en tools/packs/
// (nature/, cars/, houses/) y correr, con Node y estos paquetes instalados en otra carpeta:
//   npm i @gltf-transform/core@4.1.1 @gltf-transform/functions@4.1.1 @gltf-transform/extensions@4.1.1 sharp
//   node tools/preparar_modelos.mjs
const here = (rel) => fileURLToPath(new URL(rel, import.meta.url)).replace(/\\/g, '/');
const P = here('./packs/');
const L = here('../assets/modelos/letters/Block Alphabet by Jose Rosero - x4Ia0hqh7t.glb');
const OUT = here('../src3d/models/');
const SETS = {
  nature: {
    tree1: P + 'nature/Tree.glb', tree2: P + 'nature/Tree-t9KbsfYdXz.glb', tree3: P + 'nature/Tree-QVOop92WmG.glb',
    pine1: P + 'nature/Pine.glb', pine2: P + 'nature/Pine-79gmlLnweB.glb', pine3: P + 'nature/Pine-Zt62gceKXZ.glb',
    bush1: P + 'nature/Bush.glb', bush2: P + 'nature/Bush with Flowers.glb'
  },
  cars: {
    sedan: P + 'cars/Car.glb', hatch: P + 'cars/Car-unqqkULtRU.glb', suv: P + 'cars/SUV.glb',
    sport: P + 'cars/Sports Car.glb', sport2: P + 'cars/Sports Car-1mkmFkAz5v.glb', taxi: P + 'cars/Taxi.glb'
  },
  houses: {
    house1: P + 'houses/House.glb', house2: P + 'houses/House-7VSVwAg2T3.glb',
    house3: P + 'houses/Two story house.glb', house4: P + 'houses/Two story house-hmXhiLDf8D.glb',
    house5: P + 'houses/Two story house-htvFgnVP4d.glb'
  },
  letters: { alphabet: L }
};

const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);
fs.mkdirSync(OUT, { recursive: true });
for (const [cat, files] of Object.entries(SETS)) {
  const target = new (await import('@gltf-transform/core')).Document();
  for (const [key, file] of Object.entries(files)) {
    const src = await io.read(file);
    // Sin mapas de normales (pesan y casi no se notan a esta distancia).
    for (const m of src.getRoot().listMaterials()) { m.setNormalTexture(null); m.setOcclusionTexture(null); m.setMetallicRoughnessTexture(null); }
    const scene = src.getRoot().listScenes()[0];
    const holder = src.createNode(key);
    for (const n of scene.listChildren()) { scene.removeChild(n); holder.addChild(n); }
    scene.addChild(holder);
    mergeDocuments(target, src);
  }
  // Una sola escena con todos los modelos.
  const scenes = target.getRoot().listScenes();
  const main = scenes[0];
  for (const s of scenes.slice(1)) { for (const n of s.listChildren()) { s.removeChild(n); main.addChild(n); } s.dispose(); }
  await target.transform(
    unpartition(), dedup(), prune(),
    textureCompress({ encoder: sharp, resize: [512, 512], targetFormat: 'webp', quality: 80 }),
    quantize()
  );
  const glb = await io.writeBinary(target);
  const js = `// Modelos "${cat}" (packs de assets/modelos, preparados con tools fuera del juego). Ver README.\n` +
    `window.MODELS3D = window.MODELS3D || {};\nwindow.MODELS3D.${cat} = '${Buffer.from(glb).toString('base64')}';\n`;
  fs.writeFileSync(OUT + cat + '.js', js);
  console.log(cat.padEnd(8), (glb.byteLength / 1024).toFixed(0) + ' KB', 'texturas', target.getRoot().listTextures().map((t) => t.getName() + ' ' + t.getSize()).join(', '));
}
