/* Prüflauf gegen den Prototyp. `node build-harness.mjs` vorher laufen lassen.
   Der Stub friert die Snapshot-Objekte ein wie die echte Laufzeit — siehe
   README.md; ein grosszügigerer Aufbau prüft nichts. */
import { chromium } from 'playwright';

const browser = await chromium.launch();
let fehler = 0;
const pruefe = (name, ok, was) => {
  if (!ok) fehler++;
  console.log(`${ok ? '  ok  ' : 'FEHLT '} ${name}${ok ? '' : ' — ' + JSON.stringify(was)}`);
};

async function seite(datei, warten) {
  const p = await browser.newPage({ viewport: { width: 1280, height: 950 } });
  const errs = [];
  p.on('pageerror', (e) => errs.push(String(e).split('\n')[0]));
  p.on('dialog', (d) => d.accept());
  await p.goto(`file://${process.cwd()}/harness/${datei}`);
  await p.waitForTimeout(warten);
  return { p, errs };
}

/* 1 — mit Daten: die Liste steht, keine Meldung, keine Ausnahme */
{
  const { p, errs } = await seite('index.html', 1200);
  const s = await p.evaluate(() => ({
    rows: document.querySelectorAll('#view .row').length,
    banner: document.querySelector('#view .banner')?.textContent ?? null,
    laedt: document.getElementById('view').innerText.trim() === 'Lädt…',
  }));
  pruefe('Artikel werden gelistet', s.rows > 0, s);
  pruefe('keine Wachmeldung', s.banner === null, s);
  pruefe('nicht auf „Lädt…“', !s.laedt, s);
  pruefe('keine Ausnahme', errs.length === 0, errs);

  /* 2 — Register: Baum, Felder, Subtyp anlegen */
  await p.evaluate(() =>
    [...document.querySelectorAll('button')].find((b) => /Register/.test(b.textContent))?.click());
  await p.waitForTimeout(300);
  const baum = await p.evaluate(() =>
    [...document.querySelectorAll('.regtree button')].map((b) => b.textContent));
  pruefe('Register zeigt den Schnittstellenbaum', baum.length > 3, baum);

  await p.evaluate(() =>
    [...document.querySelectorAll('.regtree button')].find((b) => /Statblock/.test(b.textContent))?.click());
  await p.waitForTimeout(200);
  await p.evaluate(() => {
    const row = [...document.querySelectorAll('.regbody .crow')]
      .find((r) => r.textContent.includes('StatblockInfo'));
    [...row.querySelectorAll('button')].find((b) => /Felder/.test(b.textContent))?.click();
  });
  await p.waitForTimeout(200);
  const felder = await p.evaluate(() =>
    [...document.querySelectorAll('.fbox .frow .fk')].map((x) => x.textContent));
  pruefe('Felder einer Komponente sind aufklappbar', felder.includes('passivWahr'), felder.length);

  const vorher = await p.evaluate(() => document.querySelectorAll('.regtree button').length);
  await p.evaluate(() => {
    const bar = [...document.querySelectorAll('.regbody .addbar')]
      .find((b) => [...b.querySelectorAll('button')].some((x) => /Schnittstelle anlegen/.test(x.textContent)));
    bar.querySelector('input').value = 'Prüfling';
    [...bar.querySelectorAll('button')].find((x) => /Schnittstelle anlegen/.test(x.textContent)).click();
  });
  await p.waitForTimeout(200);
  const nachher = await p.evaluate(() => ({
    anzahl: document.querySelectorAll('.regtree button').length,
    gewaehlt: document.querySelector('.regbody h3')?.textContent,
    geerbt: [...document.querySelectorAll('.regbody .crow .co')].some((c) => /geerbt von/.test(c.textContent)),
    geschrieben: window.__WROTE__.includes('registry/interfaces'),
  }));
  pruefe('Subtyp anlegen fügt eine Zeile ein', nachher.anzahl === vorher + 1, nachher);
  pruefe('der Subtyp erbt die Komponenten', nachher.geerbt, nachher);
  pruefe('der Subtyp wird gespeichert', nachher.geschrieben, nachher);
  pruefe('Register ohne Ausnahme', errs.length === 0, errs);
  await p.close();
}

/* 3 — ohne Antwort: die Seite sagt, was ausblieb, statt still zu warten */
{
  const { p, errs } = await seite('stumm.html', 11000);
  const s = await p.evaluate(() => ({
    banner: document.querySelector('#view .banner')?.textContent ?? null,
    laedt: document.getElementById('view').innerText.trim() === 'Lädt…',
  }));
  pruefe('Wachmeldung erscheint', /Keine Daten empfangen/.test(s.banner ?? ''), s);
  pruefe('zählt die Registerteile richtig', /0 von 5 Registerteilen/.test(s.banner ?? ''), s);
  pruefe('bleibt nicht auf „Lädt…“', !s.laedt, s);
  pruefe('keine Ausnahme ohne Daten', errs.length === 0, errs);
  await p.close();
}

await browser.close();
console.log(fehler ? `\n${fehler} Prüfung(en) fehlgeschlagen.` : '\nAlle Prüfungen bestanden.');
process.exit(fehler ? 1 : 0);
