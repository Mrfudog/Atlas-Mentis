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

import type { Choice, Entity } from '@nw/model';
import { choiceId, maxSpellLevel, typeChain } from '@nw/model';
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

/**
 * **Eine Wahl an den Artikel hängen** (REQ-238, E-015 a). Die Id kommt aus
 * dem Text (`skills`, `fighting-style-1`), nicht aus einer Zählung — an
 * ihr hängt später die Antwort der Figur.
 */
export function wahl(wb: Werkbank, ent: Entity, text: string, c: Omit<Choice, 'id'>): void {
  const karte = wb.karte(ent, 'Choices');
  const alle = (karte['choices'] as Choice[] | undefined) ?? [];
  const eintrag: Choice = { id: choiceId(text, alle.map((x) => x.id)), ...c };
  /* Leere Angaben stehen nicht in der Karte. */
  for (const k of Object.keys(eintrag) as (keyof Choice)[]) {
    const v = eintrag[k];
    if (v === undefined || v === '' || (Array.isArray(v) && !v.length)) delete eintrag[k];
  }
  karte['choices'] = [...alle, eintrag];
}

type UebungsArt = 'skill' | 'language' | 'weapon' | 'armor' | 'tool';

/* Wie eine Wahl heisst (ihre Id) und woraus sie ohne Liste zieht. */
const WAHL_NAME: Record<UebungsArt, string> = { skill: 'skills', language: 'languages', weapon: 'weapons', armor: 'armor', tool: 'tools' };
const WAHL_LISTE: Record<UebungsArt, string[]> = { skill: ['Skill'], language: ['Language'], weapon: ['Weapon', 'Weapon.category'], armor: ['Armor.armorType'], tool: ['Item'] };

/**
 * Übungen aus den Listen von 5e.tools: was fest ist, steht in
 * `Proficiencies`, was zur Wahl steht, wird eine Wahl (REQ-238) — auch
 * „any 3" und „anyStandard 2", die keine Liste haben; dann sagt `note`,
 * was gemeint ist. `when` sagt bei einer Klasse, ob die Wahl nur für die
 * erste Klasse oder nur beim Mehrklassen-Einstieg gilt.
 */
export function uebungen(
  wb: Werkbank,
  ent: Entity,
  quellen: Partial<Record<UebungsArt, unknown>>,
  feld = 'proficient',
  when?: Choice['when'],
): void {
  const fest: string[] = [];
  const notizen: string[] = [];
  const praefix = when === 'multiclass' ? 'multiclass ' : '';
  for (const [art, roh] of Object.entries(quellen) as [UebungsArt, unknown][]) {
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
          const roheWerte = liste(c['from']).filter((x): x is string => typeof x === 'string');
          const von = roheWerte.map((x) => uebungsName(wb, art, x)).filter((x): x is string => !!x);
          const fehlt = roheWerte.filter((x) => !uebungsName(wb, art, x));
          if (fehlt.length) wb.notiz('Wahl mit Werten ohne Artikel (als Notiz an der Wahl)');
          wahl(wb, ent, `${praefix}${WAHL_NAME[art]}`, {
            kind: 'proficiency',
            when,
            count: Number(c['count'] ?? 1),
            from: von.length ? { values: von } : { enumRef: WAHL_LISTE[art] },
            note: fehlt.length ? `also: ${fehlt.map((x) => wb.zeile(x)).join(', ')}` : undefined,
          });
        } else if (v === true) {
          const n = uebungsName(wb, art, k);
          if (n) fest.push(n);
          else notizen.push(titel(k));
        } else if (typeof v === 'number') {
          /* `anyStandard: 2`, `any: 1` — eine Wahl ohne Liste. */
          wahl(wb, ent, `${praefix}${WAHL_NAME[art]}`, {
            kind: 'proficiency',
            when,
            count: v,
            from: { enumRef: WAHL_LISTE[art] },
            note: `${v} ${k.replace(/([A-Z])/g, ' $1').toLowerCase()} ${art === 'tool' ? 'tool' : art}${v === 1 ? '' : 's'} of your choice`,
          });
        }
      }
    }
  }
  /* Ein Talent führt keine festen Übungen (`Proficiencies` gehört ihm
     nicht); was es fest gibt, steht in seinem Text. */
  if (!typeChain(wb.registry, ent.interfaces[0] ?? '').includes('Proficiencies')) {
    if (fest.length || notizen.length) wb.notiz('feste Übung eines Talents (im Text belassen)');
    return;
  }
  const P = 'Proficiencies';
  const alt = (wb.karte(ent, P)[feld] as string[] | undefined) ?? [];
  const neu = [...new Set([...alt, ...fest])];
  if (neu.length) wb.karte(ent, P)[feld] = neu;
  else if (!Object.keys(wb.karte(ent, P)).length) delete ent.components[P];
  /* Was weder Name noch Wahl ist („one type of artisan's tools" als
     Wort), bleibt als freie Wahl mit Notiz stehen. */
  if (notizen.length) wahl(wb, ent, `${praefix}other proficiencies`, { kind: 'proficiency', when, note: notizen.join('; ') });
  if (ent.components['Choices'] && !Object.keys(ent.components['Choices']).length) delete ent.components['Choices'];
}

