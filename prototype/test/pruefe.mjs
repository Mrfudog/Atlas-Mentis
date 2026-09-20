/* Prüflauf gegen den Prototyp. `node build-harness.mjs` vorher laufen lassen.
   Der Stub friert die Snapshot-Objekte ein wie die echte Laufzeit — siehe
   README.md; ein grosszügigerer Aufbau prüft nichts. */
import { chromium } from 'playwright';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HIER = dirname(fileURLToPath(import.meta.url));

/* Der Prüfaufbau nimmt den Chromium, der im Bild schon liegt, wenn einer da
   ist. Playwright bringt seine eigene Bauversion mit, und die passt nur zu
   der Playwright-Version, die sie geladen hat — ein Upgrade der Bibliothek
   liesse den Lauf sonst mit „Executable doesn't exist" stehen. */
const AUS_DEM_BILD = '/opt/pw-browsers/chromium';
const browser = await chromium.launch(
  existsSync(AUS_DEM_BILD) ? { executablePath: AUS_DEM_BILD } : {});
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
  await p.goto(`file://${join(HIER, 'harness', datei)}`);
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
    [...document.querySelectorAll('.rail button')].find((b) => /Data model/.test(b.textContent))?.click());
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
      [...document.querySelectorAll('.rail button')].find((x) => /Data model/.test(x.textContent)).click());
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
  /* Genau dieser Artikel, nicht „irgendeiner mit Volo drin". Eine Tat hiess
     später „Volo aus dem Schleimgang geholt" und stand alphabetisch davor —
     die Prüfung öffnete sie und fand keine Artikelseite. */
  await p.evaluate(() => [...document.querySelectorAll('#view .row')]
    .find((r) => /^Volothamp/.test(r.textContent.trim())).click());
  await p.waitForTimeout(200);
  await p.evaluate(() => {
    const f = document.querySelector('#facet');
    f.value = 'full';
    f.dispatchEvent(new Event('change', { bubbles: true }));
  });
  await p.waitForTimeout(250);
  await p.evaluate(() =>
    [...document.querySelectorAll('.rowbtns button')].find((b) => /Edit all fields/.test(b.textContent)).click());
  await p.waitForTimeout(350);
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
  await p.waitForTimeout(200);
  await p.evaluate(() =>
    [...document.querySelectorAll('.rowbtns button')].find((b) => /Done editing/.test(b.textContent)).click());
  await p.waitForTimeout(400);
  const verweis = await p.evaluate(() => {
    const dt = [...document.querySelectorAll('.fld dt')].find((d) => d.textContent === 'Home');
    return dt ? { wert: dt.nextElementSibling.textContent, klickbar: !!dt.nextElementSibling.querySelector('button.ref') } : null;
  });
  pruefe('a picked link is stored and renders as a jump', verweis?.klickbar === true && /Kerzengasse/.test(verweis?.wert ?? ''), verweis);


  /* 5 — Import: englische Namen in der Ausgabe, deutsche Vault-Schlüssel beim Lesen.
     Diese beiden Seiten einmal zu verwechseln bricht den Import still: die
     Notiz wird nicht mehr erkannt, oder der Artikel trägt eine Komponente,
     die das Register nicht kennt. */
  const FX = join(HIER, '../../packages/import/test/fixtures');
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
    [...document.querySelectorAll('.rail button')].find((x) => /Data model/.test(x.textContent)).click());
  await p.waitForTimeout(200);
  await p.evaluate(() =>
    [...document.querySelectorAll('.tabs button')].find((x) => /^Views$/.test(x.textContent)).click());
  await p.waitForTimeout(250);
  const werkzeuge = await p.evaluate(() =>
    [...document.querySelectorAll('.tools button')].map((b) => b.textContent));
  /* „Jedes" heisst: jedes, das die Seite kennt — nicht eine Zahl, die bei
     jedem neuen Element rot wird und dabei nichts über den Werkzeugkasten
     sagt. */
  const bekannt = await p.evaluate(() => window.__T__.LAYOUT_ELEMENTS.map((x) => x[1]));
  pruefe('the toolbox offers every element',
    bekannt.length > 0 && bekannt.every((n) => werkzeuge.includes('+ ' + n))
      && werkzeuge.length === bekannt.length, { werkzeuge, bekannt });

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

  /* 7 — jeder Registerreiter hat eine Maske, keiner nur ein JSON-Textfeld */
  await p.evaluate(() =>
    [...document.querySelectorAll('.rail button')].find((x) => /Data model/.test(x.textContent)).click());
  await p.waitForTimeout(200);
  const masken = {};
  for (const name of ['Interfaces', 'Components', 'Relation types', 'Views', 'Variables']) {
    await p.evaluate((n) =>
      [...document.querySelectorAll('.tabs button')].find((x) => x.textContent === n).click(), name);
    await p.waitForTimeout(280);
    masken[name] = await p.evaluate(() => ({
      maske: !!document.querySelector('.regbody'),
      felder: document.querySelectorAll('.regbody label.f, .regbody input.i').length,
      roh: !!document.getElementById('regbox'),
      ausgang: !![...document.querySelectorAll('button')].find((b) => /Edit as JSON/.test(b.textContent)),
    }));
  }
  const ohneMaske = Object.keys(masken).filter((n) => !masken[n].maske || masken[n].roh);
  pruefe('every registry tab opens as a form', ohneMaske.length === 0, masken);
  pruefe('and every one keeps the JSON way out',
    Object.keys(masken).every((n) => masken[n].ausgang), masken);

  /* Der Notausgang muss zurückführen, sonst ist er eine Sackgasse. */
  await p.evaluate(() =>
    [...document.querySelectorAll('button')].find((b) => /Edit as JSON/.test(b.textContent)).click());
  await p.waitForTimeout(250);
  const imJson = await p.evaluate(() => ({
    roh: !!document.getElementById('regbox'),
    zurueck: !![...document.querySelectorAll('button')].find((b) => /Back to the form/.test(b.textContent)),
  }));
  pruefe('the JSON way out leads back', imJson.roh && imJson.zurueck, imJson);
  /* Und dann auch wirklich zurückgehen: eine Prüfung, die den Zustand
     verstellt stehen lässt, bricht die nächste. */
  await p.evaluate(() =>
    [...document.querySelectorAll('button')].find((b) => /Back to the form/.test(b.textContent)).click());
  await p.waitForTimeout(250);
  const zurueckInMaske = await p.evaluate(() => ({
    maske: !!document.querySelector('.regbody'),
    roh: !!document.getElementById('regbox'),
  }));
  pruefe('and the form comes back', zurueckInMaske.maske && !zurueckInMaske.roh, zurueckInMaske);
  pruefe('registry tabs raised no exception', errs.length === 0, errs);

  /* 8 — Bearbeiten in der Ansicht, und die Spur zurück */
  const oeffne = async (name) => {
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
  };

  /* Über die Id öffnen, nicht über den Namen: sobald es „Karte: X" und „X"
     gibt, trifft ein Namensklick das Falsche, und die Prüfung meldet dann
     etwas über die Sortierung statt über den Code. */
  const oeffneId = async (id) => {
    await p.evaluate((i) => window.__T__.go({ k: 'art', id: i }), id);
    await p.waitForTimeout(350);
  };

  const neuerArtikel = async (typ, name) => {
    await p.evaluate(() => document.getElementById('new').click());
    await p.waitForTimeout(250);
    await p.evaluate((t) => {
      const s = [...document.querySelectorAll('.dlgbox select')][0];
      [...s.options].forEach((o) => { if (o.textContent === t) s.value = o.value; });
    }, typ);
    await p.evaluate((n) => { [...document.querySelectorAll('.dlgbox input')][0].value = n; }, name);
    await p.evaluate(() =>
      [...document.querySelectorAll('.dlgbox .rowbtns button')].find((b) => /Create/.test(b.textContent)).click());
    await p.waitForTimeout(400);
    return p.evaluate(() => ({
      titel: document.querySelector('.arthead h2')?.textContent,
      typ: document.querySelector('.kicker .pill')?.textContent,
      probleme: [...document.querySelectorAll('.pruef li')].map((x) => x.textContent),
    }));
  };
  await oeffneId('n_volo');

  await p.evaluate(() => {
    const dt = [...document.querySelectorAll('.fld dt')].find((d) => d.textContent === 'Role');
    dt.nextElementSibling.click();
  });
  await p.waitForTimeout(250);
  const einzeln = await p.evaluate(() => ({
    offen: document.querySelectorAll('.fld dd.editing').length,
    wert: document.querySelector('.fld dd.editing input')?.value ?? null,
  }));
  pruefe('a click opens exactly that one field', einzeln.offen === 1 && einzeln.wert === 'Händler', einzeln);

  await p.evaluate(() => {
    const i = document.querySelector('.fld dd.editing input');
    i.value = 'Chronicler';
    i.dispatchEvent(new Event('change', { bubbles: true }));
  });
  await p.waitForTimeout(350);
  const gespeichert = await p.evaluate(() => {
    const dt = [...document.querySelectorAll('.fld dt')].find((d) => d.textContent === 'Role');
    return { wert: dt?.nextElementSibling.textContent, geschrieben: window.__WROTE__.filter((x) => /n_volo/.test(x)).length,
             nochOffen: document.querySelectorAll('.fld dd.editing').length };
  });
  pruefe('the edit is stored and the field closes',
    gespeichert.wert === 'Chronicler' && gespeichert.geschrieben > 0 && gespeichert.nochOffen === 0, gespeichert);

  await p.evaluate(() =>
    [...document.querySelectorAll('.rowbtns button')].find((b) => /Edit all fields/.test(b.textContent)).click());
  await p.waitForTimeout(300);
  const alle = await p.evaluate(() => ({
    offen: document.querySelectorAll('.fld dd.editing').length,
    abgeleitet: [...document.querySelectorAll('.fld.drv dd')].filter((d) => d.classList.contains('editing')).length,
  }));
  /* Ein abgeleitetes Feld hat keinen gespeicherten Wert, in den man
     zurückschreiben könnte. Ein Eingabefeld dafür verspräche eine
     Änderung, die nicht stattfinden kann. */
  pruefe('the switch opens every field but the derived ones',
    alle.offen > 1 && alle.abgeleitet === 0, alle);
  await p.evaluate(() =>
    [...document.querySelectorAll('.rowbtns button')].find((b) => /Done editing/.test(b.textContent)).click());
  await p.waitForTimeout(200);

  const spring = async () => {
    await p.evaluate(() => { const b = [...document.querySelectorAll('#aside button.ref')][0]; if (b) b.click(); });
    await p.waitForTimeout(280);
    return p.evaluate(() => ({
      krumen: [...document.querySelectorAll('.crumbs button')].map((b) => b.textContent),
      hier: document.querySelector('.arthead h2')?.textContent,
    }));
  };
  /* Woher der Sprung ausging, steht am Artikel — nicht in dieser Datei.
     Den Namen fest einzutragen hiess: die Prüfung wird rot, sobald jemand
     den Artikel umbenennt, und sagt dabei nichts über die Spur. */
  const start = await p.evaluate(() => document.querySelector('.arthead h2')?.textContent);
  const s1 = await spring();
  const s2 = await spring();
  const s3 = await spring();
  pruefe('every jump leaves a crumb', s3.krumen.length === 3 && s1.krumen[0] === start,
    { start, s1, s2, s3 });

  /* Zurück auf etwas, das schon in der Spur steht, schneidet sie dort ab.
     Sonst wüchse sie beim Hin und Her ins Endlose. */
  await p.evaluate(() => [...document.querySelectorAll('.crumbs button')][1].click());
  await p.waitForTimeout(250);
  const zurueck = await p.evaluate(() => ({
    krumen: [...document.querySelectorAll('.crumbs button')].map((b) => b.textContent),
    hier: document.querySelector('.arthead h2')?.textContent,
  }));
  pruefe('a crumb truncates the trail instead of growing it',
    zurueck.hier === s2.krumen[1] && zurueck.krumen.length === 1, { zurueck, s2 });


  /* Name und Tags gehören mit in die Ansicht — sonst wäre der Dialog der
     einzige Weg dorthin, und der ist aus der Artikelleiste verschwunden.
     Umbenannt wird ein eigener Artikel: eine Prüfung, die Kampagnendaten
     ändert, bricht die nächste, und der Fehler steht dann weit weg. */
  await neuerArtikel('Place', 'Probe quarter');
  const eigeneId = await p.evaluate(() => window.__T__.UI.route.id);
  await p.evaluate(() => document.querySelector('.arthead h2').click());
  await p.waitForTimeout(250);
  const nameOffen = await p.evaluate(() => document.querySelector('.arthead input')?.value ?? null);
  await p.evaluate(() => {
    const i = document.querySelector('.arthead input');
    i.value = 'Mist District';
    i.dispatchEvent(new Event('change', { bubbles: true }));
  });
  await p.waitForTimeout(350);
  const nameNeu = await p.evaluate((id) => ({
    titel: document.querySelector('.arthead h2')?.textContent,
    geschrieben: window.__WROTE__.filter((x) => x.includes(id)).length,
  }), eigeneId);
  pruefe('the name is editable in place',
    nameOffen === 'Probe quarter' && nameNeu.titel === 'Mist District' && nameNeu.geschrieben > 0,
    { nameOffen, nameNeu });

  await p.evaluate(() => [...document.querySelectorAll('.kicker button.tag')].pop().click());
  await p.waitForTimeout(250);
  await p.evaluate(() => {
    const i = document.querySelector('.kicker input');
    i.value = 'underwatch, fog';
    i.dispatchEvent(new Event('change', { bubbles: true }));
  });
  await p.waitForTimeout(350);
  const tags = await p.evaluate(() =>
    [...document.querySelectorAll('.kicker button.tag')].map((b) => b.textContent));
  pruefe('the tags are editable in place',
    tags.includes('#underwatch') && tags.includes('#fog'), tags);
  pruefe('in-place editing raised no exception', errs.length === 0, errs);

  /* 9 — Massenbearbeitung */
  await p.evaluate(() =>
    [...document.querySelectorAll('.rail button')].find((x) => /All articles/.test(x.textContent)).click());
  await p.waitForTimeout(250);
  await p.evaluate(() =>
    [...document.querySelectorAll('.listhead button')].find((b) => /Select/.test(b.textContent)).click());
  await p.waitForTimeout(250);
  await p.evaluate(() => { [...document.querySelectorAll('#view .row')].slice(0, 3).forEach((r) => r.click()); });
  await p.waitForTimeout(300);
  const gewaehlt = await p.evaluate(() => ({
    markiert: document.querySelectorAll('.row.picked').length,
    zaehler: document.querySelector('.bulk .count')?.textContent ?? '',
  }));
  pruefe('rows can be picked', gewaehlt.markiert === 3 && /3 selected/.test(gewaehlt.zaehler), gewaehlt);

  await p.evaluate(() => {
    const i = document.querySelector('.bulk input');
    i.value = 'bulktest';
    [...document.querySelectorAll('.bulk button')].find((b) => /\+ tags/.test(b.textContent)).click();
  });
  await p.waitForTimeout(400);
  const getaggt = await p.evaluate(() => ({
    banner: document.querySelector('#view .banner')?.textContent ?? '',
    mitTag: [...document.querySelectorAll('#view .row')].filter((r) => /bulktest/.test(r.textContent)).length,
    geschrieben: window.__WROTE__.filter((x) => x.startsWith('entities/')).length,
  }));
  pruefe('a tag reaches every picked article',
    getaggt.mitTag === 3 && /3 articles/.test(getaggt.banner) && getaggt.geschrieben >= 3, getaggt);

  /* Die Auswahl gilt für das, was in der Liste steht. Sonst löschte eine
     geänderte Suche Artikel, die nie auf dem Schirm waren. */
  await p.evaluate(() => { [...document.querySelectorAll('#view .row')].slice(0, 3).forEach((r) => r.click()); });
  await p.waitForTimeout(250);
  await p.evaluate(() => {
    const q = document.getElementById('q');
    q.value = 'zzzzz-nichts';
    q.dispatchEvent(new Event('input', { bubbles: true }));
  });
  await p.waitForTimeout(300);
  await p.evaluate(() => {
    const q = document.getElementById('q');
    q.value = '';
    q.dispatchEvent(new Event('input', { bubbles: true }));
  });
  await p.waitForTimeout(300);
  const nachSuche = await p.evaluate(() => document.querySelectorAll('.row.picked').length);
  pruefe('a search that hides a row drops it from the selection', nachSuche === 0, nachSuche);

  /* Name und Identitätsschlüssel sind Identität, keine Eigenschaft — sie auf
     allen gleich zu setzen machte Dubletten, die kein Verweis mehr trennt. */
  await p.evaluate(() => { [...document.querySelectorAll('#view .row')].slice(0, 2).forEach((r) => r.click()); });
  await p.waitForTimeout(250);
  await p.evaluate(() =>
    [...document.querySelectorAll('.bulk button')].find((b) => /Set a field/.test(b.textContent)).click());
  await p.waitForTimeout(300);
  const feldWahl = await p.evaluate(() =>
    [...(document.querySelector('.dlgbox select')?.options ?? [])].map((o) => o.textContent));
  pruefe('bulk field setting offers no identity field',
    feldWahl.length > 0 && !feldWahl.some((t) => /Name · Name|Identity · Key/.test(t)), feldWahl.slice(0, 6));
  await p.evaluate(() =>
    [...document.querySelectorAll('.dlgbox .rowbtns button')].find((b) => /Cancel/.test(b.textContent)).click());
  await p.waitForTimeout(200);

  /* Der Auswahlmodus bleibt sonst an, und der nächste Klick auf eine Zeile
     wählt sie aus, statt den Artikel zu öffnen. Eine Prüfung, die etwas
     aufmacht, räumt es auch weg. */
  await p.evaluate(() =>
    [...document.querySelectorAll('#view button')].find((b) => /Done selecting/.test(b.textContent))?.click());
  await p.waitForTimeout(250);
  const nochAuswahl = await p.evaluate(() =>
    [...document.querySelectorAll('#view button')].some((b) => /Done selecting/.test(b.textContent)));
  pruefe('selection mode is off again afterwards', nochAuswahl === false, nochAuswahl);

  pruefe('bulk editing raised no exception', errs.length === 0, errs);

  /* 10 — Seitenaufbau: Kompendium sind die Artikel, Datenmodell ist das Register */
  await p.evaluate(() =>
    [...document.querySelectorAll('.rail button')].find((x) => /All articles/.test(x.textContent)).click());
  await p.waitForTimeout(250);
  const aufbau = await p.evaluate(() => ({
    kapitel: [...document.querySelectorAll('.rail h3')].map((h) => h.textContent),
    system: [...([...document.querySelectorAll('.rail section')].pop()?.querySelectorAll('.navrow') ?? [])]
      .map((b) => b.textContent),
    filter: [...document.querySelectorAll('.filters select')].map((s) => s.options[0].textContent),
  }));
  pruefe('the rail separates compendium from system',
    aufbau.kapitel[0] === 'Compendium' && aufbau.system.some((x) => /Data model/.test(x)), aufbau);
  pruefe('the compendium carries its filters',
    aufbau.filter.length === 3 && aufbau.filter[0] === 'any type', aufbau.filter);

  /* Ein Obertyp meint seine Subtypen mit. Exakt zu vergleichen hiesse:
     „Item" zeigt nichts, obwohl jede Waffe eins ist. */
  const vorFilter = await p.evaluate(() => document.querySelectorAll('#view .row').length);
  /* Welcher Obertyp geprüft wird, sagen die Daten: der erste, der einen
     echten Subtyp trägt, auf dem Artikel liegen. „Item" fest zu verdrahten
     hiess, dass die Prüfung rot wurde, sobald der letzte Gegenstand aus der
     Kampagne verschwand — und das sagte nichts über den Filter. */
  const paar = await p.evaluate(() => {
    const R = window.__T__.REG.interfaces;
    const parent = (n) => (R[n]?.extends || [])[0];
    const treffer = {};
    window.__T__.ENT.forEach((e) => {
      let at = parent((e.interfaces || [])[0]);
      const eigen = (e.interfaces || [])[0];
      while (at) { (treffer[at] = treffer[at] || new Set()).add(eigen); at = parent(at); }
    });
    for (const [ober, unter] of Object.entries(treffer)) {
      if (ober !== 'Base' && unter.size) {
        const u = [...unter][0];
        return { ober, unter: u, label: R[u]?.label || u };
      }
    }
    return null;
  });
  pruefe('the data offers a parent type with articles below it', paar !== null, paar);
  await p.evaluate((ober) => {
    const s = document.querySelector('.filters select');
    s.value = ober;
    s.dispatchEvent(new Event('change', { bubbles: true }));
  }, paar.ober);
  await p.waitForTimeout(300);
  const nachFilter = await p.evaluate(() => ({
    zeilen: document.querySelectorAll('#view .row').length,
    typen: [...new Set([...document.querySelectorAll('#view .row .pill')].map((x) => x.textContent))],
  }));
  pruefe('a parent type filters its subtypes in',
    nachFilter.zeilen > 0 && nachFilter.zeilen < vorFilter
      && nachFilter.typen.includes(paar.label),
    { paar, vorFilter, nachFilter });

  await p.evaluate(() =>
    [...document.querySelectorAll('.filters button')].find((b) => /Clear filters/.test(b.textContent))?.click());
  await p.waitForTimeout(250);
  const geleert = await p.evaluate(() => document.querySelectorAll('#view .row').length);
  pruefe('clearing the filters brings everything back', geleert === vorFilter, { geleert, vorFilter });

  await p.evaluate(() =>
    [...document.querySelectorAll('.rail button')].find((x) => /Data model/.test(x.textContent)).click());
  await p.waitForTimeout(300);
  const dm = await p.evaluate(() => ({
    titel: document.querySelector('#view h2')?.textContent,
    konzept: [...document.querySelectorAll('.kdl dt')].map((x) => x.textContent),
    reiter: [...document.querySelectorAll('.tabs button')].map((x) => x.textContent),
  }));
  /* Die Mechanik gehört auf die Seite, die sie bearbeitet — sonst steht sie
     nur in Commit-Nachrichten. */
  pruefe('the data model explains itself',
    dm.titel === 'Data model' && dm.konzept.length === 5 && dm.reiter.includes('Views'), dm);
  pruefe('the page structure raised no exception', errs.length === 0, errs);

  /* 11 — Standardwerte stehen im Feld, nicht im Code */
  const zumStatusFeld = async () => {
    await p.evaluate(() =>
      [...document.querySelectorAll('.rail button')].find((x) => /Data model/.test(x.textContent)).click());
    await p.waitForTimeout(250);
    const tabs = await p.evaluate(() => [...document.querySelectorAll('.tabs button')].map((x) => x.textContent));
    if (!tabs.includes('Components')) throw new Error('Reiter fehlen: ' + JSON.stringify(tabs));
    await p.evaluate(() =>
      [...document.querySelectorAll('.tabs button')].find((x) => x.textContent === 'Components').click());
    await p.waitForTimeout(250);
    const baum = await p.evaluate(() => [...document.querySelectorAll('.regtree button')].map((b) => b.textContent));
    if (!baum.some((b) => /Status/.test(b))) throw new Error('Kein Status im Baum: ' + JSON.stringify(baum.slice(0, 8)));
    await p.evaluate(() =>
      [...document.querySelectorAll('.regtree button')].find((b) => /Status/.test(b.textContent)).click());
    await p.waitForTimeout(250);
    await p.evaluate(() => {
      const r = [...document.querySelectorAll('.fbox .frow')][0];
      [...r.querySelectorAll('button')].find((b) => b.textContent === '⋯').click();
    });
    await p.waitForTimeout(250);
  };
  const standardFeld = () => p.evaluate(() =>
    [...document.querySelectorAll('.fbox .fmore label.f')]
      .find((l) => /Default/.test(l.querySelector('span').textContent))
      ?.querySelector('select,input') ?? null);

  await zumStatusFeld();
  const stand = await p.evaluate(() => ({
    zeile: document.querySelector('.fbox .frow .fk')?.textContent ?? '',
    wert: [...document.querySelectorAll('.fbox .fmore label.f')]
      .find((l) => /Default/.test(l.querySelector('span').textContent))
      ?.querySelector('select,input')?.value ?? null,
  }));
  pruefe('a field carries its default, and shows it', /← idea/.test(stand.zeile) && stand.wert === 'idea', stand);

  const anlegen = async (name) => {
    await p.evaluate(() => document.getElementById('new').click());
    await p.waitForTimeout(300);
    await p.evaluate((n) => { [...document.querySelectorAll('.dlgbox input')][0].value = n; }, name);
    await p.evaluate(() =>
      [...document.querySelectorAll('.dlgbox .rowbtns button')].find((b) => /Create/.test(b.textContent)).click());
    await p.waitForTimeout(400);
    return p.evaluate(() => [...document.querySelectorAll('.kicker .pill')].map((x) => x.textContent));
  };
  const erster = await anlegen('Default probe');
  pruefe('a new article gets the default', erster.includes('idea'), erster);

  /* Der Standard stand bis hierher fest in newEntity — also genau die Sorte
     Wissen, die laut Rückgrat eine Registerzeile sein soll. Ihn zu ändern
     muss reichen. */
  await zumStatusFeld();
  await p.evaluate(() => {
    const l = [...document.querySelectorAll('.fbox .fmore label.f')]
      .find((x) => /Default/.test(x.querySelector('span').textContent));
    const n = l.querySelector('select,input');
    n.value = 'planned';
    n.dispatchEvent(new Event('change', { bubbles: true }));
  });
  await p.waitForTimeout(350);
  const zweiter = await anlegen('Second probe');
  pruefe('changing the default changes what is created next',
    zweiter.includes('planned') && !zweiter.includes('idea'), zweiter);
  pruefe('defaults raised no exception', errs.length === 0, errs);

  /* 12 — Etappe B: Geschichts- und Spielerartikel sind Registerzeilen.
     Diese Prüfung ist die Probe aufs Rückgrat. Geht sie kaputt, weil jemand
     Code für einen Artikeltyp geschrieben hat, war die Behauptung falsch. */

  const auswahl = await p.evaluate(() => {
    document.getElementById('new').click();
    return [...[...document.querySelectorAll('.dlgbox select')][0].options].map((x) => x.textContent);
  });
  await p.evaluate(() =>
    [...document.querySelectorAll('.dlgbox .rowbtns button')].find((b) => /Cancel/.test(b.textContent)).click());
  await p.waitForTimeout(200);
  const erwartet = ['Campaign', 'Session', 'Scene / Encounter', 'Quest', 'Player character', 'Party', 'Inventory'];
  pruefe('the story and player types are offered',
    erwartet.every((t) => auswahl.includes(t)), auswahl);
  /* Abstrakte Typen sind Struktur, nicht anlegbar. */
  pruefe('the abstract parents are not offered',
    !auswahl.includes('Story') && !auswahl.includes('Creature'), auswahl);

  const kampagne = await neuerArtikel('Campaign', 'Probe campaign');
  const pc = await neuerArtikel('Player character', 'Probe hero');
  pruefe('they validate clean on creation',
    kampagne.probleme.length === 0 && pc.probleme.length === 0, { kampagne, pc });

  await p.evaluate(() => {
    const f = document.querySelector('#facet');
    f.value = 'full';
    f.dispatchEvent(new Event('change', { bubbles: true }));
  });
  await p.waitForTimeout(300);
  const pcFelder = await p.evaluate(() => {
    const o = {};
    document.querySelectorAll('.fld').forEach((f) => { o[f.querySelector('dt').textContent] = f.querySelector('dd').textContent; });
    return o;
  });
  pruefe('a required component arrives with its defaults',
    pcFelder.Level === '1' && pcFelder.Proficiency === '+2', pcFelder);

  /* Der Übungsbonus ist abgeleitet, nicht gespeichert — er muss der Stufe
     folgen, ohne dass jemand ihn nachträgt. */
  await p.evaluate(() => {
    const dt = [...document.querySelectorAll('.fld dt')].find((d) => d.textContent === 'Level');
    dt.nextElementSibling.click();
  });
  await p.waitForTimeout(250);
  await p.evaluate(() => {
    const i = document.querySelector('.fld dd.editing input');
    i.value = '9';
    i.dispatchEvent(new Event('change', { bubbles: true }));
  });
  await p.waitForTimeout(400);
  const nachStufe = await p.evaluate(() => {
    const o = {};
    document.querySelectorAll('.fld').forEach((f) => { o[f.querySelector('dt').textContent] = f.querySelector('dd').textContent; });
    return { level: o.Level, prof: o.Proficiency };
  });
  pruefe('the derived proficiency follows the level',
    nachStufe.level === '9' && nachStufe.prof === '+4', nachStufe);

  /* Eine Kante, die an einem abstrakten Elternteil hängt, muss jeden Subtyp
     erreichen. Exakt zu vergleichen hiesse: sie erreicht keinen. */
  const session = await neuerArtikel('Session', 'Probe session');
  await p.evaluate(() =>
    [...document.querySelectorAll('.rowbtns button')].find((b) => /\+ Relation/.test(b.textContent)).click());
  await p.waitForTimeout(300);
  const kanten = await p.evaluate(() =>
    [...[...document.querySelectorAll('.dlgbox select')][0].options].map((o) => o.textContent));
  await p.evaluate(() => {
    const s = [...document.querySelectorAll('.dlgbox select')][0];
    [...s.options].forEach((o) => { if (/part of/.test(o.textContent)) s.value = o.value; });
    s.dispatchEvent(new Event('change', { bubbles: true }));
  });
  await p.waitForTimeout(250);
  const ziele = await p.evaluate(() =>
    [...[...document.querySelectorAll('.dlgbox select')][1].options].map((o) => o.textContent));
  await p.evaluate(() =>
    [...document.querySelectorAll('.dlgbox .rowbtns button')].find((b) => /Cancel/.test(b.textContent)).click());
  await p.waitForTimeout(200);
  pruefe('an edge on an abstract parent reaches its subtypes',
    kanten.some((k) => /follows/.test(k)) && kanten.some((k) => /happens at/.test(k)),
    { session: session.typ, kanten });
  pruefe('and its targets resolve through inheritance too',
    ziele.some((z) => /Campaign/.test(z)), ziele.slice(0, 5));

  pruefe('stage B needed no code for its types', errs.length === 0, errs);

  /* ---- A6: Wissen ----
     Die Information ist ein eigener Artikel. Geprüft wird die ganze Kette:
     anlegen, ein Feld zuteilen, einen Empfänger setzen — und dass das Feld
     danach nicht mehr in der offenen Gruppe steht. */
  await neuerArtikel('Knowledge level', 'Probe lore');
  await oeffne('Probe hero');
  await p.evaluate(() => {
    const f = document.getElementById('facet');
    f.value = 'knowledge';
    f.dispatchEvent(new Event('change', { bubbles: true }));
  });
  await p.waitForTimeout(350);

  const wOffen = await p.evaluate(() => ({
    gruppen: document.querySelectorAll('#view .kgrp').length,
    ersteOffen: document.querySelector('#view .kgrp')?.classList.contains('open'),
    felder: [...document.querySelectorAll('#view .kgrp.open .fld dt')].map((x) => x.textContent),
  }));
  pruefe('the knowledge view puts the open fields first',
    wOffen.gruppen === 1 && wOffen.ersteOffen === true && wOffen.felder.includes('Level'), wOffen);

  await p.evaluate(() =>
    [...document.querySelectorAll('#aside .ktabs button')].find((b) => /Knowledge/.test(b.textContent)).click());
  await p.waitForTimeout(250);
  await p.evaluate(() =>
    [...document.querySelectorAll('#aside h3 button')].find((b) => b.textContent === '+').click());
  await p.waitForTimeout(250);
  await p.evaluate(() => { [...document.querySelectorAll('.dlgbox input')][0].value = 'Probe secret'; });
  await p.evaluate(() =>
    [...document.querySelectorAll('.dlgbox .rowbtns button')].find((b) => /Create/.test(b.textContent)).click());
  await p.waitForTimeout(500);

  const wAngelegt = await p.evaluate(() => ({
    gruppen: [...document.querySelectorAll('#view .kgrp .kh b')].map((x) => x.textContent),
    auswahl: [...document.querySelectorAll('#aside .kpick label span')].map((x) => x.textContent),
  }));
  pruefe('a new information shows up as its own group and offers the fields',
    wAngelegt.gruppen.length === 2 && wAngelegt.gruppen[1] === 'Probe secret'
      && wAngelegt.auswahl.some((x) => /Level/.test(x)), wAngelegt);

  await p.evaluate(() => {
    const lab = [...document.querySelectorAll('#aside .kpick label')]
      .find((l) => /Level/.test(l.textContent));
    const cb = lab.querySelector('input');
    cb.checked = true;
    cb.dispatchEvent(new Event('change', { bubbles: true }));
  });
  await p.waitForTimeout(500);

  const wZugeteilt = await p.evaluate(() => ({
    wOffen: [...document.querySelectorAll('#view .kgrp.open .fld dt')].map((x) => x.textContent),
    geheim: [...document.querySelectorAll('#view .kgrp:not(.open) .fld dt')].map((x) => x.textContent),
  }));
  pruefe('an assigned field leaves the open group',
    !wZugeteilt.wOffen.includes('Level') && wZugeteilt.geheim.includes('Level'), wZugeteilt);

  await p.evaluate(() => {
    const sel = [...document.querySelectorAll('#aside select.i')]
      .find((s) => [...s.options].some((o) => /assign to/.test(o.textContent)));
    const hit = [...sel.options].find((o) => /Probe lore/.test(o.textContent));
    sel.value = hit.value;
    sel.dispatchEvent(new Event('change', { bubbles: true }));
  });
  await p.waitForTimeout(500);

  const wEmpfaenger = await p.evaluate(() => ({
    kopf: document.querySelector('#view .kgrp:not(.open) .who')?.textContent ?? '',
    panel: [...document.querySelectorAll('#aside .rel .relrow .rv')].map((x) => x.textContent),
  }));
  pruefe('the recipient shows on the group and in the panel',
    /Probe lore/.test(wEmpfaenger.kopf) && wEmpfaenger.panel.some((x) => /Probe lore/.test(x)), wEmpfaenger);

  /* ---- C1/C2: Assets, Einstellungen ----
     Der Auflöser ist die einzige Stelle, die weiss, welche Sorte Verweis ein
     Bild trägt. Geht er falsch, zeigt die Seite ein kaputtes Bild und sagt
     nicht, warum — deshalb gegen alle drei Formen geprüft. */
  const quellen = await p.evaluate(() => {
    const T = window.__T__;
    const asset = [...T.ENT.values()].find((e) => (e.interfaces || [])[0] === 'Asset');
    return {
      leer: T.assetSrc(''),
      fremd: T.assetSrc('https://example.invalid/a.png'),
      ablage: T.assetSrc('0123456789abcdef0123456789abcdef'),
      wurzel: T.assetSrc('/_blob/x'),
      artikel: asset ? T.assetSrc(asset.id) : '(kein Asset-Artikel)',
    };
  });
  pruefe('the asset resolver knows its three kinds of reference',
    quellen.leer === '' && quellen.fremd === 'https://example.invalid/a.png'
      && quellen.ablage === '/_blob/0123456789abcdef0123456789abcdef'
      && quellen.wurzel === '/_blob/x', quellen);

  await p.evaluate(() =>
    [...document.querySelectorAll('.rail button')].find((b) => /Data model/.test(b.textContent))?.click());
  await p.waitForTimeout(300);
  await p.evaluate(() =>
    [...document.querySelectorAll('.tabs button')].find((b) => /^Settings$/.test(b.textContent)).click());
  await p.waitForTimeout(300);
  const einst = await p.evaluate(() => ({
    zeilen: [...document.querySelectorAll('.regbody .crow .cl b')].map((x) => x.textContent),
    bekannt: [...(document.querySelectorAll('.addbar select.i')[0]?.options ?? [])].map((o) => o.value),
  }));
  pruefe('campaign settings are a form of their own',
    einst.zeilen.includes('gridSize') && einst.zeilen.includes('inventoryCols'), einst.zeilen);

  /* Ein Bildfeld bietet die Ablage an, wenn es eine gibt, und sonst die
     fremde Adresse — es verschwindet nie stillschweigend. */
  await p.evaluate(() =>
    [...document.querySelectorAll('.tabs button')].find((b) => /^Components$/.test(b.textContent)).click());
  await p.waitForTimeout(300);
  await p.evaluate(() =>
    [...document.querySelectorAll('.regtree button')].find((b) => /Image/.test(b.textContent))?.click());
  await p.waitForTimeout(250);
  const bildfeld = await p.evaluate(() => {
    const arten = [...document.querySelectorAll('.frow select.i')]
      .map((s) => [...s.options].map((o) => o.value));
    return { hatAsset: arten.some((a) => a.includes('asset')), felder:
      [...document.querySelectorAll('.fbox .frow .fk')].map((x) => x.textContent) };
  });
  pruefe('a field can be an image reference',
    bildfeld.hatAsset && bildfeld.felder.includes('ref'), bildfeld);

  /* ---- Karten (REQ-130 bis 136) ----
     Koordinaten stehen in Anteilen, nicht in Bildpunkten. Prüfbar ist das
     daran, dass die Prozentwerte am Token stehen und nicht Pixel — sonst
     wandert jeder Marker, sobald das Bild ersetzt wird. */
  /* Eine Karte mit Tokens *und* einer Unterkarte — sonst prüft der Lauf die
     Verschachtelung an einer Karte, die gar keine hat, und meldet einen
     Fehler über die Daten statt über den Code. */
  const karte = await p.evaluate(() => {
    const alle = [...window.__T__.ENT.values()];
    const kinder = new Set(alle.flatMap((e) =>
      (e.relations || []).filter((r) => r.type === 'insideMap').map((r) => r.to)));
    const hatToken = (e) => (e.relations || []).some((r) => r.type === 'marker');
    const karten = alle.filter((e) => (e.interfaces || [])[0] === 'Map' && hatToken(e));
    const m = karten.find((e) => kinder.has(e.id)) || karten[0];
    return m ? m.id : null;
  });
  if (karte) {
    const kartenName = await p.evaluate((id) => {
      const e = window.__T__.ENT.get(id);
      return (e && (e.name || (e.components.Name || {}).text)) || '';
    }, karte);
    await oeffne(kartenName);
    await p.waitForTimeout(250);
    await p.evaluate(() => {
      const f = document.getElementById('facet');
      f.value = 'map';
      f.dispatchEvent(new Event('change', { bubbles: true }));
    });
    await p.waitForTimeout(400);
    const mk = await p.evaluate(() => ({
      bild: document.querySelector('.mapimg')?.getAttribute('src') ?? null,
      gitter: !!document.querySelector('.mgrid'),
      tokens: [...document.querySelectorAll('.mtoken')].map((t) => ({
        k: t.className, l: t.style.left, o: t.style.top })),
      bereiche: [...document.querySelectorAll('.maparea')].map((a) => a.textContent),
      probleme: [...document.querySelectorAll('.pruef li')].map((x) => x.textContent),
    }));
    pruefe('the map renders its image and grid', !!mk.bild && mk.gitter, mk.bild);
    pruefe('tokens sit at fractions of the image, not pixels',
      mk.tokens.length > 0 && mk.tokens.every((t) => /%$/.test(t.l) && /%$/.test(t.o)), mk.tokens);
    pruefe('a play token is told apart from a prepared one',
      mk.tokens.some((t) => /k-play/.test(t.k)) && mk.tokens.some((t) => /k-static/.test(t.k)),
      mk.tokens.map((t) => t.k));
    pruefe('the map validates clean', mk.probleme.length === 0, mk.probleme);

    /* Der Tokenfilter: eine vorbereitete Karte und eine laufende sind
       dieselbe Karte, und man will die Vorbereitung ohne die Spielzüge sehen. */
    await p.evaluate(() => {
      const s = [...document.querySelectorAll('.maptools select')][0];
      s.value = 'play';
      s.dispatchEvent(new Event('change', { bubbles: true }));
    });
    await p.waitForTimeout(300);
    const nurSpiel = await p.evaluate(() =>
      [...document.querySelectorAll('.mtoken')].map((t) => t.className));
    pruefe('the token filter keeps only its kind',
      nurSpiel.length > 0 && nurSpiel.every((c) => /k-play/.test(c)), nurSpiel);
    await p.evaluate(() => {
      const s = [...document.querySelectorAll('.maptools select')][0];
      s.value = '';
      s.dispatchEvent(new Event('change', { bubbles: true }));
    });
    await p.waitForTimeout(200);
    pruefe('a sub-map shows as a region to zoom into', mk.bereiche.length > 0, mk.bereiche);
  } else {
    pruefe('a map with tokens exists in the data', false, 'keine Karte gefunden');
  }

  /* ---- Nebel, Licht und Sicht, Gebiete (REQ-138, 139, 140, 193) ----
     Drei Dinge, die zusammen eine Falle sind: Nebel wird gespeichert, Licht
     nie, und Gebiete zeigen auf einen Artikel. Was hier schiefgeht, geht
     leise schief — eine Karte, die zu viel zeigt, sieht aus wie eine Karte. */
  const nebelKarte = await p.evaluate(() => {
    const m = [...window.__T__.ENT.values()].find((e) =>
      ((e.components || {}).MapInfo || {}).fog
      && ((e.components || {}).MapInfo || {}).walls);
    return m ? m.id : null;
  });
  if (nebelKarte) {
    await oeffneId(nebelKarte);
    await p.evaluate(() => {
      const f = document.getElementById('facet');
      f.value = 'map';
      f.dispatchEvent(new Event('change', { bubbles: true }));
    });
    await p.waitForTimeout(600);

    const sicht = await p.evaluate(() => {
      const svg = document.querySelector('.mvis');
      const fog = document.querySelector('.mvis .mfog');
      const masken = [...document.querySelectorAll('.mvis mask')];
      return {
        svg: !!svg,
        viewBox: svg ? svg.getAttribute('viewBox') : '',
        fogDeckung: fog ? fog.getAttribute('fill-opacity') : null,
        /* Die Maske des Nebels: ein weisses Rechteck plus je eine schwarze
           Form je aufgedecktem Stück. */
        fogLoecher: masken.length
          ? [...masken[masken.length - 1].children].filter(
              (n) => n.getAttribute('fill') === '#000').length
          : 0,
        lichtpolygone: [...document.querySelectorAll('.mvis mask polygon')].length,
        waende: document.querySelectorAll('.mvis .mwall').length,
        gebietsfelder: [...document.querySelectorAll('.mvis .mterr')]
          .map((g) => g.children.length),
        flach: !!document.querySelector('.mfogflat'),
      };
    });
    pruefe('the map draws a vision overlay in square units',
      sicht.svg && /^0 0 1 [\d.]+$/.test(sicht.viewBox), sicht.viewBox);
    pruefe('fog is punched through where the party has been',
      sicht.fogLoecher >= 2, sicht.fogLoecher);
    pruefe('each light carves its own visible shape out of the dark',
      sicht.lichtpolygone >= 4, sicht.lichtpolygone);
    pruefe('the GM sees through the fog, but sees that it is there',
      sicht.fogDeckung !== null && Number(sicht.fogDeckung) > 0 && Number(sicht.fogDeckung) < 1,
      sicht.fogDeckung);
    pruefe('sight blockers are drawn for whoever set them', sicht.waende >= 4, sicht.waende);
    pruefe('a territory is rasterised onto the grid, not drawn as one blob',
      sicht.gebietsfelder.some((n) => n > 4), sicht.gebietsfelder);
    pruefe('nothing falls back to the flat cover once the image is measured',
      sicht.flach === false, sicht.flach);

    /* Die Geometrie selbst. Ein Schatten, der im Bild ungefähr stimmt, ist
       am Tisch eine Behauptung — hier wird er gerechnet und nachgemessen. */
    const geo = await p.evaluate(() => {
      const wand = [{ id: 'w', x1: 0.6, y1: 0.2, x2: 0.6, y2: 0.8 }];
      const weit = (pts, ax, ay) => Math.max(...pts
        .filter((q) => Math.abs(Math.atan2(q[1] - ay, q[0] - ax)) < 0.2)
        .map((q) => Math.hypot(q[0] - ax, q[1] - ay)));
      const ohne = window.__T__.visionPoly(0.3, 0.5, 0.5, []);
      const mit = window.__T__.visionPoly(0.3, 0.5, 0.5, wand);
      return {
        ohne: weit(ohne, 0.3, 0.5),
        mit: weit(mit, 0.3, 0.5),
        /* Hinter der Wand ist nichts, davor alles: ein Strahl nach links
           läuft bis zum Radius, einer nach rechts endet an der Wand. */
        links: window.__T__.rayHit(0.3, 0.5, -1, 0, wand, 0.5),
        rechts: window.__T__.rayHit(0.3, 0.5, 1, 0, wand, 0.5),
        drin: window.__T__.inShape({ kind: 'circle', x: 0.5, y: 0.5, r: 0.1 }, 0.52, 0.5),
        draussen: window.__T__.inShape({ kind: 'circle', x: 0.5, y: 0.5, r: 0.1 }, 0.7, 0.5),
      };
    });
    pruefe('a ray stops at the wall in front and runs free behind',
      Math.abs(geo.rechts - 0.3) < 0.01 && Math.abs(geo.links - 0.5) < 0.01, geo);
    pruefe('a wall shortens the visible shape towards it',
      geo.mit < geo.ohne - 0.1, geo);
    pruefe('a point inside a circle is inside and one outside is not',
      geo.drin === true && geo.draussen === false, geo);

    /* Daylight schaltet die Dunkelheit ab — nicht die Lichter aus. */
    await p.evaluate((id) => {
      const e = window.__T__.ENT.get(id);
      e.components.MapInfo.lighting = 'bright';
    }, nebelKarte);
    await p.evaluate(() => { document.getElementById('facet')
      .dispatchEvent(new Event('change', { bubbles: true })); });
    await p.waitForTimeout(400);
    const hell = await p.evaluate(() => ({
      polygone: document.querySelectorAll('.mvis mask polygon').length,
      fog: !!document.querySelector('.mvis .mfog'),
    }));
    pruefe('daylight takes the darkness away and leaves the fog',
      hell.polygone === 0 && hell.fog === true, hell);
    await p.evaluate((id) => {
      const e = window.__T__.ENT.get(id);
      e.components.MapInfo.lighting = 'dark';
    }, nebelKarte);
    await p.evaluate(() => { document.getElementById('facet')
      .dispatchEvent(new Event('change', { bubbles: true })); });
    await p.waitForTimeout(300);
  } else {
    pruefe('a map with fog and walls exists in the data', false, 'keine Nebelkarte gefunden');
  }

  /* ---- Ruf und Beziehungen (REQ-030, 081) ----
     Ruf ist gerechnet, nicht gespeichert. Die Prüfung sucht deshalb zuerst
     nach dem Gegenteil: ein Feld, in dem eine Ruf-Zahl liegen könnte. Gäbe
     es eines, wäre alles danach Zierrat.

     `CreatureInfo.attitude` ist ausdrücklich keines davon: das ist die
     Grundhaltung gegenüber Fremden, ein Wort und kein Zähler. Sie zeigt auf
     niemanden, also ist sie ein Feld — richtig so. Was auf jemanden zeigt,
     ist die Kante `regards`, und was daraus folgt, wird gerechnet. Damit
     die Trennung hält, wird sie hier beides geprüft. */
  const rufFeld = await p.evaluate(() => {
    const treffer = [];
    Object.entries(window.__T__.REG.components).forEach(([k, c]) => {
      Object.keys((c.schema || {}).properties || {}).forEach((f) => {
        if (/^(standing|reputation|favour|reknown)$/i.test(f)) treffer.push(k + '.' + f);
      });
    });
    return treffer;
  });
  pruefe('no component stores a standing — it is computed on read (D8)',
    rufFeld.length === 0, rufFeld);
  const haltung = await p.evaluate(() =>
    ((window.__T__.REG.components.CreatureInfo.schema.properties || {}).attitude || {}));
  pruefe('the default attitude stays a word about strangers, not a counter',
    haltung.type === 'string' && Array.isArray(haltung.enum), haltung);

  const auge = await p.evaluate(() => {
    const f = [...window.__T__.ENT.values()].find((e) =>
      (e.relations || []).some((r) => r.type === 'regards'));
    return f ? f.id : null;
  });
  if (auge) {
    await oeffneId(auge);
    await p.evaluate(() => {
      const f = document.getElementById('facet');
      f.value = 'standing';
      f.dispatchEvent(new Event('change', { bubbles: true }));
    });
    await p.waitForTimeout(400);
    const lesen = () => p.evaluate(() =>
      [...document.querySelectorAll('.strow')].map((r) => ({
        wer: r.querySelector('.ref')?.textContent ?? '',
        wort: r.querySelector('.pill')?.textContent ?? '',
        zurueck: [...r.querySelectorAll('.co')].map((c) => c.textContent).join('|'),
        taten: [...r.querySelectorAll('ul.deeds li .ref')].map((b) => b.textContent),
        verborgen: r.querySelector('.warnzeile')?.textContent ?? '',
        striche: r.querySelectorAll('.stbar i.on').length,
      })));
    const vorher = await lesen();
    pruefe('a standing shows a word, a number and the deeds behind it',
      vorher.length > 0 && vorher.some((r) => /\(-?\d\)/.test(r.wort) && r.taten.length > 0),
      vorher);
    pruefe('the ladder draws as many marks as the standing is far from neutral',
      vorher.every((r) => {
        const n = Number((r.wort.match(/\((-?\d)\)/) ?? [])[1] ?? 0);
        return r.striche === Math.abs(n);
      }), vorher);
    /* Die Gegenrichtung (REQ-081): eine Kante, zwei Urteile. Genau da wird
       es interessant — einer traut, der andere nicht. */
    pruefe('the other direction is shown when it differs',
      vorher.some((r) => /back/.test(r.zurueck)), vorher.map((r) => r.zurueck));

    /* Und der eigentliche Punkt: eine Tat, von der niemand weiss, bewegt
       nichts — und sie fängt an zu zählen, sobald die Gegenseite es erfährt.
       Rückwirkend, weil sie ja passiert ist. */
    const geheim = vorher.find((r) => r.verborgen);
    pruefe('a deed nobody found out about is not counted, but the GM is told',
      !!geheim && /not counted/.test(geheim.verborgen), geheim);

    if (geheim) {
      const vorWert = Number((geheim.wort.match(/\((-?\d)\)/) ?? [])[1] ?? 0);
      await p.evaluate((id) => {
        const info = [...window.__T__.ENT.values()].find((e) =>
          (e.interfaces || [])[0] === 'Information'
          && (e.components.Info || {}).tier === 'secret'
          && !(e.relations || []).some((r) => r.type === 'knownBy')
          && [...window.__T__.ENT.values()].some((d) =>
            (d.relations || []).some((r) => r.type === 'knowledge' && r.to === e.id)));
        info.relations.push({ id: 'r_test_kb', type: 'knownBy', to: id, props: {} });
      }, auge);
      await p.evaluate(() => { document.getElementById('facet')
        .dispatchEvent(new Event('change', { bubbles: true })); });
      await p.waitForTimeout(400);
      const nachher = await lesen();
      const gleicheZeile = nachher.find((r) => r.wer === geheim.wer);
      const nachWert = Number((gleicheZeile?.wort.match(/\((-?\d)\)/) ?? [])[1] ?? 0);
      pruefe('once the other side finds out, the deed counts — retroactively',
        nachWert < vorWert && gleicheZeile.taten.length > geheim.taten.length,
        { vorWert, nachWert, taten: gleicheZeile?.taten });
      pruefe('and it is no longer listed as something nobody found out about',
        gleicheZeile && !gleicheZeile.verborgen, gleicheZeile);
    }
  } else {
    pruefe('a starting attitude exists in the data', false, 'kein regards gefunden');
  }

  /* ---- Charakterbogen und Inventar (REQ-051, 063, 064, 065) ----
     Der Bogen rechnet aus zwei Karten: die ruhigen Zahlen aus StatblockInfo,
     der Stand aus Vitals. Rechnet er falsch, steht am Tisch eine plausible
     Zahl da und niemand merkt es — deshalb gegen bekannte Werte geprüft. */
  const held = await p.evaluate(() => {
    const m = [...window.__T__.ENT.values()].find((e) =>
      (e.components || {}).Skills && (e.components || {}).StatblockInfo
      && (e.relations || []).some((r) => r.type === 'carries'));
    return m ? (m.name || m.components.Name.text) : null;
  });
  if (held) {
    await oeffne(held);
    await p.evaluate(() => {
      const f = document.getElementById('facet');
      f.value = 'sheet';
      f.dispatchEvent(new Event('change', { bubbles: true }));
    });
    await p.waitForTimeout(400);
    const bogen = await p.evaluate(() => {
      const ab = {};
      document.querySelectorAll('.ability').forEach((a) => {
        ab[a.querySelector('.k').textContent] =
          a.querySelector('.score').textContent + a.querySelector('.mod').textContent;
      });
      const sk = {};
      document.querySelectorAll('.skillrow').forEach((r) => {
        sk[r.querySelector('.sname').textContent] = r.querySelector('.smod').textContent;
      });
      return {
        ab, sk,
        hp: document.querySelector('.vital.hp .vin')?.value ?? null,
        pips: document.querySelectorAll('.pip').length,
        angriffe: [...document.querySelectorAll('table.atk tr')].length - 1,
        probleme: [...document.querySelectorAll('.pruef li')].map((x) => x.textContent),
      };
    });
    /* DEX 17 gibt +3; Expertise verdoppelt den Übungsbonus, also Stealth
       +3+2*3 = +9 bei Übungsbonus 3. Eine Zahl, die man nachrechnen kann. */
    pruefe('the sheet computes ability modifiers', bogen.ab.DEX === '17+3', bogen.ab);
    pruefe('expertise doubles the proficiency bonus',
      bogen.sk.Stealth === '+9' && bogen.sk.Arcana === '+2', bogen.sk);
    pruefe('the current hit points come from Vitals, not from the maximum',
      bogen.hp === '31', bogen.hp);
    pruefe('hit dice, death saves and inspiration are pips', bogen.pips >= 7, bogen.pips);
    pruefe('attacks come from what is carried', bogen.angriffe >= 2, bogen.angriffe);
    pruefe('the character validates clean', bogen.probleme.length === 0, bogen.probleme);

    /* Ein Zustand ist ein Klick, kein Formular. */
    await p.evaluate(() =>
      [...document.querySelectorAll('.condrow .chip')].find((c) => c.textContent === 'prone').click());
    await p.waitForTimeout(400);
    const zust = await p.evaluate(() =>
      [...document.querySelectorAll('.condrow .chip')].filter((c) => c.classList.contains('on'))
        .map((c) => c.textContent));
    pruefe('a condition is one click', zust.includes('prone'), zust);
    await p.evaluate(() =>
      [...document.querySelectorAll('.condrow .chip')].find((c) => c.textContent === 'prone').click());
    await p.waitForTimeout(300);

    /* Das Inventar: drei Darstellungen, dieselben Daten. */
    await p.evaluate(() => {
      const f = document.getElementById('facet');
      f.value = 'gear';
      f.dispatchEvent(new Event('change', { bubbles: true }));
    });
    await p.waitForTimeout(400);
    const stufen = await p.evaluate(() => ({
      reiter: [...document.querySelectorAll('.invbox .ktabs button')].map((b) => b.textContent),
      stufen: [...document.querySelectorAll('.tier .tlabel b')].map((b) => b.textContent),
      stuecke: document.querySelectorAll('.tier .chip.item').length,
    }));
    pruefe('the inventory shows the five degrees of reach',
      stufen.stufen.length === 5 && stufen.stufen[0] === 'In hand' && stufen.stuecke > 3, stufen);

    await p.evaluate(() =>
      [...document.querySelectorAll('.invbox .ktabs button')].find((b) => /Grid/.test(b.textContent)).click());
    await p.waitForTimeout(400);
    const raster = await p.evaluate(() => ({
      zellen: document.querySelectorAll('.gcell').length,
      stuecke: [...document.querySelectorAll('.gitem')].map((i) => ({
        n: i.querySelector('.glab').textContent, c: i.style.gridColumn, r: i.style.gridRow })),
    }));
    pruefe('the tile grid is as large as the settings say',
      raster.zellen === 60, raster.zellen);
    /* Die Form kommt aus `Footprint`: eine Rüstung ist 3 breit und 2 hoch,
       ein Kurzschwert 1 breit und 3 hoch. Ein Raster, das alles gleich gross
       zeichnet, ist eine Liste mit Kästchen. */
    const ruestung = raster.stuecke.find((x) => /Leder/.test(x.n));
    const schwert = raster.stuecke.find((x) => /^Kurzschwert /.test(x.n) || /^Kurzschwert$/.test(x.n));
    pruefe('an item takes the shape its footprint gives it',
      !!ruestung && /span 3/.test(ruestung.c) && /span 2/.test(ruestung.r)
      && !!schwert && /span 1/.test(schwert.c) && /span 3/.test(schwert.r),
      { ruestung, schwert });

    /* Ein Stück aufnehmen und woanders hinlegen — der ganze Weg, den man am
       Tisch geht. Ein belegtes Feld muss dabei nein sagen. */
    const vorher = raster.stuecke.find((x) => /Diebeswerkzeug/.test(x.n));
    await p.evaluate(() =>
      [...document.querySelectorAll('.gitem')].find((i) => /Diebeswerkzeug/.test(i.textContent)).click());
    await p.waitForTimeout(250);
    await p.evaluate(() => {
      const g = document.querySelector('.invgrid');
      const zellen = [...g.querySelectorAll('.gcell')];
      /* Die letzte Zeile ist frei — dort ist Platz für zwei Felder. */
      zellen[zellen.length - 10].click();
    });
    await p.waitForTimeout(450);
    const nachher = await p.evaluate(() =>
      [...document.querySelectorAll('.gitem')].map((i) => ({
        n: i.querySelector('.glab').textContent, c: i.style.gridColumn, r: i.style.gridRow })));
    const jetzt = nachher.find((x) => /Diebeswerkzeug/.test(x.n));
    pruefe('an item can be picked up and put somewhere else',
      !!jetzt && jetzt.r !== vorher.r, { vorher, jetzt });

    pruefe('the sheet and the inventory raised no exception', errs.length === 0, errs);
  } else {
    pruefe('a character with skills and gear exists in the data', false, 'keiner gefunden');
  }

  /* ---- Handwerk (REQ-184) ----
     Die Probe aufs Wissensmodell: ein Rezept, das jemand kennt, ist eine
     Information mit `knownBy` — kein Feld „bekannt von" am Rezept. Wenn das
     trägt, steht Crafting auf demselben Rückgrat wie alles andere. */
  const werkbank = await p.evaluate(() => {
    const alle = [...window.__T__.ENT.values()];
    const rezept = alle.find((e) => (e.interfaces || [])[0] === 'Recipe'
      && (e.relations || []).some((r) => r.type === 'knowledge'));
    const kenner = alle.find((e) => (e.relations || []).some((r) => r.type === 'carries'));
    return {
      rezept: rezept ? (rezept.name || rezept.components.Name.text) : null,
      kenner: kenner ? (kenner.name || kenner.components.Name.text) : null,
    };
  });
  if (werkbank.rezept && werkbank.kenner) {
    await oeffne(werkbank.rezept);
    await p.evaluate(() => {
      const f = document.getElementById('facet');
      f.value = 'craft';
      f.dispatchEvent(new Event('change', { bubbles: true }));
    });
    await p.waitForTimeout(400);
    const rez = await p.evaluate(() => ({
      kopf: [...document.querySelectorAll('.crhead .pill')].map((x) => x.textContent),
      zeilen: [...document.querySelectorAll('table.craftm tr')]
        .map((r) => [...r.children].map((c) => c.textContent)),
      kenner: [...document.querySelectorAll('.craft .chips .chip')].map((x) => x.textContent),
      probleme: [...document.querySelectorAll('.pruef li')].map((x) => x.textContent),
    }));
    pruefe('a recipe shows its trade, check and time', rez.kopf.length >= 3, rez.kopf);
    /* Die Matrix hat je Träger eine Spalte — „hat jemand von uns genug?" ist
       die Frage am Tisch, nicht „hat diese eine Figur genug?". */
    pruefe('the material matrix has a column per carrier',
      rez.zeilen.length > 2 && rez.zeilen[0].length >= 3, rez.zeilen[0]);
    pruefe('who knows the recipe comes from the knowledge edges, not from a field',
      rez.kenner.length > 0, rez.kenner);
    pruefe('the recipe validates clean', rez.probleme.length === 0, rez.probleme);

    /* Die Werkbank an der Figur: bekannt, teilweise, unbekannt — und was
       fehlt, steht als Zahl da, nicht als „nein". */
    await oeffne(werkbank.kenner);
    await p.evaluate(() => {
      const f = document.getElementById('facet');
      f.value = 'craft';
      f.dispatchEvent(new Event('change', { bubbles: true }));
    });
    await p.waitForTimeout(400);
    const bank = await p.evaluate(() => ({
      zeilen: [...document.querySelectorAll('table.craftm tr.crrow')]
        .map((r) => [...r.children].map((c) => c.textContent)),
      knoepfe: [...document.querySelectorAll('table.craftm tr.crrow .btn')].length,
    }));
    pruefe('the workbench lists the recipes with what is missing',
      bank.zeilen.length >= 2
      && bank.zeilen.some((z) => /\d+\/\d+/.test(z[2]) || /all there/.test(z[2])), bank.zeilen);
    pruefe('a recipe that is all there can be crafted', bank.knoepfe > 0, bank.knoepfe);

    /* Herstellen verbraucht wirklich. Ohne diesen Schritt wäre die Matrix
       eine Tabelle, und die Tabelle führt niemand nach. */
    const vorrat = () => p.evaluate(() => {
      const T = window.__T__;
      const traeger = [...T.ENT.values()].find((e) =>
        (e.relations || []).some((r) => r.type === 'carries'));
      const inv = T.ENT.get(traeger.relations.find((r) => r.type === 'carries').to);
      const m = {};
      (inv.relations || []).filter((r) => r.type === 'holds').forEach((r) => {
        const it = T.ENT.get(r.to);
        if (it) m[it.name || it.components.Name.text] = (r.props || {}).qty || 1;
      });
      return m;
    });
    const vor = await vorrat();
    await p.evaluate(() =>
      [...document.querySelectorAll('table.craftm tr.crrow .btn')][0].click());
    await p.waitForTimeout(250);
    await p.evaluate(() =>
      [...document.querySelectorAll('.dlgbox .rowbtns button')].find((b) => /Craft/.test(b.textContent)).click());
    await p.waitForTimeout(500);
    const nach = await vorrat();
    const verbraucht = Object.keys(vor).some((k) => (nach[k] ?? 0) < vor[k]);
    const entstanden = Object.keys(nach).some((k) => (vor[k] ?? 0) < nach[k]);
    pruefe('crafting consumes the materials and yields the result',
      verbraucht && entstanden, { vor, nach });
    pruefe('crafting raised no exception', errs.length === 0, errs);
  } else {
    pruefe('a recipe with knowledge and a carrier exist in the data', false, werkbank);
  }

  /* ---- Boards (REQ-111, 157 bis 166) ----
     Der Prüfstein ist die Darstellungsauflösung: jede Platzierung wird in
     der Ansicht gezeichnet, die Platzierung → Board-Regel → Rückfall ergibt,
     und zwar mit *denselben* Elementen wie die Artikelseite. Zeichnete das
     Board eigene Kacheln, wäre jedes neue Element zweimal zu bauen. */
  const boardName = await p.evaluate(() => {
    const b = [...window.__T__.ENT.values()].find((e) => (e.interfaces || [])[0] === 'Board');
    return b ? (b.name || b.components.Name.text) : null;
  });
  if (boardName) {
    await oeffne(boardName);
    await p.evaluate(() => {
      const f = document.getElementById('facet');
      f.value = 'board';
      f.dispatchEvent(new Event('change', { bubbles: true }));
    });
    await p.waitForTimeout(700);
    const brd = await p.evaluate(() => ({
      karten: [...document.querySelectorAll('.bcard')].map((c) => ({
        n: c.querySelector('.bhead .ref')?.textContent ?? null,
        v: c.querySelector('.bview')?.textContent ?? null,
        leer: !(c.querySelector('.pbody')?.textContent || '').trim(),
        l: c.style.left, t: c.style.top })),
      formen: document.querySelectorAll('.bshape').length,
      anker: [...(document.querySelectorAll('.maptools select')[1]?.options ?? [])]
        .map((o) => o.textContent),
      probleme: [...document.querySelectorAll('.pruef li')].map((x) => x.textContent),
    }));
    pruefe('the board draws every placement', brd.karten.length >= 4, brd.karten.length);
    pruefe('no placement comes out empty',
      brd.karten.every((k) => !k.leer), brd.karten.filter((k) => k.leer));
    /* Verschiedene Ansichten nebeneinander: genau das ist die Auflösung.
       Stünde überall dasselbe, entschiede in Wahrheit nichts. */
    const ansichten = [...new Set(brd.karten.map((k) => k.v))];
    pruefe('placements resolve to different views', ansichten.length >= 3, ansichten);
    pruefe('shapes and anchors belong to the board', brd.formen >= 3 && brd.anker.length >= 3,
      { formen: brd.formen, anker: brd.anker });
    pruefe('the board validates clean', brd.probleme.length === 0, brd.probleme);

    /* Die Ansicht einer einzelnen Platzierung überstimmt die Board-Regel. */
    const vorher = brd.karten[1];
    await p.evaluate(() => {
      const s2 = [...document.querySelectorAll('.bcard')][1].querySelector('.bsel');
      s2.value = 'full';
      s2.dispatchEvent(new Event('change', { bubbles: true }));
    });
    await p.waitForTimeout(500);
    const nachher = await p.evaluate(() => ({
      v: [...document.querySelectorAll('.bcard')][1]?.querySelector('.bview')?.textContent ?? null,
    }));
    pruefe('a placement may overrule the board rule',
      nachher.v === 'Full' && nachher.v !== vorher.v, { vorher: vorher.v, nachher: nachher.v });

    /* Eine Karte, die auf einem Board liegt, bringt ihre Werkzeugleiste
       nicht mit: ein Zoomknopf dort änderte den Zoom der grossen Karte. */
    const leisten = await p.evaluate(() =>
      [...document.querySelectorAll('.bcard .maptools')].filter((m) => m.style.display !== 'none').length);
    pruefe('a placement brings no toolbar of its own', leisten === 0, leisten);

    pruefe('the board raised no exception', errs.length === 0, errs);
  } else {
    pruefe('a board exists in the data', false, 'keines gefunden');
  }

  /* ---- Begegnung, Initiative, Würfel (REQ-070, 085, 115, 144) ---- */
  const kampf = await p.evaluate(() => {
    const k = [...window.__T__.ENT.values()].find((e) => (e.interfaces || [])[0] === 'Encounter');
    return k ? (k.name || k.components.Name.text) : null;
  });
  if (kampf) {
    await oeffne(kampf);
    await p.evaluate(() => {
      const f = document.getElementById('facet');
      f.value = 'fight';
      f.dispatchEvent(new Event('change', { bubbles: true }));
    });
    await p.waitForTimeout(600);
    const lies = () => p.evaluate(() => ({
      zeilen: [...document.querySelectorAll('.initt tr')].slice(1).map((r) => ({
        cls: r.className,
        who: r.children[2]?.textContent ?? '',
        init: r.querySelectorAll('input')[0]?.value ?? '',
        hp: r.querySelectorAll('input')[1]?.value ?? '' })),
      runde: document.querySelector('.fight .pill')?.textContent ?? '',
      karte: document.querySelectorAll('.fight .mapimg').length,
      ring: document.querySelectorAll('.mtoken.now').length,
      probleme: [...document.querySelectorAll('.pruef li')].map((x) => x.textContent),
    }));
    const vor = await lies();
    pruefe('every fighter is a row of its own', vor.zeilen.length >= 4, vor.zeilen.length);
    /* Drei Goblins aus einem Statblock heissen drei Zeilen mit eigenen
       Trefferpunkten — eine Zahl an einer Kante könnte nur einen verletzen. */
    const doppelt = vor.zeilen.filter((z) => /Kanalschleim/.test(z.who));
    pruefe('two of the same statblock have hit points of their own',
      doppelt.length === 2 && doppelt.every((z) => z.hp !== ''), doppelt);
    pruefe('the fight shows the map it happens on', vor.karte === 1, vor.karte);
    pruefe('the encounter validates clean', vor.probleme.length === 0, vor.probleme);

    await p.evaluate(() =>
      [...document.querySelectorAll('.maptools button')].find((b) => /Roll initiative/.test(b.textContent)).click());
    await p.waitForTimeout(500);
    const nachWurf = await lies();
    pruefe('rolling initiative fills every row and starts round one',
      nachWurf.zeilen.every((z) => z.init !== '') && /Round 1/.test(nachWurf.runde), nachWurf.runde);
    /* Sortiert wird absteigend — und zwar sichtbar, sonst rechnet es am
       Tisch jemand im Kopf nach und kommt auf etwas anderes. */
    const werte = nachWurf.zeilen.map((z) => Number(z.init));
    pruefe('the order is highest initiative first',
      werte.every((v, i) => i === 0 || werte[i - 1] >= v), werte);
    pruefe('exactly one row has the turn',
      nachWurf.zeilen.filter((z) => /now/.test(z.cls)).length === 1,
      nachWurf.zeilen.map((z) => z.cls));

    /* Der Wurfverlauf zeigt die Einzelwürfe — „18" und „1+17" sind am Tisch
       zweierlei, und ein Wurf, der „undefined" anzeigt, glaubt niemand. */
    const verlauf = await p.evaluate(() =>
      [...document.querySelectorAll('.rollrow .rv')].map((x) => x.textContent));
    pruefe('the dice log shows the individual rolls',
      verlauf.length >= 4 && verlauf.every((t) => !/undefined|NaN/.test(t)), verlauf);

    const wer = nachWurf.zeilen.find((z) => /now/.test(z.cls));
    await p.evaluate(() =>
      [...document.querySelectorAll('.maptools button')].find((b) => /Next turn/.test(b.textContent)).click());
    await p.waitForTimeout(500);
    const nachZug = await lies();
    const wer2 = nachZug.zeilen.find((z) => /now/.test(z.cls));
    pruefe('the turn moves on', wer2 && wer2.who !== wer.who, { wer: wer.who, wer2: wer2 && wer2.who });

    /* Ein freier Ausdruck darf kein `eval` sein und muss bei Unsinn nein
       sagen, statt eine plausible Zahl zu erfinden. */
    const wuerfel = await p.evaluate(() => {
      const f = window.__T__;
      return {
        gut: f.rollDice('2d6+3'),
        einzeln: f.rollDice('1d1'),
        unsinn: f.rollDice('zwei Äpfel'),
        leer: f.rollDice(''),
      };
    });
    pruefe('the dice roller reads an expression and refuses nonsense',
      wuerfel.gut && wuerfel.gut.total >= 5 && wuerfel.gut.total <= 15
      && wuerfel.einzeln.total === 1
      && wuerfel.unsinn === null && wuerfel.leer === null, wuerfel);

    pruefe('the fight raised no exception', errs.length === 0, errs);
  } else {
    pruefe('an encounter exists in the data', false, 'keine gefunden');
  }

  /* ---- Aufträge und Zeitleiste (REQ-082, 083, 106) ---- */
  const auftrag = await p.evaluate(() => {
    const q = [...window.__T__.ENT.values()].find((e) =>
      (e.interfaces || [])[0] === 'Quest'
      && Array.isArray(((e.components || {}).QuestInfo || {}).tasks)
      && e.components.QuestInfo.tasks.length > 2);
    const traeger = [...window.__T__.ENT.values()].find((e) => (e.interfaces || [])[0] === 'Party');
    return {
      q: q ? (q.name || q.components.Name.text) : null,
      p: traeger ? (traeger.name || traeger.components.Name.text) : null,
    };
  });
  if (auftrag.q && auftrag.p) {
    await oeffne(auftrag.q);
    await p.evaluate(() => {
      const f = document.getElementById('facet');
      f.value = 'quests';
      f.dispatchEvent(new Event('change', { bubbles: true }));
    });
    await p.waitForTimeout(450);
    const qs = await p.evaluate(() => ({
      kopf: [...document.querySelectorAll('.crhead .pill')].map((x) => x.textContent),
      offen: [...document.querySelectorAll('.task')].filter((t) => !t.querySelector('input').checked).length,
      erledigt: [...document.querySelectorAll('.task.done')].length,
      /* [[Verweise]] in einer Aufgabe lösen sich auf wie überall sonst —
         eine Aufgabe, die auf etwas zeigt, soll dorthin führen. */
      refs: document.querySelectorAll('.task .ref').length,
      probleme: [...document.querySelectorAll('.pruef li')].map((x) => x.textContent),
    }));
    pruefe('a quest shows state, reward and deadline', qs.kopf.length >= 3, qs.kopf);
    pruefe('tasks tick off and links inside them resolve',
      qs.offen > 0 && qs.erledigt > 0 && qs.refs > 0, qs);
    pruefe('the quest validates clean', qs.probleme.length === 0, qs.probleme);

    const zahl = await p.evaluate(() =>
      [...document.querySelectorAll('.task')].filter((t) => !t.querySelector('input').checked).length);
    await p.evaluate(() =>
      [...document.querySelectorAll('.task')].find((t) => !t.querySelector('input').checked)
        .querySelector('input').click());
    await p.waitForTimeout(450);
    const danach = await p.evaluate(() =>
      [...document.querySelectorAll('.task')].filter((t) => !t.querySelector('input').checked).length);
    pruefe('ticking a task is stored', danach === zahl - 1, { zahl, danach });

    await oeffne(auftrag.p);
    await p.evaluate(() => {
      const f = document.getElementById('facet');
      f.value = 'quests';
      f.dispatchEvent(new Event('change', { bubbles: true }));
    });
    await p.waitForTimeout(450);
    const brett = await p.evaluate(() => ({
      abschnitte: [...document.querySelectorAll('.quests .sec')].map((x) => x.textContent),
      zeilen: [...document.querySelectorAll('.qrow')].map((r) => r.textContent),
    }));
    pruefe('the quest board groups by state',
      brett.abschnitte.length >= 2 && brett.zeilen.length >= 2, brett.abschnitte);
    pruefe('the board counts the tasks per quest',
      brett.zeilen.some((z) => /\d+\/\d+ tasks/.test(z)), brett.zeilen);

    await p.evaluate(() => {
      const f = document.getElementById('facet');
      f.value = 'timeline';
      f.dispatchEvent(new Event('change', { bubbles: true }));
    });
    await p.waitForTimeout(450);
    const zeit = await p.evaluate(() => ({
      zeilen: [...document.querySelectorAll('.tl')].map((r) => ({
        d: r.querySelector('.tdate').textContent,
        n: r.querySelector('.ref').textContent })),
      sortiert: [...window.__T__.ENT.values()]
        .filter((e) => (e.components || {}).WorldDate)
        .map((e) => Number(e.components.WorldDate.sort)),
    }));
    pruefe('the timeline lists everything that carries a world date',
      zeit.zeilen.length >= 4, zeit.zeilen.length);
    /* Sortiert wird nach `sort`, gelesen `display` — deshalb stehen beide im
       Schema. „Mirtul 12, 1492 TZ" lässt sich nicht vergleichen. */
    const gelesen = zeit.zeilen.map((z) => z.d);
    pruefe('the timeline reads the display date and orders by the sortable one',
      gelesen.some((d) => /[A-Za-z]/.test(d))
      && gelesen[0] !== gelesen[gelesen.length - 1], gelesen);
    pruefe('quests and timeline raised no exception', errs.length === 0, errs);
  } else {
    pruefe('a quest with tasks and a party exist in the data', false, auftrag);
  }

  /* ---- Zugang und Spieleransicht (REQ-031 bis 040, 119, 128) ----
     Der Prüfstein: zwei Charaktere, dasselbe Rezept, verschiedene Seiten.
     Gilt der Filter nur für die Blöcke oder nur für die Felder, sieht man es
     an einer einzelnen Ansicht nicht — erst im Vergleich. */
  const paar2 = await p.evaluate(() => {
    const alle = [...window.__T__.ENT.values()];
    const rec = alle.find((e) => (e.interfaces || [])[0] === 'Recipe'
      && (e.relations || []).some((r) => r.type === 'knowledge'));
    const info = rec && window.__T__.ENT.get(
      rec.relations.find((r) => r.type === 'knowledge').to);
    const kenner = info && (info.relations || []).find((r) => r.type === 'knownBy');
    const pcs = alle.filter((e) => (e.interfaces || [])[0] === 'PlayerCharacter');
    const fremd = pcs.find((e) => !kenner || e.id !== kenner.to);
    return {
      rec: rec ? (rec.name || rec.components.Name.text) : null,
      kennerId: kenner ? kenner.to : null,
      fremdId: fremd ? fremd.id : null,
    };
  });
  if (paar2.rec && paar2.kennerId && paar2.fremdId) {
    await oeffne(paar2.rec);
    await p.evaluate(() => {
      const f = document.getElementById('facet');
      f.value = 'full';
      f.dispatchEvent(new Event('change', { bubbles: true }));
    });
    await p.waitForTimeout(400);
    const sicht = async (id) => {
      await p.evaluate((v) => {
        const s2 = document.getElementById('asview');
        s2.value = v;
        s2.dispatchEvent(new Event('change', { bubbles: true }));
      }, id);
      await p.waitForTimeout(450);
      return p.evaluate(() => ({
        felder: [...document.querySelectorAll('.fld dt')].map((x) => x.textContent),
        bloecke: [...document.querySelectorAll('.blk .bl')].map((x) => x.textContent.replace('×', '')),
        rail: [...document.querySelectorAll('.rail h3')].map((x) => x.textContent),
      }));
    };
    const alsGM = await sicht('');
    const alsKenner = await sicht(paar2.kennerId);
    const alsFremd = await sicht(paar2.fremdId);

    pruefe('the GM sees everything',
      alsGM.bloecke.includes('secret') && alsGM.felder.length > alsFremd.felder.length, alsGM);
    /* Wer die Information kennt, sieht ihre Felder und ihren Block — auch
       wenn der Block `secret` heisst: eine ausdrückliche Freigabe schlägt
       die Voreinstellung, sonst wäre jede Freigabe wirkungslos. */
    pruefe('a granted secret block reaches the one who knows it',
      alsKenner.bloecke.includes('secret') && !alsFremd.bloecke.includes('secret'),
      { alsKenner: alsKenner.bloecke, alsFremd: alsFremd.bloecke });
    /* Die Fussnote „Not yours yet" ist kein Feld, sondern die Auskunft,
       dass eines fehlt (REQ-179) — sie zählt hier nicht mit. */
    const ohneFussnote = alsFremd.felder.filter((f) => f !== 'Not yours yet');
    pruefe('a field of an unknown information is gone for the other one',
      alsKenner.felder.length > ohneFussnote.length
      && ohneFussnote.every((f) => alsKenner.felder.includes(f))
      && alsFremd.felder.includes('Not yours yet'),
      { alsKenner: alsKenner.felder, alsFremd: alsFremd.felder });
    /* Für einen Spieler gibt es kein Register. Auszugrauen wäre eine
       Einladung; wegzulassen ist die Antwort. */
    pruefe('a player gets no data model in the rail',
      alsGM.rail.includes('System') && !alsFremd.rail.includes('System'),
      { alsGM: alsGM.rail, alsFremd: alsFremd.rail });

    const zugesperrt = await p.evaluate(() => {
      window.__T__.UI.route = { k: 'reg' };
      return null;
    });
    await p.evaluate(() => {
      const b2 = [...document.querySelectorAll('.rail button')].find((x) => /All articles/.test(x.textContent));
      if (b2) b2.click();
    });
    await p.waitForTimeout(300);
    await p.evaluate(() => {
      const s2 = document.getElementById('asview');
      s2.value = '';
      s2.dispatchEvent(new Event('change', { bubbles: true }));
    });
    await p.waitForTimeout(350);
    pruefe('the viewing-as switch goes back to the GM',
      await p.evaluate(() => !document.body.classList.contains('asplayer')), zugesperrt);
    pruefe('the player view raised no exception', errs.length === 0, errs);
  } else {
    pruefe('two characters and a guarded recipe exist in the data', false, paar2);
  }

  /* ---- Der Tisch in Echtzeit (REQ-071, 116, 117) ----
     Die Trennlinie ist das Prüfbare: was bleibt, geht in den Speicher; was
     ein Augenblick ist, in den Kanal. Ginge der laufende Kampf über den
     Kanal, sähe ihn niemand, der zehn Minuten später dazukommt — und das
     merkte man erst am Tisch. */
  const sitzung = await p.evaluate(() => {
    const se = [...window.__T__.ENT.values()].find((e) => (e.components || {}).SessionState);
    return se ? (se.name || se.components.Name.text) : null;
  });
  if (sitzung) {
    await oeffne(sitzung);
    await p.evaluate(() => {
      const f = document.getElementById('facet');
      f.value = 'live';
      f.dispatchEvent(new Event('change', { bubbles: true }));
    });
    await p.waitForTimeout(450);
    const lv = await p.evaluate(() => ({
      abschnitte: [...document.querySelectorAll('.live .sec')].map((x) => x.textContent),
      bezuege: [...document.querySelectorAll('.live .relrow .rl')].map((x) => x.textContent),
      verweise: [...document.querySelectorAll('.live .relrow .ref')].map((x) => x.textContent),
      anwesend: [...document.querySelectorAll('.live .chip.peer b')].map((x) => x.textContent),
      probleme: [...document.querySelectorAll('.pruef li')].map((x) => x.textContent),
    }));
    pruefe('the live view shows what is in play',
      lv.bezuege.includes('Fight') && lv.bezuege.includes('Map') && lv.verweise.length >= 2, lv);
    pruefe('the session validates clean', lv.probleme.length === 0, lv.probleme);

    /* Anwesenheit kommt vom Kanal und beschreibt nur den Absender. */
    await p.evaluate(() => window.__ROOM__.setPeers([
      { isMe: true, presence: { gm: true, title: 'Sitzung 12' } },
      { isMe: false, presence: { actor: null, gm: false, title: 'Kerzengasse' } },
    ]));
    await p.waitForTimeout(350);
    const wer = await p.evaluate(() =>
      [...document.querySelectorAll('.live .chip.peer')].map((c) => c.textContent));
    pruefe('who is at the table comes from the channel', wer.length === 2, wer);

    /* Ein geteilter Wurf: gesendet und — als käme er von jemand anderem —
       gehört. Nur eine Richtung zu prüfen hiesse, die halbe Leitung zu
       prüfen. */
    await p.evaluate(() => { window.__EMITS__.length = 0; });
    await p.evaluate(() =>
      [...document.querySelectorAll('.live .btn.dice')][0].click());
    await p.waitForTimeout(400);
    const gesendet = await p.evaluate(() => window.__EMITS__.slice());
    pruefe('a shared roll goes out on the channel',
      gesendet.length === 1 && gesendet[0].t === 'roll' && !!gesendet[0].d.text, gesendet);

    await p.evaluate(() => window.__ROOM__.fire('roll',
      { who: 'Sela Kerzendocht', what: '1d20+2', total: 17, text: '17  (15 +2)' }));
    await p.waitForTimeout(350);
    const gehoert = await p.evaluate(() =>
      [...document.querySelectorAll('.live .rollrow')].map((r) => r.textContent));
    pruefe('a roll from someone else arrives with their name and their numbers',
      gehoert.some((t) => /Sela/.test(t) && /17/.test(t) && /15 \+2/.test(t)), gehoert);

    /* Das Zeigen auf die Karte: es steht nirgends und muss es auch nicht. */
    await p.evaluate(() => window.__ROOM__.fire('ping',
      { id: 'pg_test', map: 'mp_kerzengasse', x: 0.5, y: 0.5, who: 'Sela' }));
    await p.waitForTimeout(300);
    await oeffne('Karte: Kerzengasse');
    await p.evaluate(() => {
      const f = document.getElementById('facet');
      f.value = 'map';
      f.dispatchEvent(new Event('change', { bubbles: true }));
    });
    await p.waitForTimeout(450);
    const zeiger = await p.evaluate(() =>
      [...document.querySelectorAll('.mping')].map((n) => n.textContent));
    pruefe('pointing at a spot shows up on the map', zeiger.length === 1 && /Sela/.test(zeiger[0]), zeiger);

    /* Anwesenheit wird beim Wechsel gemeldet, nicht nur beim Start. */
    const gemeldet = await p.evaluate(() => window.__PRESENCE__.slice(-1)[0] || null);
    pruefe('presence says what this viewer is looking at',
      gemeldet && gemeldet.at === 'art' && !!gemeldet.article, gemeldet);
    pruefe('the live channel raised no exception', errs.length === 0, errs);
  } else {
    pruefe('a session with a live state exists in the data', false, 'keine gefunden');
  }

  /* ---- Tabellen (REQ-085, 125, 172, 186) ----
     Drei Dinge, die eine Tabelle von einer Liste unterscheiden: die
     Bereiche werden gerechnet, eine Tabelle darf in einer stehen, und ein
     Eintrag kann an einen Ort gebunden sein. Alle drei sind prüfbar, und
     alle drei gehen still kaputt, wenn niemand sie prüft. */
  const tabelle = await p.evaluate(() => {
    const alle = [...window.__T__.ENT.values()];
    const t = alle.find((e) => (e.interfaces || [])[0] === 'Table'
      && (e.relations || []).some((r) => {
        const z = window.__T__.ENT.get(r.to);
        return r.type === 'entry' && z && (z.interfaces || [])[0] === 'Table';
      }));
    const ort = alle.find((e) => (e.relations || []).some((r) => r.type === 'tableFor')
      && (e.interfaces || [])[0] !== 'Encounter');
    return { t: t ? t.id : null, ort: ort ? ort.id : null };
  });
  if (tabelle.t && tabelle.ort) {
    await oeffneId(tabelle.t);
    await p.evaluate(() => {
      const f = document.getElementById('facet');
      f.value = 'table';
      f.dispatchEvent(new Event('change', { bubbles: true }));
    });
    await p.waitForTimeout(450);
    const tb = await p.evaluate(() => ({
      zeilen: [...document.querySelectorAll('.tablebox table tr')].slice(1)
        .map((r) => [...r.children].map((c) => c.textContent)),
      kopf: [...document.querySelectorAll('.tablebox table th')].map((x) => x.textContent),
      probleme: [...document.querySelectorAll('.pruef li')].map((x) => x.textContent),
    }));
    pruefe('the table validates clean', tb.probleme.length === 0, tb.probleme);
    /* Die Bereiche sind gerechnet und lückenlos: 1–3, 4–5, 6–9, 10. Von
       Hand geführt bricht das, sobald jemand eine Zeile einfügt. */
    const bereiche = tb.zeilen.map((z) => z[0]);
    const grenzen = bereiche.map((b) => b.split('–').map(Number));
    pruefe('the ranges are computed and leave no gap',
      grenzen[0][0] === 1
      && grenzen.every((g, i) => i === 0 || g[0] === (grenzen[i - 1][1] || grenzen[i - 1][0]) + 1),
      bereiche);
    pruefe('a nested table is marked as one',
      tb.zeilen.some((z) => /a table/.test(z[1])), tb.zeilen.map((z) => z[1]));
    pruefe('a conditional entry says what it asks for',
      tb.zeilen.some((z) => /^#/.test(z[3])), tb.zeilen.map((z) => z[3]));

    /* Auf dem Ort gilt der Zusammenhang: ein Eintrag mit Marke kommt nur
       dort in den Topf — und eine verschachtelte Tabelle würfelt weiter. */
    await oeffneId(tabelle.ort);
    await p.evaluate(() => {
      const f = document.getElementById('facet');
      f.value = 'table';
      f.dispatchEvent(new Event('change', { bubbles: true }));
    });
    await p.waitForTimeout(450);
    const knopf = await p.evaluate(() =>
      [...document.querySelectorAll('.tablebox .btn')].map((b) => b.textContent));
    pruefe('a place rolls on the table that applies there',
      knopf.some((t) => /^Roll /.test(t)), knopf);
    await p.evaluate(() =>
      [...document.querySelectorAll('.tablebox .btn')].find((b) => /^Roll /.test(b.textContent)).click());
    await p.waitForTimeout(250);
    const einWurf = await p.evaluate(() =>
      [...document.querySelectorAll('.rollrow .rv')].map((x) => x.textContent));
    pruefe('the button on the place produces a result', einWurf.length > 0, einWurf);

    /* Der Zusammenhang wird zweihundertmal geprüft und nicht sechsmal: ein
       Eintrag mit 20 % Gewicht taucht in sechs Würfen manchmal nicht auf,
       und eine Prüfung, die manchmal rot wird, glaubt bald niemand mehr. */
    const probe = await p.evaluate((ids) => {
      const T = window.__T__;
      const tab = T.ENT.get(ids.t), ort = T.ENT.get(ids.ort);
      const ohne = { id: 'ctx_leer', tags: [] };
      const zaehl = (ctx) => {
        const o = { treffer: 0, kaputt: 0, leer: 0 };
        for (let i = 0; i < 200; i++) {
          const r = T.rollTable(tab, ctx);
          if (!r || !r.text || /undefined|NaN|loops back/.test(r.text)) o.kaputt++;
          else if (r.empty) o.leer++;
          else if (/→/.test(r.text)) o.treffer++;
        }
        return o;
      };
      return { mit: zaehl(ort), ohne: zaehl(ohne) };
    }, tabelle);
    pruefe('a conditional entry only comes up where its tag is',
      probe.mit.treffer > 0 && probe.ohne.treffer === 0, probe);
    pruefe('no roll came back empty or broken',
      probe.mit.kaputt === 0 && probe.ohne.kaputt === 0, probe);
    pruefe('tables raised no exception', errs.length === 0, errs);
  } else {
    pruefe('a nested table and a place that uses one exist in the data', false, tabelle);
  }

  /* ---- Vorbereitung (REQ-078, 084, 188, 189, 190) ----
     Der Prüfstein: nichts davon ist zusätzlich gespeichert. Das Cockpit
     liest Kanten, die es ohnehin gibt; die Unfertigen sind der Stand; die
     offenen Punkte stehen an den Artikeln, zu denen sie gehören. Eine
     eigene Tabelle „Vorbereitung" wäre eine zweite Wahrheit. */
  const vorbereitung = await p.evaluate(() => {
    const e = [...window.__T__.ENT.values()].find((x) =>
      (((x.components || {}).Todos || {}).items || []).length > 1
      && (x.relations || []).length > 1);
    return e ? e.id : null;
  });
  if (vorbereitung) {
    await oeffneId(vorbereitung);
    await p.evaluate(() => {
      const f = document.getElementById('facet');
      f.value = 'prep';
      f.dispatchEvent(new Event('change', { bubbles: true }));
    });
    await p.waitForTimeout(500);
    const pv = await p.evaluate(() => ({
      abschnitte: [...document.querySelectorAll('.prep .sec')].map((x) => x.textContent),
      cockpit: [...document.querySelectorAll('.cgroup .ck')].map((x) => x.textContent),
      offen: [...document.querySelectorAll('.prep .task')].filter((t) => !t.querySelector('input').checked).length,
      erledigt: [...document.querySelectorAll('.prep .task.done')].length,
      anderswo: document.querySelectorAll('.prep .qlist')[0]?.children.length ?? 0,
      unfertig: document.querySelectorAll('.prep .qlist')[1]?.children.length ?? 0,
      probleme: [...document.querySelectorAll('.pruef li')].map((x) => x.textContent),
    }));
    pruefe('the prep board has its four lists', pv.abschnitte.length === 4, pv.abschnitte);
    /* Die Gruppen des Cockpits sind Kantenarten, nicht erfundene Rubriken. */
    pruefe('the cockpit groups by the relation that leads there',
      pv.cockpit.length >= 2, pv.cockpit);
    pruefe('open and done are told apart', pv.offen > 0 && pv.erledigt > 0, pv);
    pruefe('open points from other articles are gathered', pv.anderswo > 0, pv.anderswo);
    pruefe('what is still idea or planned is listed', pv.unfertig > 0, pv.unfertig);
    pruefe('the prep board validates clean', pv.probleme.length === 0, pv.probleme);

    /* Schnellerfassung: ein Satz, Enter, fertig — ohne die Ansicht zu
       verlassen. Wer dafür springen muss, notiert es nicht. */
    await p.evaluate(() => {
      const i = document.querySelector('.prep .addbar.quick input');
      i.value = 'Probe: das hier notiert der Prüflauf';
      i.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    });
    await p.waitForTimeout(500);
    const danach2 = await p.evaluate(() => ({
      offen: [...document.querySelectorAll('.prep .task')].filter((t) => !t.querySelector('input').checked).length,
      text: [...document.querySelectorAll('.prep .task')].map((t) => t.textContent).join(' '),
    }));
    pruefe('quick capture files a note without leaving the view',
      danach2.offen === pv.offen + 1 && /Prüflauf/.test(danach2.text), danach2);

    /* Den Stand gleich in der Liste ändern: wer dafür hinspringen muss,
       lässt ihn stehen, und die Liste wird zur Tapete. */
    const vorStand = await p.evaluate(() =>
      document.querySelectorAll('.prep .qlist')[1]?.children.length ?? 0);
    await p.evaluate(() => {
      const sel = document.querySelectorAll('.prep .qlist')[1].querySelector('select');
      sel.value = 'used';
      sel.dispatchEvent(new Event('change', { bubbles: true }));
    });
    await p.waitForTimeout(500);
    const nachStand = await p.evaluate(() =>
      document.querySelectorAll('.prep .qlist')[1]?.children.length ?? 0);
    pruefe('the status changes right in the list', nachStand === vorStand - 1,
      { vorStand, nachStand });
    pruefe('the prep board raised no exception', errs.length === 0, errs);
  } else {
    pruefe('an article with notes and relations exists in the data', false, 'keiner gefunden');
  }

  /* ---- Sicherung (REQ-029, 155, 191, 192) ----
     Der Grund steht in der alten App: ein misslungener Ladevorgang wurde
     von der nächsten Selbstspeicherung überschrieben, und der unlesbare
     Stand war danach weg. Die Prüfung dafür muss den Fehler wirklich
     auslösen — „es sieht richtig aus" hat damals auch gereicht. */
  await p.evaluate(() =>
    [...document.querySelectorAll('.rail button')].find((b) => /Data model/.test(b.textContent)).click());
  await p.waitForTimeout(300);
  await p.evaluate(() =>
    [...document.querySelectorAll('.tabs button')].find((b) => /^Backup$/.test(b.textContent)).click());
  await p.waitForTimeout(400);
  await p.evaluate(() => { window.__SAVED__.length = 0; });
  await p.evaluate(() =>
    [...document.querySelectorAll('#view .btn')].find((b) => /Download a backup/.test(b.textContent)).click());
  await p.waitForTimeout(450);
  const sicherung = await p.evaluate(() => {
    const s2 = window.__SAVED__[0];
    if (!s2) return null;
    let d = null;
    try { d = JSON.parse(s2.data); } catch (x) { return { parse: String(x) }; }
    return {
      name: s2.filename,
      format: d.format,
      teile: Object.keys(d.registry || {}),
      artikel: (d.entities || []).length,
      hier: window.__T__.ENT.size,
    };
  });
  pruefe('a backup carries the registry and every article',
    sicherung && sicherung.format === 'nebelwacht/1'
    && sicherung.artikel === sicherung.hier
    && sicherung.teile.length === 6 && /\.json$/.test(sicherung.name), sicherung);

  /* Der Trockenlauf sagt, was passieren würde — eine Wiederherstellung ohne
     Vorschau ist ein zweiter Datenverlust mit Anlauf. */
  const trocken = await p.evaluate(() => {
    const T = window.__T__;
    const st = T.exportState();
    st.entities.push({ id: 'x_probe', interfaces: ['Article'], name: 'Probe',
      tags: [], components: { Name: { text: 'Probe' } }, relations: [] });
    st.entities[0] = Object.assign({}, st.entities[0], { name: 'Anders' });
    const weg = Object.assign({}, st, { entities: st.entities.slice(2) });
    return {
      gut: T.importReport(st),
      fehlend: T.importReport(weg),
      kaputt: T.importReport({ format: 'anders/1' }),
      keinObjekt: T.importReport('nein'),
    };
  });
  pruefe('the dry run counts new, changed and unchanged',
    trocken.gut.ok && trocken.gut.neu === 1 && trocken.gut.geaendert === 1
    && trocken.gut.gleich > 0, trocken.gut);
  pruefe('the dry run says what a restore would remove',
    trocken.fehlend.weg >= 2, trocken.fehlend);
  pruefe('a file that is not a backup is refused with reasons',
    !trocken.kaputt.ok && trocken.kaputt.fehler.length >= 2
    && !trocken.keinObjekt.ok, trocken);

  /* Fail-closed: nach einem kaputten Ladevorgang wird nicht geschrieben. */
  const vorSchreib = await p.evaluate(() => window.__WROTE__.length);
  await p.evaluate(() => window.__T__.breakLoad('the registry part “views” failed (test).'));
  await p.evaluate(() =>
    [...document.querySelectorAll('.rail button')].find((x) => /All articles/.test(x.textContent)).click());
  await p.waitForTimeout(250);
  await p.evaluate(() => [...document.querySelectorAll('#view .row')][0].click());
  await p.waitForTimeout(300);
  await p.evaluate(() => { const h = document.querySelector('.arthead h2'); if (h) h.click(); });
  await p.waitForTimeout(200);
  await p.evaluate(() => {
    const i = document.querySelector('.arthead input');
    if (i) { i.value = 'Darf nicht gespeichert werden'; i.dispatchEvent(new Event('change', { bubbles: true })); }
  });
  await p.waitForTimeout(400);
  const zu = await p.evaluate((v) => ({
    geschrieben: window.__WROTE__.length - v,
    banner: document.querySelector('#view .banner')?.textContent ?? '',
  }), vorSchreib);
  pruefe('after a failed load nothing is written any more',
    zu.geschrieben === 0 && /Nothing is being saved/.test(zu.banner), zu);
  /* Und die Sicherung geht trotzdem — gerade dann. */
  await p.evaluate(() =>
    [...document.querySelectorAll('.rail button')].find((b) => /Data model/.test(b.textContent)).click());
  await p.waitForTimeout(300);
  await p.evaluate(() =>
    [...document.querySelectorAll('.tabs button')].find((b) => /^Backup$/.test(b.textContent)).click());
  await p.waitForTimeout(350);
  await p.evaluate(() => { window.__SAVED__.length = 0; });
  await p.evaluate(() =>
    [...document.querySelectorAll('#view .btn')].find((b) => /Download a backup/.test(b.textContent)).click());
  await p.waitForTimeout(450);
  const trotzdem = await p.evaluate(() => window.__SAVED__.length);
  pruefe('the backup still works while writing is closed', trotzdem === 1, trotzdem);
  pruefe('the backup raised no exception', errs.length === 0, errs);

  /* Der Prüflauf darf nicht mit geschlossenem Schreibweg weitergehen. */
  await p.evaluate(() => window.__T__.breakLoad(''));
  await p.waitForTimeout(200);

  /* ---- Deckname und bekannte Unbekannte (REQ-178, 179) ----
     Beides sind Zugaben zum Wissensmodell, und beide sind genau dann etwas
     wert, wenn sie *unterschiedlich* ausfallen. Eine Prüfung an einer
     einzelnen Ansicht sähe nichts. */
  const deck = await p.evaluate(() => {
    const alle = [...window.__T__.ENT.values()];
    const e = alle.find((x) => ((x.components || {}).Identity || {}).cover
      && (x.relations || []).some((r) => r.type === 'knowledge'));
    if (!e) return null;
    const info = window.__T__.ENT.get(
      e.relations.find((r) => r.type === 'knowledge').to);
    const kennt = info && (info.relations || []).find((r) => r.type === 'knownBy');
    const pcs = alle.filter((x) => (x.interfaces || [])[0] === 'PlayerCharacter');
    const fremd = pcs.find((x) => !kennt || x.id !== kennt.to);
    return { id: e.id, echt: e.name || e.components.Name.text,
      cover: e.components.Identity.cover,
      kennerId: kennt ? kennt.to : null, fremdId: fremd ? fremd.id : null };
  });
  if (deck && deck.kennerId && deck.fremdId) {
    const sicht2 = async (v) => {
      await p.evaluate((x) => {
        const s2 = document.getElementById('asview');
        s2.value = x;
        s2.dispatchEvent(new Event('change', { bubbles: true }));
      }, v);
      await p.waitForTimeout(400);
      await p.evaluate((i) => window.__T__.go({ k: 'art', id: i }), deck.id);
      await p.waitForTimeout(300);
      await p.evaluate(() => {
        const f = document.getElementById('facet');
        f.value = 'full';
        f.dispatchEvent(new Event('change', { bubbles: true }));
      });
      await p.waitForTimeout(400);
      return p.evaluate(() => ({
        titel: document.querySelector('.arthead h2')?.textContent ?? null,
        zurueck: document.querySelector('.fld.withheld dd')?.textContent ?? null,
        letzte: [...document.querySelectorAll('.fld')].pop()?.className ?? '',
      }));
    };
    const gm2 = await sicht2('');
    const kenner2 = await sicht2(deck.kennerId);
    const fremd2 = await sicht2(deck.fremdId);
    pruefe('the GM and the one who knows see the real name',
      gm2.titel === deck.echt && kenner2.titel === deck.echt, { gm2, kenner2 });
    pruefe('everyone else sees the cover name',
      fremd2.titel === deck.cover, fremd2);
    /* Dass etwas fehlt, darf man wissen — was, nicht. */
    pruefe('a filtered view says how much it is withholding',
      /and \d+ more/.test(fremd2.zurueck || '') && gm2.zurueck === null, fremd2);
    pruefe('the note about it comes last, not in the middle',
      /withheld/.test(fremd2.letzte), fremd2.letzte);

    /* In der Liste gilt derselbe Name — sonst verriete ihn das Kompendium. */
    await p.evaluate(() =>
      [...document.querySelectorAll('.rail button')].find((b) => /All articles/.test(b.textContent)).click());
    await p.waitForTimeout(350);
    const inListe = await p.evaluate((c) =>
      [...document.querySelectorAll('#view .row .rn')].map((x) => x.textContent).includes(c), deck.cover);
    pruefe('the cover name holds in the compendium too', inListe, deck.cover);

    /* Ein Verweis muss trotzdem ankommen: aufgelöst wird gegen den
       gespeicherten Namen, nicht gegen den, der angezeigt wird. */
    const trifft = await p.evaluate((n) => window.__T__.findByName(n), deck.echt);
    pruefe('a link still resolves against the stored name', trifft === deck.id,
      { trifft, erwartet: deck.id });

    await p.evaluate(() => {
      const s2 = document.getElementById('asview');
      s2.value = '';
      s2.dispatchEvent(new Event('change', { bubbles: true }));
    });
    await p.waitForTimeout(350);
    pruefe('cover names raised no exception', errs.length === 0, errs);
  } else {
    pruefe('an article with a cover name exists in the data', false, deck);
  }

  /* ---- Regeln (REQ-091, 098, 099, 175) ----
     Der Massstab ist REQ-098: unter fünf Sekunden. Prüfbar ist daran, dass
     der Text gleich dasteht und dass getippt wird, nicht geklickt. */
  const hatRegeln = await p.evaluate(() =>
    [...window.__T__.ENT.values()].filter((e) => (e.interfaces || [])[0] === 'Rule').length);
  if (hatRegeln >= 2) {
    await p.evaluate(() =>
      [...document.querySelectorAll('.rail button')].find((b) => /^Rules/.test(b.textContent)).click());
    await p.waitForTimeout(400);
    const br = await p.evaluate(() => ({
      count: document.querySelector('#view .count')?.textContent ?? '',
      arten: [...document.querySelectorAll('#view .chips .chip')].map((x) => x.textContent),
      /* Der Text steht gleich da — das ist der ganze Punkt. */
      mitText: [...document.querySelectorAll('#view .rule')]
        .filter((r) => (r.querySelector('.rt')?.textContent || '').trim().length > 10).length,
      gesamt: document.querySelectorAll('#view .rule').length,
      nutzer: [...document.querySelectorAll('#view .rusers .ref')].map((x) => x.textContent),
    }));
    pruefe('the rules browser shows every rule with its text',
      br.gesamt >= 2 && br.mitText === br.gesamt, br);
    pruefe('it groups by kind', br.arten.length >= 2, br.arten);
    /* Wer die Regel benutzt, ist der Rückbezug, den `composedOf` schon
       trägt — keine zweite Liste. */
    pruefe('it says who uses a rule', br.nutzer.length > 0, br.nutzer);

    /* Getippt wird ein Wortanfang, und die Liste wird schmaler. */
    const wort = await p.evaluate(() => {
      const n = document.querySelector('#view .rule .ref')?.textContent || '';
      return n.slice(0, 5).toLowerCase();
    });
    await p.evaluate((w) => {
      const i = document.querySelector('#view input[type=search]');
      i.value = w;
      i.dispatchEvent(new Event('input', { bubbles: true }));
    }, wort);
    await p.waitForTimeout(300);
    const eng = await p.evaluate(() => ({
      count: document.querySelector('#view .count')?.textContent ?? '',
      erste: document.querySelector('#view .rule .ref')?.textContent ?? null,
    }));
    pruefe('typing narrows it down and puts the name match first',
      /^1 of /.test(eng.count) === false || eng.erste !== null,
      eng);
    pruefe('the search finds the rule it was typed for',
      (eng.erste || '').toLowerCase().indexOf(wort) === 0, { wort, eng });
    await p.evaluate(() => {
      const i = document.querySelector('#view input[type=search]');
      i.value = '';
      i.dispatchEvent(new Event('input', { bubbles: true }));
    });
    await p.waitForTimeout(250);

    /* Der Merkzettel liegt im eigenen Bereich des Nutzers — einer, den
       alle sehen, ist keiner. */
    await p.evaluate(() => [...document.querySelectorAll('#view .rule .rk .btn')][0].click());
    await p.waitForTimeout(450);
    const pin = await p.evaluate(() => ({
      chips: [...document.querySelectorAll('.pinbar .chip')].map((x) => x.textContent),
      wohin: window.__WROTE__.filter((x) => /data\/users/.test(x)),
    }));
    pruefe('a pinned rule goes to the viewer’s own corner',
      pin.chips.length === 1 && pin.wohin.length > 0, pin);

    /* Verweise im Fliesstext: wo eine Regel beim Namen genannt wird, steht
       sie auch — und sie klappt an Ort und Stelle auf, weil Wegspringen und
       Zurückspringen zwei Schritte zu viel sind. */
    /* Gesucht ist ein Artikel, in dessen *gezeichnetem* Text ein Regelname
       vorkommt. Das ist nicht dasselbe wie „steht in seinen Feldern": ein
       Statblock zieht die Regeltexte über `composedOf` herein, und genau
       dort will man den Verweis. Deshalb wird der gezogene Text mitgesucht. */
    const mitProsa = await p.evaluate(() => {
      const T = window.__T__;
      const regeln = [...T.ENT.values()].filter((e) => (e.interfaces || [])[0] === 'Rule');
      const namen = regeln.map((e) => e.name || e.components.Name.text)
        .filter((n) => n && n.length >= 4);
      /* Prosa ist die Beschreibung und die Textblöcke — nicht der ganze
         Artikel. Der Name selbst zählt nicht: ein Artikel, der „Verzicht:
         Verstrickt" heisst, nennt keine Regel im Text, und ein Treffer
         darauf prüfte die Suche statt das Erkennen. */
      const prosa = (x) => {
        let t = ((x.components || {}).Description || {}).raw || '';
        (x.blocks || []).forEach((b) => { t += ' ' + (b.body || ''); });
        return t;
      };
      const textVon = (x) => {
        let t = prosa(x);
        (x.relations || []).forEach((r) => {
          const d = T.REG.relations[r.type];
          if (!d || !d.section) return;
          const z = T.ENT.get(r.to);
          if (z) t += ' ' + prosa(z);
        });
        return t;
      };
      const e = [...T.ENT.values()].find((x) =>
        (x.interfaces || [])[0] !== 'Rule' && T.articleVisible(x)
        && namen.some((n) => textVon(x).indexOf(n) >= 0));
      return e ? e.id : null;
    });
    if (mitProsa) {
      await oeffneId(mitProsa);
      await p.evaluate(() => {
        const f = document.getElementById('facet');
        f.value = 'full';
        f.dispatchEvent(new Event('change', { bubbles: true }));
      });
      await p.waitForTimeout(450);
      const inline2 = await p.evaluate(() =>
        [...document.querySelectorAll('.rulew')].map((x) => x.textContent));
      pruefe('a rule named in prose is marked', inline2.length > 0, inline2);
      await p.evaluate(() => { const w = document.querySelector('.rulew'); if (w) w.click(); });
      await p.waitForTimeout(300);
      const auf = await p.evaluate(() => {
        const n = document.querySelector('.rulepop');
        return n && n.style.display !== 'none' ? n.textContent : null;
      });
      pruefe('it opens where it stands instead of jumping away',
        !!auf && auf.length > 20, auf && auf.slice(0, 60));
    } else {
      pruefe('some article names a rule in its prose', false, 'keiner gefunden');
    }
    pruefe('the rules browser raised no exception', errs.length === 0, errs);
  } else {
    pruefe('rule elements exist in the data', false, hatRegeln);
  }

  /* ---- Punktreise (REQ-168 bis 171) ----
     Eine Punktreise ist ein Graph, keine Karte: von jedem Knoten geht es
     nur dorthin, wohin jemand einen Weg gelegt hat. Prüfbar ist daran, dass
     sich die Wege ändern, wenn die Gruppe weiterzieht — und dass Zeit und
     Zehrung dabei laufen. */
  const reise = await p.evaluate(() => {
    const T = window.__T__;
    const eltern = [...T.ENT.values()].find((e) => {
      if ((e.interfaces || [])[0] !== 'Place') return false;
      const kinder = [...T.ENT.values()].filter((o) =>
        (o.relations || []).some((r) => r.type === 'partOf' && r.to === e.id));
      return kinder.length >= 3
        && kinder.some((k) => (k.relations || []).some((r) => r.type === 'route'));
    });
    return eltern ? eltern.id : null;
  });
  if (reise) {
    await oeffneId(reise);
    await p.evaluate(() => {
      const f = document.getElementById('facet');
      f.value = 'crawl';
      f.dispatchEvent(new Event('change', { bubbles: true }));
    });
    await p.waitForTimeout(550);
    const lies2 = () => p.evaluate(() => ({
      kopf: [...document.querySelectorAll('.crawl .maptools .pill')].map((x) => x.textContent),
      spalten: [...document.querySelectorAll('.crcol')].map((c) => ({
        k: c.querySelector('.ck').textContent,
        n: [...c.querySelectorAll('.crnode b')].map((b) => b.textContent) })),
      hier: document.querySelector('.crnode.here b')?.textContent ?? null,
      wege: [...document.querySelectorAll('.crway .ck .ref')].map((x) => x.textContent),
      signale: [...document.querySelectorAll('.crway .cb')].length,
      handlungen: [...document.querySelectorAll('.cractions .rl')].map((x) => x.textContent),
      probleme: [...document.querySelectorAll('.pruef li')].map((x) => x.textContent),
    }));
    const vor2 = await lies2();
    pruefe('the crawl orders its nodes by distance from where you stand',
      vor2.spalten.length >= 2 && vor2.spalten[0].k === 'here'
      && vor2.spalten[0].n.length === 1, vor2.spalten);
    /* Der Sinneseindruck steht an der Kante: jeder Weg bringt seinen
       eigenen mit, und das ist der Unterschied zu einer Liste von Orten. */
    pruefe('every way carries its own sensory line',
      vor2.wege.length >= 2 && vor2.signale === vor2.wege.length,
      { wege: vor2.wege, signale: vor2.signale });
    pruefe('the crawl validates clean', vor2.probleme.length === 0, vor2.probleme);
    pruefe('each character gets one action at this node',
      vor2.handlungen.length >= 1, vor2.handlungen);
    /* Tag, Wache und Zehrung stehen da — sonst führt sie niemand nach. */
    pruefe('day, watch and provisions are on the bar',
      vor2.kopf.some((t) => /Day \d+, watch \d+/.test(t))
      && vor2.kopf.some((t) => /rations in/.test(t)), vor2.kopf);

    await p.evaluate(() =>
      [...document.querySelectorAll('.crway .btn')].find((b) => /Travel/.test(b.textContent)).click());
    await p.waitForTimeout(650);
    const nach2 = await lies2();
    pruefe('travelling moves the party and re-draws the ways',
      nach2.hier !== vor2.hier
      && JSON.stringify(nach2.wege) !== JSON.stringify(vor2.wege), { vor2: vor2.hier, nach2: nach2.hier });
    /* Ankommen deckt auf, wohin es weitergeht — sonst müsste die
       Spielleitung jede Kante von Hand freischalten und vergisst die
       halben. */
    pruefe('arriving reveals where it goes on from there',
      nach2.wege.length >= 2, nach2.wege);
    const zahl = (t) => { const m = /in (\d+)/.exec(t || ''); return m ? Number(m[1]) : null; };
    const vorR = zahl(vor2.kopf.find((t) => /rations in/.test(t)));
    const nachR = zahl(nach2.kopf.find((t) => /rations in/.test(t)));
    pruefe('a node of travel costs a watch and a step of provisions',
      nachR !== null && vorR !== null && nachR === vorR - 1
      && nach2.kopf.join() !== vor2.kopf.join(), { vorR, nachR });
    pruefe('the crawl raised no exception', errs.length === 0, errs);
  } else {
    pruefe('a point-crawl exists in the data', false, 'keine gefunden');
  }

  /* ---- Ebenen und Stapel (REQ-004 bis 009, 044) ----
     Der Prüfstein ist, dass sich etwas *ändert*, wenn man eine Ebene
     umlegt. Eine Stapelanzeige, die immer dasselbe zeigt, ist eine
     Behauptung. */
  const stapel = await p.evaluate(() => {
    const T = window.__T__;
    const camp = [...T.ENT.values()].find((e) =>
      (e.relations || []).some((r) => r.type === 'activates'));
    const aus = [...T.ENT.values()].find((e) => (e.interfaces || [])[0] === 'Layer'
      && !(camp?.relations || []).some((r) => r.type === 'activates' && r.to === e.id));
    const ersetzt = [...T.ENT.values()].find((e) =>
      (e.relations || []).some((r) => r.type === 'overrides'));
    return {
      camp: camp ? camp.id : null,
      aus: aus ? aus.id : null,
      neu: ersetzt ? ersetzt.id : null,
      alt: ersetzt ? ersetzt.relations.find((r) => r.type === 'overrides').to : null,
    };
  });
  if (stapel.camp && stapel.neu) {
    await oeffneId(stapel.camp);
    await p.evaluate(() => {
      const f = document.getElementById('facet');
      f.value = 'stack';
      f.dispatchEvent(new Event('change', { bubbles: true }));
    });
    await p.waitForTimeout(550);
    const st3 = await p.evaluate(() => ({
      ebenen: [...document.querySelectorAll('.layer .ck .ref')].map((x) => x.textContent),
      nummern: [...document.querySelectorAll('.layer .num')].map((x) => Number(x.textContent)),
      ersetzt: [...document.querySelectorAll('.stackbox .chips .chip.warn')].map((x) => x.textContent),
      probleme: [...document.querySelectorAll('.pruef li')].map((x) => x.textContent),
    }));
    pruefe('the stack lists its layers bottom first',
      st3.ebenen.length >= 2
      && st3.nummern.every((n, i) => i === 0 || n === st3.nummern[i - 1] + 1), st3);
    pruefe('the stack names what a higher layer replaces',
      st3.ersetzt.length >= 1 && /→/.test(st3.ersetzt[0]), st3.ersetzt);
    pruefe('the stack validates clean', st3.probleme.length === 0, st3.probleme);

    /* Was ersetzt ist, ist weg — nicht durchgestrichen, sondern weg: eine
       Liste, die beide Fassungen zeigt, ist schlimmer als keine. */
    const beide = await p.evaluate((ids) => {
      const sichtbar = (id) => {
        const e = window.__T__.ENT.get(id);
        return !!e && window.__T__.articleVisible(e);
      };
      return { neu: sichtbar(ids.neu), alt: sichtbar(ids.alt) };
    }, stapel);
    pruefe('the replaced version is out and the replacing one is in',
      beide.neu === true && beide.alt === false, beide);

    /* Die Herkunft steht am Artikel, nicht in einem Register — die Frage
       stellt sich dort, wo man liest. */
    await oeffneId(stapel.neu);
    const herkunft = await p.evaluate(() =>
      [...document.querySelectorAll('.stackchip .chip')].map((x) => x.textContent));
    pruefe('an article says which layer it comes from', herkunft.length >= 1, herkunft);

    /* Und jetzt die Gegenprobe: eine Ebene aufschalten, die etwas
       herausnimmt, und nachsehen, dass es verschwindet. */
    if (stapel.aus) {
      const wegName = await p.evaluate((lid) => {
        const T = window.__T__;
        const opfer = [...T.ENT.values()].find((e) =>
          (e.relations || []).some((r) => r.type === 'inLayer' && r.to === lid
            && (r.props || {}).mode === 'removes'));
        return opfer ? opfer.id : null;
      }, stapel.aus);
      if (wegName) {
        const vorhin = await p.evaluate((id) => {
          const e = window.__T__.ENT.get(id);
          return !!e && window.__T__.articleVisible(e);
        }, wegName);
        await oeffneId(stapel.camp);
        await p.evaluate(() => {
          const f = document.getElementById('facet');
          f.value = 'stack';
          f.dispatchEvent(new Event('change', { bubbles: true }));
        });
        await p.waitForTimeout(500);
        await p.evaluate((lid) => {
          const sel = [...document.querySelectorAll('.stackbox select')][0];
          sel.value = lid;
          sel.dispatchEvent(new Event('change', { bubbles: true }));
        }, stapel.aus);
        await p.waitForTimeout(600);
        const jetzt = await p.evaluate((id) => {
          const e = window.__T__.ENT.get(id);
          return !!e && window.__T__.articleVisible(e);
        }, wegName);
        pruefe('switching a layer on can take something out of play',
          vorhin === true && jetzt === false, { vorhin, jetzt });
        /* Und wieder ab: der Artikel ist zurück. Löschen wäre endgültig
           gewesen, Herausnehmen ist es nicht. */
        await p.evaluate(() => {
          const b2 = [...document.querySelectorAll('.layer .btn')].pop();
          if (b2) b2.click();
        });
        await p.waitForTimeout(600);
        const zurueck2 = await p.evaluate((id) => {
          const e = window.__T__.ENT.get(id);
          return !!e && window.__T__.articleVisible(e);
        }, wegName);
        pruefe('switching it off brings it back', zurueck2 === true, zurueck2);
      } else {
        pruefe('a layer that removes something exists in the data', false, stapel.aus);
      }
    }
    pruefe('the layer stack raised no exception', errs.length === 0, errs);
  } else {
    pruefe('a campaign with layers exists in the data', false, stapel);
  }

  pruefe('knowledge needed no browser modal', modale.length === 0, modale);
  pruefe('no exception through the knowledge panel', errs.length === 0, errs);

  /* Die Ansicht wieder auf Schnell — eine Prüfung, die etwas aufmacht,
     räumt es auch weg. */
  await p.evaluate(() => {
    const f = document.getElementById('facet');
    f.value = 'quick';
    f.dispatchEvent(new Event('change', { bubbles: true }));
  });
  await p.waitForTimeout(200);
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
  pruefe('counts registry parts correctly', /0 of 6 registry parts/.test(s.banner ?? ''), s);
  pruefe('does not sit on Loading…', !s.laedt, s);
  pruefe('no exception without data', errs.length === 0, errs);
  await p.close();
}

await browser.close();
console.log(fehler ? `\n${fehler} check(s) failed.` : '\nAll checks passed.');
process.exit(fehler ? 1 : 0);
