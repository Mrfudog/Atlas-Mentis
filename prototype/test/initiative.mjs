/* Prüflauf für D53 (REQ-211–213): die Zeile liest RK und Maximum vom
   Statblock der Instanz, ein Klick öffnet den Statblock daneben, Einträge
   zählen am Zug ihres Ankers herunter (der Bestand am eigenen Zugende), und
   Spielende sehen die Gruppe und was aufgedeckt oder beteiligt ist — mit
   Decknamen und TP als Wort. `node build-harness.mjs` vorher; Daten legt
   der Lauf selbst an. */
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

await p.evaluate(() => {
  const T = window.__T__;
  const jetzt = new Date().toISOString();
  const neu = (id, typ, name, components = {}, relations = []) =>
    T.persist({ id, interfaces: [typ], name, components: { Identity: { name }, ...components }, relations, adhoc: [], createdAt: jetzt });
  neu('t_party', 'Party', 'The Lanterns');
  neu('t_rook', 'PlayerCharacter', 'Rook', {}, [{ id: 'm1', type: 'memberOfParty', to: 't_party' }]);
  neu('t_sbrook', 'Statblock', 'Rook stats', { Statblock: { ac: 15, hp: 24 } }, [{ id: 'b1', type: 'belongsTo', to: 't_rook' }]);
  neu('t_guardt', 'Statblock', 'Guard', { Statblock: { ac: 16, hp: 11 } });
  neu('t_guard', 'Creature', 'Guard', { Identity: { name: 'Guard', cover: 'Soldier' } });
  neu('t_sbg', 'Statblock', 'Guard 1 stats', { Statblock: { hp: 18 } },
    [{ id: 'i1', type: 'instanceOf', to: 't_guardt' }, { id: 'b2', type: 'belongsTo', to: 't_guard' }]);
  neu('t_mage', 'Creature', 'Vex', { Identity: { name: 'Vex', cover: 'Robed figure' } });
  neu('t_prone', 'Condition', 'Prone');
  neu('t_enc', 'Encounter', 'Gate fight', {}, [
    { id: 'p1', type: 'participates', to: 't_rook', props: { label: 'Rook', init: 15, hp: 20 } },
    { id: 'p2', type: 'participates', to: 't_mage', props: { label: 'Vex', init: 12, hp: 5, hpMax: 12, revealed: true,
      conditions: [{ rule: 't_prone', rounds: 1, anchor: 'p1', at: 'end' }, { text: 'Has the key', hidden: true }] } },
    { id: 'p3', type: 'participates', to: 't_guard', props: { label: 'Guard 1', init: 10,
      conditions: [{ rule: 't_prone', rounds: 1, source: 'Rook' }] } },
    { id: 'p4', type: 'participates', to: 't_guard', props: { label: 'Guard 2', init: 8 } },
  ]);
});
await p.waitForTimeout(400);
await p.evaluate(() => window.__T__.go({ k: 'art', id: 't_enc' }));
await p.waitForTimeout(500);

const zeilen = () => p.evaluate(() =>
  [...document.querySelectorAll('#main table.initt tr')].slice(1).map((r) => r.innerText.replace(/\s+/g, ' ').trim()));

let z = await zeilen();
pruefe('die Tabelle steht', z.length === 4, z);
pruefe('RK und Maximum vom Statblock der Spielerfigur', /Rook.*15.*\/24/.test(z[0] ?? ''), z[0]);
pruefe('die Instanz liest die RK der Vorlage und ihr eigenes Maximum', /Guard 1.*16.*\/18/.test(z[2] ?? ''), z[2]);
pruefe('ohne Statblock gilt die alte Abschrift', /Vex.*\/12/.test(z[1] ?? ''), z[1]);
pruefe('die Notiz steht bei der Leitung', /Has the key/.test(z[1] ?? ''), z[1]);

/* Ein Klick auf die Zeile öffnet den Statblock daneben, die Seite bleibt. */
await p.evaluate(() => document.querySelectorAll('#main table.initt tr')[3].querySelector('td.who .pname').click());
await p.waitForTimeout(300);
const seite = await p.evaluate(() => ({
  route: window.__T__.UI.route, side: !!document.querySelector('#main .fightside'),
  text: (document.querySelector('#main .fightside') || {}).innerText || '' }));