/**
 * **Attributsboni**: `{dex: 2}` ist fest, `choose` eine Wahl — mit
 * `amount` (+1 je Wahl) oder `weighted` (+2 auf eines, +1 auf ein
 * anderes). Mehrere Blöcke sind bei 5e.tools **Alternativen** (+2/+1 oder
 * +1/+1/+1); die erste wird die Wahl, die übrigen stehen als Satz in
 * `note` und im Bericht.
 */
function attributsWahl(wb: Werkbank, ent: Entity, roh: unknown): Record<string, number> {
  const fest: Record<string, number> = {};
  const bloecke = liste(roh) as Knoten[];
  const satz = (b: Knoten): string => {
    const c = (b['choose'] as Knoten | undefined) ?? {};
    const w = c['weighted'] as Knoten | undefined;
    const von = liste(w?.['from'] ?? c['from']).map(String).join(', ');
    return w ? `${liste(w['weights']).map((x) => `+${String(x)}`).join('/')} from ${von}` : `+${String(c['amount'] ?? 1)} to ${String(c['count'] ?? 1)} from ${von}`;
  };
  bloecke.forEach((b, i) => {
    for (const [k, v] of Object.entries(b ?? {})) {
      if (ATTR.includes(k) && typeof v === 'number') {
        if (i === 0) fest[k] = v;
      } else if (k === 'choose' && i === 0) {
        const c = v as Knoten;
        const w = c['weighted'] as Knoten | undefined;
        const von = liste(w?.['from'] ?? c['from']).map(String).filter((a) => ATTR.includes(a));
        const bonus = w ? liste(w['weights']).map(Number) : Array.from({ length: Number(c['count'] ?? 1) }, () => Number(c['amount'] ?? 1));
        const anders = bloecke.slice(1).filter((x) => x && x['choose']).map(satz);
        if (anders.length) wb.notiz('Attributswahl mit Alternativen (erste als Wahl, Rest als Notiz)');
        wahl(wb, ent, 'ability scores', {
          kind: 'ability',
          count: bonus.length,
          bonus,
          from: { values: von.length ? von : [...ATTR] },
          note: anders.length ? `or instead: ${anders.join('; ')}` : undefined,
        });
      }
    }
  });
  return fest;
}

/* Die Talentkategorien von 5e.tools als Marken: woraus eine Wahl zieht. */
const TALENT_KATEGORIE: Record<string, string> = { G: 'general', O: 'origin', FS: 'fighting style', 'FS:P': 'fighting style', 'FS:R': 'fighting style', EB: 'epic boon' };

/**
 * **Talente einer Abstammung oder eines Hintergrunds**: `{"alert|xphb":
 * true}` ist fest (eine Kante `grants`), `any` und `anyFromCategory`
 * sind Wahlen. Mehrere Blöcke sind Alternativen; die erste gilt, die
 * übrigen stehen im Bericht.
 */
function talente(wb: Werkbank, ent: Entity, roh: unknown): void {
  const bloecke = liste(roh) as Knoten[];
  if (bloecke.length > 1) wb.notiz('Talente mit Alternativen (erste übernommen)');
  const b = bloecke[0];
  if (!b) return;
  for (const [k, v] of Object.entries(b)) {
    if (k === 'any' && typeof v === 'number') {
      wahl(wb, ent, 'feat', { kind: 'feat', count: v, from: { interfaces: ['Feat'] } });
    } else if (k === 'anyFromCategory') {
      const c = v as Knoten;
      const marken = [...new Set(liste(c['category']).map((x) => TALENT_KATEGORIE[String(x)]).filter((x): x is string => !!x))];
      wahl(wb, ent, `${marken[0] ?? 'feat'} feat`, { kind: 'feat', count: Number(c['count'] ?? 1), from: { interfaces: ['Feat'], tags: marken } });
    } else if (v === true) {
      const [n = '', q = ''] = k.split('|');
      const ziel = wb.finde('feat', [n, q.toUpperCase()]);
      if (ziel) wb.kante(ent, 'grants', ziel.id);
      else wb.ctx.insLeere('feat', k);
    } else wb.notiz(`Talentangabe ${k} (nicht abgebildet)`);
  }
}

/**
 * **Fortschritte einer Klasse** (`featProgression`,
 * `optionalfeatureProgression`): wie viele Talente oder Zusatzmerkmale
 * man auf welcher Stufe **insgesamt** hat — als Liste je Stufe oder als
 * `{"3": 3, "7": 5}`. Daraus wird je Stufe, auf der es mehr werden, eine
 * Wahl mit dem Zuwachs.
 */
