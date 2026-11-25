/*
  Der Bestand der Ansichten (T-234) — je anlegbarer Art, welche Ansicht
  gilt, woher ihre Anordnung kommt und welche Elemente darin stehen.

  Die Frage, die das Register sonst nicht auf einmal beantwortet: **sagt
  eine Art an einem Ort etwas Eigenes, oder gilt dort die Grundanordnung?**
  Und welche grossen Blöcke (Bogen, Zauber, Leser …) zeichnen noch alles
  selbst, statt aus Elementen zu bestehen (T-282)?

  Aufruf (nach dem Bau von model und registry):
    node packages/registry/scripts/ansichten.mjs            # Tabelle als Markdown
    node packages/registry/scripts/ansichten.mjs --json     # dasselbe als JSON
    node packages/registry/scripts/ansichten.mjs <Typ>      # ein Typ, Element für Element

  Gelesen wird nur das Register (`seedRegistry`), kein Bestand: gestaltete
  Ansichten aus dem Designer stehen in der Datenbank, nicht hier — die
  zeigt die Werkbank bzw. Registry › Views.
*/
import { areaOf, isDesignedView, layoutFor, typeChain, viewKeys } from '@nw/model';
import { seedRegistry as R } from '../dist/index.js';

const argv = process.argv.slice(2);
const ALS_JSON = argv.includes('--json');
const EIN_TYP = argv.find((a) => !a.startsWith('--'));

/**
 * **Grosse Blöcke** (T-282): Elemente, die ein ganzes Stück Seite selbst
 * zeichnen und im Designer nicht weiter zerlegbar sind. Sie sind nicht
 * falsch — ein Statblock wie im Buch ist eine Einheit —, aber was darin
 * steht, lässt sich nur am Code ändern.
 */
const GROSS = new Set([
  'statblock', 'spell', 'item', 'sheet', 'turn', 'spells', 'campaign', 'inventory', 'crafting',
  'wares', 'reader', 'contents', 'classOverview', 'originOverview', 'map', 'board', 'initiative',
  'timeline', 'live', 'prep', 'crawl', 'stack', 'members', 'rules', 'knowledgeContents', 'stats',
]);

/** Die Orte, nach denen die Seite fragt, und die Gruppe Handout. */
const ORTE = viewKeys(R).filter((k) => !isDesignedView(R.views[k]));

const flach = (layout, raus = []) => {
  for (const el of layout ?? []) {
    raus.push(el);
    flach(el.children, raus);
    for (const t of el.tabs ?? []) flach(t.layout, raus);
  }
  return raus;
};

const elementText = (el) => {
  const f = Array.isArray(el.fields) ? `[${el.fields.join(', ')}]` : el.fields ? `(${el.fields})` : '';
  const x = el.except?.length ? ` −${el.except.join(',')}` : '';
  return `${el.el}${f}${x}`;
};

const arten = Object.keys(R.interfaces)
  .filter((n) => !R.interfaces[n].abstract)
  .sort((a, b) => (areaOf(R, a) || 'zz').localeCompare(areaOf(R, b) || 'zz') || a.localeCompare(b));

const bestand = arten.map((typ) => {
  const orte = {};
  for (const ort of ORTE) {
    const { layout, from, mode } = layoutFor(R, ort, typ);
    const els = flach(layout);
    orte[ort] = {
      from,
      mode,
      elements: els.map(elementText),
      big: [...new Set(els.filter((e) => GROSS.has(e.el)).map((e) => e.el))],
    };
  }
  return { typ, area: areaOf(R, typ), chain: typeChain(R, typ).slice(1), orte };
});

if (ALS_JSON) {
  console.log(JSON.stringify({ places: ORTE, types: bestand }, null, 2));
} else if (EIN_TYP) {
  const b = bestand.find((x) => x.typ === EIN_TYP);
  if (!b) {
    console.error(`Keine anlegbare Art „${EIN_TYP}".`);
    process.exit(1);
  }
  console.log(`# ${b.typ} (${b.area || 'ohne Bereich'}) — erbt ${b.chain.join(', ') || 'nichts'}\n`);
  for (const ort of ORTE) {
    const o = b.orte[ort];
    console.log(`## ${ort} — ${o.from ? `${o.mode} an ${o.from}` : 'Grundanordnung der Ansicht'}`);
    for (const e of o.elements) console.log(`- ${e}`);
    console.log('');
  }
} else {
  /* Kurzform je Zelle: `—` Grundanordnung, `±X` Anpassung an X, `■X` eigene
     Anordnung an X; dahinter die grossen Blöcke. */
  const zelle = (o, typ) => {
    if (!o.from) return '—';
    const wo = o.from === typ ? '' : ` (${o.from})`;
    const mark = o.mode === 'adjusted' ? '±' : '■';
    return `${mark}${wo}${o.big.length ? ` ${o.big.join(', ')}` : ''}`;
  };
  console.log(`| Art | Bereich | ${ORTE.join(' | ')} |`);
  console.log(`|---|---|${ORTE.map(() => '---').join('|')}|`);
  for (const b of bestand) console.log(`| ${b.typ} | ${b.area || '—'} | ${ORTE.map((o) => zelle(b.orte[o], b.typ)).join(' | ')} |`);
  const eigen = (ort) => bestand.filter((b) => b.orte[ort].from).length;
  console.log(`\n${bestand.length} anlegbare Arten. Eigenes je Ort: ${ORTE.map((o) => `${o} ${eigen(o)}`).join(', ')}.`);
  const gross = new Map();
  for (const b of bestand) for (const o of ORTE) for (const g of b.orte[o].big) gross.set(g, [...(gross.get(g) ?? []), `${b.typ}.${o}`]);
  console.log('\nGrosse Blöcke (T-282):');
  for (const [g, wo] of [...gross].sort()) console.log(`- ${g}: ${wo.length} — ${wo.slice(0, 8).join(', ')}${wo.length > 8 ? ' …' : ''}`);
}
