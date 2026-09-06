import { cpSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const repositoryRoot = path.resolve(scriptDirectory, '..');
const webRoot = path.join(repositoryRoot, 'apps', 'web');
const nextRoot = path.join(webRoot, '.next');
const standaloneRoot = path.join(nextRoot, 'standalone');
const standaloneAppRoot = path.join(standaloneRoot, 'apps', 'web');
const generatedServer = path.join(standaloneAppRoot, 'server.js');

if (!existsSync(generatedServer)) {
  throw new Error(
    `Servidor standalone do Next.js não encontrado em ${generatedServer}.`,
  );
}

const publicSource = path.join(webRoot, 'public');
const publicDestination = path.join(standaloneAppRoot, 'public');

if (existsSync(publicSource)) {
  cpSync(publicSource, publicDestination, { recursive: true, force: true });
}

const staticSource = path.join(nextRoot, 'static');
const staticDestination = path.join(standaloneAppRoot, '.next', 'static');

if (existsSync(staticSource)) {
  mkdirSync(path.dirname(staticDestination), { recursive: true });
  cpSync(staticSource, staticDestination, { recursive: true, force: true });
}

writeFileSync(
  path.join(standaloneRoot, 'server.js'),
  `'use strict';\nrequire('./apps/web/server.js');\n`,
  'utf8',
);

console.log('Saída standalone preparada para a Hostinger.');
