/* Prüflauf für D54 (REQ-214–217): das Tragraster aus Grösse und Statblock,
   die Basiszonen, Behälter in Behältern, die Figur im Reiter „Worn“ und
   „Draw“ am Bogen; dazu D58 (REQ-225): der Gurt frei, „Drop“ und „Stow“. `node build-harness.mjs` vorher; die Artikel legt der
   Lauf selbst an, `dbdump/entities` darf leer sein. */
import { chromium } from 'playwright';
import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HIER = dirname(fileURLToPath(import.meta.url));
const AUS_DEM_BILD = '/opt/pw-browsers/chromium';
const browser = await chromium.launch(existsSync(AUS_DEM_BILD) ? { executablePath: AUS_DEM_BILD } : {});
const p = await browser.newPage();
const fehlerImSkript = [];
p.on('pageerror', (e) => fehlerImSkript.push(String(e)));
await p.goto('file://' + join(HIER, 'harness', 'index.html'));
await p.waitForTimeout(1500);

let fehler = 0;
const pruefe = (name, ok, was) => {
  if (!ok) fehler++;
  console.log(`${ok ? '  ok  ' : 'FEHLT '} ${name}${ok ? '' : ' — ' + JSON.stringify(was)}`);
};

/* Brom: mittelgross, STR 16 → Zusatzquadrat 3. Im Tragraster die Bag of
   Holding auf einer Aktionszone, darin ein Seil; ein Rucksack an den
   Schultern mit einer Fackel in seiner Aktionszone; ein Dolch im Holster;
   ein Ring am alten Platz `ring1` (vor der Wanderung). */
await p.evaluate(() => {
  const T = window.__T__;
  const jetzt = new Date().toISOString();
  const art = (id, typ, name, comps = {}, relations = []) => T.persist({ id, interfaces: [typ], name,
    components: Object.assign({ Identity: { name, id: id } }, comps), adhoc: [], relations, createdAt: jetzt });
  art('it_seil', 'Item', 'Rope');
  art('it_fackel', 'Item', 'Torch');
  art('it_dolch', 'Item', 'Dagger');
  art('it_ring', 'Item', 'Ring of Warmth');
  art('inv_bag', 'Inventory', 'Bag — inside', { Inventory: { grid: ['####', '####'] } },
    [{ id: 'h1', type: 'holds', to: 'it_seil', props: { qty: 1, gx: 0, gy: 0 } }]);
  art('inv_pack', 'Inventory', 'Pack — inside', { Inventory: { grid: ['######'], zones: { '0,0': 'action', '5,0': 'round' } } },
    [{ id: 'h2', type: 'holds', to: 'it_fackel', props: { qty: 1, gx: 0, gy: 0 } }]);
  art('it_bag', 'Item', 'Bag of Holding', {}, [{ id: 'c1', type: 'carries', to: 'inv_bag', props: {} }]);
  art('it_pack', 'Item', 'Backpack', {}, [{ id: 'c2', type: 'carries', to: 'inv_pack', props: {} }]);
  art('inv_brom', 'Inventory', 'Brom — gear', {}, [
    { id: 'h3', type: 'holds', to: 'it_bag', props: { qty: 1, gx: 3, gy: 0 } },
    { id: 'h4', type: 'holds', to: 'it_pack', props: { qty: 1, slot: 'shoulders', tier: 'worn' } },
    { id: 'h5', type: 'holds', to: 'it_dolch', props: { qty: 1, slot: 'holster1', tier: 'belt' } },
    { id: 'h6', type: 'holds', to: 'it_ring', props: { qty: 1, slot: 'ring1', tier: 'worn' } },
  ]);
  art('cr_brom', 'Creature', 'Brom', { Creature: { figure: 'female' } },
    [{ id: 'c3', type: 'carries', to: 'inv_brom', props: {} }]);
  art('sb_brom', 'Statblock', 'Brom (stats)', { Statblock: { size: 'medium', prof: 2 }, Abilities: { str: 16 } },
    [{ id: 'b1', type: 'belongsTo', to: 'cr_brom', props: {} }]);
});
await p.waitForTimeout(400);

