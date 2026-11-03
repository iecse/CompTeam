import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const dist = path.join(root, 'dist');
const assets = path.join(root, 'assets');
const repositoryName = process.env.GITHUB_REPOSITORY?.split('/').pop() ?? 'CompTeam';
const builtHtml = fs.readFileSync(path.join(dist, 'index.html'), 'utf8');

if (builtHtml.includes('src/main.tsx') || !builtHtml.includes(`/${repositoryName}/assets/`)) {
  throw new Error('The Vite build does not contain compiled assets for this repository.');
}

const resolvedAssets = fs.existsSync(assets) ? fs.realpathSync(assets) : path.resolve(assets);
if (path.relative(root, resolvedAssets) !== 'assets') {
  throw new Error('Refusing to replace an asset directory outside the repository root.');
}

fs.rmSync(assets, { recursive: true, force: true });
fs.cpSync(path.join(dist, 'assets'), assets, { recursive: true });

for (const entry of fs.readdirSync(dist, { withFileTypes: true })) {
  if (entry.name === 'assets') continue;
  const source = path.join(dist, entry.name);
  const destination = path.join(root, entry.name);
  if (entry.isDirectory()) fs.cpSync(source, destination, { recursive: true });
  else if (entry.isFile()) fs.copyFileSync(source, destination);
}

fs.writeFileSync(path.join(root, '.nojekyll'), '');
console.log(`Synchronized the built site to the repository root for /${repositoryName}/.`);
