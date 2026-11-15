import { Buffer } from 'node:buffer';
import { URL } from 'node:url';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { zipSync } from 'fflate';
import { puertoRicoFiles } from './puerto-rico-package.mjs';

const files = await puertoRicoFiles();
const descriptor = JSON.parse(files['game.json'].toString('utf8'));
descriptor.presentation = {};
for (const [kind, file] of [
  ['icon', 'icon'],
  ['cover', 'cover'],
  ['background', 'harbor'],
]) {
  const png = await readFile(
    new URL(`../game-packages/puerto-rico/art/${file}.png`, import.meta.url),
  );
  if (png.length > 320 * 1024) throw new Error(`${kind} exceeds artwork limit`);
  descriptor.presentation[kind] = `data:image/png;base64,${png.toString('base64')}`;
}
files['game.json'] = Buffer.from(JSON.stringify(descriptor));
const manifestVersion = /version:\s*'([0-9]+\.[0-9]+\.[0-9]+)'/.exec(
  files['server.js'].toString('utf8'),
)?.[1];
if (!manifestVersion) throw new Error('Missing exact game version');
const total = Object.values(files).reduce((size, bytes) => size + bytes.length, 0);
if (total > 2 * 1024 * 1024) throw new Error(`Unpacked game exceeds 2 MiB: ${total}`);
const output = new URL(`../dist/game-packages/puerto-rico-${manifestVersion}.zip`, import.meta.url);
await mkdir(new URL('.', output), { recursive: true });
// ZIP's DOS timestamp uses local date fields, so construct the same wall clock
// in every timezone. Text is normalized by puertoRicoFiles for Windows/Linux.
const bytes = zipSync(files, { mtime: new Date(2026, 9, 24, 0, 0, 0), level: 9 });
await writeFile(output, bytes);
console.log(
  `Puerto Rico ZIP: ${output.pathname} (${bytes.length} bytes; unpacked ${total}; embedded original artwork)`,
);