const r = await p.evaluate(() => {
  const T = window.__T__;
  const inv = T.ENT.get('inv_brom');
  const cg = T.carryGridOf(inv);
  const form = T.containerGrid(inv);
  const z = T.zonesOf(inv);
  const liste = T.drawList(T.ENT.get('cr_brom')).map((d) => ({ n: d.item.name, s: d.stage, w: T.drawPath(d) }));
  return { cg, cols: form.cols, rows: form.rows, z00: z['0,0'], z20: z['2,0'], z60: z['6,0'], liste,
    plaetze: T.slotList(), vorlagen: T.containerPresets().map((v) => v.name) };
});
pruefe('Tragraster 11×6 aus Grösse medium und STR 16', r.cols === 11 && r.rows === 6 && r.cg && r.cg.base === 5 && r.cg.extra === 3, r);
pruefe('Basiszonen nach Spalten', r.z00 === 'bonus action' && r.z20 === 'action' && r.z60 === 'turn', r);
const stufe = (n) => (r.liste.find((x) => x.n === n) || {}).s;
pruefe('Bag of Holding liegt in der Aktionszone', stufe('Bag of Holding') === 'action', r.liste);
pruefe('das Seil darin braucht einen Zug', stufe('Rope') === 'turn', r.liste);
pruefe('der Rucksack an den Schultern nimmt die Stufe des Platzes', stufe('Backpack') === 'bonus action', r.liste);
pruefe('die Fackel im Rucksack: Aktionszone gegen Platz + 1', stufe('Torch') === 'action', r.liste);
pruefe('der Dolch im Holster ist frei', stufe('Dagger') === 'free action', r.liste);
pruefe('der Weg steht in Worten', /Bag of Holding in the action zone → turn/.test((r.liste.find((x) => x.n === 'Rope') || {}).w || ''), r.liste);
pruefe('die Plätze kommen aus dem Register', r.plaetze.includes('holster2') && r.plaetze.includes('neck4') && !r.plaetze.includes('ring1'), r.plaetze);
pruefe('die Vorlagen kommen aus den Einstellungen', r.vorlagen.includes('Backpack') && r.vorlagen.includes('Bag of Holding'), r.vorlagen);

/* Der Reiter „Worn“: die Figur und der verwaiste alte Platz. */
await p.evaluate(() => { const T = window.__T__; T.go({ k: 'art', id: 'cr_brom' }); T.UI.invView = 'body'; T.UI.tab = 'gear'; T.render(); });
await p.waitForTimeout(500);
const worn = await p.evaluate(() => ({
  text: document.getElementById('main').innerText,
  fig: (document.querySelector('.wornfig svg') || { getAttribute: () => '' }).getAttribute('aria-label'),
}));
pruefe('die Figur folgt Creature.figure', worn.fig === 'Figure: female', worn.fig);
pruefe('Holster und Ringe je Hand stehen da', /Holster II/i.test(worn.text) && /Rings, left hand/i.test(worn.text), worn.text.slice(0, 600));
pruefe('ein alter Platz wird gezeigt und nicht verschluckt', /slot the registry no longer knows/i.test(worn.text), '');

/* Draw am Bogen. */
await p.evaluate(() => { const T = window.__T__; T.UI.tab = ''; T.UI.drawOpen = 'turn'; T.render(); });
await p.waitForTimeout(400);
const bogen = await p.evaluate(() => document.getElementById('main').innerText);
pruefe('am Bogen je Stufe ein Draw', /Draw/.test(bogen) && /bonus action/i.test(bogen), bogen.slice(0, 300));
pruefe('Draw zeigt Stück, Weg und Stufe', /Rope[\s\S]{0,80}Bag of Holding in the action zone → turn/.test(bogen), bogen.slice(bogen.indexOf('Actions'), bogen.indexOf('Actions') + 600));

/* REQ-225, D58: der Gurt ist frei, Drop kostet eine freie Aktion, Stow eine Bonusaktion. */
const kosten = await p.evaluate(() => ({ h: window.__T__.handActionsCost(), belt: window.__T__.setting('slotDraw', '') }));
pruefe('Drop frei, Stow Bonusaktion (Einstellung handActions)', kosten.h.drop === 'free action' && kosten.h.stow === 'bonus action', kosten.h);
pruefe('der Gurt ist eine freie Aktion (slotDraw)', /belt:free action/.test(kosten.belt), kosten.belt);
await p.evaluate(() => {
  const T = window.__T__;
  T.persist({ id: 'it_schwert', interfaces: ['Item'], name: 'Longsword', components: { Identity: { name: 'Longsword' } }, adhoc: [], relations: [], createdAt: new Date().toISOString() });
  const inv = T.ENT.get('inv_brom');
  T.persist(Object.assign({}, inv, { relations: inv.relations.concat([
    { id: 'h7', type: 'holds', to: 'it_schwert', props: { qty: 1, slot: 'mainHand', tier: 'held' } },
    { id: 'h8', type: 'holds', to: 'it_fackel', props: { qty: 1, slot: 'belt', tier: 'belt' } },
  ]) }));
  T.UI.drawOpen = ''; T.render();
});
await p.waitForTimeout(400);
const zeilenText = await p.evaluate(() => [...document.querySelectorAll('#main .drawrow')].map((r) => r.innerText.replace(/\s+/g, ' ')));
const zeileVon = (w) => zeilenText.find((t) => t.startsWith(w)) || '';
pruefe('Drop steht in der Zeile der freien Aktion', /Drop · 1/.test(zeileVon('free action')), zeilenText);
pruefe('Stow steht in der Zeile der Bonusaktion', /Stow · 1/.test(zeileVon('bonus action')) && !/Stow/.test(zeileVon('free action')), zeilenText);
const gurt = await p.evaluate(() => (window.__T__.drawList(window.__T__.ENT.get('cr_brom')).find((d) => d.rel ? d.rel.id === 'h8' : d.st.rel.id === 'h8') || {}).stage);
pruefe('was am Gurt hängt, kommt mit einer freien Aktion', gurt === 'free action', gurt);

