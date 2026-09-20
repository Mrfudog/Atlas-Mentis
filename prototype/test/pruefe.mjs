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
  await p.evaluate(() => [...document.querySelectorAll('#view .row')].find((r) => /Volo/.test(r.textContent)).click());
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
  pruefe('the toolbox offers every element', werkzeuge.length === 9 && werkzeuge.some((t) => /Field table/.test(t)), werkzeuge);

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
  await oeffne('Volo');

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
     einzige Weg dorthin, und der ist aus der Artikelleiste verschwunden. */
  await oeffne('Nebeldistrikt');
  await p.evaluate(() => document.querySelector('.arthead h2').click());
  await p.waitForTimeout(250);
  const nameOffen = await p.evaluate(() => document.querySelector('.arthead input')?.value ?? null);
  await p.evaluate(() => {
    const i = document.querySelector('.arthead input');
    i.value = 'Mist District';
    i.dispatchEvent(new Event('change', { bubbles: true }));
  });
  await p.waitForTimeout(350);
  const nameNeu = await p.evaluate(() => ({
    titel: document.querySelector('.arthead h2')?.textContent,
    geschrieben: window.__WROTE__.filter((x) => /o_nebeldistrikt/.test(x)).length,
  }));
  pruefe('the name is editable in place',
    nameOffen === 'Nebeldistrikt' && nameNeu.titel === 'Mist District' && nameNeu.geschrieben > 0,
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
