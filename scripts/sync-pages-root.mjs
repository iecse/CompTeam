import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const dist = path.join(root, 'dist');
const distHtml = path.join(dist, 'index.html');
const distAssets = path.join(dist, 'assets');
const assets = path.join(root, 'assets');
const repositoryName =
  process.env.GITHUB_REPOSITORY?.trim().replace(/\/+$/, '').replace(/\.git$/, '').split('/').pop() || 'CompTeam';

if (!fs.existsSync(distHtml)) {
  throw new Error('Build output missing at dist/index.html. Run "npm run build" first.');
}
if (!fs.existsSync(distAssets)) {
  throw new Error('Compiled assets directory missing at dist/assets. Run "npm run build" first.');
}

const builtHtml = fs.readFileSync(distHtml, 'utf8');

if (builtHtml.includes('src/main.tsx') || !builtHtml.includes(`/${repositoryName}/assets/`)) {
  throw new Error('The Vite build does not contain compiled assets for this repository.');
}

const resolvedAssets = fs.existsSync(assets) ? fs.realpathSync(assets) : path.resolve(assets);
if (path.resolve(resolvedAssets).toLowerCase() !== path.resolve(root, 'assets').toLowerCase()) {
  throw new Error('Refusing to replace an asset directory outside the repository root.');
}

fs.rmSync(assets, { recursive: true, force: true });
fs.cpSync(distAssets, assets, { recursive: true });

for (const entry of fs.readdirSync(dist, { withFileTypes: true })) {
  if (entry.name === 'assets') continue;
  const source = path.join(dist, entry.name);
  const destination = path.join(root, entry.name);
  if (entry.isDirectory()) fs.cpSync(source, destination, { recursive: true });
  else if (entry.isFile()) fs.copyFileSync(source, destination);
}

fs.writeFileSync(path.join(root, '.nojekyll'), '');
console.log(`Synchronized the built site to the repository root for /${repositoryName}/.`);