function fortschritt(wb: Werkbank, ent: Entity, roh: unknown, art: 'feat' | 'feature'): void {
  for (const p of liste(roh)) {
    const o = p as Knoten;
    const name = String(o['name'] ?? (art === 'feat' ? 'Feat' : 'Feature'));
    const prog = o['progression'];
    const stufen: [number, number][] = Array.isArray(prog)
      ? prog.map((n, i) => [i + 1, Number(n)] as [number, number])
      : Object.entries((prog as Knoten | undefined) ?? {}).map(([l, n]) => [Number(l), Number(n)] as [number, number]).sort((a, b) => a[0] - b[0]);
    let bisher = 0;
    for (const [stufe, gesamt] of stufen) {
      if (!Number.isFinite(gesamt) || gesamt <= bisher || stufe < 1 || stufe > 20) continue;
      const from =
        art === 'feat'
          ? { interfaces: ['Feat'], tags: [...new Set(liste(o['category']).map((x) => TALENT_KATEGORIE[String(x)]).filter((x): x is string => !!x))] }
          : {
              interfaces: ['Feature'],
              where: { component: 'Feature', property: 'featureType', value: liste(o['featureType']).map((t) => FEATURE_TYPE[String(t)] ?? String(t)).join(', ') },
            };
      if (!from.tags?.length) delete from.tags;
      wahl(wb, ent, `${name} ${stufe}`, { kind: art, level: stufe, count: gesamt - bisher, from, note: name });
      bisher = gesamt;
    }
  }
}

/**
 * **Ausrüstung (a) oder (b)** als Wahlen: je Block mit Buchstaben eine
 * Wahl, deren Möglichkeiten die Buchstaben sind. **Das Feste** (`_`) ist
 * eine Wahl mit genau einer Möglichkeit — sie beantwortet sich selbst
 * (`fixedPicks`) und landet so wie eine gewählte Variante im Inventar
 * (T-096). Jede Möglichkeit nennt ihre Stücke (`items`, Nummern wie die
 * Verweise im Text) und ihr Geld (`gold`, gp), damit niemand den Text
 * lesen muss; der Text bleibt die Beschriftung.
 */
function ausruestungsWahl(wb: Werkbank, ent: Entity, roh: unknown, when?: Choice['when']): void {
  const moeglichkeit = (key: string, teile: unknown) => {
    const xs = liste(teile);
    const inhalt = xs.map((x) => stueckDaten(wb, x));
    const items = inhalt.flatMap((i) => (i.item ? [{ id: i.item, qty: i.qty }] : []));
    const gold = inhalt.reduce((n, i) => n + i.gp, 0);
    return {
      key,
      label: xs.map((x) => stueck(wb, x)).filter(Boolean).join(', '),
      ...(items.length ? { items } : {}),
      ...(gold ? { gold } : {}),
    };
  };
  for (const block of liste(roh)) {
    const b = (block as Knoten) ?? {};
    if (b['_']) wahl(wb, ent, 'equipment-fixed', { kind: 'equipment', when, from: { options: [moeglichkeit('fixed', b['_'])] } });
    const keys = Object.keys(b).filter((k) => k !== '_').sort();
    if (keys.length < 2) continue;
    wahl(wb, ent, 'equipment', {
      kind: 'equipment',
      when,
      from: { options: keys.map((k) => moeglichkeit(k.toLowerCase(), b[k])) },
    });
  }
}

/** Ein Stück Ausrüstung als Daten: der Gegenstand (Nummer), wie viele, und Geld in gp. */
function stueckDaten(wb: Werkbank, x: unknown): { item?: string; qty: number; gp: number } {
  const finde = (ref: string): string | undefined => {
    const [n = '', q = ''] = ref.split('|');
    const e = wb.finde('item', [n, q.toUpperCase()]);
    return e ? String((e.components['Identity'] as { id?: unknown } | undefined)?.id ?? '') || undefined : undefined;
  };
  if (typeof x === 'string') return { item: finde(x), qty: 1, gp: 0 };
  const o = (x as Knoten) ?? {};
  const qty = Math.max(1, Number(o['quantity']) || 1);
  if (o['item']) return { item: finde(String(o['item'])), qty, gp: Number(o['containsValue'] ?? 0) / 100 };
  if (o['value'] !== undefined) return { qty: 1, gp: Number(o['value']) / 100 };
  return { qty: 1, gp: 0 };
}

/** Ein Stück Ausrüstung als Text. */
function stueck(wb: Werkbank, x: unknown): string {
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
  if (o['equipmentType']) return sorteAlsSatz(String(o['equipmentType']), Number(o['quantity']) || 1);
  return '';
}

