/* Prüflauf für D55 (REQ-218, 219): Blaupausen werden gelernt, die Werkbank
   filtert, und das Material wird beim Start gebunden. Die Artikel legt der
   Lauf selbst an — er braucht nur das Register aus `emit-seed`.
   `node build-harness.mjs` vorher. */
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

/* Eine Schmiedin mit fünf Eisen und einer Zange; zwei Rezepte. Das
   Schwert braucht drei Eisen und die Zange (nicht verbraucht), der Nagel
   ein Eisen und zwei Kohle, die niemand hat. */
await p.evaluate(() => {
  const T = window.__T__;
  const jetzt = new Date().toISOString();
  const art = (id, typ, name, comps, rels) => T.persist({ id, interfaces: [typ], name,
    components: Object.assign({ Identity: { name, id: id, aliases: [] } }, comps || {}),
    adhoc: [], relations: rels || [], createdAt: jetzt });
  art('it_eisen', 'Item', 'Iron');
  art('it_zange', 'Item', 'Tongs');
  art('it_kohle', 'Item', 'Coal');
  art('it_schwert', 'Item', 'Sword');
  art('it_nagel', 'Item', 'Nail');
  art('rz_schwert', 'Recipe', 'Forge a sword',
    { Recipe: { trade: 'Smith', days: 1, dc: 1, onFailure: 'halfLost' } },
    [{ id: 'n1', type: 'needs', to: 'it_eisen', props: { qty: 3 } },
     { id: 'n2', type: 'needs', to: 'it_zange', props: { qty: 1, consumed: false } },
     { id: 'y1', type: 'yields', to: 'it_schwert', props: {} }]);
  art('rz_nagel', 'Recipe', 'Forge nails',
    { Recipe: { trade: 'Smith', tool: 'Tongs', days: 2, onFailure: 'materialsLost' } },
    [{ id: 'n3', type: 'needs', to: 'it_eisen', props: { qty: 1 } },
     { id: 'n4', type: 'needs', to: 'it_kohle', props: { qty: 2 } },
     { id: 'y2', type: 'yields', to: 'it_nagel', props: {} }]);
  art('inv_s', 'Inventory', 'Smith’s pack', {},
    [{ id: 'h1', type: 'holds', to: 'it_eisen', props: { qty: 5, tier: 'pack' } },
     { id: 'h2', type: 'holds', to: 'it_zange', props: { qty: 1, tier: 'belt' } }]);
  art('cr_s', 'Creature', 'Smith', {}, [{ id: 'c1', type: 'carries', to: 'inv_s', props: {} }]);
});
await p.waitForTimeout(600);

const frage = (fn, ...args) => p.evaluate(([f, a]) => {
  const T = window.__T__;
  const E = (id) => T.ENT.get(id);
  return new Function('T', 'E', 'a', f)(T, E, a);
}, [fn, args]);

pruefe('ohne Zuteilung ist die Blaupause nicht gelernt',
  await frage("return T.recipeLearned(E('rz_schwert'),'cr_s')") === 'unlearned');
pruefe('„this character knows" lässt sie weg',
  !(await frage("return T.craftMatches(E('rz_schwert'),E('cr_s'),{know:'learned'})")));
pruefe('„all blueprints" zeigt sie',
  await frage("return T.craftMatches(E('rz_schwert'),E('cr_s'),{know:''})"));

await frage("T.craftTeach(E('rz_schwert'),E('cr_s'))");
await p.waitForTimeout(500);
pruefe('Lehren teilt eine Information über knownBy zu',
  await frage("return T.recipeLearned(E('rz_schwert'),'cr_s')") === 'learned');

pruefe('das Schwert ist machbar',
  await frage("return T.craftMatches(E('rz_schwert'),E('cr_s'),{ready:'ready'})"));
pruefe('der Nagel ist „fast" (Kohle fehlt, ein Posten)',
  await frage("var s=T.craftStatus(E('rz_nagel'),E('cr_s')); return s.short===1&&T.craftMatches(E('rz_nagel'),E('cr_s'),{ready:'almost'})"));
pruefe('das Schwert ist nicht „fast"',
  !(await frage("return T.craftMatches(E('rz_schwert'),E('cr_s'),{ready:'almost'})")));
pruefe('nach Material: aus Kohle nur der Nagel',
  await frage("return !T.craftMatches(E('rz_schwert'),E('cr_s'),{material:'it_kohle'})&&T.craftMatches(E('rz_nagel'),E('cr_s'),{material:'it_kohle'})"));
pruefe('nach Beruf und Werkzeug',
  await frage("return T.craftMatches(E('rz_schwert'),E('cr_s'),{trade:'trade:Smith'})&&!T.craftMatches(E('rz_schwert'),E('cr_s'),{trade:'tool:Tongs'})&&T.craftMatches(E('rz_nagel'),E('cr_s'),{trade:'tool:Tongs'})"));