const klick = (text) => p.evaluate((t) => {
  const b = [...document.querySelectorAll('#main .drawrows button')].find((x) => x.textContent.trim().startsWith(t));
  if (b) b.click();
  return !!b;
}, text);
await klick('Drop');
await p.waitForTimeout(300);
await p.evaluate(() => [...document.querySelectorAll('#main .drawlist button')].find((b) => b.textContent === 'Drop').click());
await p.waitForTimeout(300);
const fallen = await p.evaluate(() => {
  const h = window.__T__.ENT.get('inv_brom').relations.find((x) => x.id === 'h7');
  return { props: h.props, text: document.getElementById('main').innerText };
});
pruefe('Drop: das Schwert liegt am Boden und bleibt im Inventar', fallen.props.tier === 'ground' && !fallen.props.slot, fallen.props);
pruefe('der Bogen sagt, was am Boden liegt', /On the ground: Longsword/.test(fallen.text), '');

/* Wieder in die Hand, dann verstauen: erst ins Raster, dann an den Platz. */
const inDieHand = () => p.evaluate(() => {
  const T = window.__T__;
  const inv = T.ENT.get('inv_brom');
  T.persist(Object.assign({}, inv, { relations: inv.relations.map((x) => x.id === 'h7'
    ? Object.assign({}, x, { props: { qty: 1, slot: 'offHand', tier: 'held' } }) : x) }));
  T.UI.drawOpen = 'stow'; T.render();
});
await inDieHand();
await p.waitForTimeout(300);
const ziele = await p.evaluate(() => [...document.querySelectorAll('#main .drawlist select option')].map((o) => o.value));
pruefe('Stow bietet das Raster und freie Plätze, keine Hand und keinen belegten', ziele[0] === 'grid' && ziele.includes('head') && !ziele.includes('mainHand') && !ziele.includes('belt') && !ziele.includes('holster1'), ziele);
await p.evaluate(() => [...document.querySelectorAll('#main .drawlist button')].find((b) => b.textContent === 'Stow').click());
await p.waitForTimeout(300);
let verstaut = await p.evaluate(() => window.__T__.ENT.get('inv_brom').relations.find((x) => x.id === 'h7').props);
pruefe('Stow ins Raster: Lage gesetzt, aus der Hand, im Gepäck', verstaut.gx != null && verstaut.gy != null && !verstaut.slot && verstaut.tier === 'pack', verstaut);
await inDieHand();
await p.waitForTimeout(300);
await p.evaluate(() => {
  const sel = document.querySelector('#main .drawlist select');
  sel.value = 'holster2';
  [...document.querySelectorAll('#main .drawlist button')].find((b) => b.textContent === 'Stow').click();
});
await p.waitForTimeout(300);
verstaut = await p.evaluate(() => window.__T__.ENT.get('inv_brom').relations.find((x) => x.id === 'h7').props);
pruefe('Stow an einen Platz: Holster, Stufe Gurt', verstaut.slot === 'holster2' && verstaut.tier === 'belt' && verstaut.gx == null, verstaut);

/* „How it works“ rechnet Gurt, Drop und Stow aus den Einstellungen. */
await p.evaluate(() => { const T = window.__T__; T.UI.regtab = 'howto'; T.go({ k: 'reg' }); });
await p.waitForTimeout(500);
const howto = await p.evaluate(() => document.getElementById('main').innerText);
pruefe('How it works: Gurt frei, Drop frei, Stow Bonusaktion', /Dagger at the belt\s+slotDraw\s+→\s+free action/.test(howto) && /Drop\s+handActions\s+→\s+free action/.test(howto) && /Stow\s+handActions\s+→\s+bonus action/.test(howto), howto.slice(howto.indexOf('Dagger at the belt') - 50, howto.indexOf('Dagger at the belt') + 300));
await p.evaluate(() => window.__T__.go({ k: 'art', id: 'cr_brom' }));
await p.waitForTimeout(300);

/* Wird Brom klein, liegt die Bag ausserhalb der Form — ihre Lage bleibt. */
await p.evaluate(() => {
  const T = window.__T__;
  const sb = T.ENT.get('sb_brom');
  T.persist(Object.assign({}, sb, { components: Object.assign({}, sb.components, { Statblock: { size: 'tiny', prof: 2 } }) }));
});
await p.waitForTimeout(300);
const klein = await p.evaluate(() => {
  const T = window.__T__;
  const inv = T.ENT.get('inv_brom');
  const h = inv.relations.find((x) => x.id === 'h3');
  return { gx: h.props.gx, stufe: (T.drawList(T.ENT.get('cr_brom')).find((d) => d.item.id === 'it_bag') || {}).stage };
});
pruefe('ausserhalb der Form: Lage bleibt, keine Stufe', klein.gx === 3 && klein.stufe === null, klein);

pruefe('keine Skriptfehler', fehlerImSkript.length === 0, fehlerImSkript);
await browser.close();
console.log(fehler ? `${fehler} Prüfung(en) fehlgeschlagen` : 'alles grün');
process.exit(fehler ? 1 : 0);
