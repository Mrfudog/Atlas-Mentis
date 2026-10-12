/* Prüflauf für D56: der Bewegungsrechner auf der Karte — Diagonalen
   5-10-5 je Zug, Wegpunkte, das Tempo im Sitzungszustand, eine Zone mit
   Kosten, Aufdecken entlang des bestätigten Pfads und die Spieleransicht.
   `node build-harness.mjs` vorher; der Bestand darf leer sein, der Lauf
   legt an, was er braucht. */
import { chromium } from 'playwright';
import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HIER = dirname(fileURLToPath(import.meta.url));
const AUS_DEM_BILD = '/opt/pw-browsers/chromium';
const browser = await chromium.launch(existsSync(AUS_DEM_BILD) ? { executablePath: AUS_DEM_BILD } : {});
const p = await browser.newPage({ viewport: { width: 1400, height: 1000 } });
const fehlerImSkript = [];
p.on('pageerror', (e) => fehlerImSkript.push(String(e)));
await p.goto('file://' + join(HIER, 'harness', 'index.html'));
await p.waitForTimeout(1200);
let fehler = 0;
const pruefe = (name, ok, was) => {
  if (!ok) fehler++;
  console.log(`${ok ? '  ok  ' : 'FEHLT '} ${name}${ok ? '' : ' — ' + JSON.stringify(was)}`);
};

/* Eine Karte von 10 × 7 Feldern zu 70 px, eine Wand, eine Eisfläche, eine
   versteckte Grube; eine Heldin (WIS 14, Wahrnehmung geübt, Übung 2 →
   passiv 14), ein versteckter Goblin (Heimlichkeit 13) hinter der Wand. */
await p.evaluate(() => {
  const T = window.__T__;
  const jetzt = new Date().toISOString();
  const svg = 'data:image/svg+xml;utf8,' + encodeURIComponent(
    "<svg xmlns='http://www.w3.org/2000/svg' width='700' height='490'><rect width='700' height='490' fill='#cdb'/></svg>");
  const art = (id, typ, name, comps, rels) => T.persist({ id, interfaces: [typ], name,
    components: Object.assign({ Identity: { name, id: T.nextId(typ) } }, comps || {}),
    adhoc: [], relations: rels || [], createdAt: jetzt });
  art('z_eis', 'ZoneKind', 'Ice', { ZoneKind: { moveCost: 2, save: 'dex', saveDC: 10 },
    Description: { description: 'Slippery: on a failed save you fall prone.' } });
  art('z_grube', 'ZoneKind', 'Pit', { ZoneKind: { hiddenUntil: 12, damage: '2d6', damageType: 'bludgeoning' } });
  art('c_held', 'Creature', 'Hera', {});
  art('s_held', 'Statblock', 'Hera stats', { Statblock: { speed: '30 ft., climb 20 ft.', prof: 2 },
    Abilities: { wis: 14, dex: 12 }, Proficiencies: { proficient: ['Perception'] } },
  [{ id: 'r_b1', type: 'belongsTo', to: 'c_held', props: {} }]);
  art('c_gob', 'Creature', 'Goblin', {});
  art('p_grp', 'Party', 'The Watch', {});
  T.persist(Object.assign({}, T.ENT.get('c_held'), { relations: [{ id: 'r_m1', type: 'memberOfParty', to: 'p_grp', props: {} }] }));
  art('m_karte', 'Map', 'Cellar', {
    Image: { image: svg },
    Map: { gridShape: 'square', gridSize: 70, fog: false, lighting: 'bright',
      /* Eine senkrechte Wand bei x = 5 Felder, Zeilen 0 bis 3. */
      walls: [{ id: 'w1', kind: 'wall', x1: 0.5, y1: 0, x2: 0.5, y2: 4 / 7 }] },
  }, [
    { id: 'tk_held', type: 'marker', to: 'c_held', props: { x: 0.05, y: 0.5 / 7, kind: 'play' } },
    { id: 'tk_gob', type: 'marker', to: 'c_gob', props: { x: 0.75, y: 1.5 / 7, kind: 'play', hidden: true, stealth: 13 } },
    { id: 'zn_eis', type: 'zone', to: 'z_eis', props: { kind: 'rect', x: 0.1, y: 0, w: 0.1, h: 1 } },
    { id: 'zn_grube', type: 'zone', to: 'z_grube', props: { kind: 'rect', x: 0.3, y: 2 / 7, w: 0.1, h: 1 / 7 } },
  ]);
  art('s_ses', 'Session', 'Session 1', { Session: { activeMap: 'm_karte' } });
  T.UI.moveMode = 'path';
  T.go({ k: 'play' });
});
await p.waitForTimeout(800);

