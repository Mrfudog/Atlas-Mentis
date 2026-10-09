/**
 * **Charakterbau** (Abgleich §4.2, Schritt 9 und 10; M3): Klassen,
 * Unterklassen und ihre Merkmale, Zusatzmerkmale (Anrufungen, Manöver …),
 * Abstammungen, Hintergründe, Talente.
 *
 * Was eine Klasse auf welcher Stufe gewährt, ist die Kante `grants` mit
 * `props.level` (D50). 5e.tools führt „Ability Score Improvement" je
 * Klasse fünfmal mit demselben Text; daraus wird **ein** Merkmal je Klasse
 * und fünf Kanten.
 */

import type { Entity } from '@nw/model';
import type { Knoten } from '../copy.js';
import type { Werkbank } from '../werkbank.js';
import type { Zuordnung } from '../zuordnung.js';
import { GROESSE, liste, SCHADEN, titel, zahl } from '../zuordnung.js';
import { fertigkeit } from './regeln.js';

const ATTR = ['str', 'dex', 'con', 'int', 'wis', 'cha'];

const kl = (s: unknown) => String(s ?? '').trim().toLowerCase();

/** Ein Name, den ein Übungsfeld halten darf, aus einem 5e.tools-Wort. */
function uebungsName(wb: Werkbank, art: 'skill' | 'language' | 'weapon' | 'armor' | 'tool', wort: string): string | undefined {
  const roh = wort.replace(/\{@\w+ ([^}]*)\}/g, '$1');
  const [name = ''] = roh.split('|');
  const n = name.trim();
  if (!n) return undefined;
  switch (art) {
    case 'skill':
      return wb.finde('skill', [n])?.name ?? fertigkeit(n);
    case 'language':
      return wb.finde('language', [n])?.name;
    case 'armor':
      return ['light', 'medium', 'heavy', 'shield'].includes(kl(n)) ? kl(n) : kl(n) === 'shields' ? 'shield' : undefined;
    case 'weapon':
      if (['simple', 'martial'].includes(kl(n))) return kl(n);
      if (/^(simple|martial) weapons?$/i.test(n)) return kl(n).split(' ')[0];
      return wb.finde('item', roh.split('|') as string[])?.name ?? wb.finde('item', [n.replace(/s$/, '')])?.name;
    case 'tool':
      return wb.finde('item', roh.split('|') as string[])?.name;
  }
}

/** Übungen aus den Listen von 5e.tools: was fest ist, was zur Wahl steht. */
export function uebungen(
  wb: Werkbank,
  ent: Entity,
  quellen: Partial<Record<'skill' | 'language' | 'weapon' | 'armor' | 'tool', unknown>>,
  feld = 'proficient',
): void {
  const fest: string[] = [];
  const wahl: { from: string[]; count: number; note: string }[] = [];
  const notizen: string[] = [];
  for (const [art, roh] of Object.entries(quellen) as ['skill' | 'language' | 'weapon' | 'armor' | 'tool', unknown][]) {
    for (const block of liste(roh)) {
      if (typeof block === 'string') {
        const n = uebungsName(wb, art, block);
        if (n) fest.push(n);
        else notizen.push(wb.zeile(block));
        continue;
      }
      for (const [k, v] of Object.entries((block as Knoten) ?? {})) {
        if (k === 'choose') {
          const c = v as Knoten;
          const von = liste(c['from']).map((x) => (typeof x === 'string' ? uebungsName(wb, art, x) : undefined)).filter((x): x is string => !!x);
          wahl.push({ from: von, count: Number(c['count'] ?? 1), note: `${String(c['count'] ?? 1)} ${art === 'skill' ? 'skill' : art} of your choice` });
        } else if (v === true) {
          const n = uebungsName(wb, art, k);
          if (n) fest.push(n);
          else notizen.push(titel(k));
        } else if (typeof v === 'number') {
          /* `anyStandard: 2`, `any: 1` — eine Wahl ohne Liste. */
          notizen.push(`${v} ${k.replace(/([A-Z])/g, ' $1').toLowerCase()} ${art === 'tool' ? 'tool' : art}${v === 1 ? '' : 's'} of your choice`);
        }
      }
    }
  }
  const P = 'Proficiencies';
  const alt = (wb.karte(ent, P)[feld] as string[] | undefined) ?? [];
  const neu = [...new Set([...alt, ...fest])];
  if (neu.length) wb.karte(ent, P)[feld] = neu;
  else if (!Object.keys(wb.karte(ent, P)).length) delete ent.components[P];
  if (!ent.interfaces.some((t) => ['Class', 'Subclass', 'Ancestry', 'Background'].includes(t))) return;
  const C = 'ProficiencyChoice';
  const [erste, ...weitere] = wahl;
  const karte = wb.karte(ent, C);
  if (erste && !karte['chooseFrom']) {
    wb.feld(ent, C, 'chooseFrom', erste.from);
    wb.feld(ent, C, 'chooseCount', erste.count);
  } else if (erste) weitere.unshift(erste);
  const satz = [...((karte['chooseNote'] as string | undefined) ? [karte['chooseNote'] as string] : []), ...weitere.map((w) => `${w.note}: ${w.from.join(', ')}`), ...notizen];
  if (satz.length) karte['chooseNote'] = satz.join('; ');
  if (!Object.keys(karte).length) delete ent.components[C];
}