/* Die Sorten von 5e.tools als gesprochene Wörter (Einzahl, Mehrzahl). */
const SORTE: Record<string, [string, string]> = {
  weaponSimple: ['simple weapon', 'simple weapons'],
  weaponMartial: ['martial weapon', 'martial weapons'],
  weaponSimpleMelee: ['simple melee weapon', 'simple melee weapons'],
  weaponMartialMelee: ['martial melee weapon', 'martial melee weapons'],
  weaponSimpleRanged: ['simple ranged weapon', 'simple ranged weapons'],
  weaponMartialRanged: ['martial ranged weapon', 'martial ranged weapons'],
  toolArtisan: ["artisan's tools", "artisan's tools"],
  instrumentMusical: ['musical instrument', 'musical instruments'],
  setGaming: ['gaming set', 'gaming sets'],
  focusSpellcastingArcane: ['arcane focus', 'arcane foci'],
  focusSpellcastingDruidic: ['druidic focus', 'druidic foci'],
  focusSpellcastingHoly: ['holy focus', 'holy foci'],
};
const ZAHLWORT = ['', 'one', 'two', 'three', 'four', 'five', 'six'];

/**
 * **Eine offene Stelle als Satz** (T-162): „two martial weapons of your
 * choice". Vorher stand hier „one weapon martial of your choice" — die
 * Menge ging verloren (der Kämpfer bekam eine Kriegswaffe statt zwei), und
 * die Wortstellung war die des Schlüssels. Der Assistent liest den Satz
 * (`itemSlotIn`) und bietet eine Auswahl an.
 */
function sorteAlsSatz(typ: string, menge: number): string {
  const [eins, viele] = SORTE[typ] ?? [typ.replace(/([A-Z])/g, ' $1').toLowerCase().trim(), ''];
  const wort = menge > 1 ? (viele || eins) : eins;
  return `${ZAHLWORT[menge] ?? String(menge)} ${wort} of your choice`;
}

/** Die Startausrüstung eines Hintergrunds: was fest ist, und die Wahl a/b. */
function ausruestung(wb: Werkbank, roh: unknown): string {
  const zeilen: string[] = [];
  for (const block of liste(roh)) {
    const b = block as Knoten;
    if (b['_']) zeilen.push(`- ${liste(b['_']).map((x) => stueck(wb, x)).filter(Boolean).join(', ')}`);
    const wahl = Object.keys(b).filter((k) => k !== '_').sort();
    if (wahl.length) zeilen.push(`- ${wahl.map((k) => `(${k}) ${liste(b[k]).map((x) => stueck(wb, x)).filter(Boolean).join(', ')}`).join(' or ')}`);
  }
  return zeilen.join('\n');
}

/**
 * `{choose: {from: [...]}}`-Zauberlisten (`additionalSpells`) als `casts`.
 *
 * `nurWenn`: der Block ist eine von mehreren Möglichkeiten (Magic Initiate:
 * Barden- oder Klerikerzauber …). Dann wird nichts fest angelegt — eine
 * Kante gilt immer —, sondern jede Wahl hängt an der Möglichkeit, und die
 * festen Zauber werden eine Wahl mit Vorgabe (T-089).
 */
