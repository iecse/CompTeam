import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const built = fs.readFileSync(path.join(root, 'dist', 'index.html'), 'utf8');
const published = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const repositoryName = process.env.GITHUB_REPOSITORY?.split('/').pop() ?? 'CompTeam';

if (built.includes('src/main.tsx') || published.includes('src/main.tsx')) {
  throw new Error('The repository root still contains a raw Vite source entry.');
}

const publishedUrls = [...published.matchAll(/(?:src|href)="([^"]+)"/g)]
  .map(([, url]) => url)
  .filter(url => url.startsWith(`/${repositoryName}/`));
const builtAssets = [...built.matchAll(/(?:src|href)="([^"]+\/assets\/[^"]+)"/g)]
  .map(([, url]) => url)
  .sort();
const publishedAssets = publishedUrls.filter(url => url.includes('/assets/')).sort();

if (JSON.stringify(builtAssets) !== JSON.stringify(publishedAssets)) {
  throw new Error('The repository root does not reference the current compiled assets. Run npm run build and npm run sync:pages-root.');
}

if (!publishedUrls.some(url => url.includes('/assets/') && url.endsWith('.js')) ||
    !publishedUrls.some(url => url.includes('/assets/') && url.endsWith('.css'))) {
  throw new Error('The repository root is missing compiled JavaScript or CSS links.');
}

for (const url of publishedUrls) {
  const file = path.join(root, url.slice(repositoryName.length + 2));
  if (!fs.existsSync(file)) throw new Error(`Published asset is missing: ${url}`);
}

console.log(`The repository root is ready for /${repositoryName}/ branch publishing.`);
