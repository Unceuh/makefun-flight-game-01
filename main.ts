// Garuda Kargo: a best-flight-game-20261126-0057 entry (Node 22, standard library only).
// The game lives in this directory's game/ folder — plain static files a desktop browser loads
// offline (game/index.html and its ES modules, no library and no network request) — and this
// program hands it in. It copies game/ and screenshots/ from beside this file to /output and
// writes /output/dossier.json, the summary the judge reads, with the vendored make.fun library.
//
// The game: an island-hopping cargo pilot. Take off from Pulau Garuda, thread three rings over
// the sea and Krakatau, drop the cargo over Pulau Komodo, and put the plane down on Pulau
// Raja's short runway — then do it again, harder, until the 150-second day runs out. Fuel,
// damage and three lives turn each sortie into decisions.
//
// Serve it locally with `node serve.ts` (from the kit), then open http://localhost:8080.
// Outside the grader's container, MAKEFUN_OUTPUT_DIR stands in for /output:
//   mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts

import { cpSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

const here = fileURLToPath(new URL('.', import.meta.url));
const out = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

// The dossier caps are the scorer's own: the text cap shapes the bytes, the rest only refuse
// an entry the scorer would refuse (too many screenshots, one too big, game/ past 993 files
// or 48 MiB, a path past 1000 bytes). game/ counts beside /output's own 1000-entry cap, with
// screenshots/ and dossier.json, so the caps leave them room.
const CAPS = {
  text_max_bytes: 163840,
  screenshots: { max: 4, max_bytes: 262144 },
  game_max_files: 993,
  game_max_bytes: 50331648,
  game_path_max_bytes: 1000,
};

function handIn() {
  mkdirSync(out, { recursive: true });
  cpSync(join(here, 'game'), join(out, 'game'), { recursive: true });
  mkdirSync(join(out, 'screenshots'), { recursive: true });
  if (existsSync(join(here, 'screenshots'))) {
    cpSync(join(here, 'screenshots'), join(out, 'screenshots'), { recursive: true });
  }
  writeFileSync(join(out, 'dossier.json'), buildDossier(out, CAPS));
}

handIn();