pruefe('was zurückkommt: Gelingen gibt nur die Zange zurück',
  JSON.stringify(await frage("return T.craftReturns(E('rz_schwert'),[{item:'it_eisen',qty:3},{item:'it_zange',qty:1}],true)"))
    === JSON.stringify([{ item: 'it_zange', qty: 1 }]));
pruefe('was zurückkommt: Misslingen mit halfLost rundet ab, die Zange immer',
  JSON.stringify(await frage("return T.craftReturns(E('rz_schwert'),[{item:'it_eisen',qty:3},{item:'it_zange',qty:1}],false)"))
    === JSON.stringify([{ item: 'it_eisen', qty: 1 }, { item: 'it_zange', qty: 1 }]));
pruefe('was zurückkommt: materialsLost gibt nichts',
  (await frage("return T.craftReturns(E('rz_nagel'),[{item:'it_eisen',qty:1}],false)")).length === 0);

/* Ein Gang aus der Zeit vor D55: nichts gebunden, die Zange in der Hand. */
await frage("var s=E('cr_s'); s.relations.push({id:'alt',type:'crafting',to:'rz_schwert',props:{day:0,days:1,rolls:[],put:[{item:'it_eisen',qty:3}]}}); T.persist(s)");
await p.waitForTimeout(400);
pruefe('ein alter Gang bleibt gültig (Zange zählt in der Hand)',
  await frage("var j=T.craftJobs(E('cr_s'))[0]; return T.jobReady(E('cr_s'),j).ok"));
await frage("var s=E('cr_s'); s.relations=s.relations.filter(function(r){return r.id!=='alt';}); T.persist(s)");
await p.waitForTimeout(400);

/* Der Start bindet: drei Eisen und die Zange verlassen den Beutel. */
await frage("T.craftStart(E('rz_schwert'),E('cr_s'))");
await p.waitForTimeout(200);
const dialog = await p.evaluate(() => document.querySelector('.dlgbox')?.innerText || '');
pruefe('der Dialog nennt, was gebunden wird', /Iron ×3, Tongs ×1/.test(dialog), dialog);
await p.evaluate(() => [...document.querySelectorAll('.dlgbox button')].find((b) => b.textContent === 'Start').click());
await p.waitForTimeout(500);
pruefe('nach dem Start: zwei Eisen, keine Zange im Beutel',
  await frage("return T.amountHeld(E('cr_s'),'it_eisen')===2&&T.amountHeld(E('cr_s'),'it_zange')===0"));
pruefe('am Gang gebunden: drei Eisen und die Zange',
  JSON.stringify(await frage("return T.craftJobs(E('cr_s'))[0].rel.props.put"))
    === JSON.stringify([{ item: 'it_eisen', qty: 3 }, { item: 'it_zange', qty: 1 }]));
pruefe('der gebundene Gang ist bereit',
  await frage("var j=T.craftJobs(E('cr_s'))[0]; return T.jobReady(E('cr_s'),j).ok"));

/* Abbruch nach halfLost: ein Eisen und die Zange kommen zurück. */
await frage("T.craftAbort(E('cr_s'),T.craftJobs(E('cr_s'))[0])");
await p.waitForTimeout(200);
await p.evaluate(() => [...document.querySelectorAll('.dlgbox button')].find((b) => b.textContent === 'Stop').click());
await p.waitForTimeout(500);
pruefe('nach dem Abbruch: drei Eisen, die Zange zurück, kein Gang',
  await frage("return T.amountHeld(E('cr_s'),'it_eisen')===3&&T.amountHeld(E('cr_s'),'it_zange')===1&&!T.craftJobs(E('cr_s')).length"));

/* Die Werkbank der Figur: der ungelernte Nagel steht gestrichelt da. */
await frage("T.go({k:'art',id:'cr_s'}); T.UI.tab='craft'; T.render()");
await p.waitForTimeout(600);
const seite = await p.evaluate(() => {
  const z = [...document.querySelectorAll('tr.crrow')];
  return z.map((r) => r.className + ' | ' + r.innerText.replace(/\s+/g, ' ')).join('\n');
});
pruefe('die Werkbank zeigt die ungelernte Blaupause gestrichelt',
  /unlearned \| Forge nails must still be learned/.test(seite), seite);
pruefe('und die gelernte als machbar', /ready \| Forge a sword learned/.test(seite), seite);

if (process.env.BILD) await p.screenshot({ path: process.env.BILD, fullPage: true });
pruefe('keine Skriptfehler', !fehlerImSkript.length, fehlerImSkript);
await browser.close();
console.log(fehler ? `\n${fehler} Prüfung(en) fehlgeschlagen` : '\nalles grün');
process.exit(fehler ? 1 : 0);
