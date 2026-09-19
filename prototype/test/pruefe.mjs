/* Prüflauf gegen den Prototyp. `node build-harness.mjs` vorher laufen lassen.
   Der Stub friert die Snapshot-Objekte ein wie die echte Laufzeit — siehe
   README.md; ein grosszügigerer Aufbau prüft nichts. */
import { chromium } from 'playwright';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

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


  /* 5 — Import: englische Namen in der Ausgabe, deutsche Vault-Schlüssel beim Lesen.
     Diese beiden Seiten einmal zu verwechseln bricht den Import still: die
     Notiz wird nicht mehr erkannt, oder der Artikel trägt eine Komponente,
     die das Register nicht kennt. */
  const FX = '/home/user/Nebelwacht/packages/import/test/fixtures';
  const lade = (d) => readdirSync(d).filter((f) => f.endsWith('.md'))
    .map((f) => ({ name: f, text: readFileSync(join(d, f), 'utf8') }));
  const fixtures = [...lade(FX), ...lade(join(FX, 'statblock'))];

  const imp = await p.evaluate((dn) => {
    const T = window.__T__;
    const r = T.runImport(dn);
    const ifs = new Set(Object.keys(T.REG.interfaces));
    const comps = new Set(Object.keys(T.REG.components));
    const rels = new Set(Object.keys(T.REG.relations));
    const fremd = [];
    r.all.forEach((e) => {
      (e.interfaces || []).forEach((i) => { if (!ifs.has(i)) fremd.push(`${e.name}: interface ${i}`); });
      Object.keys(e.components || {}).forEach((c) => { if (!comps.has(c)) fremd.push(`${e.name}: component ${c}`); });
      (e.relations || []).forEach((x) => { if (!rels.has(x.type)) fremd.push(`${e.name}: relation ${x.type}`); });
    });
    const schwert = r.all.find((e) => e.name === 'Bastardschwert');
    const kette = r.all.find((e) => /Kettenr/.test(e.name));
    const grimm = r.all.find((e) => e.name === 'Grimmhauer' && e.interfaces[0] === 'Statblock');
    return {
      zahlen: { item: r.item.length, statblock: r.statblock.length, rules: r.rules.length },
      fremd,
      unknown: r.unknown,
      schwert: schwert && { iface: schwert.interfaces[0], type: schwert.components.ItemInfo?.itemType,
                            dmg: schwert.components.WeaponInfo?.damage, fp: !!schwert.components.Footprint },
      kette: kette && { iface: kette.interfaces[0], ac: kette.components.ArmorInfo?.ac,
                        bild: !!kette.components.Image?.url },
      grimm: grimm && { size: grimm.components.StatblockInfo?.size, hp: grimm.components.StatblockInfo?.hp,
                        speed: grimm.components.StatblockInfo?.speed },
    };
  }, fixtures);

  pruefe('every vault note is recognised', imp.unknown.length === 0, imp.unknown);
  pruefe('the import emits only names the registry knows', imp.fremd.length === 0, imp.fremd);
  pruefe('items import as their subtype', imp.schwert?.iface === 'Weapon' && imp.kette?.iface === 'Armor', { s: imp.schwert, k: imp.kette });
  pruefe('item fields land under the English keys', imp.schwert?.dmg === '1d8 / 1d10' && imp.kette?.ac === 16, { s: imp.schwert, k: imp.kette });
  pruefe('the grid and the image survive', imp.schwert?.fp === true && imp.kette?.bild === true, { s: imp.schwert, k: imp.kette });
  pruefe('statblock label lines land under the English keys', imp.grimm?.hp === 45 && /40ft/.test(imp.grimm?.speed ?? ''), imp.grimm);
  pruefe('statblock sections become pooled rules', imp.zahlen.rules > 20, imp.zahlen);

  pruefe('field kinds and import raised no exception', errs.length === 0, errs);

  /* 6 — Ansichten als Werkzeugkasten, und ein Layout je Typ */
  await p.evaluate(() =>
    [...document.querySelectorAll('.rail button')].find((x) => /Registry/.test(x.textContent)).click());
  await p.waitForTimeout(200);
  await p.evaluate(() =>
    [...document.querySelectorAll('.tabs button')].find((x) => /Compendium/.test(x.textContent)).click());
  await p.waitForTimeout(250);
  const werkzeuge = await p.evaluate(() =>
    [...document.querySelectorAll('.tools button')].map((b) => b.textContent));
  pruefe('the toolbox offers every element', werkzeuge.length === 8 && werkzeuge.some((t) => /Field table/.test(t)), werkzeuge);

  await p.evaluate(() =>
    [...document.querySelectorAll('.regtree button')].find((b) => b.textContent === 'Full').click());
  await p.waitForTimeout(200);
  const umgewandelt = await p.evaluate(() =>
    [...document.querySelectorAll('.regbody .crow .cl b')].map((c) => c.textContent));
  /* Die alten Ansichten waren eine Sammlung von Schaltern. Sie müssen beim
     Lesen zu Elementen werden, sonst stünde hier eine leere Liste und die
     Ansicht sähe aus, als zeige sie nichts. */
  pruefe('an older view converts into elements', umgewandelt.includes('Description') && umgewandelt.includes('Field table'), umgewandelt);

  await p.evaluate(() => {
    const s = document.querySelector('.regbody select');
    [...s.options].forEach((o) => { if (/Statblock/.test(o.textContent)) s.value = o.value; });
    s.dispatchEvent(new Event('change', { bubbles: true }));
  });
  await p.waitForTimeout(250);
  await p.evaluate(() =>
    [...document.querySelectorAll('.tools button')].find((b) => /Heading/.test(b.textContent)).click());
  await p.waitForTimeout(300);
  await p.evaluate(() => {
    const t = document.querySelector('.fbox input');
    t.value = 'Statblocks only';
    t.dispatchEvent(new Event('change', { bubbles: true }));
  });
  await p.waitForTimeout(300);
  for (let i = 0; i < 6; i++) {
    await p.evaluate(() => {
      const r = [...document.querySelectorAll('.regbody .crow')].find((x) => /Heading/.test(x.textContent));
      const up = [...r.querySelectorAll('button')].find((b) => b.textContent === '↑');
      if (up && !up.disabled) up.click();
    });
    await p.waitForTimeout(140);
  }
  const reihe = await p.evaluate(() =>
    [...document.querySelectorAll('.regbody .crow .cl b')].map((c) => c.textContent));
  pruefe('elements can be reordered', reihe[0] === 'Heading', reihe);

  const zeig = async (name) => {
    await p.evaluate(() =>
      [...document.querySelectorAll('.rail button')].find((x) => /All articles/.test(x.textContent)).click());
    await p.waitForTimeout(200);
    await p.evaluate((n) =>
      [...document.querySelectorAll('#view .row')].find((r) => r.textContent.includes(n)).click(), name);
    await p.waitForTimeout(200);
    await p.evaluate(() => {
      const f = document.querySelector('#facet');
      f.value = 'full';
      f.dispatchEvent(new Event('change', { bubbles: true }));
    });
    await p.waitForTimeout(250);
    return p.evaluate(() => [...document.querySelectorAll('#view .sec')].map((x) => x.textContent));
  };
  const sb = await zeig('Kanalschleim');
  const npc = await zeig('Volo');
  pruefe('a per-type layout reaches that type', sb.includes('Statblocks only'), sb);
  pruefe('and leaves the other types alone', !npc.includes('Statblocks only'), npc);
  pruefe('views raised no exception', errs.length === 0, errs);
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
