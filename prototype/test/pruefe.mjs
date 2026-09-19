import { chromium } from 'playwright';
const b = await chromium.launch();
for (const [name, wait] of [['index', 1200], ['stumm', 11000]]) {
  const p = await b.newPage({ viewport: { width: 1200, height: 700 } });
  const errs = []; p.on('pageerror', e => errs.push(String(e).split('\n')[0]));
  await p.goto(`file://${process.cwd()}/harness/${name}.html`);
  await p.waitForTimeout(wait);
  console.log(`[${name}]`, JSON.stringify(await p.evaluate(() => ({
    rows: document.querySelectorAll('#view .row').length,
    banner: document.querySelector('#view .banner')?.textContent?.slice(0, 120) ?? null,
    stillLoading: document.getElementById('view').innerText.trim() === 'Lädt…',
  }))), 'errors:', errs);
  await p.close();
}
await b.close();
