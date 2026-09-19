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
  const modale = [];
  p.on('pageerror', (e) => errs.push(String(e).split('\n')[0]));
  /* Ein Browser-Modal ist hier ein Fehler, kein Ereignis: die Seite läuft im
     Artefakt in einem sandboxed iframe, wo confirm() verworfen wird und false
     liefert. Wer sich darauf verlässt, dessen Knopf tut stillschweigend
     nichts. Darum wird abgewiesen und gezählt, nicht bestätigt. */
  p.on('dialog', (d) => { modale.push(d.message()); d.dismiss(); });
  await p.goto(`file://${process.cwd()}/harness/${datei}`);
  await p.waitForTimeout(warten);
  return { p, errs, modale };
}

/* 1 — mit Daten: die Liste steht, keine Meldung, keine Ausnahme */
{
  const { p, errs, modale } = await seite('index.html', 1200);
  const s = await p.evaluate(() => ({
    rows: document.querySelectorAll('#view .row').length,
    banner: document.querySelector('#view .banner')?.textContent ?? null,
    laedt: document.getElementById('view').innerText.trim() === 'Loading…',
  }));
  pruefe('articles are listed', s.rows > 0, s);
  pruefe('no watchdog banner', s.banner === null, s);
  pruefe('not stuck on Loading…', !s.laedt, s);
  pruefe('no exception', errs.length === 0, errs);

  /* 2 — Register: Baum, Felder, Subtyp anlegen */
  await p.evaluate(() =>
    [...document.querySelectorAll('.rail button')].find((b) => /Registry/.test(b.textContent))?.click());
  await p.waitForTimeout(300);
  const baum = await p.evaluate(() =>
    [...document.querySelectorAll('.regtree button')].map((b) => b.textContent));
  pruefe('registry shows the interface tree', baum.length > 3, baum);

  await p.evaluate(() =>
    [...document.querySelectorAll('.regtree button')].find((b) => /Statblock/.test(b.textContent))?.click());
  await p.waitForTimeout(200);
  await p.evaluate(() => {
    const row = [...document.querySelectorAll('.regbody .crow')]
      .find((r) => r.textContent.includes('StatblockInfo'));
    [...row.querySelectorAll('button')].find((b) => /Fields/.test(b.textContent))?.click();
  });
  await p.waitForTimeout(200);
  const felder = await p.evaluate(() =>
    [...document.querySelectorAll('.fbox .frow .fk')].map((x) => x.textContent));
  pruefe('a component expands to its fields', felder.includes('passivePerception'), felder.length);

  const vorher = await p.evaluate(() => document.querySelectorAll('.regtree button').length);
  await p.evaluate(() => {
    const bar = [...document.querySelectorAll('.regbody .addbar')]
      .find((b) => [...b.querySelectorAll('button')].some((x) => /Create interface/.test(x.textContent)));
    bar.querySelector('input').value = 'Probe';
    [...bar.querySelectorAll('button')].find((x) => /Create interface/.test(x.textContent)).click();
  });
  await p.waitForTimeout(200);
  const nachher = await p.evaluate(() => ({
    anzahl: document.querySelectorAll('.regtree button').length,
    gewaehlt: document.querySelector('.regbody h3')?.textContent,
    geerbt: [...document.querySelectorAll('.regbody .crow .co')].some((c) => /inherited from/.test(c.textContent)),
    geschrieben: window.__WROTE__.includes('registry/interfaces'),
  }));
  pruefe('creating a subtype inserts a row', nachher.anzahl === vorher + 1, nachher);
  pruefe('the subtype inherits its components', nachher.geerbt, nachher);
  pruefe('the subtype is saved', nachher.geschrieben, nachher);
  pruefe('registry raised no exception', errs.length === 0, errs);

  /* 3 — Löschen: eigener Dialog, kein window.confirm */
  await p.evaluate(() =>
    [...document.querySelectorAll('.rail button')].find((b) => /All articles/.test(b.textContent))?.click());
  await p.waitForTimeout(250);
  const vorherZeilen = await p.evaluate(() => document.querySelectorAll('#view .row').length);
  await p.evaluate(() => document.querySelector('#view .row').click());
  await p.waitForTimeout(200);
  await p.evaluate(() =>
    [...document.querySelectorAll('.rowbtns button')].find((b) => b.textContent === 'Delete').click());
  await p.waitForTimeout(200);
  const gefragt = await p.evaluate(() => ({
    dlg: !!document.querySelector('.dlg'),
    knoepfe: [...document.querySelectorAll('.dlgbox .rowbtns button')].map((b) => b.textContent),
  }));
  pruefe('delete asks inside the page', gefragt.dlg, gefragt);

  await p.evaluate(() =>
    [...document.querySelectorAll('.dlgbox .rowbtns button')].find((b) => /Cancel/.test(b.textContent)).click());
  await p.waitForTimeout(200);
  const abgebrochen = await p.evaluate(() => window.__DELETED__.length);
  pruefe('cancel deletes nothing', abgebrochen === 0, abgebrochen);

  await p.evaluate(() =>
    [...document.querySelectorAll('.rowbtns button')].find((b) => b.textContent === 'Delete').click());
  await p.waitForTimeout(150);
  await p.evaluate(() =>
    [...document.querySelectorAll('.dlgbox .rowbtns button')].find((b) => /Delete/.test(b.textContent)).click());
  await p.waitForTimeout(300);
  const geloescht = await p.evaluate(() => ({
    weg: window.__DELETED__,
    zeilen: document.querySelectorAll('#view .row').length,
  }));
  pruefe('delete removes the article', geloescht.weg.length === 1, geloescht);
  pruefe('the list gets shorter', geloescht.zeilen === vorherZeilen - 1, { vorherZeilen, ...geloescht });
  pruefe('no browser modal — discarded in the iframe', modale.length === 0, modale);

  /* 4 — Feldarten: Farbe, Auswahl, Verweis; Schlüssel umbenennen */
  const zumFeld = async (iface, comp, key) => {
    await p.evaluate(() =>
      [...document.querySelectorAll('.rail button')].find((x) => /Registry/.test(x.textContent)).click());
    await p.waitForTimeout(200);
    await p.evaluate((i) =>
      [...document.querySelectorAll('.regtree button')].find((b) => b.textContent.includes(i)).click(), iface);
    await p.waitForTimeout(200);
    await p.evaluate((c) => {
      const row = [...document.querySelectorAll('.regbody .crow')].find((r) => r.textContent.includes(c));
      [...row.querySelectorAll('button')].find((b) => /Fields/.test(b.textContent)).click();
    }, comp);
    await p.waitForTimeout(200);
    if (!key) return;
    await p.evaluate((k) => {
      const row = [...document.querySelectorAll('.fbox .frow')].find((r) => r.querySelector('.fk')?.textContent === k);
      [...row.querySelectorAll('button')].find((b) => b.textContent === '⋯').click();
    }, key);
    await p.waitForTimeout(200);
  };

  await zumFeld('Faction', 'FactionInfo', 'color');
  const arten = await p.evaluate(() => {
    const row = [...document.querySelectorAll('.fbox .frow')].find((r) => r.querySelector('.fk')?.textContent === 'color');
    return [...row.querySelector('select').options].map((o) => o.value);
  });
  pruefe('every field kind is offered', ['color', 'link', 'choice'].every((k) => arten.includes(k)), arten);

  await p.evaluate(() => {
    const row = [...document.querySelectorAll('.fbox .frow')].find((r) => r.querySelector('.fk')?.textContent === 'color');
    const sel = row.querySelector('select');
    sel.value = 'color';
    sel.dispatchEvent(new Event('change', { bubbles: true }));
  });
  await p.waitForTimeout(250);
  await p.evaluate(() =>
    [...document.querySelectorAll('.rail button')].find((x) => /All articles/.test(x.textContent)).click());
  await p.waitForTimeout(200);
  await p.evaluate(() => [...document.querySelectorAll('#view .row')].find((r) => /Auge/.test(r.textContent)).click());
  await p.waitForTimeout(200);
  await p.evaluate(() => {
    document.querySelector('#facet').value = 'full';
    document.querySelector('#facet').dispatchEvent(new Event('change', { bubbles: true }));
  });
  await p.waitForTimeout(250);
  const farbe = await p.evaluate(() => document.querySelector('.fld .swatch')?.getAttribute('style') ?? null);
  pruefe('a colour field renders as a swatch', /#8b5cf6/.test(farbe ?? ''), farbe);

  /* Umbenennen muss Schema, Ansichten UND die Werte in den Artikeln treffen —
     wer nur das Schema ändert, lässt die Werte still hinter dem alten Namen. */
  await zumFeld('Statblock', 'StatblockInfo', 'hp');
  await p.evaluate(() => {
    const box = [...document.querySelectorAll('.fbox .fmore')][0];
    const keyIn = [...box.querySelectorAll('label.f')]
      .find((l) => /Key/.test(l.querySelector('span').textContent)).querySelector('input');
    keyIn.value = 'hitPoints';
    keyIn.dispatchEvent(new Event('change', { bubbles: true }));
  });
  await p.waitForTimeout(400);
  const umbenannt = await p.evaluate(() => ({
    banner: document.querySelector('#view .banner')?.textContent ?? '',
    felder: [...document.querySelectorAll('.fbox .frow .fk')].map((x) => x.textContent),
    geschrieben: window.__WROTE__,
  }));
  pruefe('renaming a key rewrites the schema', umbenannt.felder.includes('hitPoints') && !umbenannt.felder.includes('hp'), umbenannt.felder.slice(0, 5));
  pruefe('renaming a key rewrites the articles', /article/.test(umbenannt.banner) && umbenannt.geschrieben.some((x) => x.startsWith('entities/')), umbenannt.banner);
  pruefe('renaming a key rewrites the views', umbenannt.geschrieben.includes('registry/views'), umbenannt.geschrieben);

  /* Verweisfeld: Zielbeschränkung engt ein, Vorschlag speichert die Id */
  await zumFeld('Creature', 'CreatureInfo', null);
  await p.evaluate(() => {
    const bar = [...document.querySelectorAll('.fbox .addbar')][0];
    const [k, t] = bar.querySelectorAll('input');
    k.value = 'home';
    t.value = 'Home';
    [...bar.querySelectorAll('button')].find((b) => /Add field/.test(b.textContent)).click();
  });
  await p.waitForTimeout(250);
  await p.evaluate(() => {
    const row = [...document.querySelectorAll('.fbox .frow')].find((r) => r.querySelector('.fk')?.textContent === 'home');
    const sel = row.querySelector('select');
    sel.value = 'link';
    sel.dispatchEvent(new Event('change', { bubbles: true }));
  });
  await p.waitForTimeout(300);
  const offen = await p.evaluate(() => document.querySelector('.tgt .hint')?.textContent ?? '');
  await p.evaluate(() => {
    const sel = document.querySelector('.tgt select');
    [...sel.options].forEach((o) => { o.selected = /Place/.test(o.textContent); });
    sel.dispatchEvent(new Event('change', { bubbles: true }));
  });
  await p.waitForTimeout(300);
  const eng = await p.evaluate(() => document.querySelector('.tgt .hint')?.textContent ?? '');
  const zahl = (t) => Number((t.match(/^(\d+)/) ?? [])[1] ?? -1);
  pruefe('a target constraint narrows the candidates', zahl(eng) > 0 && zahl(eng) < zahl(offen), { offen, eng });

  await p.evaluate(() =>
    [...document.querySelectorAll('.rail button')].find((x) => /All articles/.test(x.textContent)).click());
  await p.waitForTimeout(200);
  await p.evaluate(() => [...document.querySelectorAll('#view .row')].find((r) => /Volo/.test(r.textContent)).click());
  await p.waitForTimeout(200);
  await p.evaluate(() => [...document.querySelectorAll('.rowbtns button')].find((b) => b.textContent === 'Edit').click());
  await p.waitForTimeout(300);
  await p.evaluate(() => {
    const inp = document.querySelector('.linkbox input');
    inp.value = 'kerz';
    inp.dispatchEvent(new Event('input', { bubbles: true }));
  });
  await p.waitForTimeout(200);
  const treffer = await p.evaluate(() => [...document.querySelectorAll('.sugg button')].map((b) => b.textContent));
  pruefe('typing filters the link suggestions', treffer.length === 1 && /Kerzengasse/.test(treffer[0]), treffer);

  await p.evaluate(() =>
    document.querySelector('.sugg button').dispatchEvent(new MouseEvent('mousedown', { bubbles: true })));
  await p.waitForTimeout(150);
  await p.evaluate(() =>
    [...document.querySelectorAll('.dlgbox .rowbtns button')].find((b) => /Save/.test(b.textContent)).click());
  await p.waitForTimeout(400);
  await p.evaluate(() => {
    document.querySelector('#facet').value = 'full';
    document.querySelector('#facet').dispatchEvent(new Event('change', { bubbles: true }));
  });
  await p.waitForTimeout(250);
  const verweis = await p.evaluate(() => {
    const dt = [...document.querySelectorAll('.fld dt')].find((d) => d.textContent === 'Home');
    return dt ? { wert: dt.nextElementSibling.textContent, klickbar: !!dt.nextElementSibling.querySelector('button.ref') } : null;
  });
  pruefe('a picked link is stored and renders as a jump', verweis?.klickbar === true && /Kerzengasse/.test(verweis?.wert ?? ''), verweis);

  pruefe('field kinds raised no exception', errs.length === 0, errs);
  await p.close();
}

/* 3 — ohne Antwort: die Seite sagt, was ausblieb, statt still zu warten */
{
  const { p, errs } = await seite('stumm.html', 11000);
  const s = await p.evaluate(() => ({
    banner: document.querySelector('#view .banner')?.textContent ?? null,
    laedt: document.getElementById('view').innerText.trim() === 'Loading…',
  }));
  pruefe('watchdog banner appears', /No data received/.test(s.banner ?? ''), s);
  pruefe('counts registry parts correctly', /0 of 5 registry parts/.test(s.banner ?? ''), s);
  pruefe('does not sit on Loading…', !s.laedt, s);
  pruefe('no exception without data', errs.length === 0, errs);
  await p.close();
}

await browser.close();
console.log(fehler ? `\n${fehler} check(s) failed.` : '\nAll checks passed.');
process.exit(fehler ? 1 : 0);
