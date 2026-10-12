/* Prüflauf für REQ-220 / D57: die Weltgeschichte als Spuren neben der
   Kampagne. Eine Spur ist ein Ereignis mit Spanne, was darin liegt, sagt
   `partOf` und nicht der Zeitraum; die Kampagne ist eine Spur; was ein
   Spieler nicht sehen oder nicht wissen darf, fehlt. `node
   build-harness.mjs` vorher; der Lauf legt seine Artikel selbst an. */
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

/* Ein Zeitalter, darin ein Krieg, darin eine Schlacht und ein Gefecht nach
   Kriegsende; eine Hochzeit in der Spanne des Kriegs, die nicht zu ihm
   gehört; eine Sitzung in der Kampagne; ein Geheimnis der Leitung; eine
   Krönung, deren Datum hinter einer Information steht. */
await p.evaluate(() => {
  const T = window.__T__;
  const jetzt = new Date().toISOString();
  const zeit = (sort, untilSort) => ({ sort, untilSort, display: 'Y' + sort, until: untilSort ? 'Y' + untilSort : undefined });
  const a = (id, typ, name, comps, rels) => T.persist({ id, interfaces: [typ], name,
    components: Object.assign({ Identity: { name } }, comps), adhoc: [], relations: rels || [], createdAt: jetzt });
  const teil = (to) => ({ id: 'p_' + to + Math.random(), type: 'partOf', to });
  a('w_world', 'World', 'Faerûn', { World: { calendar: 'Dale Reckoning' } });
  a('c_camp', 'Campaign', 'Nebelwacht', {}, [{ id: 'iw', type: 'inWorld', to: 'w_world' }]);
  a('e_age', 'Event', 'Third Age', { Time: zeit(1000, 1500) });
  a('e_war', 'Event', 'Dragon War', { Time: zeit(1480, 1490) }, [teil('e_age')]);
  a('e_battle', 'Event', 'Battle of Ash', { Time: zeit(1485) }, [teil('e_war')]);
  a('e_late', 'Event', 'Late skirmish', { Time: zeit(1495) }, [teil('e_war')]);
  a('e_wedding', 'Event', 'Royal wedding', { Time: zeit(1486) });
  a('s_one', 'Session', 'Session one', { Time: zeit(1492) }, [teil('c_camp')]);
  a('e_secret', 'Event', 'Secret pact', { Time: zeit(1487), Visibility: { audience: 'gm' } }, [teil('e_war')]);
  a('i_crown', 'Information', 'When the crowning was', { Information: { fields: ['Time'] } });
  a('e_crown', 'Event', 'Crowning', { Time: zeit(1484) }, [teil('e_war'), { id: 'k1', type: 'knowledge', to: 'i_crown' }]);
  a('pc_rook', 'PlayerCharacter', 'Rook', {});
});
await p.waitForTimeout(500);

const lanes = await p.evaluate(() => {
  const T = window.__T__;
  return T.worldHistory(T.ENT.get('c_camp')).map((l) => [l.id, l.depth, l.items.map((i) => i.id).join(','), l.outside.join(',')]);
});
pruefe('Spuren als Baum, die Kampagne nach ihrem Anfang', JSON.stringify(lanes.map((l) => [l[0], l[1]])) ===
  JSON.stringify([['e_age', 0], ['e_war', 1], ['c_camp', 0]]), lanes);
const krieg = lanes.find((l) => l[0] === 'e_war');
pruefe('über die Kante, nicht über den Zeitraum: die Hochzeit liegt nicht im Krieg',
  krieg && !krieg[2].includes('e_wedding') && krieg[2].includes('e_battle'), krieg);
pruefe('die Kampagne hält, was keine Spur hält', lanes.find((l) => l[0] === 'c_camp')?.[2] === 'e_wedding,s_one', lanes);
pruefe('ausserhalb der Spanne wird genannt', krieg && krieg[3] === 'e_late', krieg);