/* Der Rechner selbst: auf freiem Feld drei Schritte schräg sind 15 Fuss,
   vier sind 20, und die Parität läuft über einen Wegpunkt weiter. */
const rein = await p.evaluate(() => {
  const T = window.__T__;
  const g = { cols: 10, rows: 10, walls: [], cost: {}, blocked: {}, noStop: {}, avoid: {} };
  return {
    drei: T.mvPath(g, { x: 0, y: 0 }, { x: 3, y: 3 }, 0, false).feet,
    vier: T.mvPath(g, { x: 0, y: 0 }, { x: 4, y: 4 }, 0, false).feet,
    via: T.mvVia(g, { x: 0, y: 0 }, [{ x: 1, y: 1 }, { x: 2, y: 2 }], 0, false).feet,
    reich: Object.keys(T.mvReach(g, { x: 0, y: 0 }, 30, 0)).includes('4,4'),
  };
});
pruefe('drei Diagonalen kosten 20, zwei 15 — und über einen Wegpunkt dasselbe', rein.drei === 20 && rein.vier === 30 && rein.via === 15, rein);
pruefe('mit 30 Fuss reicht es vier Felder schräg', rein.reich, rein);

const ansicht = () => p.evaluate(() => document.getElementById('main').innerText);
const tokens = () => p.evaluate(() => [...document.querySelectorAll('.mtoken')].map((t) => t.title.split(' ·')[0]));

pruefe('die Leitung sieht den versteckten Goblin', (await tokens()).some((t) => t.startsWith('Goblin')), await tokens());
pruefe('die Karte zeigt die Eiszone', await p.evaluate(() => !!document.querySelector('.mzone')), '');

await p.evaluate(() => { window.__T__.UI.mapPlayers = true; window.__T__.render(); });
await p.waitForTimeout(300);
pruefe('in der Spieleransicht fehlt der versteckte Goblin', !(await tokens()).some((t) => t.startsWith('Goblin')), await tokens());
pruefe('… und die unentdeckte Grube', await p.evaluate(() => [...document.querySelectorAll('.mzone title')].every((t) => !/Pit/.test(t.textContent))), '');
await p.evaluate(() => { window.__T__.UI.mapPlayers = false; window.__T__.render(); });
await p.waitForTimeout(300);

/* Die Heldin wählen: die Leiste zeigt Tempo und Kurzwahl. */
await p.evaluate(() => [...document.querySelectorAll('.mtoken')].find((t) => t.title.startsWith('Hera')).dispatchEvent(new PointerEvent('pointerup', { bubbles: true })));
await p.waitForTimeout(300);
let text = await ansicht();
pruefe('gewählt: 0 von 30 Fuss, nächste Diagonale 5', /0 of 30 ft used · 30 left · next diagonal 5 ft/.test(text), text.slice(0, 600));
pruefe('die Kurzwahl kennt das Klettertempo aus dem Statblock', /Dash ×2 60/.test(text) && /Climb 20/.test(text), text.slice(0, 600));
pruefe('sieht: der Goblin hinter der Wand nicht', /Sees[\s\S]*Goblin — no line of sight/.test(text), text.slice(0, 900));

