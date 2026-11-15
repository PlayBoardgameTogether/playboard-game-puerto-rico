import { Buffer } from 'node:buffer';
import { URL } from 'node:url';
import { readFile } from 'node:fs/promises';

export async function puertoRicoFiles() {
  const base = new URL('../game-packages/puerto-rico/', import.meta.url);
  const text = async (file) =>
    (await readFile(new URL(file, base), 'utf8')).replaceAll('\r\n', '\n');
  const shared = await text('shared.txt');
  let client = (await text('client.html'))
    .replace('/* PUERTO_RICO_SHARED */', shared)
    .replace('/* PUERTO_RICO_STYLES */', await text('client.css'));
  for (const [key, file] of Object.entries({
    HARBOR: 'harbor',
    ICON: 'icon',
    BUILDINGS: 'buildings',
    OBJECTS: 'objects',
  })) {
    const png = await readFile(new URL(`art/${file}.png`, base));
    client = client.replaceAll(`__ART_${key}__`, `data:image/png;base64,${png.toString('base64')}`);
  }
  return {
    'game.json': Buffer.from(await text('game.json')),
    'server.js': Buffer.from(shared + '\n' + (await text('server.txt'))),
    'client.html': Buffer.from(client),
  };
}