/** Die Startausrüstung eines Hintergrunds: was fest ist, und die Wahl a/b. */
function ausruestung(wb: Werkbank, roh: unknown): string {
  const stueck = (x: unknown): string => {
    if (typeof x === 'string') return wb.zeile(`{@item ${x}}`);
    const o = x as Knoten;
    const menge = o['quantity'] ? ` (${String(o['quantity'])})` : '';
    if (o['item']) {
      const name = o['displayName'] ? `|${String(o['displayName'])}` : '';
      const [n = '', q = ''] = String(o['item']).split('|');
      return `${wb.zeile(`{@item ${n}|${q}${name}}`)}${menge}${o['containsValue'] ? ` containing ${Number(o['containsValue']) / 100} gp` : ''}`;
    }
    if (o['special']) return `${wb.zeile(String(o['special']))}${menge}`;
    if (o['value'] !== undefined) return `${Number(o['value']) / 100} gp`;
    if (o['equipmentType']) return `one ${String(o['equipmentType']).replace(/([A-Z])/g, ' $1').toLowerCase()} of your choice`;
    return '';
  };
  const zeilen: string[] = [];
  for (const block of liste(roh)) {
    const b = block as Knoten;
    if (b['_']) zeilen.push(`- ${liste(b['_']).map(stueck).filter(Boolean).join(', ')}`);
    const wahl = Object.keys(b).filter((k) => k !== '_').sort();
    if (wahl.length) zeilen.push(`- ${wahl.map((k) => `(${k}) ${liste(b[k]).map(stueck).filter(Boolean).join(', ')}`).join(' or ')}`);
  }
  return zeilen.join('\n');
}

