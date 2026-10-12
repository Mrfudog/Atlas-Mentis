/* Prüflauf für D51: der Biss rechnet am Statblock, die Kante trägt die
   Abweichung, der Angriff zeigt seine Träger nach Kreaturentyp, und ein
   Monstermerkmal zeigt auf sein Volksmerkmal. `node build-harness.mjs`
   vorher, mit einem Ausschnitt aus dem Importer in `dbdump/entities`. */
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
/* Eine Kampagne, die die 5e-Ebene aufschaltet — ohne sie steht nichts aus
   dem Import im Stapel (E2), und so ist es auch im Artefakt. */
await p.evaluate(() => {
  const T = window.__T__;
  let ebene = null;
  T.ENT.forEach((e, k) => { if ((e.interfaces || [])[0] === 'Layer') ebene = k; });
  T.persist({ id: 'c_pruef', interfaces: ['Campaign'], name: 'Prüfrunde', components: { Identity: { name: 'Prüfrunde', id: 'campaign-0001' } },
    adhoc: [], relations: [{ id: 'a1', type: 'activates', to: ebene, props: { order: 10 } }], createdAt: new Date().toISOString() });
});
await p.waitForTimeout(500);
let fehler = 0;
const pruefe = (name, ok, was) => {
  if (!ok) fehler++;
  console.log(`${ok ? '  ok  ' : 'FEHLT '} ${name}${ok ? '' : ' — ' + JSON.stringify(was)}`);
};
/** Einen Artikel nach Name und Art öffnen und den Text der Seite holen. */
const oeffne = async (name, typ) => {
  await p.evaluate(([n, t]) => {
    const T = window.__T__;
    let id = null;
    T.ENT.forEach((e, k) => { if (!id && e.name === n && (e.interfaces || [])[0] === t) id = k; });
    T.go({ k: 'art', id });
  }, [name, typ]);
  await p.waitForTimeout(500);
  return p.evaluate(() => document.getElementById('main').innerText);
};

const wolf = await oeffne('Wolf', 'Statblock');
pruefe('der Biss des Wolfs rechnet wie im Buch', /Bite[\s\S]*Melee Weapon Attack:\s*\+4 to hit, reach 5 ft\., one target\. Hit: 7 \(2d4 \+ 2\) piercing damage/.test(wolf), wolf.slice(0, 600));
pruefe('der Satz nur des Wolfs steht dabei', /knocked\s+prone/i.test(wolf), '');

/* Den Biss, den der Wolf benutzt — es gibt Bisse mehrerer Schadensarten. */
await p.evaluate(() => {
  const T = window.__T__;
  let wolf = null;
  T.ENT.forEach((e) => { if (e.name === 'Wolf' && e.interfaces[0] === 'Statblock') wolf = e; });
  const r = wolf.relations.find((x) => x.type === 'composedOf' && T.ENT.get(x.to)?.name === 'Bite');
  T.go({ k: 'art', id: r.to });
});
await p.waitForTimeout(500);
const biss = await p.evaluate(() => document.getElementById('main').innerText);
pruefe('der Biss zeigt seine Träger nach Kreaturentyp', /Used by \(\d+\)[\s\S]*beast · \d+/i.test(biss), biss.slice(0, 800));

const ork = await oeffne('Orc', 'Statblock');
pruefe('der Ork hat seinen Angriff gerechnet', /Greataxe[\s\S]*\+5 to hit/.test(ork), ork.slice(0, 600));

/* Woher Aggressive kommt: das Merkmal des Orks zeigt auf das Volksmerkmal. */
await p.evaluate(() => {
  const T = window.__T__;
  let ork = null;
  T.ENT.forEach((e) => { if (e.name === 'Orc' && e.interfaces[0] === 'Statblock') ork = e; });
  const r = ork.relations.find((x) => x.type === 'composedOf' && T.ENT.get(x.to)?.name === 'Aggressive');
  T.go({ k: 'art', id: r.to });
});
await p.waitForTimeout(500);
const aggressiv = await p.evaluate(() => document.getElementById('main').innerText);
pruefe('Aggressive des Orks zeigt auf das Volksmerkmal', /variant of Aggressive/i.test(aggressiv), aggressiv.slice(0, 400));

/* Anpassen schreibt an die Kante und nicht in den Biss. */
const nachher = await p.evaluate(async () => {
  const T = window.__T__;
  let wolf = null;
  T.ENT.forEach((e) => { if (e.name === 'Wolf' && e.interfaces[0] === 'Statblock') wolf = e; });
  T.go({ k: 'art', id: wolf.id });
  await new Promise((r) => setTimeout(r, 300));
  const knopf = [...document.querySelectorAll('#main .comp .cn button')].find((b) => b.textContent === 'adjust');
  knopf.click();
  await new Promise((r) => setTimeout(r, 200));
  const feld = [...document.querySelectorAll('.dlg label.f')].find((l) => l.textContent.startsWith('Damage dice')).querySelector('input');
  feld.value = '3d6';
  [...document.querySelectorAll('.dlg button')].find((b) => b.textContent === 'Save').click();
  await new Promise((r) => setTimeout(r, 400));
  return document.getElementById('main').innerText;
});
pruefe('Anpassen ändert die Zahlen dieses Statblocks', /Hit: 12 \(3d6 \+ 2\) piercing/.test(nachher), nachher.slice(0, 500));

pruefe('kein Skriptfehler', fehlerImSkript.length === 0, fehlerImSkript.slice(0, 3));
await browser.close();
process.exit(fehler ? 1 : 0);