function zusatzzauber(wb: Werkbank, ent: Entity, roh: unknown, nurWenn?: { choice: string; pick: string }): void {
  for (const block of liste(roh)) {
    const fest: string[] = [];
    const b = block as Knoten;
    /* Mit welchem Attribut (T-309): `ability: "cha"`; eine Wahl
       (`{choose: [...]}`) bleibt offen — dann gilt das der Quelle. */
    const attr = typeof b['ability'] === 'string' && ATTR.includes(b['ability']) ? b['ability'] : undefined;
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
            /* `{choose: "level=0|class=Wizard", count: 1}` ist eine Wahl
               (REQ-238); der Filter steht als Satz in `note`. */
            const c = (s as Knoten | null)?.['choose'];
            if (typeof c === 'string') {
              /* Der Filter als Angabe, wo er sich lesen lässt (T-309): `level=0`
                 wird der Grad, `class=Wizard` die Zauberliste der Klasse, wenn
                 sie schon bekannt ist. Der Satz bleibt in `note`. */
              const teile = Object.fromEntries(c.split('|').map((t) => t.split('=') as [string, string]));
              const grade = /^[0-9;]+$/.test(teile['level'] ?? '') ? teile['level']!.split(';').map(Number) : undefined;
              const klasse = teile['class'] && !teile['class'].includes(';') ? wb.finde('class', [teile['class']]) : undefined;
              wahl(wb, ent, 'spells', {
                kind: 'spell',
                level: ab && ab >= 1 && ab <= 20 ? ab : undefined,
                count: Number((s as Knoten)['count'] ?? 1),
                ability: attr,
                from: {
                  interfaces: ['Spell'],
                  ...(klasse ? { listedBy: { type: 'spellList', from: klasse.id } } : {}),
                  ...(grade ? { where: { component: 'Spell', property: 'level', value: grade } } : {}),
                },
                ...(nurWenn ? { onlyIf: nurWenn } : {}),
                note: [c.split('|').map((t) => t.replace('=', ' ').replace(/;/g, ' or ')).join(', '), uses].filter(Boolean).join(' · '),
              });
            } else if (c && typeof c === 'object' && Array.isArray((c as Knoten)['from'])) {
              /* `{choose: {from: ["hex", …], count: 2}}`: eine Wahl aus genannten Zaubern. */
              const ziele = liste((c as Knoten)['from']).map((x) => wb.finde('spell', String(x).replace(/#c$/, '').split('|')));
              wahl(wb, ent, 'spells', {
                kind: 'spell',
                count: Number((c as Knoten)['count'] ?? 1),
                ability: attr,
                from: { interfaces: ['Spell'] },
                ...(nurWenn ? { onlyIf: nurWenn } : {}),
                note: [`one of ${liste((c as Knoten)['from']).map(String).join(', ')}`, uses].filter(Boolean).join(' · '),
              });
              for (const [i, z] of ziele.entries()) if (!z) wb.ctx.insLeere('spell', String(liste((c as Knoten)['from'])[i]));
            } else wb.notiz('Zauber ohne Wahl und ohne Namen (als Text belassen)');
            continue;
          }
          const [n = '', q = ''] = s.replace(/#c$/, '').split('|');
          const ziel = wb.finde('spell', [n, q]);
          if (!ziel) {
            wb.ctx.insLeere('spell', s);
            continue;
          }
          if (nurWenn) {
            fest.push(ziel.id);
            continue;
          }
          const props: Record<string, unknown> = { mode: modus === 'expanded' ? 'known' : modus };
          if (attr) props['ability'] = attr;
          if (uses) props['uses'] = uses;
          if (ab && ab >= 1 && ab <= 20) props['fromLevel'] = ab;
          wb.kante(ent, 'casts', ziel.id, props);
        }
      }
    }
    if (nurWenn && fest.length) {
      wahl(wb, ent, 'spells', { kind: 'spell', count: fest.length, from: { interfaces: ['Spell'] }, default: fest, onlyIf: nurWenn, ability: attr, note: 'given with this option' });
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

/**
 * Die Stufentabelle einer Klasse als `Table` mit `tableFor` (M8) — und
 * dieselbe für eine Unterklasse, wo sie eigene Spalten bringt
 * (`subclassTableGroups`: Eldritch Knight, Arcane Trickster). Die
 * Klassenansicht hängt diese Spalten an die Tabelle der Klasse, sobald die
 * Unterklasse gewählt ist, wie 5e.tools es tut.
 */
function klassentabelle(wb: Werkbank, klasse: Entity, e: Knoten, feld: 'classTableGroups' | 'subclassTableGroups' = 'classTableGroups'): void {
  const gruppen = liste(e[feld]) as Knoten[];
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
  const t = wb.anlegen('Table', `${klasse.name} Table`, `${feld === 'classTableGroups' ? 'classTable' : 'subclassTable'}|${klasse.id}`, e);
  wb.feld(t, 'Table', 'kind', 'generic');
  wb.feld(t, 'Table', 'columns', spalten);
  wb.feld(t, 'Table', 'rows', zeilen.map((z) => ({ cells: z, text: z.slice(1).join(' · ') })));
  wb.kante(klasse, 'tableFor', t.id);
}

const FORTSCHRITT: Record<string, string> = { full: 'full', '1/2': 'half', '1/3': 'third', pact: 'pact', artificer: 'artificer' };

/**
 * **Welche Zauber eine Klasse wählen lässt** (T-309): aus
 * `cantripProgression` (Zaubertricks), `spellsKnownProgression` (bekannte
 * Zauber, Barde, Hexenmeister …), `spellsKnownProgressionFixed` (was je
 * Stufe dazukommt — das Zauberbuch des Magiers) und, ohne Buch,
 * `preparedSpellsProgression` (2024: vorbereitete Zauber). Je Stufe, auf
 * der die Zahl wächst, eine Wahl `kind: 'spell'` mit dem Zuwachs, aus der
 * Zauberliste dieses Artikels (`listedBy`, `spellList`) und bis zu dem
 * Grad, den die Klasse dort wirkt. Ein `preparedSpells`-Satz (2014: Stufe
 * + Attribut) ist keine Wahl beim Bau — vorbereitet wird am Tisch.
 *
 * Rein: der Lauf und `scripts/zauberwahl-nachziehen.mjs` rechnen dasselbe.
 */
export function zauberwahlen(e: Knoten, id: string, taken: Iterable<string> = []): Choice[] {
  const prog = FORTSCHRITT[String(e['casterProgression'] ?? '')];
  const ab = typeof e['spellcastingAbility'] === 'string' && ATTR.includes(e['spellcastingAbility']) ? e['spellcastingAbility'] : undefined;
  const ids = [...taken];
  const raus: Choice[] = [];
  const zahlen = (v: unknown): number[] => (Array.isArray(v) ? v.map((x) => Number(x) || 0) : []);
  /* Was eine Stufe gibt, auf der die Klasse noch nichts wirkt, wandert zur ersten, auf der sie es tut. */
  let offen = 0;
  const neu = (text: string, stufe: number, zuwachs: number, grade: number[], mode: 'known' | 'prepared', note: string) => {
    if (stufe === 1) offen = 0;
    if (!grade.length) {
      offen += Math.max(0, zuwachs);
      return;
    }
    const count = zuwachs + offen;
    offen = 0;
    if (count <= 0) return;
    const c: Choice = {
      id: choiceId(text, ids),
      kind: 'spell',
      ...(stufe > 1 ? { level: stufe } : {}),
      count,
      mode,
      ...(ab ? { ability: ab } : {}),
      from: {
        interfaces: ['Spell'],
        listedBy: { type: 'spellList', from: id },
        where: { component: 'Spell', property: 'level', value: grade },
      },
      note,
    };
    ids.push(c.id);
    raus.push(c);
  };
  /* Aus einer Summe je Stufe (3, 3, 3, 4 …) der Zuwachs je Stufe. */
  const zuwachs = (summen: number[]) => summen.map((n, i) => n - (i ? summen[i - 1]! : 0));
  const bis = (stufe: number) => Array.from({ length: Math.max(0, maxSpellLevel(prog, stufe)) }, (_, i) => i + 1);
  zuwachs(zahlen(e['cantripProgression'])).forEach((n, i) => neu('cantrips', i + 1, n, [0], 'known', 'cantrips'));
  const fest = zahlen(e['spellsKnownProgressionFixed']);
  if (fest.length) fest.forEach((n, i) => neu('spellbook', i + 1, n, bis(i + 1), 'known', 'spells for your spellbook'));
  else if (Array.isArray(e['spellsKnownProgression'])) zuwachs(zahlen(e['spellsKnownProgression'])).forEach((n, i) => neu('spells', i + 1, n, bis(i + 1), 'known', 'spells known'));
  else if (Array.isArray(e['preparedSpellsProgression'])) zuwachs(zahlen(e['preparedSpellsProgression'])).forEach((n, i) => neu('prepared', i + 1, n, bis(i + 1), 'prepared', 'prepared spells'));
  return raus;
}

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

/**
 * **Die Attributssteigerung fragt selbst** (T-107, E-027): +2 auf ein
 * Attribut oder +1 auf zwei (dasselbe zweimal heisst +2), wahlweise ein
 * Talent. Bei 5e.tools (2014) ist sie Text; die Wahl steht am Merkmal, und
 * weil die Klasse es auf mehreren Stufen gewährt, antwortet die Figur je
 * Stufe (`chose` mit `props.by`/`props.level`). Die 2024er-Klassen
 * bringen das Talent je Stufe schon mit (`featProgression`) — ihr Merkmal
 * sagt nichts von „by 2" und bekommt keine Wahl. Migration 042 schreibt
 * dieselben Einträge an die vorhandenen Merkmale.
 */
export const ASI_WAHLEN: Choice[] = [
  {
    id: 'improvement',
    kind: 'option',
    from: { options: [{ key: 'asi', label: 'Increase ability scores' }, { key: 'feat', label: 'Take a feat instead' }] },
    default: ['asi'],
    note: 'Ability Score Improvement',
  },
  {
    id: 'ability-scores',
    kind: 'ability',
    count: 2,
    bonus: [1, 1],
    repeat: true,
    from: { values: [...ATTR] },
    onlyIf: { choice: 'improvement', pick: 'asi' },
    note: '+2 to one ability score or +1 to two',
  },
  { id: 'feat', kind: 'feat', count: 1, from: { interfaces: ['Feat'] }, onlyIf: { choice: 'improvement', pick: 'feat' }, note: 'Feat' },
];

/** Eine Attributssteigerung nach 2014: „increase one ability score of your choice by 2". */
const ASI_TEXT = /increase one ability score of your choice by 2/i;

const merkmal = (art: 'classFeature' | 'subclassFeature'): Zuordnung => ({
  art,
  tag: art,
  typ: () => 'Feature',
  name: (e) => String(e['name']),
  /* Mit Klassen- und Unterklassenquelle zuerst (T-087): derselbe Name,
     dieselbe Klasse und Stufe stehen 2014 und 2024 da. */
  schluessel: (e) =>
    art === 'classFeature'
      ? [[e['name'], e['className'], e['classSource'] ?? 'PHB', e['level']], [e['name'], e['className'], e['level']]]
      : [
          [e['name'], e['className'], e['classSource'] ?? 'PHB', e['subclassShortName'], e['subclassSource'] ?? 'PHB', e['level']],
          [e['name'], e['className'], e['subclassShortName'], e['level']],
        ],
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
    if (ASI_TEXT.test(text) && !wb.karte(ent, 'Choices')['choices']) wb.karte(ent, 'Choices')['choices'] = structuredClone(ASI_WAHLEN);
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
      uebungen(wb, ent, { armor: prof['armor'], weapon: prof['weapons'], tool: prof['tools'], skill: prof['skills'] }, 'proficient', 'start');
      wb.feld(ent, 'Proficiencies', 'saves', liste(e['proficiency']).map(String).filter((a) => ATTR.includes(a)));
      const ausr = (e['startingEquipment'] as Knoten | undefined) ?? {};
      const ausrText = [
        liste(ausr['default']).map((x) => `- ${wb.zeile(x)}`).join('\n'),
        ausr['goldAlternative'] ? `Alternatively, ${wb.zeile(ausr['goldAlternative'])} gp to buy your own equipment.` : '',
      ].filter(Boolean).join('\n\n');
      wb.feld(ent, C, 'startingEquipment', ausrText);
      /* Das Startgold als Ausdruck (T-096): `{@dice 5d4 × 10|…}` → `5d4×10`. */
      const gold = /\{@dice\s+([^|}]+)/.exec(String(ausr['goldAlternative'] ?? ''))?.[1] ?? String(ausr['goldAlternative'] ?? '');
      if (gold.trim()) wb.feld(ent, C, 'startingGold', gold.replace(/\s+/g, '').replace(/x/gi, '×'));
      ausruestungsWahl(wb, ent, ausr['defaultData'], 'start');
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
      /* 2024 nennt keine `requirements`: dann gilt 13 im Hauptattribut
         (T-319) — eine Liste von Möglichkeiten, je Möglichkeit alle Werte. */
      wb.feld(ent, C, 'multiclassRequirement', reqText(req) || hauptVoraussetzung(e['primaryAbility']));
      const mp = (mc['proficienciesGained'] as Knoten | undefined) ?? {};
      uebungen(wb, ent, { armor: mp['armor'], weapon: mp['weapons'], tool: mp['tools'], skill: mp['skills'] }, 'multiclassProficient', 'multiclass');
      if (ent.components['Proficiencies']?.['multiclassProficient']) {
        wb.feld(ent, C, 'multiclassProficient', ent.components['Proficiencies']['multiclassProficient']);
        delete ent.components['Proficiencies']['multiclassProficient'];
      }
      wb.feld(ent, C, 'subclassTitle', e['subclassTitle']);
      if (e['casterProgression']) wb.feld(ent, C, 'casterProgression', FORTSCHRITT[String(e['casterProgression'])]);
      if (e['spellcastingAbility']) wb.feld(ent, C, 'spellAbility', e['spellcastingAbility']);
      if (e['isSidekick']) wb.marke(ent, 'sidekick');
      gewaehrt(wb, ent, e['classFeatures'], 'classFeature');
      /* Auf welcher Stufe die Unterklasse gewählt wird: das Merkmal mit
         `gainSubclassFeature` (Martial Archetype, 3). */
      for (const f of liste(e['classFeatures'])) {
        const o = f as Knoten;
        if (typeof f !== 'object' || !o['gainSubclassFeature']) continue;
        const stufe = Number(String(o['classFeature'] ?? '').split('|')[3]);
        wahl(wb, ent, String(e['subclassTitle'] ?? 'subclass'), {
          kind: 'subclass',
          level: Number.isInteger(stufe) && stufe >= 1 && stufe <= 20 ? stufe : undefined,
          from: { interfaces: ['Subclass'], edge: { type: 'subclassOf', to: ent.id } },
        });
        break;
      }
      fortschritt(wb, ent, e['featProgression'], 'feat');
      fortschritt(wb, ent, e['optionalfeatureProgression'], 'feature');
      zauberwahlenAnhaengen(wb, ent, e);
      klassentabelle(wb, ent, e);
      lore(wb, ent, 'classFluff', e);
    },
  },
  {
    art: 'subclass',
    tag: 'subclass',
    typ: () => 'Subclass',
    name: (e) => String(e['name']),
    schluessel: (e) => [
      [e['name'], e['className'], e['classSource'] ?? 'PHB', e['source']],
      [e['shortName'], e['className'], e['classSource'] ?? 'PHB', e['source']],
      [e['name'], e['className']],
      [e['shortName'], e['className']],
    ],
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
      fortschritt(wb, ent, e['optionalfeatureProgression'], 'feature');
      klassentabelle(wb, ent, e, 'subclassTableGroups');
      zusatzzauber(wb, ent, e['additionalSpells']);
      /* Eldritch Knight, Arcane Trickster: die Unterklasse zaubert (T-309). */
      zauberwahlenAnhaengen(wb, ent, e);
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
      'weaponProficiencies', 'armorProficiencies', 'startingEquipment', 'feats', 'additionalSpells', 'ability',
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
      ausruestungsWahl(wb, ent, e['startingEquipment']);
      const fest = attributsWahl(wb, ent, e['ability']);
      if (Object.keys(fest).length) wb.notiz('fester Attributsbonus eines Hintergrunds (nicht abgebildet)');
      talente(wb, ent, e['feats']);
      lore(wb, ent, 'backgroundFluff', e);
    },
  },
  {
    art: 'feat',
    tag: 'feat',
    typ: () => 'Feat',
    name: (e) => String(e['name']),
    genutzt: [
      'name', 'entries', 'prerequisite', 'repeatable', 'repeatableHidden', 'additionalSpells', 'ability', 'category',
      'skillProficiencies', 'toolProficiencies', 'languageProficiencies', 'weaponProficiencies', 'armorProficiencies',
    ],
    fuellen(wb, ent, e) {
      wb.feld(ent, 'Feat', 'prerequisite', e['prerequisite'] ? voraussetzung(wb, e['prerequisite']) : undefined);
      if (e['repeatable']) wb.feld(ent, 'Feat', 'repeatable', true);
      /* Die Kategorie wird eine Marke: daraus zieht eine Wahl „ein
         Origin-Talent" (REQ-238). */
      wb.marke(ent, ...liste(e['category']).map((c) => TALENT_KATEGORIE[String(c)]));
      /* Ein fester Bonus (+1 Con) ist eine Wahl ohne Spielraum: sie
         beantwortet sich selbst (`fixedPicks`). */
      const fest = attributsWahl(wb, ent, e['ability']);
      for (const [a, n] of Object.entries(fest)) wahl(wb, ent, `${a} increase`, { kind: 'ability', count: 1, bonus: [n], from: { values: [a] } });
      uebungen(wb, ent, {
        skill: e['skillProficiencies'], language: e['languageProficiencies'], tool: e['toolProficiencies'],
        weapon: e['weaponProficiencies'], armor: e['armorProficiencies'],
      });
      talentZauber(wb, ent, e['additionalSpells']);
      wb.prosa(ent, wb.text(e['entries']));
    },
  },
];

/**
 * **Die Zauber eines Talents** (T-089): stand bis 14.10. in `genutzt` und
 * wurde doch nie gelesen — Drow High Magic trug seine drei Zauber nur im
 * Text. Ein Block wie bei einer Abstammung (`casts`); mehrere Blöcke sind
 * Möglichkeiten (Magic Initiate: je Klasse eine Liste), also erst eine Wahl
 * `option` und dahinter die Zauberwahlen dieser Möglichkeit.
 */
function talentZauber(wb: Werkbank, ent: Entity, roh: unknown): void {
  const bloecke = liste(roh) as Knoten[];
  if (bloecke.length <= 1) {
    zusatzzauber(wb, ent, roh);
    return;
  }
  const options = bloecke.map((b, i) => {
    const label = typeof b['name'] === 'string' ? b['name'] : `Option ${i + 1}`;
    return { key: label.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || `option-${i + 1}`, label };
  });
  wahl(wb, ent, 'spell list', { kind: 'option', count: 1, from: { options } });
  const ids = ((wb.karte(ent, 'Choices')['choices'] as Choice[] | undefined) ?? []).map((c) => c.id);
  const choice = ids[ids.length - 1]!;
  for (const [i, b] of bloecke.entries()) zusatzzauber(wb, ent, b, { choice, pick: options[i]!.key });
}

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
  const bonus = attributsWahl(wb, ent, e['ability']);
  if (Object.keys(bonus).length) wb.feld(ent, A, 'abilityBonus', bonus);
  if (e['lineage']) wb.feld(ent, A, 'abilityNote', `lineage: ${String(e['lineage'])}`);
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
  talente(wb, ent, e['feats']);
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


/** Die Zauberwahlen an die Karte `Choices` hängen (T-309). */
function zauberwahlenAnhaengen(wb: Werkbank, ent: Entity, e: Knoten): void {
  const karte = wb.karte(ent, 'Choices');
  const alle = (karte['choices'] as Choice[] | undefined) ?? [];
  const dazu = zauberwahlen(e, ent.id, alle.map((c) => c.id));
  if (dazu.length) karte['choices'] = [...alle, ...dazu];
}

/**
 * **Die Mehrklassen-Voraussetzung aus dem Hauptattribut** (T-319, Regeln
 * 2024): `[{str: true}, {dex: true}]` heisst eines davon („STR 13 or
 * DEX 13"), `[{str: true, cha: true}]` beides („STR 13, CHA 13").
 */
export function hauptVoraussetzung(roh: unknown): string {
  const wege = liste(roh)
    .map((x) => Object.keys((x ?? {}) as Knoten).filter((a) => ATTR.includes(a)))
    .filter((w) => w.length);
  if (!wege.length) return '';
  if (wege.length === 1) return wege[0]!.map((a) => `${a.toUpperCase()} 13`).join(', ');
  return wege.map((w) => w.map((a) => `${a.toUpperCase()} 13`).join(' and ')).join(' or ');
}