/* Wegpunkte: über das Eis (Spalte 1) nach Spalte 4, Zeile 0. */
const wegpunkt = (cx, cy) => p.evaluate(([x, y]) => {
  const img = document.querySelector('.mapinner');
  const r = img.getBoundingClientRect();
  const ev = new MouseEvent('click', { bubbles: true, clientX: r.left + (x + 0.5) / 10 * r.width, clientY: r.top + (y + 0.5) / 7 * r.height });
  img.dispatchEvent(ev);
}, [cx, cy]);
await wegpunkt(4, 0);
await p.waitForTimeout(300);
text = await ansicht();
/* Gerade über Spalte 1 (Eis ×2): 10 + 5 + 5 + 5 = 25. */
pruefe('der Weg über das Eis kostet 25 Fuss und passt', /Path 25 ft over 1 point — fits/.test(text), text.slice(0, 900));
pruefe('das Eis steht vorher an der Leiste', /Ice/.test(text), '');

await p.evaluate(() => [...document.querySelectorAll('.movepanel button')].find((b) => b.textContent === 'Confirm').click());
await p.waitForTimeout(400);
const nach = await p.evaluate(() => {
  const T = window.__T__;
  const k = T.ENT.get('m_karte'), s = T.ENT.get('s_ses').components.Session;
  return { tok: k.relations.find((r) => r.id === 'tk_held').props, moves: s.moves, log: (s.log || []).map((x) => x.text) };
});
pruefe('das Token steht in Spalte 4', Math.abs(nach.tok.x - 0.45) < 1e-6, nach.tok);
pruefe('der Verbrauch steht in der Sitzung, nicht am Artikel', nach.moves?.[0]?.used === 25 && nach.moves[0].token === 'tk_held', nach.moves);
pruefe('das Protokoll nennt die Zone mit ihrer Regel', nach.log.some((t) => /Hera enters Ice: movement ×2 · DC 10 DEX save · Slippery/.test(t)), nach.log);

/* Weiter: um das Ende der Wand herum nach (6,3) — 15 + 5 + 10 = 30, dafür
   reicht es nicht mehr. */
await wegpunkt(6, 3);
await p.waitForTimeout(300);
text = await ansicht();
pruefe('5 Fuss bleiben, der Weg um die Wand ist zu weit', /5 left/.test(text) && /too far/.test(text), text.slice(0, 900));
/* Spurt: das Tempo wird 60, der Verbrauch bleibt. */
await p.evaluate(() => [...document.querySelectorAll('.movepanel button')].find((b) => b.textContent.startsWith('Dash')).click());
await p.waitForTimeout(400);
text = await ansicht();
pruefe('mit Spurt: 25 von 60', /25 of 60 ft used/.test(text), text.slice(0, 400));
await p.evaluate(() => [...document.querySelectorAll('.movepanel button')].find((b) => b.textContent === 'Confirm').click());
await p.waitForTimeout(400);
const danach = await p.evaluate(() => {
  const T = window.__T__;
  const k = T.ENT.get('m_karte'), s = T.ENT.get('s_ses').components.Session;
  return { gob: k.relations.find((r) => r.id === 'tk_gob').props, grube: k.relations.find((r) => r.id === 'zn_grube').props, log: (s.log || []).map((x) => x.text) };
});
pruefe('entlang des Pfads wird der Goblin entdeckt (PP 14 gegen 13)', !danach.gob.hidden && danach.log.some((t) => /Hera spots Goblin \(PP 14 vs 13\)/.test(t)), danach);
pruefe('… und die Grube bemerkt (versteckt bis PP 12)', danach.grube.found === true && danach.log.some((t) => /notices Pit/.test(t)), danach);

/* Ein neuer Zug: ohne Kampf setzt die Leitung von Hand zurück. */
await p.evaluate(() => [...document.querySelectorAll('.movepanel button')].find((b) => b.textContent === 'New turn').click());
await p.waitForTimeout(300);
text = await ansicht();
pruefe('neuer Zug: nichts verbraucht, Diagonale wieder 5', /0 of 60 ft used · 60 left · next diagonal 5 ft/.test(text), text.slice(0, 400));