/* Die Seite der Kampagne, Reiter Weltgeschichte. */
const seite = async () => p.evaluate(() => document.getElementById('main').innerText);
await p.evaluate(() => { window.__T__.go({ k: 'art', id: 'c_camp' }); });
await p.waitForTimeout(400);
let text = await seite();
pruefe('Reiter Kampagne und Weltgeschichte', /Campaign/.test(text) && /World history/.test(text), text.slice(0, 400));
pruefe('der Kampagnenreiter zeigt die Sitzung, nicht die Schlacht', /Session one/.test(text) && !/Battle of Ash/.test(text), text.slice(0, 800));
await p.evaluate(() => [...document.querySelectorAll('#main .tabs button')].find((b) => b.textContent === 'World history').click());
await p.waitForTimeout(300);
text = await seite();
pruefe('die Weltgeschichte zeigt Spuren und Einträge', /Third Age/.test(text) && /Dragon War/.test(text) && /Battle of Ash/.test(text), text.slice(0, 800));
pruefe('der Kalender der Welt steht dabei', /Dale Reckoning/.test(text), '');
pruefe('die Leitung sieht das Geheimnis', /Secret pact/.test(text), '');
/* `BILD=pfad.png` legt ein Bildschirmfoto der Weltgeschichte ab. */
if (process.env.BILD) await (await p.$('.tlw')).screenshot({ path: process.env.BILD });
await p.evaluate(() => [...document.querySelectorAll('.tllane')].find((l) => l.textContent.startsWith('Dragon War')).querySelector('.tlzoom').click());
await p.waitForTimeout(300);
const gezoomt = await p.evaluate(() => [...document.querySelectorAll('.tlaxis .tltick')].map((t) => Number(t.textContent)));
pruefe('herangezoomt umfasst die Achse den Krieg', gezoomt.length > 2 && gezoomt[0] >= 1475 && gezoomt.at(-1) <= 1500, gezoomt);
if (process.env.BILD) await (await p.$('.tlw')).screenshot({ path: process.env.BILD.replace(/\.png$/, '-zoom.png') });
await p.evaluate(() => [...document.querySelectorAll('.tlw button')].find((b) => b.textContent === 'Show all').click());
await p.waitForTimeout(300);

/* Ausblenden: der Krieg verschwindet, das Zeitalter bleibt. */
await p.evaluate(() => {
  const lab = [...document.querySelectorAll('.tltog')].find((l) => l.textContent === 'Dragon War');
  lab.querySelector('input').click();
});
await p.waitForTimeout(300);
const spuren = await p.evaluate(() => [...document.querySelectorAll('.tllane .tllab .ref')].map((b) => b.textContent));
pruefe('eine Spur lässt sich ausblenden', !spuren.includes('Dragon War') && spuren.includes('Third Age'), spuren);
await p.evaluate(() => {
  const lab = [...document.querySelectorAll('.tltog')].find((l) => l.textContent === 'Dragon War');
  lab.querySelector('input').click();
});
await p.waitForTimeout(300);

/* Klick auf einen Balken öffnet den Artikel. */
await p.evaluate(() => [...document.querySelectorAll('.tlitem')].find((b) => b.textContent === 'Battle of Ash').click());
await p.waitForTimeout(300);
const route = await p.evaluate(() => window.__T__.UI.route);
pruefe('Klick auf einen Eintrag öffnet den Artikel', route.k === 'art' && route.id === 'e_battle', route);

/* Als Spieler: das Geheimnis fehlt, die Krönung steht nicht auf der Leiste. */
await p.evaluate(() => { const T = window.__T__; T.UI.asActor = 'pc_rook'; T.go({ k: 'art', id: 'c_camp' }); });
await p.waitForTimeout(400);
text = await seite();
pruefe('Spielende sehen das Geheimnis nicht', !/Secret pact/.test(text) && /Battle of Ash/.test(text), text.slice(0, 800));
pruefe('ein Datum, das man nicht weiss, steht nicht auf der Leiste', !/Crowning/.test(text), '');

/* „How it works" rechnet sein Beispiel mit derselben Funktion. */
await p.evaluate(() => { const T = window.__T__; T.UI.asActor = ''; T.UI.regtab = 'howto'; T.go({ k: 'reg' }); });
await p.waitForTimeout(500);
text = await seite();
pruefe('How it works zeigt das Beispiel, gerechnet', /A world history in tracks/i.test(text) &&
  /Late skirmish\s+— outside the span/.test(text) && /Nebelwacht\s+1486 – 1492 \(worked out\)/.test(text),
  (text.match(/A world history in tracks[\s\S]{0,1600}/i) || [text.slice(0, 300)])[0]);

pruefe('kein Skriptfehler', fehlerImSkript.length === 0, fehlerImSkript.slice(0, 3));
await browser.close();
process.exit(fehler ? 1 : 0);
