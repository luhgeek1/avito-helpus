import assert from 'node:assert/strict';
import { registerHooks, createRequire } from 'node:module';
import { extname } from 'node:path';
import { writeFile } from 'node:fs/promises';

registerHooks({ resolve(specifier, context, next) {
  const source = context.parentURL?.includes('/src/entities/pet/');
  return next(source && specifier.startsWith('.') && !extname(specifier) ? `${specifier}.ts` : specifier, context);
} });
const require = createRequire(new URL('../../package.json', import.meta.url));
const sharp = require('sharp');
const { pets } = await import('../../src/entities/pet/config/pets.ts');
const { pixelRuns, spriteGrid } = await import('../../src/entities/pet/lib/sprite.ts');
const { spriteFrames } = await import('../../src/entities/pet/lib/sprite-frames.ts');
let checked = 0, beforeNodes = 0, afterNodes = 0;
for (const pet of pets) {
  const cached = spriteFrames(pet);
  assert.strictEqual(spriteFrames(pet), cached);
  for (let frame = 0; frame < 4; frame++) {
    const grid = spriteGrid(pet, frame), runs = pixelRuns(grid);
    const wrap = body => `<svg xmlns="http://www.w3.org/2000/svg" width="${grid.length * 4}" height="${grid.length * 4}" viewBox="0 0 ${grid.length} ${grid.length}" shape-rendering="crispEdges">${body}</svg>`;
    const oldSvg = wrap(runs.map(run => `<rect x="${run.x}" y="${run.y}" width="${run.w}" height="1" fill="${run.color}"/>`).join(''));
    const newSvg = wrap(cached.frames[frame].map(path => `<path d="${path.path}" fill="${path.color}"/>`).join(''));
    const [oldPixels, newPixels] = await Promise.all([oldSvg, newSvg].map(svg => sharp(Buffer.from(svg)).ensureAlpha().raw().toBuffer()));
    assert(oldPixels.equals(newPixels), `Raster mismatch: ${pet.id} frame ${frame}`);
    assert(grid[0].every(pixel => !pixel) && grid.at(-1).every(pixel => !pixel));
    assert(grid.every(row => !row[0] && !row.at(-1)));
    beforeNodes += runs.length; afterNodes += cached.frames[frame].length; checked++;
  }
}
const report = { pets: pets.length, frames: checked, pixelIdentical: true, transparentBorders: true,
  cacheReused: true, beforeNodes, afterNodes, reductionPercent: +(100 * (1 - afterNodes / beforeNodes)).toFixed(1) };
await writeFile('frontend/design/captures/sprite-path-verification.json', JSON.stringify(report, null, 2));
console.log(JSON.stringify(report));
