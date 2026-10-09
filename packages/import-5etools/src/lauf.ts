/**
 * **Ein Lauf** (Abgleich §4.2): lesen, sieben, `_copy` auflösen, Artikel
 * anlegen, füllen, prüfen. Ein Prüffehler bricht den Lauf — eine Datei,
 * die die Einfuhr ablehnen würde, soll gar nicht erst entstehen.
 */

import type { Entity, Registry } from '@nw/model';
import { stageBases, validateEntity } from '@nw/model';
import { seedRegistry } from '@nw/registry';
import { legeAktionsartenAn, REGELN } from './arten/regeln.js';
import { ZAUBER } from './arten/zauber.js';
import { GEGENSTAENDE } from './arten/gegenstaende.js';
import { CHARAKTERBAU } from './arten/charakterbau.js';
import { LEGENDAER, MONSTER } from './arten/monster.js';
import { WELT } from './arten/welt.js';
import type { Knoten } from './copy.js';
import { KOPIE_VON, loeseKopien } from './copy.js';
import type { Auswahl, Datenstand } from './lesen.js';
import { ARTEN_WEG, ausschluss, quelleVon } from './lesen.js';
import type { Bericht } from './werkbank.js';
import { Werkbank, zaehle } from './werkbank.js';
import type { Zuordnung } from './zuordnung.js';

/** Die Reihenfolge aus Abgleich §4.2 — jede spätere Art zeigt auf frühere. */
export const ZUORDNUNGEN: Zuordnung[] = [
  ...REGELN,
  ZAUBER,
  ...GEGENSTAENDE,
  ...CHARAKTERBAU,
  LEGENDAER,
  ...MONSTER,
  ...WELT,
];

/** Die Ebene, in der der ganze Bestand liegt (Arbeitsplan §1, M9). */
export const EBENE = 'D&D 5e (2014)';

/** Begleittexte, die an einen Artikel gehen (`Lore`). */
const FLUFF = ['monsterFluff', 'raceFluff', 'backgroundFluff', 'classFluff', 'subclassFluff'];

const kl = (s: unknown) => String(s ?? '').trim().toLowerCase();

/** Woran `_copy` einen Eintrag erkennt — je Art etwas anders. */
function kopieSchluessel(art: string): (e: Knoten) => string {
  switch (art) {
    case 'subclass':
      return (e) => `${kl(e['name'] ?? e['shortName'])}|${kl(e['source'])}|${kl(e['className'])}|${kl(e['classSource'])}`;
    case 'classFeature':
      return (e) => `${kl(e['name'])}|${kl(e['source'])}|${kl(e['className'])}|${kl(e['classSource'])}|${kl(e['level'])}`;
    case 'subclassFeature':
      return (e) => `${kl(e['name'])}|${kl(e['source'])}|${kl(e['className'])}|${kl(e['classSource'])}|${kl(e['subclassShortName'])}|${kl(e['level'])}`;
    case 'subrace':
      return (e) => `${kl(e['name'])}|${kl(e['source'])}|${kl(e['raceName'])}`;
    case 'deity':
      return (e) => `${kl(e['name'])}|${kl(e['source'])}|${kl(e['pantheon'])}`;
    default:
      return (e) => `${kl(e['name'])}|${kl(quelleVon(e))}`;
  }
}

export interface Ergebnis {
  datei: { format: string; registry: Registry & { components?: unknown }; entities: Entity[] };
  bericht: Bericht;
}

export class Prueffehler extends Error {
  constructor(readonly fehler: string[]) {
    super(`${fehler.length} Artikel bestehen die Prüfung nicht:\n${fehler.slice(0, 40).join('\n')}`);
  }
}

/** Leere Karten und Listen weg — eine leere Karte trägt nichts (D27). */
function aufraeumen(e: Entity): void {
  for (const [k, v] of Object.entries(e.components)) {
    if (v && typeof v === 'object' && !Object.keys(v).length) delete e.components[k];
  }
  if (e.relations && !e.relations.length) delete e.relations;
}

