/**
 * **Prüfungen über den Bestand** (Werkbank, W9).
 *
 * Mit den 24 157 Artikeln aus 5e.tools sieht niemand mehr von Auge, was
 * schiefliegt: ein `[object Object]` in einer Tabelle, „Amphibious" 27-mal,
 * eine Kante auf einen Artikel, den es nicht mehr gibt. Jede Prüfung hier
 * ist eine reine Funktion über eine Liste von Artikeln und sagt **wo** und
 * **warum** — gezählt wird alles, gezeigt werden Beispiele.
 *
 * Die Liste ist erweiterbar: eine neue Prüfung ist ein Eintrag in
 * `CHECKS`, keine Route und keine Maske. Was hier geprüft wird, ist der
 * Bestand, **wie ihn der Fragende sieht** — der Server gibt den gesiebten
 * (Stapel, Instanz aufgelöst, Sichtbarkeit), und `exists` sagt nur, ob ein
 * Kantenziel überhaupt da ist.
 */

import { imageAddresses } from './assets.js';
import { entityName, linkFinder, typeChain } from './entity.js';
import { glossaryFieldRefs } from './glossary.js';
import { INSTANCE_RELATION, isInstance } from './instance.js';
import { beschreibeAbweichung, registerAbweichung } from './registerabgleich.js';
import { RULE_OPTIONS } from './ruleOptions.js';
import type { Entity, Registry } from './types.js';
import { stageBases, validateEntity } from './validate.js';
import { viewConflicts } from './viewScope.js';
import { MIN_CONTRAST, tokenContrast } from './tokens.js';
import { stateGaps, stateOf } from './readiness.js';
import { LAYER_TYPES, UNASSIGNED_LAYER } from './stack.js';
import { LAYER_RELATION } from './visibility.js';

export interface CheckHit {
  /** Peg-Id — der Weg zum Artikel (`/artikel/:id`). */
  id: string;
  name: string;
  type: string;
  reason: string;
  /** Bei Doppeln: alle Artikel der Gruppe, der erste ist der älteste. */
  group?: string[];
  /** Kein Artikel, sondern eine Registerzeile (T-123): wohin im Register. */
  registry?: Record<string, string>;
}

export interface CheckResult {
  key: string;
  label: string;
  description: string;
  /** Wie viele Treffer es gibt — nicht wie viele mitkommen. */
  count: number;
  hits: CheckHit[];
  ms: number;
}

export interface CheckContext {
  registry: Registry;
  /** Was geprüft wird: der Bestand, wie ihn der Fragende sieht. */
  entities: Entity[];
  /** Id → Art über den ganzen Bestand: ob ein Kantenziel da ist. */
  exists: ReadonlyMap<string, string>;
  /** Die Startzeilen, gegen die das Register verglichen wird (T-123). */
  seed?: Registry;
}

export interface Check {
  key: string;
  label: string;
  description: string;
  run(ctx: CheckContext): CheckHit[];
}

const typeOf = (e: Entity) => e.interfaces?.[0] ?? '';
const hit = (e: Entity, reason: string, group?: string[]): CheckHit => ({
  id: e.id,
  name: entityName(e),
  type: typeOf(e),
  reason,
  ...(group ? { group } : {}),
});

/** Jeder Text in einem Artikel, mit dem Feld, in dem er steht. */
function texte(e: Entity, raus: (pfad: string, text: string) => void): void {
  const geh = (pfad: string, v: unknown): void => {
    if (typeof v === 'string') raus(pfad, v);
    else if (Array.isArray(v)) v.forEach((x, i) => geh(`${pfad}[${i}]`, x));
    else if (v && typeof v === 'object') {
      for (const [k, x] of Object.entries(v)) geh(`${pfad}.${k}`, x);
    }
  };
  for (const [karte, werte] of Object.entries(e.components ?? {})) geh(karte, werte);
  for (const f of e.adhoc ?? []) geh(`adhoc.${f.key}`, f.value);
}

/** Leer heisst: nichts, ein leerer oder nur aus Leerraum bestehender Text, eine leere Liste. */
function leer(v: unknown): boolean {
  if (v === undefined || v === null) return true;
  if (typeof v === 'string') return v.trim() === '';
  if (Array.isArray(v)) return v.length === 0;
  return false;
}

/* JSON mit sortierten Schlüsseln: zwei Karten sind gleich, wenn ihre Werte
   gleich sind, egal in welcher Reihenfolge Postgres sie zurückgibt. */
