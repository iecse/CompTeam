import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const built = fs.readFileSync(path.join(root, 'dist', 'index.html'), 'utf8');
const published = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const repositoryName = process.env.GITHUB_REPOSITORY?.split('/').pop() ?? 'CompTeamDemo';

const normalizeLineEndings = text => text.replace(/\r\n/g, '\n');
if (normalizeLineEndings(built) !== normalizeLineEndings(published) || published.includes('src/main.tsx')) {
  throw new Error('The repository root does not contain the current compiled Vite page. Run npm run build and npm run sync:pages-root.');
}

const urls = [...published.matchAll(/(?:src|href)="([^"]+)"/g)]
  .map(([, url]) => url)
  .filter(url => url.startsWith(`/${repositoryName}/`));

if (!urls.some(url => url.includes('/assets/') && url.endsWith('.js')) ||
    !urls.some(url => url.includes('/assets/') && url.endsWith('.css'))) {
  throw new Error('The repository root is missing compiled JavaScript or CSS links.');
}

for (const url of urls) {
  const file = path.join(root, url.slice(repositoryName.length + 2));
  if (!fs.existsSync(file)) throw new Error(`Published asset is missing: ${url}`);
}

console.log(`The repository root is ready for /${repositoryName}/ branch publishing.`);