/* Nebel: beim Bestätigen weicht er im Sichtkreis, Schritt für Schritt. */
await p.evaluate(() => {
  const T = window.__T__, k = T.ENT.get('m_karte');
  T.persist(Object.assign({}, k, { components: Object.assign({}, k.components, { Map: Object.assign({}, k.components.Map, { fog: true, reveal: [] }) }) }));
});
await p.waitForTimeout(300);
await wegpunkt(5, 5);
await p.waitForTimeout(300);
await p.evaluate(() => [...document.querySelectorAll('.movepanel button')].find((b) => b.textContent === 'Confirm').click());
await p.waitForTimeout(400);
const nebel = await p.evaluate(() => (window.__T__.ENT.get('m_karte').components.Map.reveal || []).map((s) => s.kind));
pruefe('der Nebel weicht entlang des Pfads, ein Sichtkreis je Schritt', nebel.length >= 2 && nebel.every((k) => k === 'poly'), nebel);

/* Ein Kampf: der Zug ist Begegnung, Runde und wer dran ist — ein neuer
   Zug fängt frisch an, ohne dass jemand zurücksetzt. */
await p.evaluate(() => {
  const T = window.__T__;
  T.persist({ id: 'k_kampf', interfaces: ['Encounter'], name: 'Cellar fight',
    components: { Identity: { name: 'Cellar fight', id: T.nextId('Encounter') }, Encounter: { round: 1, turn: 0 } },
    adhoc: [], relations: [
      { id: 'pa1', type: 'participates', to: 'c_held', props: { init: 15, ally: true } },
      { id: 'pa2', type: 'participates', to: 'c_gob', props: { init: 12 } }],
    createdAt: new Date().toISOString() });
  const s = T.ENT.get('s_ses');
  T.persist(Object.assign({}, s, { components: Object.assign({}, s.components, { Session: Object.assign({}, s.components.Session, { activeEncounter: 'k_kampf' }) }) }));
});
await p.waitForTimeout(400);
text = await ansicht();
pruefe('im Kampf fängt der Zug frisch an: 0 von 30', /0 of 30 ft used/.test(text), text.slice(0, 1200));
const feind = await p.evaluate(() => {
  const T = window.__T__, k = T.ENT.get('m_karte');
  const geo = T.mapGeom(k.components.Map, { w: 700, h: 490 });
  const gr = T.moveGrid(k, k.components.Map, geo, k.relations.find((r) => r.id === 'tk_held'));
  return Object.keys(gr.blocked);
});
pruefe('der Goblin ist im Kampf ein Gegner: sein Feld ist gesperrt', feind.length === 1, feind);

/* Spieleransicht als Figur: die eigene bewegen, keine Übersteuerung. */
await p.evaluate(() => { window.__T__.UI.asActor = 'c_held'; window.__T__.render(); });
await p.waitForTimeout(300);
await wegpunkt(6, 5);
await p.waitForTimeout(300);
const knoepfe = await p.evaluate(() => [...document.querySelectorAll('.movepanel button')].map((b) => b.textContent));
pruefe('als Spielerin: bestätigen ja, frei setzen und neuer Zug nein', knoepfe.includes('Confirm') && !knoepfe.includes('Place (no cost)') && !knoepfe.includes('New turn'), knoepfe);
await p.evaluate(() => { window.__T__.UI.asActor = ''; window.__T__.render(); });
await p.waitForTimeout(300);

/* Vollbild: der Kasten füllt das Fenster. */
await p.evaluate(() => [...document.querySelectorAll('.mapbox .maptools button')].find((b) => /Full screen/.test(b.textContent)).click());
await p.waitForTimeout(300);
pruefe('Vollbild legt den Kartenkasten über die Seite', await p.evaluate(() => getComputedStyle(document.querySelector('.mapbox')).position === 'fixed'), '');

pruefe('keine Fehler im Skript', fehlerImSkript.length === 0, fehlerImSkript);
await browser.close();
console.log(fehler ? `\n${fehler} Prüfung(en) fehlgeschlagen.` : '\nAlles gut.');
process.exit(fehler ? 1 : 0);