/** `{choose: {from: [...]}}`-Zauberlisten (`additionalSpells`) als `casts`. */
function zusatzzauber(wb: Werkbank, ent: Entity, roh: unknown): void {
  for (const block of liste(roh)) {
    const b = block as Knoten;
    for (const modus of ['innate', 'known', 'prepared', 'expanded'] as const) {
      const nachStufe = b[modus] as Record<string, unknown> | undefined;
      if (!nachStufe) continue;
      for (const [stufe, inhalt] of Object.entries(nachStufe)) {
        const ab = zahl(stufe.replace(/[^0-9]/g, ''));
        const eintraege: [unknown, string | undefined][] = [];
        if (Array.isArray(inhalt)) for (const s of inhalt) eintraege.push([s, undefined]);
        else if (inhalt && typeof inhalt === 'object') {
          for (const [k, v] of Object.entries(inhalt as Knoten)) {
            if (k === '_') for (const s of liste(v)) eintraege.push([s, undefined]);
            else if (k === 'will') for (const s of liste(v)) eintraege.push([s, 'at will']);
            else if (k === 'daily' || k === 'rest') {
              for (const [n, l] of Object.entries(v as Knoten)) for (const s of liste(l)) eintraege.push([s, `${n.replace(/e$/, '')}/${k === 'daily' ? 'day' : 'rest'}`]);
            } else if (k === 'ritual') for (const s of liste(v)) eintraege.push([s, 'ritual']);
          }
        }
        for (const [s, uses] of eintraege) {
          if (typeof s !== 'string') {
            wb.notiz('Zauber zur Wahl (als Text belassen)');
            continue;
          }
          const [n = '', q = ''] = s.replace(/#c$/, '').split('|');
          const ziel = wb.finde('spell', [n, q]);
          if (!ziel) {
            wb.ctx.insLeere('spell', s);
            continue;
          }
          const props: Record<string, unknown> = { mode: modus === 'expanded' ? 'known' : modus };
          if (uses) props['uses'] = uses;
          if (ab && ab >= 1 && ab <= 20) props['fromLevel'] = ab;
          wb.kante(ent, 'casts', ziel.id, props);
        }
      }
    }
  }
}

function lore(wb: Werkbank, ent: Entity, art: string, e: Knoten): void {
  const f = wb.fluff(art, String(e['name']), String(e['source']));
  if (f) wb.lore(ent, wb.text(f['entries']));
}

const FEATURE_TYPE: Record<string, string> = {
  AI: 'Artificer Infusion', ED: 'Elemental Discipline', EI: 'Eldritch Invocation', MM: 'Metamagic',
  'MV': 'Maneuver', 'MV:B': 'Maneuver, Battle Master', 'MV:C2-UA': 'Maneuver, Cavalier V2 (UA)',
  'AS:V1-UA': 'Arcane Shot, V1 (UA)', 'AS:V2-UA': 'Arcane Shot, V2 (UA)', AS: 'Arcane Shot',
  OTH: 'Other', 'FS:F': 'Fighting Style, Fighter', 'FS:B': 'Fighting Style, Bard',
  'FS:P': 'Fighting Style, Paladin', 'FS:R': 'Fighting Style, Ranger', PB: 'Pact Boon',
  OR: 'Onomancy Resonant', RN: 'Rune Knight Rune', AF: 'Alchemical Formula', TT: 'Traveler\'s Trick',
};

/** `prerequisite` als Satz: „Level 5, Pact of the Blade". */
export function voraussetzung(wb: Werkbank, roh: unknown): string {
  const teile: string[] = [];
  for (const p of liste(roh)) {
    const o = p as Knoten;
    const satz: string[] = [];
    for (const [k, v] of Object.entries(o ?? {})) {
      if (k === 'level') {
        const l = typeof v === 'object' && v ? (v as Knoten) : { level: v };
        const klasse = (l['class'] as Knoten | undefined)?.['name'];
        satz.push(`${klasse ? `${String(klasse)} ` : ''}level ${String(l['level'])}`);
      } else if (k === 'ability') {
        for (const a of liste(v)) for (const [at, w] of Object.entries(a as Knoten)) satz.push(`${at.toUpperCase()} ${String(w)}`);
      } else if (k === 'race' || k === 'background' || k === 'feat' || k === 'spell' || k === 'pact' || k === 'patron' || k === 'item' || k === 'feature' || k === 'optionalfeature') {
        satz.push(
          liste(v)
            .map((x) => {
              if (typeof x === 'string') {
                const tag = k === 'optionalfeature' ? 'optfeature' : k === 'feature' ? '' : k;
                return tag && /^(race|background|feat|spell|item|optfeature)$/.test(tag) ? wb.zeile(`{@${tag} ${x.replace(/#c$/, '')}}`) : titel(x);
              }
              const xo = x as Knoten;
              return `${titel(String(xo['name'] ?? xo['displayEntry'] ?? ''))}${xo['subrace'] ? ` (${String(xo['subrace'])})` : ''}`;
            })
            .join(' or '),
        );
      } else if (k === 'spellcasting' || k === 'spellcasting2020' || k === 'spellcastingFeature') satz.push('the ability to cast at least one spell');
      else if (k === 'proficiency') {
        for (const pr of liste(v)) for (const [a, w] of Object.entries(pr as Knoten)) satz.push(`proficiency with ${String(w)} ${a}`);
      } else if (k === 'other' || k === 'otherSummary') satz.push(typeof v === 'string' ? wb.zeile(v) : wb.zeile(String((v as Knoten)['entry'] ?? '')));
      else if (k === 'note') satz.push(wb.zeile(String(v)));
      else if (k === 'campaign') satz.push(`${liste(v).join(' or ')} campaign`);
      else if (k === 'psionics') satz.push('psionics');
      else satz.push(k);
    }
    teile.push(satz.join(', '));
  }
  return teile.filter(Boolean).join('; or ');
}

/** Die Stufentabelle einer Klasse als `Table` mit `tableFor` (M8). */
function klassentabelle(wb: Werkbank, klasse: Entity, e: Knoten): void {
  const gruppen = liste(e['classTableGroups']) as Knoten[];
  if (!gruppen.length) return;
  const spalten = ['Level'];
  const zeilen: string[][] = Array.from({ length: 20 }, (_, i) => [String(i + 1)]);
  for (const g of gruppen) {
    const labels = liste(g['colLabels']).map((c) => wb.zeile(String(c)).replace(/\*/g, ''));
    spalten.push(...labels);
    const rows = liste(g['rows'] ?? g['rowsSpellProgression']) as unknown[][];
    for (let i = 0; i < 20; i++) {
      const r = liste(rows[i]);
      for (let j = 0; j < labels.length; j++) {
        const c = r[j];
        let s: string;
        if (c && typeof c === 'object') {
          const o = c as Knoten;
          s = o['type'] === 'bonus' ? `+${String(o['value'])}` : o['type'] === 'dice' ? liste(o['toRoll']).map((d) => `${(d as Knoten)['number']}d${(d as Knoten)['faces']}`).join('+') : o['type'] === 'bonusSpeed' ? `+${String(o['value'])} ft.` : String(o['value'] ?? '');
        } else s = c === 0 ? '—' : wb.zeile(String(c ?? ''));
        zeilen[i]!.push(s);
      }
    }
  }
  const t = wb.anlegen('Table', `${klasse.name} Table`, `classTable|${klasse.id}`, e);
  wb.feld(t, 'Table', 'kind', 'generic');
  wb.feld(t, 'Table', 'columns', spalten);
  wb.feld(t, 'Table', 'rows', zeilen.map((z) => ({ cells: z, text: z.slice(1).join(' · ') })));
  wb.kante(klasse, 'tableFor', t.id);
}

const FORTSCHRITT: Record<string, string> = { full: 'full', '1/2': 'half', '1/3': 'third', pact: 'pact', artificer: 'artificer' };

/** Die Kanten `grants` aus `classFeatures` / `subclassFeatures`. */
function gewaehrt(wb: Werkbank, ent: Entity, roh: unknown, tag: 'classFeature' | 'subclassFeature'): void {
  for (const f of liste(roh)) {
    const s = typeof f === 'string' ? f : String((f as Knoten)['classFeature'] ?? (f as Knoten)['subclassFeature'] ?? '');
    const t = s.split('|');
    const ziel = wb.finde(tag, t);
    const stufe = Number(tag === 'classFeature' ? t[3] : t[5]);
    if (!ziel) {
      wb.ctx.insLeere(tag, s);
      continue;
    }
    wb.kante(ent, 'grants', ziel.id, Number.isInteger(stufe) && stufe >= 1 && stufe <= 20 ? { level: stufe } : undefined);
  }
}

const merkmal = (art: 'classFeature' | 'subclassFeature'): Zuordnung => ({
  art,
  tag: art,
  typ: () => 'Feature',
  name: (e) => String(e['name']),
  schluessel: (e) =>
    art === 'classFeature'
      ? [[e['name'], e['className'], e['level']]]
      : [[e['name'], e['className'], e['subclassShortName'], e['level']]],
  herkunft: (e) => `${String(e['className'])}|${String(e['subclassShortName'] ?? '')}|${String(e['level'])}`,
  /* Dasselbe Merkmal derselben (Unter-)Klasse mit demselben Text auf
     mehreren Stufen ist eine Sache. */
  /* „When you reach 4th level …" und „… 8th level …" sind derselbe Text
     bis auf die Stufe — die steht an der Kante (D50). */
  vereinen: (e) => `${art}|${kl(e['name'])}|${kl(e['className'])}|${kl(e['subclassShortName'])}|${JSON.stringify(e['entries']).replace(/\b\d+(st|nd|rd|th)\b/g, '#')}`,
  genutzt: ['name', 'entries', 'className', 'classSource', 'subclassShortName', 'subclassSource', 'level', 'header', 'isClassFeatureVariant', 'consumes'],
  fuellen(wb, ent, e) {
    wb.feld(ent, 'Feature', 'featureType', art === 'classFeature' ? 'class' : 'subclass');
    if (e['isClassFeatureVariant']) wb.marke(ent, 'optional');
    let text = wb.text(e['entries']);
    if ((wb.vereint.get(ent.id) ?? 1) > 1) {
      text = text.replace(new RegExp(`\\b${String(e['level'])}(st|nd|rd|th) level`, 'g'), 'a level that grants this feature');
    }
    wb.prosa(ent, text);
  },
});

const GENUTZT_ABSTAMMUNG = [
  'name', 'entries', 'size', 'speed', 'ability', 'age', 'darkvision', 'creatureTypes', 'resist',
  'skillProficiencies', 'languageProficiencies', 'toolProficiencies', 'weaponProficiencies',
  'armorProficiencies', 'additionalSpells', 'lineage', 'traitTags', 'heightAndWeight', 'feats',
  'creatureTypeTags', 'blindsight', 'immune', 'conditionImmune', 'vulnerable', 'soundClip',
];

export const CHARAKTERBAU: Zuordnung[] = [
  merkmal('classFeature'),
  merkmal('subclassFeature'),
  {
    art: 'class',
    tag: 'class',
    typ: () => 'Class',
    name: (e) => String(e['name']),
    genutzt: [
      'name', 'hd', 'proficiency', 'startingProficiencies', 'startingEquipment', 'multiclassing',
      'classFeatures', 'subclassTitle', 'casterProgression', 'spellcastingAbility', 'classTableGroups',
      'primaryAbility', 'isSidekick', 'cantripProgression', 'spellsKnownProgression',
      'spellsKnownProgressionFixed', 'preparedSpells', 'preparedSpellsProgression', 'optionalfeatureProgression',
      'additionalSpells', 'featProgression', 'requirements',
    ],
    fuellen(wb, ent, e) {
      const C = 'Class';
      wb.feld(ent, C, 'hitDie', zahl((e['hd'] as Knoten | undefined)?.['faces']));
      const haupt = liste(e['primaryAbility']).flatMap((x) => Object.keys(x as Knoten)).filter((a) => ATTR.includes(a));
      wb.feld(ent, C, 'primaryAbility', [...new Set(haupt)]);
      const prof = (e['startingProficiencies'] as Knoten | undefined) ?? {};
      uebungen(wb, ent, { armor: prof['armor'], weapon: prof['weapons'], tool: prof['tools'], skill: prof['skills'] });
      wb.feld(ent, 'Proficiencies', 'saves', liste(e['proficiency']).map(String).filter((a) => ATTR.includes(a)));
      const ausr = (e['startingEquipment'] as Knoten | undefined) ?? {};
      const ausrText = [
        liste(ausr['default']).map((x) => `- ${wb.zeile(x)}`).join('\n'),
        ausr['goldAlternative'] ? `Alternatively, ${wb.zeile(ausr['goldAlternative'])} gp to buy your own equipment.` : '',
      ].filter(Boolean).join('\n\n');
      wb.feld(ent, C, 'startingEquipment', ausrText);
      const mc = (e['multiclassing'] as Knoten | undefined) ?? {};
      const req = (mc['requirements'] as Knoten | undefined) ?? {};
      const reqText = (r: Knoten): string =>
        Object.entries(r)
          .map(([k, v]) =>
            /* `or: [{str: 13, dex: 13}]` heisst: eines davon. */
            k === 'or'
              ? liste(v).map((x) => Object.entries(x as Knoten).map(([a, w]) => `${a.toUpperCase()} ${String(w)}`).join(' or ')).join(' or ')
              : `${k.toUpperCase()} ${String(v)}`,
          )
          .join(', ');
      wb.feld(ent, C, 'multiclassRequirement', reqText(req));
      const mp = (mc['proficienciesGained'] as Knoten | undefined) ?? {};
      uebungen(wb, ent, { armor: mp['armor'], weapon: mp['weapons'], tool: mp['tools'], skill: mp['skills'] }, 'multiclassProficient');
      if (ent.components['Proficiencies']?.['multiclassProficient']) {
        wb.feld(ent, C, 'multiclassProficient', ent.components['Proficiencies']['multiclassProficient']);
        delete ent.components['Proficiencies']['multiclassProficient'];
      }
      wb.feld(ent, C, 'subclassTitle', e['subclassTitle']);
      if (e['casterProgression']) wb.feld(ent, C, 'casterProgression', FORTSCHRITT[String(e['casterProgression'])]);
      if (e['spellcastingAbility']) wb.feld(ent, C, 'spellAbility', e['spellcastingAbility']);
      if (e['isSidekick']) wb.marke(ent, 'sidekick');
      gewaehrt(wb, ent, e['classFeatures'], 'classFeature');
      klassentabelle(wb, ent, e);
      lore(wb, ent, 'classFluff', e);
    },
  },
  {
    art: 'subclass',
    tag: 'subclass',
    typ: () => 'Subclass',
    name: (e) => String(e['name']),
    schluessel: (e) => [[e['name'], e['className']], [e['shortName'], e['className']]],
    herkunft: (e) => String(e['className']),
    genutzt: [
      'name', 'shortName', 'className', 'classSource', 'subclassFeatures', 'casterProgression',
      'spellcastingAbility', 'additionalSpells', 'subclassTableGroups', 'cantripProgression',
      'spellsKnownProgression', 'optionalfeatureProgression',
    ],
    fuellen(wb, ent, e) {
      const S = 'Subclass';
      wb.feld(ent, S, 'shortName', e['shortName']);
      if (e['casterProgression']) wb.feld(ent, S, 'casterProgression', FORTSCHRITT[String(e['casterProgression'])]);
      if (e['spellcastingAbility']) wb.feld(ent, S, 'spellAbility', e['spellcastingAbility']);
      const klasse = wb.finde('class', [String(e['className']), String(e['classSource'] ?? 'PHB')]);
      if (klasse) wb.kante(ent, 'subclassOf', klasse.id);
      else wb.ctx.insLeere('class', `${String(e['className'])}|${String(e['classSource'])}`);
      gewaehrt(wb, ent, e['subclassFeatures'], 'subclassFeature');
      zusatzzauber(wb, ent, e['additionalSpells']);
      const f = wb.fluff('subclassFluff', String(e['name']), String(e['source']));
      if (f) wb.lore(ent, wb.text(f['entries']));
    },
  },
  {
    art: 'optionalfeature',
    tag: 'optfeature',
    typ: () => 'Feature',
    name: (e) => String(e['name']),
    genutzt: ['name', 'entries', 'featureType', 'prerequisite', 'consumes', 'additionalSpells', 'isClassFeatureVariant'],
    fuellen(wb, ent, e) {
      const typen = liste(e['featureType']).map((t) => FEATURE_TYPE[String(t)] ?? String(t));
      wb.feld(ent, 'Feature', 'featureType', typen.join(', '));
      const teile: string[] = [];
      if (e['prerequisite']) teile.push(`*Prerequisite: ${voraussetzung(wb, e['prerequisite'])}*`);
      if (e['consumes']) {
        const c = e['consumes'] as Knoten;
        teile.push(`*Consumes: ${String(c['amount'] ?? 1)} ${wb.zeile(String(c['name'] ?? ''))}*`);
      }
      teile.push(wb.text(e['entries']));
      wb.prosa(ent, teile.filter(Boolean).join('\n\n'));
    },
  },
  {
    art: 'race',
    tag: 'race',
    typ: () => 'Ancestry',
    name: (e) => String(e['name']),
    genutzt: GENUTZT_ABSTAMMUNG,
    fuellen: (wb, ent, e) => abstammung(wb, ent, e, 'raceFluff'),
  },
  {
    art: 'subrace',
    tag: 'race',
    typ: (e, wb) => {
      if (!e['name']) {
        wb.notiz('Unterart ohne Namen (Spielart der Abstammung)', 'subrace');
        return undefined;
      }
      return 'Ancestry';
    },
    name: (e) => `${String(e['raceName'])} (${String(e['name'])})`,
    schluessel: (e) => [[`${String(e['raceName'])} (${String(e['name'])})`, e['source']], [`${String(e['name'])} ${String(e['raceName'])}`, e['source']]],
    genutzt: [...GENUTZT_ABSTAMMUNG, 'raceName', 'raceSource', 'overwrite'],
    fuellen(wb, ent, e) {
      abstammung(wb, ent, e, 'raceFluff');
      const volk = wb.finde('race', [String(e['raceName']), String(e['raceSource'] ?? 'PHB')]);
      if (volk && volk.id !== ent.id) wb.kante(ent, 'subraceOf', volk.id);
      else wb.ctx.insLeere('race', String(e['raceName']));
    },
  },
  {
    art: 'background',
    tag: 'background',
    typ: () => 'Background',
    name: (e) => String(e['name']),
    genutzt: [
      'name', 'entries', 'skillProficiencies', 'languageProficiencies', 'toolProficiencies',
      'weaponProficiencies', 'armorProficiencies', 'startingEquipment', 'feats', 'additionalSpells',
    ],
    fuellen(wb, ent, e) {
      uebungen(wb, ent, {
        skill: e['skillProficiencies'], language: e['languageProficiencies'], tool: e['toolProficiencies'],
        weapon: e['weaponProficiencies'], armor: e['armorProficiencies'],
      });
      /* Das Merkmal eines Hintergrunds („Shelter of the Faithful") ist ein
         Merkmal wie jedes andere: ein Artikel, den er gewährt. */
      const rest: unknown[] = [];
      for (const x of liste(e['entries'])) {
        const o = x as Knoten;
        if (o && typeof o === 'object' && (o['data'] as Knoten | undefined)?.['isFeature'] && o['name']) {
          const f = wb.anlegen('Feature', String(o['name']).replace(/^Feature:\s*/, ''), `bgFeature|${ent.id}|${String(o['name'])}`, e);
          wb.feld(f, 'Feature', 'featureType', 'background');
          wb.prosa(f, wb.text(o['entries']));
          wb.kante(ent, 'grants', f.id);
        } else rest.push(x);
      }
      wb.prosa(ent, wb.text(rest));
      wb.feld(ent, 'Background', 'startingEquipment', ausruestung(wb, e['startingEquipment']));
      lore(wb, ent, 'backgroundFluff', e);
    },
  },
  {
    art: 'feat',
    tag: 'feat',
    typ: () => 'Feat',
    name: (e) => String(e['name']),
    genutzt: ['name', 'entries', 'prerequisite', 'repeatable', 'repeatableHidden', 'additionalSpells', 'ability', 'category'],
    fuellen(wb, ent, e) {
      wb.feld(ent, 'Feat', 'prerequisite', e['prerequisite'] ? voraussetzung(wb, e['prerequisite']) : undefined);
      if (e['repeatable']) wb.feld(ent, 'Feat', 'repeatable', true);
      wb.prosa(ent, wb.text(e['entries']));
    },
  },
];

/* Die Abschnitte, die Felder sind und keine Merkmale. */
const KEIN_MERKMAL = /^(age|alignment|size|speed|languages|ability score increase|ability score increases|creature type|subrace|subraces)$/i;

function abstammung(wb: Werkbank, ent: Entity, e: Knoten, fluff: string): void {
  const A = 'Ancestry';
  wb.feld(ent, A, 'size', liste(e['size']).map((s) => GROESSE[String(s)]).filter(Boolean));
  const sp = e['speed'];
  if (typeof sp === 'number') wb.feld(ent, A, 'speed', `${sp} ft.`);
  else if (sp && typeof sp === 'object') {
    wb.feld(ent, A, 'speed', Object.entries(sp as Knoten).filter(([, v]) => typeof v === 'number' || v === true).map(([k, v]) => (k === 'walk' ? `${String(v)} ft.` : `${k} ${v === true ? 'equal to walking speed' : `${String(v)} ft.`}`)).join(', '));
  }
  const bonus: Record<string, number> = {};
  const wahl: string[] = [];
  for (const a of liste(e['ability'])) {
    for (const [k, v] of Object.entries(a as Knoten)) {
      if (ATTR.includes(k) && typeof v === 'number') bonus[k] = v;
      else if (k === 'choose') {
        const c = v as Knoten;
        wahl.push(`choose ${String(c['count'] ?? 1)} from ${liste(c['from']).join(', ')}${c['amount'] ? ` (+${String(c['amount'])})` : ''}`);
      }
    }
  }
  if (Object.keys(bonus).length) wb.feld(ent, A, 'abilityBonus', bonus);
  wb.feld(ent, A, 'abilityNote', wahl.join('; '));
  if (e['lineage']) wb.feld(ent, A, 'abilityNote', [wahl.join('; '), `lineage: ${String(e['lineage'])}`].filter(Boolean).join('; '));
  const alter = e['age'] as Knoten | undefined;
  if (alter) wb.feld(ent, A, 'age', [alter['mature'] ? `mature at ${String(alter['mature'])}` : '', alter['max'] ? `live to about ${String(alter['max'])}` : ''].filter(Boolean).join(', '));
  wb.feld(ent, A, 'darkvision', zahl(e['darkvision']));
  wb.feld(ent, A, 'creatureType', liste(e['creatureTypes']).map(String).join(', '));
  wb.feld(ent, A, 'resistances', liste(e['resist']).filter((r) => typeof r === 'string' && Object.values(SCHADEN).includes(r)));
  uebungen(wb, ent, {
    skill: e['skillProficiencies'], language: e['languageProficiencies'], tool: e['toolProficiencies'],
    weapon: e['weaponProficiencies'], armor: e['armorProficiencies'],
  });
  zusatzzauber(wb, ent, e['additionalSpells']);
  /* Merkmale der Abstammung werden Artikel, die sie gewährt (M3); was ein
     Feld schon sagt (Alter, Grösse, Tempo …), bleibt Text. */
  const rest: unknown[] = [];
  for (const x of liste(e['entries'])) {
    const o = x as Knoten;
    if (o && typeof o === 'object' && o['type'] === 'entries' && typeof o['name'] === 'string' && !KEIN_MERKMAL.test(o['name'])) {
      const f = wb.anlegen('Feature', String(o['name']), `raceFeature|${ent.id}|${String(o['name'])}`, e);
      wb.feld(f, 'Feature', 'featureType', 'ancestry');
      wb.prosa(f, wb.text(o['entries']));
      wb.kante(ent, 'grants', f.id);
    } else rest.push(x);
  }
  wb.prosa(ent, wb.text(rest));
  const f = wb.fluff(fluff, ent.name, String(e['source'])) ?? wb.fluff(fluff, String(e['name']), String(e['source']));
  if (f) wb.lore(ent, wb.text(f['entries']));
}

