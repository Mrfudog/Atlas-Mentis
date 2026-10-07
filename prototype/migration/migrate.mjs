/**
 * Etappe A1 — Umbenennung auf englische Bezeichner.
 *
 * Register und Artikel müssen zusammen umgeschrieben werden. Ein Artikel nennt
 * seine Schnittstelle, seine Komponenten und seine Kantenarten beim Namen;
 * benennt man nur das Register um, zeigen alle 36 Artikel ins Leere und die
 * Prüfung beanstandet jeden einzelnen.
 *
 *   node migrate.mjs <eingabe-verzeichnis> <ausgabe-verzeichnis>
 *
 * Erwartet die Form, die `ArtifactData` mit `out_dir` schreibt:
 *   <eingabe>/registry/<teil>.json   und   <eingabe>/entities/<id>.json
 *
 * Schreibt dieselbe Form nach <ausgabe> und einen Bericht nach stdout.
 * Die Eingabe wird nicht angefasst — sie ist die einzige Sicherung.
 */

import { readFileSync, readdirSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const HIER = dirname(fileURLToPath(import.meta.url));
const KARTE = JSON.parse(readFileSync(join(HIER, 'rename-map.json'), 'utf8'));

const [, , EIN, AUS] = process.argv;
if (!EIN || !AUS) {
  console.error('Aufruf: node migrate.mjs <eingabe-verzeichnis> <ausgabe-verzeichnis>');
  process.exit(2);
}

const bericht = { interfaces: 0, components: 0, properties: 0, relations: 0, views: 0, entities: 0 };
const unbekannt = new Set();

/* Ein Name, der nicht in der Karte steht, bleibt wie er ist — er war schon
   englisch. Das ist kein Fehler und wird nicht gemeldet. */
const neu = (karte, alt) => (Object.hasOwn(karte, alt) ? karte[alt] : alt);

const ifaceName = (n) => neu(KARTE.interfaces, n);
const compName = (n) => neu(KARTE.components, n);
const relName = (n) => neu(KARTE.relations, n);
const viewName = (n) => neu(KARTE.views, n);

/** Feldschlüssel werden je Komponente umbenannt — `art` heisst in Place `kind`
 *  und in StatblockInfo ebenfalls `kind`, aber das ist Zufall, nicht Regel. */
const propName = (comp, key) => {
  const je = KARTE.properties[compName(comp)];
  return je && Object.hasOwn(je, key) ? je[key] : key;
};

/* ---------------------------------------------------------------- Register */

function migriereComponents(alt) {
  const out = {};
  for (const [name, def] of Object.entries(alt)) {
    if (name === '__version__') continue;
    const nName = compName(name);
    if (nName !== name) bericht.components++;

    const schema = def.schema ?? { type: 'object', properties: {} };
    const props = schema.properties ?? {};
    const nProps = {};
    /* Alt→neu für diese Komponente, damit `derived` und `of` mitgezogen werden:
       eine Berechnung nennt Nachbarfelder beim Namen. */
    const lokal = {};
    for (const key of Object.keys(props)) lokal[key] = propName(name, key);

    for (const [key, p] of Object.entries(props)) {
      const nKey = lokal[key];
      if (nKey !== key) bericht.properties++;
      const nP = { ...p };
      if (nP.derived) nP.derived = ersetzeBezeichner(nP.derived, lokal);
      if (nP.of) nP.of = lokal[nP.of] ?? nP.of;
      const titel = KARTE.propertyTitles[nName]?.[nKey];
      if (titel) nP.title = titel;
      nProps[nKey] = nP;
    }

    const nSchema = { ...schema, properties: nProps };
    if (Array.isArray(schema.required)) {
      nSchema.required = schema.required.map((k) => lokal[k] ?? k);
    }
    out[nName] = { ...def, schema: nSchema };
    const label = KARTE.componentLabels[nName];
    if (label) out[nName].label = label;
  }
  return out;
}

/** Bezeichner in einem Rechenausdruck ersetzen, ohne `mod` oder Zahlen zu treffen. */
function ersetzeBezeichner(ausdruck, karte) {
  return String(ausdruck).replace(/[A-Za-z_][A-Za-z0-9_]*/g, (w) => karte[w] ?? w);
}

function migriereInterfaces(alt) {
  const out = {};
  for (const [name, def] of Object.entries(alt)) {
    if (name === '__version__') continue;
    const nName = ifaceName(name);
    if (nName !== name) bericht.interfaces++;
    const d = { ...def, name: nName };
    if (Array.isArray(def.extends)) d.extends = def.extends.map(ifaceName);
    if (Array.isArray(def.requires)) d.requires = def.requires.map(compName);
    if (Array.isArray(def.allows)) d.allows = def.allows.map(compName);
    const label = KARTE.interfaceLabels[nName];
    if (label) d.label = label;
    out[nName] = d;
  }
  return out;
}

function migriereRelations(alt) {
  const out = {};
  for (const [typ, def] of Object.entries(alt)) {
    if (typ === '__version__') continue;
    const nTyp = relName(typ);
    if (nTyp !== typ) bericht.relations++;
    const d = { ...def };
    if (Array.isArray(def.from)) d.from = def.from.map((x) => (x === '*' ? x : ifaceName(x)));
    if (Array.isArray(def.to)) d.to = def.to.map((x) => (x === '*' ? x : ifaceName(x)));
    const paar = KARTE.relationLabels[nTyp];
    if (paar) {
      d.label = paar[0];
      d.inverseLabel = paar[1];
    }
    if (KARTE.relationSections[nTyp]) d.section = KARTE.relationSections[nTyp];
    out[nTyp] = d;
  }
  return out;
}

/** `felder` listet "Komponente" oder "Komponente.feld" — beide Hälften wandern. */
function migriereFeldverweis(verweis) {
  const [comp, key] = String(verweis).split('.');
  const nComp = compName(comp);
  return key === undefined ? nComp : `${nComp}.${propName(comp, key)}`;
}

function migriereViews(alt) {
  const out = {};
  for (const [name, def] of Object.entries(alt)) {
    if (name === '__version__') continue;
    const nName = viewName(name);
    if (nName !== name) bericht.views++;
    const d = {};
    for (const [k, v] of Object.entries(def)) {
      const nK = neu(KARTE.viewProps, k);
      if (nK === 'fields' && Array.isArray(v)) d[nK] = v.map(migriereFeldverweis);
      else if (typeof v === 'string' && Object.hasOwn(KARTE.viewPropValues, v)) {
        d[nK] = KARTE.viewPropValues[v];
      } else d[nK] = v;
    }
    const label = KARTE.viewLabels[nName];
    if (label) d.label = label;
    out[nName] = d;
  }
  return out;
}

/* ---------------------------------------------------------------- Artikel */

function migriereEntity(e) {
  const out = { ...e };
  if (Array.isArray(e.interfaces)) out.interfaces = e.interfaces.map(ifaceName);

  if (e.components && typeof e.components === 'object') {
    const nComps = {};
    for (const [comp, wert] of Object.entries(e.components)) {
      const nComp = compName(comp);
      if (wert && typeof wert === 'object' && !Array.isArray(wert)) {
        const nWert = {};
        for (const [key, v] of Object.entries(wert)) nWert[propName(comp, key)] = v;
        nComps[nComp] = nWert;
      } else nComps[nComp] = wert;
    }
    out.components = nComps;
  }

  if (Array.isArray(e.relations)) {
    out.relations = e.relations.map((r) => ({ ...r, type: relName(r.type) }));
  }
  return out;
}

/* ---------------------------------------------------------------- Lauf */

const schreibe = (pfad, inhalt) => {
  mkdirSync(dirname(pfad), { recursive: true });
  writeFileSync(pfad, `${JSON.stringify(inhalt, null, 2)}\n`);
};

const teile = {
  components: migriereComponents,
  interfaces: migriereInterfaces,
  relations: migriereRelations,
  views: migriereViews,
};

for (const teil of Object.keys(teile)) {
  const pfad = join(EIN, 'registry', `${teil}.json`);
  if (!existsSync(pfad)) {
    unbekannt.add(`registry/${teil}.json fehlt`);
    continue;
  }
  const alt = JSON.parse(readFileSync(pfad, 'utf8'));
  schreibe(join(AUS, 'registry', `${teil}.json`), teile[teil](alt));
}

/* `vars` trägt Kampagnenvariablen, die der Nutzer selbst benennt — die fasst
   niemand automatisch an. Durchreichen, nicht raten. */
const varsPfad = join(EIN, 'registry', 'vars.json');
if (existsSync(varsPfad)) {
  schreibe(join(AUS, 'registry', 'vars.json'), JSON.parse(readFileSync(varsPfad, 'utf8')));
}

const entDir = join(EIN, 'entities');
if (existsSync(entDir)) {
  for (const datei of readdirSync(entDir).filter((f) => f.endsWith('.json'))) {
    const e = JSON.parse(readFileSync(join(entDir, datei), 'utf8'));
    schreibe(join(AUS, 'entities', datei), migriereEntity(e));
    bericht.entities++;
  }
}

console.log('Umbenannt:');
for (const [was, n] of Object.entries(bericht)) console.log(`  ${was}: ${n}`);
for (const u of unbekannt) console.log(`  ! ${u}`);