export function stableJson(v: unknown): string {
  if (Array.isArray(v)) return `[${v.map(stableJson).join(',')}]`;
  if (v && typeof v === 'object') {
    return `{${Object.keys(v as object)
      .sort()
      .filter((k) => (v as Record<string, unknown>)[k] !== undefined)
      .map((k) => `${JSON.stringify(k)}:${stableJson((v as Record<string, unknown>)[k])}`)
      .join(',')}}`;
  }
  return JSON.stringify(v) ?? 'null';
}

/** Der Inhalt eines Artikels ohne Nummer, Fundstelle und Verwaltung —
 *  daran erkennt man ein Doppel (vgl. `vereineGleiche` im Importer). */
const OHNE = new Set(['Identity', 'Source', 'Status', 'Tags']);
export function contentKey(e: Entity): string {
  const k: Record<string, unknown> = {};
  for (const [karte, werte] of Object.entries(e.components ?? {})) if (!OHNE.has(karte)) k[karte] = werte;
  return stableJson(k);
}

function woerter(e: Entity): Set<string> {
  const w = new Set<string>();
  texte({ ...e, components: Object.fromEntries(Object.entries(e.components ?? {}).filter(([k]) => !OHNE.has(k))) }, (_p, t) => {
    for (const m of t.toLowerCase().matchAll(/[\p{L}\p{N}]+/gu)) w.add(m[0]);
  });
  return w;
}

function jaccard(a: Set<string>, b: Set<string>): number {
  if (!a.size && !b.size) return 1;
  let gemeinsam = 0;
  for (const x of a) if (b.has(x)) gemeinsam += 1;
  return gemeinsam / (a.size + b.size - gemeinsam);
}

const nummer = (e: Entity) => String(e.components?.['Identity']?.['id'] ?? '');
/** Älter zuerst: die kleinere Nummer derselben Art, sonst die Peg-Id. */
function aelter(a: Entity, b: Entity): number {
  const na = nummer(a);
  const nb = nummer(b);
  if (na && nb && na !== nb) return na.localeCompare(nb, 'en', { numeric: true });
  return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
}

const LINK = /\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g;