export function lauf(stand: Datenstand, auswahl: Auswahl = {}, registry: Registry = seedRegistry): Ergebnis {
  const wb = new Werkbank(registry);

  /* 1. Die Ebene. Kein `inLayer` an ihr selbst. */
  const ebene = wb.anlegen('Layer', EBENE, 'layer|5e-2014');
  delete ebene.components['Source'];
  wb.feld(ebene, 'Layer', 'kind', 'system');
  wb.feld(ebene, 'Layer', 'order', 0);
  wb.feld(ebene, 'Layer', 'version', '2014');
  wb.prosa(ebene, 'The 2014 rules of the fifth edition and everything built on them, taken over once from 5e.tools. Which book and page an article comes from is in its source.');
  wb.ebene = ebene;
  legeAktionsartenAn(wb);

  /* Begleittexte, nach Name und Quelle. Sie stehen selbst manchmal als
     Kopie da. */
  for (const art of FLUFF) {
    const roh = stand.arten.get(art) ?? [];
    wb.artBericht(art).gelesen += roh.length;
    const gelöst = loeseKopien(roh, kopieSchluessel(art), (was) => wb.notiz(was, art));
    wb.fluffe.set(art, new Map(gelöst.map((f) => [`${kl(f['name'])}|${kl(f['source'])}`, f])));
  }
  const vorlagen = new Map((stand.arten.get('monsterTemplate') ?? []).map((t) => [`${kl(t['name'])}|${kl(t['source'])}`, t]));

  /* Was keine Zuordnung hat und nicht bewusst wegbleibt, steht im Bericht. */
  const bekannt = new Set([...ZUORDNUNGEN.map((z) => z.art), ...FLUFF, ...Object.keys(ARTEN_WEG)]);
  for (const [art, liste] of stand.arten) {
    if (bekannt.has(art)) continue;
    const b = wb.artBericht(art);
    b.gelesen += liste.length;
    zaehle(b.notizen, 'keine Zuordnung', liste.length);
  }
  for (const [art, grund] of Object.entries(ARTEN_WEG)) {
    const n = stand.arten.get(art)?.length ?? 0;
    if (!n || art === '_meta') continue;
    const b = wb.artBericht(art);
    b.gelesen += n;
    zaehle(b.notizen, `weggelassen: ${grund}`, n);
  }

  /* 2. Erster Gang: jeder Eintrag bekommt seinen Artikel und seine Nummer. */
  const zuFuellen: [Zuordnung, Entity, Knoten][] = [];
  /* Je Art: Kopierschlüssel → Artikel, damit eine aufgelöste Kopie ihr
     Original findet (`variantOf`, Abgleich §4.2 Schritt 3). */
  const nachKopie = new Map<string, Entity>();
  const pegs = new Set<string>(wb.entities.map((e) => e.id));
  for (const z of ZUORDNUNGEN) {
    const roh = stand.arten.get(z.art) ?? [];
    const b = wb.artBericht(z.art);
    b.gelesen += roh.length;
    const gelöst = loeseKopien(roh, kopieSchluessel(z.art), (was) => wb.notiz(was, z.art), vorlagen);
    const vereint = new Map<string, Entity>();
    /* Die Kernbücher zuerst, dann nach Erscheinen: so trägt der Goblin aus
       dem Monster Manual die kleinere Nummer, und ein Merkmal, das viele
       teilen, nennt als Fundstelle das Buch, in dem es zuerst stand. */
    const rang = (e: Knoten): string => {
      const q = quelleVon(e);
      const kern = ['PHB', 'MM', 'DMG'].indexOf(q);
      if (kern >= 0) return `0${kern}`;
      return `1${stand.quellen.get(q.toLowerCase())?.published ?? '9999'}`;
    };
    const geordnet = gelöst.map((e, i) => [rang(e), i, e] as const).sort((a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : a[1] - b[1]));
    for (const [, , e] of geordnet) {
      const grund = ausschluss(e, stand, auswahl);
      if (grund) {
        const m = b.ausgeschlossen.get(grund) ?? new Map<string, number>();
        zaehle(m, quelleVon(e) || '(ohne)');
        b.ausgeschlossen.set(grund, m);
        continue;
      }
      const q = quelleVon(e);
      if (q && !stand.quellen.has(q.toLowerCase())) zaehle(wb.bericht.fremdeQuellen, q);
      const typ = z.typ(e, wb);
      if (!typ) continue;
      const v = z.vereinen?.(e);
      let ent = v ? vereint.get(v) : undefined;
      if (!ent) {
        const herkunft = `${z.art}|${kl(z.name(e))}|${kl(q)}|${z.herkunft?.(e) ?? ''}`;
        const vorher = wb.entities.length;
        const neu = wb.anlegen(typ, z.name(e), herkunft, e);
        if (pegs.has(neu.id)) {
          /* Derselbe Eintrag zweimal (dieselbe Art, derselbe Name, dieselbe
             Quelle): der zweite fällt weg und wird gezählt. */
          wb.entities.splice(vorher, 1);
          zaehle(wb.bericht.typen, typ, -1);
          wb.notiz('doppelter Eintrag', z.art);
          continue;
        }
        pegs.add(neu.id);
        nachKopie.set(`${z.art}|${kopieSchluessel(z.art)(e)}`, neu);
        ent = neu;
        if (v) vereint.set(v, ent);
        zuFuellen.push([z, ent, e]);
        zaehle(b.artikel, typ);
      } else {
        wb.notiz('mit gleichlautendem Eintrag vereint', z.art);
        wb.vereint.set(ent.id, (wb.vereint.get(ent.id) ?? 1) + 1);
      }
      for (const s of z.schluessel?.(e) ?? [[z.name(e), q]]) wb.merke(ent, z.tag, ...s);
      /* Unter dem Namen, den 5e.tools selbst trägt, auch — für Unterarten. */
      if (z.art === 'subrace') wb.merke(ent, 'race', e['name'], q);
    }
  }

  /* 3. Zweiter Gang: füllen. Jetzt findet jeder Verweis sein Ziel. */
  for (const [z, ent, e] of zuFuellen) {
    wb.aktuelleArt = z.art;
    z.fuellen(wb, ent, e);
    /* Andere Namen, unter denen 5e.tools den Eintrag auch führt. */
    if (Array.isArray(e['alias']) && e['alias'].length) {
      const alt = (wb.karte(ent, 'Identity')['aliases'] as string[] | undefined) ?? [];
      wb.feld(ent, 'Identity', 'aliases', [...new Set([...alt, ...e['alias'].map(String)])]);
    }
    wb.liegen(z.art, e, [...z.genutzt, 'name', 'alias']);
  }

  /* Eine aufgelöste Kopie zeigt auf ihr Original, wenn es hereinkam und
     sie nicht schon auf einen Grundgegenstand zeigt (`variantOf` ist eine
     Kante). */
  for (const [z, ent, e] of zuFuellen) {
    const von = e[KOPIE_VON];
    if (typeof von !== 'string') continue;
    const original = nachKopie.get(`${z.art}|${von}`);
    if (!original || original.id === ent.id) {
      if (!original) wb.notiz('Kopie eines Eintrags, der nicht hereinkam', z.art);
      continue;
    }
    if ((ent.relations ?? []).some((r) => r.type === 'variantOf')) continue;
    wb.kante(ent, 'variantOf', original.id);
  }

  for (const e of wb.entities) aufraeumen(e);

  /* 4. Prüfen, mit Art und Stufen — wie der Server beim Schreiben. */
  const bekannteArten = new Map(wb.entities.map((e) => [e.id, e.interfaces[0] ?? ''] as const));
  /* Die Ids einmal: ohne sie baut die Prüfung je Artikel ein neues Set
     aus allen Schlüsseln, und das sind bei 28 000 Artikeln Minuten. */
  const bekannteIds = new Set(bekannteArten.keys());
  const stufen = stageBases(wb.entities);
  const fehler: string[] = [];
  if (bekannteArten.size !== wb.entities.length) fehler.push('Zwei Artikel tragen dieselbe Peg-Id.');
  for (const e of wb.entities) {
    const issues = validateEntity(registry, e, { knownTypes: bekannteArten, knownIds: bekannteIds, stageOf: stufen });
    for (const i of issues) fehler.push(`${e.interfaces[0]} „${e.name}" (${(e.components['Identity'] as { id: string }).id}): ${i.message}`);
  }
  if (fehler.length) throw new Prueffehler(fehler);

  return {
    datei: {
      format: 'nebelwacht/1',
      /* `components` ist der zweite Name für `interfaces`, den die Einfuhr
         des Prototyps noch liest (`register-datei.mjs`). */
      registry: { ...registry, components: registry.interfaces },
      entities: wb.entities,
    },
    bericht: wb.bericht,
  };
}

