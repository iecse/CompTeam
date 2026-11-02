const siteUrl = process.argv[2];
const attempts = Number(process.env.VERIFY_SITE_ATTEMPTS ?? 12);

if (!siteUrl || !Number.isInteger(attempts) || attempts < 1) {
  throw new Error('Usage: node scripts/verify-deployed-site.mjs <pages-url>');
}

async function verify() {
  const page = await fetch(siteUrl, { headers: { 'Cache-Control': 'no-cache' } });
  if (!page.ok) throw new Error(`Page returned HTTP ${page.status}`);

  const html = await page.text();
  if (html.includes('src/main.tsx')) {
    throw new Error('Pages is serving the Vite source HTML. Set Settings → Pages → Source to GitHub Actions.');
  }

  const script = html.match(/src="([^"]+\/assets\/[^"]+\.js)"/);
  const stylesheet = html.match(/href="([^"]+\/assets\/[^"]+\.css)"/);
  if (!script || !stylesheet) throw new Error('Built JavaScript or CSS asset is missing from the published HTML.');

  for (const [kind, path] of [['JavaScript', script[1]], ['CSS', stylesheet[1]]]) {
    const asset = await fetch(new URL(path, siteUrl));
    if (!asset.ok) throw new Error(`${kind} asset returned HTTP ${asset.status}: ${path}`);
  }
}

let lastError;
for (let attempt = 1; attempt <= attempts; attempt++) {
  try {
    await verify();
    console.log(`Pages site and built assets are available at ${siteUrl}`);
    process.exit(0);
  } catch (error) {
    lastError = error;
    console.warn(`Published site check ${attempt}/${attempts}: ${error.message}`);
    if (attempt < attempts) await new Promise((resolve) => setTimeout(resolve, 5000));
  }
}

throw lastError;