pruefe('der Statblock steht daneben', seite.side && seite.route.id === 't_enc', seite);

/* Nächster Zug: Rook endet (Vex' Eintrag mit Anker Rook fällt), Vex fängt an. */
await p.evaluate(() => [...document.querySelectorAll('#main button')].find((b) => /Next turn/.test(b.textContent)).click());
await p.waitForTimeout(300);
let roh = await p.evaluate(() => window.__T__.ENT.get('t_enc').relations.map((r) => [r.id, (r.props || {}).conditions]));
pruefe('der Anker zählt im Zug eines anderen herunter', roh[1][1].length === 1 && roh[1][1][0].text === 'Has the key', roh[1]);
pruefe('der Bestand wartet auf das eigene Zugende', roh[2][1].length === 1, roh[2]);
await p.evaluate(() => [...document.querySelectorAll('#main button')].find((b) => /Next turn/.test(b.textContent)).click());
await p.waitForTimeout(300);
await p.evaluate(() => [...document.querySelectorAll('#main button')].find((b) => /Next turn/.test(b.textContent)).click());
await p.waitForTimeout(300);
roh = await p.evaluate(() => window.__T__.ENT.get('t_enc').relations.map((r) => [r.id, (r.props || {}).conditions]));
pruefe('… und läuft dort ab', roh[2][1].length === 0, roh[2]);

/* Ablauf vorhersagen. */
const ende = await p.evaluate(() => window.__T__.fightExpiresAt({ rounds: 1, anchor: 'p2', at: 'end' }, 'p3', ['p1', 'p2', 'p3', 'p4'], 2, 1));
pruefe('die Maske sagt, wann ein Eintrag abläuft', ende && ende.round === 2 && ende.at === 'end', ende);

/* Spieleransicht. */
await p.evaluate(() => { window.__T__.UI.asActor = 't_rook'; window.__T__.render(); });
await p.waitForTimeout(400);
z = await zeilen();
pruefe('Spielende sehen die Gruppe und den Aufgedeckten', z.length === 2, z);
pruefe('mit Decknamen und TP als Wort', /Robed figure/.test(z.join('|')) && !/Vex/.test(z.join('|')) && /bloodied/i.test(z.join('|')), z);
pruefe('die Gruppe mit Zahlen', /Rook.*20\/24/.test(z[0] ?? ''), z[0]);
pruefe('versteckte Notiz nicht', !/Has the key/.test(z.join('|')), z);
const gesiebt = await p.evaluate(() => JSON.stringify(window.__T__.participants(window.__T__.ENT.get('t_enc')).map((x) => x.rel)));
pruefe('zurückgehalten in den Daten, nicht nur in der Maske', !/Has the key|"t_mage"|"hp":5/.test(gesiebt), gesiebt);

/* Getroffen heisst beteiligt. */
await p.evaluate(() => { window.__T__.UI.asActor = ''; window.__T__.render(); });
await p.waitForTimeout(300);
await p.evaluate(() => document.querySelectorAll('#main table.initt tr')[3].querySelector('td.hpcell button').click());
await p.waitForTimeout(300);
await p.evaluate(() => { window.__T__.UI.asActor = 't_rook'; window.__T__.render(); });
await p.waitForTimeout(300);
z = await zeilen();
pruefe('wer getroffen wird, steht in der Reihe — unter Decknamen', z.length === 3 && /Soldier/.test(z.join('|')) && /bloodied/i.test(z.join('|')), z);

/* Das Beispiel auf „How it works" rechnet mit derselben Funktion. */
await p.evaluate(() => { const T = window.__T__; T.UI.asActor = ''; T.UI.regtab = 'howto'; T.go({ k: 'reg' }); });
await p.waitForTimeout(500);
const howto = await p.evaluate(() => document.getElementById('main').innerText);
pruefe('How it works zeigt den Kampf durchgerechnet', /A fight, its durations/i.test(howto) && /ends round 2, end of p-vex/.test(howto) && /round 12, end of p-rook/.test(howto), howto.slice(howto.search(/A fight/i), howto.search(/A fight/i) + 900));

pruefe('keine Fehler im Skript', fehlerImSkript.length === 0, fehlerImSkript);
await browser.close();
console.log(fehler ? `\n${fehler} Prüfung(en) fehlgeschlagen` : '\nalles grün');
process.exit(fehler ? 1 : 0);