/**
 * Ein kleiner Ausschnitt für den Prüfbestand (M14): ein paar Statblöcke,
 * Zauber, zwei Klassen, die Zustände — und alles, worauf deren Kanten
 * zeigen, damit jeder Artikel für sich die Prüfung besteht.
 */
export function ausschnitt(entities: Entity[], wunsch: { typ: string; namen?: string[]; anzahl?: number }[]): Entity[] {
  const nachId = new Map(entities.map((e) => [e.id, e]));
  const drin = new Map<string, Entity>();
  const nimm = (e: Entity) => {
    if (drin.has(e.id)) return;
    drin.set(e.id, e);
    for (const r of e.relations ?? []) {
      const z = nachId.get(r.to);
      if (z) nimm(z);
    }
    for (const karte of Object.values(e.components)) {
      for (const v of Object.values(karte ?? {})) {
        if (typeof v === 'string' && nachId.has(v)) nimm(nachId.get(v)!);
      }
    }
  };
  for (const w of wunsch) {
    const passend = entities.filter((e) => e.interfaces[0] === w.typ);
    const gewaehlt = w.namen
      ? passend.filter((e) => w.namen!.includes(e.name))
      : passend.slice(0, w.anzahl ?? passend.length);
    for (const e of gewaehlt) nimm(e);
  }
  /* Was eine Stufe ist, braucht ihren Grundzustand — und umgekehrt sollen
     die Stufen da sein, wenn der Grundzustand da ist. */
  for (const e of entities) {
    if ((e.relations ?? []).some((r) => r.type === 'stageOf' && drin.has(r.to))) nimm(e);
  }
  return [...drin.values()];
}