export const CHECKS: Check[] = [
  {
    key: 'invalid',
    label: 'Fails validation',
    description: 'Articles that validateEntity refuses — a save of them would be refused too.',
    run({ registry, entities, exists }) {
      const stufen = stageBases(entities);
      /* Die Ids einmal: ohne sie baut validateEntity je Artikel ein Set aus
         allen Schlüsseln — über 21 000 Artikel 50 s statt einer halben. */
      const ids = new Set(exists.keys());
      const raus: CheckHit[] = [];
      for (const e of entities) {
        const issues = validateEntity(registry, e, { knownTypes: exists, knownIds: ids, stageOf: stufen });
        if (issues.length) {
          raus.push(hit(e, issues.slice(0, 3).map((i) => i.message).join('; ') + (issues.length > 3 ? ` (+${issues.length - 3})` : '')));
        }
      }
      return raus;
    },
  },
  {
    key: 'objectObject',
    label: '[object Object] in text',
    description: 'A field whose text reads "[object Object]" — an object was written as text.',
    run({ entities }) {
      const raus: CheckHit[] = [];
      for (const e of entities) {
        const felder: string[] = [];
        texte(e, (pfad, t) => {
          if (t.includes('[object Object]')) felder.push(pfad);
        });
        if (felder.length) raus.push(hit(e, felder.slice(0, 5).join(', ') + (felder.length > 5 ? ` (+${felder.length - 5})` : '')));
      }
      return raus;
    },
  },
  {
    key: 'emptyRequired',
    label: 'Empty required fields',
    description: 'Required fields that are missing, empty, blank or an empty list.',
    run({ registry, entities }) {
      const raus: CheckHit[] = [];
      for (const e of entities) {
        const fehlt: string[] = [];
        for (const typ of typeChain(registry, typeOf(e))) {
          const schema = registry.interfaces[typ]?.schema;
          for (const feld of schema?.required ?? []) {
            if (schema?.properties[feld]?.derived) continue;
            if (leer(e.components?.[typ]?.[feld])) fehlt.push(`${typ}.${feld}`);
          }
        }
        if (fehlt.length) raus.push(hit(e, fehlt.join(', ')));
      }
      return raus;
    },
  },
  {
    key: 'duplicates',
    label: 'Same name, same type',
    description:
      'Candidates for a merge: articles of one type with one name. Declared variants (variantOf) and instances are left out; similarity compares the words of the content.',
    run({ entities }) {
      const gruppen = new Map<string, Entity[]>();
      for (const e of entities) {
        if (isInstance(e) || (e.relations ?? []).some((r) => r.type === 'variantOf')) continue;
        const name = entityName(e).trim().toLowerCase();
        if (!name) continue;
        const k = `${typeOf(e)}\u0000${name}`;
        (gruppen.get(k) ?? gruppen.set(k, []).get(k)!).push(e);
      }
      const raus: (CheckHit & { n: number })[] = [];
      for (const g of gruppen.values()) {
        if (g.length < 2) continue;
        g.sort(aelter);
        const erster = g[0]!;
        const inhalte = new Map<string, number>();
        for (const e of g) {
          const k = contentKey(e);
          inhalte.set(k, (inhalte.get(k) ?? 0) + 1);
        }
        const gleich = Math.max(...inhalte.values());
        const w0 = woerter(erster);
        let min = 1;
        let summe = 0;
        for (const e of g.slice(1)) {
          const s = jaccard(w0, woerter(e));
          min = Math.min(min, s);
          summe += s;
        }
        const mittel = summe / (g.length - 1);
        raus.push({
          ...hit(
            erster,
            `${g.length} articles · ${gleich > 1 ? `${gleich} identical` : 'none identical'} · similarity ${mittel.toFixed(2)} (min ${min.toFixed(2)})`,
            g.map((e) => e.id),
          ),
          n: g.length,
        });
      }
      return raus.sort((a, b) => b.n - a.n || a.name.localeCompare(b.name)).map(({ n: _n, ...h }) => h);
    },
  },
  {
    key: 'danglingEdges',
    label: 'Edges into nothing',
    description: 'Edges whose target article does not exist.',
    run({ entities, exists }) {
      const raus: CheckHit[] = [];
      for (const e of entities) {
        const weg = (e.relations ?? []).filter((r) => !exists.has(r.to));
        if (weg.length) raus.push(hit(e, weg.slice(0, 5).map((r) => `${r.type} → ${r.to}`).join(', ') + (weg.length > 5 ? ` (+${weg.length - 5})` : '')));
      }
      return raus;
    },
  },
  {
    key: 'statblockWithoutStats',
    label: 'Statblocks without numbers',
    description: 'A statblock (instances read their template) with no armour class, no hit points and no ability score.',
    run({ registry, entities }) {
      const raus: CheckHit[] = [];
      for (const e of entities) {
        if (!typeChain(registry, typeOf(e)).includes('Statblock')) continue;
        const sb = e.components?.['Statblock'] ?? {};
        const ab = e.components?.['Abilities'] ?? {};
        const zahl = (v: unknown) => v !== undefined && v !== null && v !== '' && Number.isFinite(Number(v));
        if (zahl(sb['ac']) || zahl(sb['hp'])) continue;
        if (['str', 'dex', 'con', 'int', 'wis', 'cha'].some((k) => zahl(ab[k]))) continue;
        raus.push(hit(e, 'no AC, HP or ability score'));
      }
      return raus;
    },
  },
  {
    key: 'instanceWithoutTemplate',
    label: 'Instances without template',
    description: 'An instanceOf edge whose template is missing or of another type.',
    run({ entities, exists }) {
      const raus: CheckHit[] = [];
      for (const e of entities) {
        for (const r of e.relations ?? []) {
          if (r.type !== INSTANCE_RELATION) continue;
          const art = exists.get(r.to);
          if (!art) raus.push(hit(e, `template ${r.to} does not exist`));
          else if (art !== typeOf(e)) raus.push(hit(e, `template ${r.to} is a ${art}`));
        }
      }
      return raus;
    },
  },
  {
    /* T-123: Registeränderungen ohne Migration kamen nie auf dev und prod. */
    key: 'registryDrift',
    label: 'Registry differs from the seed',
    description:
      'A type, field, edge, view or list that stands differently in this database than in packages/registry — a change that came without a migration, or one somebody made here on purpose.',
    run({ registry, seed }) {
      if (!seed) return [];
      return registerAbweichung(registry, seed).map((a) => ({
        id: `registry:${a.part}:${a.name}${a.path ? `:${a.path}` : ''}`,
        name: a.path ? `${a.name}.${a.path}` : a.name,
        type: a.part,
        reason: beschreibeAbweichung(a),
        registry: registerOrt(a.part, a.name),
      }));
    },
  },
  {
    key: 'brokenLinks',
    label: 'Links that hit nothing',
    description: 'A [[…]] link in text whose target no visible article carries as number, id, name or alias.',
    run({ entities }) {
      const finde = linkFinder(entities);
      const raus: CheckHit[] = [];
      for (const e of entities) {
        const offen = new Set<string>();
        texte(e, (_p, t) => {
          if (!t.includes('[[')) return;
          for (const m of t.matchAll(LINK)) if (!finde(m[1]!).length) offen.add(m[1]!.trim());
        });
        if (offen.size) raus.push(hit(e, [...offen].slice(0, 5).join(', ') + (offen.size > 5 ? ` (+${offen.size - 5})` : '')));
      }
      return raus;
    },
  },
  {
    key: 'ambiguousLinks',
    label: 'Ambiguous links',
    description: 'A [[Name]] link that more than one article answers to — it should name the number.',
    run({ entities }) {
      const finde = linkFinder(entities);
      const raus: CheckHit[] = [];
      for (const e of entities) {
        const mehr = new Set<string>();
        texte(e, (_p, t) => {
          if (!t.includes('[[')) return;
          for (const m of t.matchAll(LINK)) if (finde(m[1]!).length > 1) mehr.add(m[1]!.trim());
        });
        if (mehr.size) raus.push(hit(e, [...mehr].slice(0, 5).join(', ')));
      }
      return raus;
    },
  },
  {
    /* T-201: die Galerie zeigt Assets; ein Bild, das nur als Adresse in
       einem Feld steht (die Karten der Abenteuer aus 5e.tools), ist für sie
       nicht da. `scripts/bilder-nachtrag.mjs` führt sie als Assets. */
    key: 'imageAddress',
    label: 'Images given as an address',
    description: 'An image field holds a web address instead of an image article — the gallery does not show it.',
    run({ registry, entities }) {
      const raus: CheckHit[] = [];
      for (const e of entities) {
        const adressen = imageAddresses(registry, e);
        if (adressen.length) raus.push(hit(e, adressen.map((a) => `${a.field}: ${a.url}`).join(', ')));
      }
      return raus;
    },
  },
  {
    /* T-425, E-173: zwei Beiträge zu einer Ansicht fassen dasselbe Element
       an, oder zwei Elemente wollen an dieselbe Stelle. Beides ist erlaubt
       und hat eine Regel (genauere Schicht, Priorität) — hier steht, wo. */
    key: 'viewConflicts',
    label: 'View conflicts',
    description:
      'Two overlays on a view change the same element (the more specific one wins), or two elements claim the same position (the higher priority, then the more specific overlay comes first). Neither is an error; this lists where it happens.',
    run({ registry, exists }) {
      return viewConflicts(registry, (id) => exists.get(id)).map((k) => ({
        id: `view:${k.group}:${k.type}:${k.kind}:${k.element}`,
        name: `${k.group} › ${k.type}`,
        type: 'view',
        reason:
          k.kind === 'conflict'
            ? `“${k.element}” is changed by ${k.sources.join(' and ')} — ${k.winner} wins`
            : `“${k.element}” shares position ${k.position} with ${k.sources.join(', ')}`,
        registry: registerOrt('views', k.winner ?? k.sources.find((s) => !s.startsWith('type ') && !s.startsWith('view ')) ?? k.group),
      }));
    },
  },
  {
    /* T-425, E-182, E-186: was in der Parkplatz-Ebene liegt oder noch gar
       keine Ebene hat — offene Arbeit, bis es in seine Ebene verschoben ist. */
    key: 'unassigned',
    label: 'Unassigned',
    description: 'Articles in the layer Unassigned, or with no layer at all. Move each into the layer it belongs to (Admin › Layer on the article, or a bulk change “move to layer”).',
    run({ registry, entities }) {
      const raus: CheckHit[] = [];
      for (const e of entities) {
        const typ = e.interfaces?.[0] ?? '';
        if (LAYER_TYPES.has(typ) || typeChain(registry, typ).includes('Layer') || isInstance(e)) continue;
        const ebenen = (e.relations ?? []).filter((r) => r.type === LAYER_RELATION);
        if (!ebenen.length) raus.push(hit(e, 'no layer'));
        else if (ebenen.some((r) => r.to === UNASSIGNED_LAYER)) raus.push(hit(e, 'in Unassigned'));
      }
      return raus;
    },
  },
  {
    /* T-425, E-178: ein Artikel trägt einen Stand, dessen Pflicht er nicht
       (mehr) erfüllt — gesetzt vor der Pflicht oder danach geleert. Er
       behält den Stand; hier steht, was fehlt. */
    key: 'readyWithGaps',
    label: 'Ready with gaps',
    description: 'Articles at prepared or ready that miss a field or edge their type requires for that state (requiredFor). They keep their state; fill in what is missing, or set a lower state.',
    run({ registry, entities }) {
      const raus: CheckHit[] = [];
      for (const e of entities) {
        const stand = stateOf(e);
        if (!stand || isInstance(e)) continue;
        const luecken = stateGaps(registry, e, stand);
        if (luecken.length) raus.push(hit(e, `${stand}, missing: ${luecken.map((g) => g.label).join(', ')}`));
      }
      return raus;
    },
  },
  {
    /* T-425, E-170: ein Text oder Akzent steht auf seiner Fläche zu schwach. */
    key: 'tokenContrast',
    label: 'Token contrast',
    description: `A text token reads below ${MIN_CONTRAST.text}:1 on the surface it is meant for, or an accent below ${MIN_CONTRAST.accent}:1 — in the light or the dark mode. Change one of the two colours under Registry › Tokens.`,
    run({ registry }) {
      return tokenContrast(registry).map((k) => ({
        id: `token:${k.token}:${k.mode}`,
        name: registry.tokens?.[k.token]?.label ?? k.token,
        type: 'token',
        reason: `${k.ratio}:1 on ${registry.tokens?.[k.on]?.label ?? k.on} (${k.mode})`,
        registry: { tab: 'tokens', token: k.token },
      }));
    },
  },
  {
    /* T-347: ein Feld oder eine Regeloption nennt einen Glossarbegriff
       (`glossary`); der Eintrag ist ein Artikel der Installation und kann
       fehlen — dann steht dort wieder der eigene Satz, und hier steht, wo. */
    key: 'missingGlossaryTerms',
    label: 'Glossary terms named but missing',
    description:
      'A field or rule option names a glossary term (glossary) that no visible glossary article carries as name or alias — the field title and the handbook fall back to their own sentence.',
    run({ registry, entities }) {
      const namen = new Set<string>();
      for (const e of entities) {
        if (!typeChain(registry, e.interfaces?.[0] ?? '').includes('GlossaryTerm')) continue;
        const id = e.components?.['Identity'] as { name?: unknown; aliases?: unknown } | undefined;
        for (const n of [id?.name, ...(Array.isArray(id?.aliases) ? id.aliases : [])]) if (typeof n === 'string') namen.add(n.trim().toLowerCase());
      }
      const fehlt = (n: string) => !namen.has(n.trim().toLowerCase());
      const raus: CheckHit[] = [];
      for (const r of glossaryFieldRefs(registry)) {
        if (fehlt(r.name)) raus.push({ id: `glossary:${r.ref}`, name: r.ref, type: 'field', reason: `names “${r.name}”`, registry: { type: r.ref.split('.')[0]! } });
      }
      for (const o of RULE_OPTIONS) {
        if (o.glossary && fehlt(o.glossary)) raus.push({ id: `glossary:rule:${o.key}`, name: o.key, type: 'rule option', reason: `names “${o.glossary}”` });
        for (const v of o.variants ?? []) {
          if (v.glossary && fehlt(v.glossary)) raus.push({ id: `glossary:rule:${o.key}:${v.key}`, name: `${o.key}: ${v.key}`, type: 'rule option', reason: `names “${v.glossary}”` });
        }
      }
      return raus;
    },
  },
];

/** Wohin im Register (`/registry?…`) eine Zeile führt. */
function registerOrt(part: string, name: string): Record<string, string> {
  if (part === 'interfaces') return { type: name };
  if (part === 'relations') return { tab: 'edges', edge: name };
  if (part === 'views') return { tab: 'views', view: name };
  if (part === 'enums') return { tab: 'lists', list: name };
  return {};
}

export interface RunChecksOptions {
  /** Nur diese Prüfungen (Schlüssel); ohne Angabe alle. */
  only?: string[];
  /** Wie viele Treffer je Prüfung mitkommen; gezählt wird immer alles. */
  limit?: number;
}

export function runChecks(ctx: CheckContext, options: RunChecksOptions = {}): CheckResult[] {
  const limit = options.limit ?? 50;
  return CHECKS.filter((c) => !options.only?.length || options.only.includes(c.key)).map((c) => {
    const t0 = Date.now();
    const alle = c.run(ctx);
    return {
      key: c.key,
      label: c.label,
      description: c.description,
      count: alle.length,
      hits: alle.slice(0, Math.max(0, limit)),
      ms: Math.round(Date.now() - t0),
    };
  });
}