/** Was der Prüfbestand aus einem Lauf bekommt (Abgleich §4.3, M14). */
export const PROBE: { typ: string; namen?: string[]; anzahl?: number }[] = [
  { typ: 'Statblock', namen: ['Goblin', 'Mage', 'Adult Red Dragon', 'Wolf', 'Bandit', 'Guard', 'Ogre', 'Zombie', 'Skeleton', 'Gelatinous Cube', 'Owlbear', 'Veteran', 'Priest', 'Kobold', 'Orc', 'Giant Rat', 'Swarm of Rats', 'Bugbear', 'Hobgoblin', 'Ghoul'] },
  { typ: 'Spell', namen: ['Fireball', 'Magic Missile', 'Cure Wounds', 'Shield', 'Mage Armor', 'Fire Bolt', 'Light', 'Detect Magic', 'Misty Step', 'Counterspell', 'Bless', 'Healing Word', 'Sleep', 'Thunderwave', 'Hold Person', 'Invisibility', 'Fly', 'Haste', 'Lightning Bolt', 'Spirit Guardians', 'Guidance', 'Sacred Flame', 'Eldritch Blast', 'Hex', 'Hunter\'s Mark', 'Wall of Fire', 'Polymorph', 'Banishment', 'Cone of Cold', 'Raise Dead'] },
  { typ: 'Class', namen: ['Fighter', 'Wizard'] },
  { typ: 'Subclass', namen: ['Champion', 'School of Evocation'] },
  { typ: 'Condition' },
  { typ: 'Skill' },
  { typ: 'Language', namen: ['Common', 'Elvish', 'Dwarvish', 'Goblin', 'Draconic', 'Orc', 'Giant'] },
  { typ: 'Weapon', namen: ['Longsword', 'Shortsword', 'Scimitar', 'Shortbow', 'Dagger', 'Hand Crossbow'] },
  { typ: 'Armor', namen: ['Leather Armor', 'Chain Mail', 'Shield'] },
  { typ: 'Item', namen: ['+1 Weapon', 'Bag of Holding', 'Potion of Healing', 'Rope, Hempen (50 feet)', 'Wand of Magic Missiles'] },
  { typ: 'Ancestry', namen: ['Elf', 'Elf (High)', 'Dwarf', 'Human'] },
  { typ: 'Background', namen: ['Acolyte', 'Criminal'] },
  { typ: 'Feat', namen: ['Alert', 'Lucky'] },
  { typ: 'Rule', namen: ['Darkvision', 'Flanking'] },
];
