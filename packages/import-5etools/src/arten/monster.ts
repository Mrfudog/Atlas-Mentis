/**
 * **Statblöcke** (Abgleich §4.2, Schritt 11; M5): Monster und Objekte.
 *
 * Ein Monster aus dem Buch ist bei uns der Zahlenblock, aus dem Figuren
 * ihre Instanzen lesen (D82). Seine Aktionen und Merkmale sind eigene
 * `Action`- und `Feature`-Artikel über `composedOf` (Arbeitsplan §2.5):
 * dieselbe Aktionsart, dieselben Angriffsfelder, mit denen die Initiative
 * rechnen kann statt Text zu lesen.
 *
 * **Gleichlautende Merkmale gibt es einmal.** „Pack Tactics" steht bei
 * fünfzig Monstern und sagt jedes Mal dasselbe, nur mit einem anderen
 * Namen darin („The wolf has advantage …"). Der Importer schreibt den
 * Namen samt Artikel als `{CREATURE}` („{CREATURE} has advantage …") und
 * legt die Bindung an die Kante (`composedOf.props.vars`, „the wolf") —
 * die Vorlage bleibt die Vorlage (REQ-174, W1).
 */

import type { Entity } from '@nw/model';
import type { Knoten } from '../copy.js';
import { profAusCr } from '../copy.js';
import { inline, OHNE, zauberwirken } from '../text.js';
import type { Werkbank } from '../werkbank.js';
import type { Zuordnung } from '../zuordnung.js';
import { ATTRIBUTE, gesinnung, GROESSE, liste, zahl } from '../zuordnung.js';
import { aktionsart, fertigkeit } from './regeln.js';
import { zerlegeAngriff } from './angriff.js';

const ATTR_VON_SKILL: Record<string, string> = {
  acrobatics: 'dex', 'animal handling': 'wis', arcana: 'int', athletics: 'str', deception: 'cha',
  history: 'int', insight: 'wis', intimidation: 'cha', investigation: 'int', medicine: 'wis',
  nature: 'int', perception: 'wis', performance: 'cha', persuasion: 'cha', religion: 'int',
  'sleight of hand': 'dex', stealth: 'dex', survival: 'wis',
};

/* Die Abschnitte eines Statblocks und ihre Aktionsart. `trait` ist ein
   Merkmal, alles andere eine Aktion. */
const ABSCHNITTE: [string, string | undefined][] = [
  ['trait', undefined],
  ['action', 'action'],
  ['bonus', 'bonus'],
  ['reaction', 'reaction'],
  ['legendary', 'legendary'],
  ['mythic', 'mythic'],
];

const mod = (wert: number) => Math.floor((wert - 10) / 2);

/** `{"walk": 30, "fly": {"number": 60, "condition": "(hover)"}}` → „30 ft., fly 60 ft. (hover)". */
export function tempo(roh: unknown): string {
  if (typeof roh === 'number') return `${roh} ft.`;
  if (!roh || typeof roh !== 'object') return '';
  const teile: string[] = [];
  for (const art of ['walk', 'burrow', 'climb', 'fly', 'swim']) {
    const v = (roh as Knoten)[art];
    if (v === undefined) continue;
    const zahlTeil = typeof v === 'object' && v ? `${String((v as Knoten)['number'])} ft.${(v as Knoten)['condition'] ? ` ${inline(String((v as Knoten)['condition']), OHNE)}` : ''}` : v === true ? 'equal to walking speed' : `${String(v)} ft.`;
    teile.push(art === 'walk' ? zahlTeil : `${art} ${zahlTeil}`);
  }
  const alt = (roh as Knoten)['alternate'];
  if (alt) teile.push('(alternate forms)');
  return teile.join(', ');
}

/** Resistenzen und Immunitäten als Satz, mit Bedingungen. */
function schadenSatz(wb: Werkbank, roh: unknown, feld: string): string {
  return liste(roh)
    .map((x) => {
      if (typeof x === 'string') return x;
      const o = x as Knoten;
      if (o['special']) return wb.zeile(String(o['special']));
      const innen = schadenSatz(wb, o[feld], feld);
      return [o['preNote'] ? wb.zeile(String(o['preNote'])) : '', innen, o['note'] ? wb.zeile(String(o['note'])) : ''].filter(Boolean).join(' ');
    })
    .join('; ');
}

/** Name einer Aktion ohne Marken und ohne Aufladung; die Aufladung als Wert. */
function aktionsname(roh: string): { name: string; recharge?: string; uses?: string } {
  let recharge: string | undefined;
  const r = /\{@recharge ?(\d?)\}/.exec(roh);
  if (r) recharge = r[1] ? (r[1] === '6' ? '6' : `${r[1]}–6`) : '6';
  const ohne = roh.replace(/\s*\{@recharge ?\d?\}/, '');
  const name = inline(ohne, OHNE).replace(/\*+/g, '').trim();
  const u = /\((\d+\/(?:Day|Turn|Short Rest|Long Rest|Rest)(?: each)?)\)/i.exec(name);
  return { name, recharge, uses: u?.[1] };
}

/**
 * Wie ein Monster in seinem eigenen Text heisst. `woerter` sind die Wörter
 * aus Namen und Kreaturtyp (klein), aus denen „the …" bestehen darf;
 * `gross` die Wörter, die der Name gross schreibt („the Scarlet
 * Sentinel"); `eigen` die Namensteile, die ohne Artikel dastehen
 * („Venomfang can …", „Gar can …") — leer, wenn die Kreatur keinen
 * Eigennamen trägt.
 */
export interface Selbst {
  woerter: Set<string>;
  gross: Set<string>;
  eigen: Set<string>;
  /** Voller Name und `shortName` einer benannten Kreatur, wörtlich („Mr. Honeycutt"). */
  ganz?: string[];
}

/* Wörter, auf die eine Folge nicht enden darf: „the swarm of" ist „the
   swarm", und „the of" ist nichts. Mitten im Namen stehen sie („the
   brain in a jar"). */
const FUELL = new Set(['of', 'and', 'or', 'the', 'a', 'an', 'in', 'on', 'to', 'with', 'from', 'any', 'von', 'de', 'du', 'la', 'le']);

const WORT = /^[\p{L}\p{N}'’-]+$/u;
/* Wo ein Name endet: vor einem Zeichen, das kein Wort fortsetzt, oder vor
   dem Genitiv („the dragon's breath"). */
const ENDE = `(?=$|[^\\p{L}\\p{N}'’-]|['’]s(?![\\p{L}\\p{N}]))`;
const ANFANG = `(?<![\\p{L}\\p{N}'’-])`;

/* Verweise und Würfel bleiben, wie sie sind: „Dragon" in
   `[[statblock-0012|Adult Black Dragon]]` ist kein Platzhalter. */
const GESCHUETZT = /\[\[[^\]]*\]\]|\{\{(?:[^{}]|\{[^{}]*\})*\}\}|\{[A-Z0-9_]+\}/g;

const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** Ruft `f` für jedes Stück Text ausserhalb von Verweisen und Würfeln auf. */
function ausserhalb(text: string, f: (stueck: string) => string): string {
  let out = '';
  let last = 0;
  for (const m of text.matchAll(GESCHUETZT)) {
    out += f(text.slice(last, m.index)) + m[0];
    last = (m.index ?? 0) + m[0].length;
  }
  return out + f(text.slice(last));
}

/**
 * Die längste Folge ab `woerter[0]`, die `passt`, ohne Füllwort am Ende.
 * Ein Genitiv beendet sie („the dragon's" → „dragon").
 */
function folge(woerter: string[], passt: (w: string) => boolean): string[] {
  const out: string[] = [];
  for (const w of woerter) {
    const genitiv = /^(.+)['’]s$/u.exec(w)?.[1];
    if (genitiv && passt(genitiv)) {
      out.push(genitiv);
      break;
    }
    if (!WORT.test(w) || !passt(w)) break;
    out.push(w);
  }
  while (out.length && FUELL.has(out[out.length - 1]!.toLowerCase())) out.pop();
  return out;
}

/**
 * Die Namen, unter denen dieser Text das Monster nennt: je „the"/„The"
 * die längste folgende Wortfolge aus Namen oder Kreaturtyp („the dragon"
 * am Black Dragon Wyrmling, „the guard drake" am Black Guard Drake), und
 * jede Folge von Namensteilen ohne Artikel („Gar", „Wei Feng").
 */
function kandidaten(text: string, selbst: Selbst): string[] {
  const gefunden = new Set<string>();
  /* Klein, wie das Buch die Kreatur nennt — gross nur, wie der Name es
     schreibt: „the Shapechanger trait" meint das Merkmal, nicht den Vampir. */
  const imNamen = (w: string) => (/^\p{Lu}/u.test(w) ? selbst.gross.has(w) : selbst.woerter.has(w));
  const eigen = (w: string) => selbst.eigen.has(w) || FUELL.has(w);
  ausserhalb(text, (stueck) => {
    for (const m of stueck.matchAll(/(?<![\p{L}\p{N}'’-])([Tt]he) (?=([\p{L}\p{N}'’ -]+))/gu)) {
      const f = folge(m[2]!.split(' '), imNamen);
      if (!f.length) continue;
      /* Grossgeschrieben ist es ein Titel, und der Artikel gehört dazu, wie
         er dasteht: „When The Abbot hits" bleibt so. */
      gefunden.add(`${f.some((w) => /^\p{Lu}/u.test(w)) ? m[1] : 'the'} ${f.join(' ')}`);
    }
    if (selbst.eigen.size) {
      for (const m of stueck.matchAll(/(?<![\p{L}\p{N}'’-])(?<!\b[Tt]he )(?=(\p{Lu}[\p{L}\p{N}'’ -]*))/gu)) {
        const f = folge(m[1]!.split(' '), eigen);
        if (f.length && selbst.eigen.has(f[0]!)) gefunden.add(f.join(' '));
      }
    }
    for (const n of selbst.ganz ?? []) {
      if (new RegExp(`${ANFANG}(?<!\\b[Tt]he )${escape(n)}${ENDE}`, 'u').test(stueck)) gefunden.add(n);
    }
    return stueck;
  });
  return [...gefunden];
}

/**
 * Ersetzt das Monster im Text durch `{CREATURE}` und sagt, mit welchem
 * Namen der Text es nennt. **Der Platzhalter trägt den Artikel** („{CREATURE}
 * can breathe air and water." mit „the dragon" oder „Venomfang" an der
 * Kante): so lesen sich Texte gleich, die sich nur im Namen unterscheiden,
 * auch wenn der eine ein Eigenname ist. Gross am Satzanfang schreibt
 * `parseInline`. **Ein Name je Text**, der längste, der vorkommt: stünden
 * zwei verschiedene unter demselben Platzhalter, läse einer davon falsch
 * (REQ-174).
 */
export function platzhalter(text: string, selbst: Selbst): { text: string; wort?: string } {
  const [wort] = kandidaten(text, selbst).sort((a, b) => b.length - a.length);
  if (!wort) return { text };
  /* Klein heisst: „The dragon" und „the dragon" sind dasselbe, gross
     geschrieben wird beim Lesen. Ein Titel steht wörtlich. */
  const re = wort.startsWith('the ')
    ? new RegExp(`${ANFANG}[Tt]he ${escape(wort.slice(4))}${ENDE}`, 'gu')
    : new RegExp(`${ANFANG}(?<!\\b[Tt]he )${escape(wort)}(?! [\\p{Lu}])${ENDE}`, 'gu');
  return { text: ausserhalb(text, (stueck) => stueck.replace(re, '{CREATURE}')), wort };
}

/**
 * Ein Merkmal oder eine Aktion des Statblocks — neu oder, wenn derselbe
 * Text unter demselben Namen schon steht, derselbe Artikel noch einmal.
 */
function teil(
  wb: Werkbank,
  sb: Entity,
  e: Knoten,
  roh: Knoten,
  wort: string | undefined,
  selbst: Selbst,
  geteilt: Map<string, Entity>,
): void {
  const typ = wort ? 'Action' : 'Feature';
  const { name, recharge, uses } = aktionsname(String(roh['name'] ?? (wort ? 'Action' : 'Trait')));
  /* Ein Angriff ist einer für alle, die so angreifen; die Zahlen rechnet
     der Statblock (D51, `angriff.ts`). */
  const z = wort ? zerlegeAngriff(roh['entries'] ?? roh['entry']) : null;
  if (wort && z) {
    const schluessel = `Angriff|${wort}|${name}|${z.sorten.join(',')}|${z.schadensart}|${recharge ?? ''}|${uses ?? ''}`;
    let ziel = geteilt.get(schluessel);
    if (ziel) {
      wb.bericht.geteilt.verwendungen += 1;
      if (e['srd'] || e['srd52']) wb.karte(ziel, 'Source')['srd'] = true;
      if (!wb.geteiltGezaehlt.has(ziel.id)) {
        wb.bericht.geteilt.merkmale += 1;
        wb.geteiltGezaehlt.add(ziel.id);
      }
    } else {
      ziel = wb.anlegen('Action', name, schluessel, e);
      wb.feld(ziel, 'Action', 'actionType', aktionsart(wb, wort).id);
      wb.feld(ziel, 'Action', 'recharge', recharge);
      wb.feld(ziel, 'Action', 'uses', uses);
      wb.feld(ziel, 'Action', 'attack', z.sorten);
      wb.feld(ziel, 'Action', 'damageType', z.schadensart);
      geteilt.set(schluessel, ziel);
    }
    /* Die Kante bekommt eine Marke, damit die Vereinigung sie findet —
       zwei gleichnamige Angriffe an einem Statblock sind zwei Kanten. */
    const marke = wb.angriffe.length;
    wb.kante(sb, 'composedOf', ziel.id, { _angriff: marke });
    const kante = sb.relations!.find((r) => r.props?.['_angriff'] === marke)!;
    wb.angriffe.push({ sb, ziel, kante, z, satz: z.rest.length ? wb.text(z.rest, 5) : '' });
    return;
  }
  if (wort && JSON.stringify(roh['entries'] ?? '').includes('{@atk')) wb.bericht.angriffe.alsText += 1;
  const { text, wort: genannt } = platzhalter(vorlagenwerte(wb.text(roh['entries'] ?? roh['entry'], 5), e), selbst);
  const benutzt = text.includes('{CREATURE}');
  const schluessel = `${typ}|${wort ?? ''}|${name}|${text}`;
  let ziel = geteilt.get(schluessel);
  if (ziel) {
    wb.bericht.geteilt.verwendungen += 1;
    /* Steht derselbe Text in einem SRD-Monster, ist er SRD-Text. */
    if (e['srd'] || e['srd52']) wb.karte(ziel, 'Source')['srd'] = true;
    if (!wb.geteiltGezaehlt.has(ziel.id)) {
      wb.bericht.geteilt.merkmale += 1;
      wb.geteiltGezaehlt.add(ziel.id);
    }
  } else {
    ziel = wb.anlegen(typ, name, `${typ}|${wort ?? ''}|${name}|${text}`, e);
    if (wort) {
      wb.feld(ziel, 'Action', 'actionType', aktionsart(wb, wort).id);
      wb.feld(ziel, 'Action', 'recharge', recharge);
      wb.feld(ziel, 'Action', 'uses', uses);
    } else wb.feld(ziel, 'Feature', 'featureType', 'monster');
    wb.prosa(ziel, text);
    if (benutzt) wb.feld(ziel, 'Vars', 'bindings', { CREATURE: 'the creature' });
    geteilt.set(schluessel, ziel);
  }
  const vars: Record<string, string> = {};
  if (benutzt && genannt) vars['CREATURE'] = genannt;
  wb.kante(sb, 'composedOf', ziel.id, Object.keys(vars).length ? { vars } : undefined);
}

/** Zauberwirken: Felder am Statblock, `casts` je Zauber, der Text als Merkmal. */
function zauber(wb: Werkbank, sb: Entity, e: Knoten, selbst: Selbst): void {
  const S = 'Statblock';
  for (const [i, sc] of (liste(e['spellcasting']) as Knoten[]).entries()) {
    if (i === 0) {
      if (sc['ability']) wb.feld(sb, S, 'spellAbility', sc['ability']);
      const kopf = JSON.stringify(sc['headerEntries'] ?? '');
      const stufe = /(\d+)(?:st|nd|rd|th)-level spellcaster/.exec(kopf);
      if (stufe) wb.feld(sb, S, 'casterLevel', Math.min(20, Number(stufe[1])));
      const grade = (sc['spells'] as Record<string, Knoten> | undefined) ?? {};
      const plaetze: number[] = [];
      for (let g = 1; g <= 9; g++) plaetze.push(Number(grade[String(g)]?.['slots'] ?? 0));
      while (plaetze.length && plaetze[plaetze.length - 1] === 0) plaetze.pop();
      wb.feld(sb, S, 'spellSlots', plaetze);
    }
    const angeboren = /innate/i.test(String(sc['name'] ?? ''));
    const kante = (s: unknown, props: Record<string, unknown>) => {
      if (typeof s !== 'string') return;
      const m = /\{@spell ([^}]*)\}/.exec(s);
      if (!m) return;
      const [n = '', q = ''] = m[1]!.split('|');
      const ziel = wb.finde('spell', [n, q]);
      if (ziel) wb.kante(sb, 'casts', ziel.id, { mode: angeboren ? 'innate' : 'prepared', ...props });
      else wb.ctx.insLeere('spell', `${n}|${q}`);
    };
    for (const s of liste(sc['will'])) kante(s, { uses: 'at will' });
    for (const s of liste(sc['constant'])) kante(s, { uses: 'constant' });
    for (const feld of ['daily', 'rest', 'restLong', 'weekly', 'monthly', 'yearly'] as const) {
      const wort: Record<string, string> = { daily: 'day', rest: 'rest', restLong: 'long rest', weekly: 'week', monthly: 'month', yearly: 'year' };
      for (const [k, v] of Object.entries((sc[feld] as Knoten | undefined) ?? {})) {
        for (const s of liste(v)) kante(s, { uses: `${k.replace(/e$/, '')}/${wort[feld]}` });
      }
    }
    for (const [g, gr] of Object.entries((sc['spells'] as Record<string, Knoten> | undefined) ?? {})) {
      for (const s of liste(gr['spells'])) kante(s, { level: Number(g) });
    }
    /* Der Text bleibt als Merkmal: er sagt, was die Felder nicht sagen
       (Fussnoten, „bevor der Kampf beginnt …"). Gezählt wird er nicht als
       geteilt — zwei Magier mit derselben Liste sind selten. */
    const f = wb.anlegen('Feature', aktionsname(String(sc['name'] ?? 'Spellcasting')).name, `spellcasting|${sb.id}|${i}`, e);
    wb.feld(f, 'Feature', 'featureType', 'spellcasting');
    const { text, wort: genannt } = platzhalter(vorlagenwerte(zauberwirken(sc, wb.ctx), e), selbst);
    wb.prosa(f, text);
    if (genannt) {
      wb.feld(f, 'Vars', 'bindings', { CREATURE: 'the creature' });
      wb.kante(sb, 'composedOf', f.id, { vars: { CREATURE: genannt } });
    } else wb.kante(sb, 'composedOf', f.id);
  }
}

/** Die Abschnitte eines Statblocks über `composedOf`, in der Reihenfolge des Buchs. */
function abschnitte(wb: Werkbank, sb: Entity, e: Knoten, selbst: Selbst, geteilt: Map<string, Entity>): void {
  for (const [feld, wort] of ABSCHNITTE) {
    /* Das Zauberwirken steht bei 5e.tools zwischen den Merkmalen und den
       Aktionen, und dort steht es auch hier. */
    if (feld === 'action') zauber(wb, sb, e, selbst);
    for (const roh of liste(e[feld])) {
      if (!roh || typeof roh !== 'object') continue;
      teil(wb, sb, e, roh as Knoten, wort, selbst, geteilt);
    }
  }
  /* Was vor einem Abschnitt steht („The dragon can take 3 legendary
     actions …"), gehört zum Abschnitt und nicht zu einer Aktion. Die Zahl
     ist ein Feld; der Satz bleibt am Statblock. */
  const kopf: string[] = [];
  for (const k of ['actionHeader', 'bonusHeader', 'reactionHeader', 'legendaryHeader', 'mythicHeader']) {
    if (e[k]) kopf.push(wb.text(e[k], 5));
  }
  if (kopf.length) wb.prosa(sb, kopf.join('\n\n'));
}

const GENUTZT_MONSTER = [
  'name', 'shortName', 'size', 'type', 'alignment', 'alignmentPrefix', 'ac', 'hp', 'speed', 'str', 'dex', 'con', 'int', 'wis',
  'cha', 'save', 'skill', 'senses', 'passive', 'languages', 'cr', 'pbNote', 'trait', 'action', 'bonus',
  'reaction', 'legendary', 'mythic', 'legendaryHeader', 'mythicHeader', 'actionHeader',
  'bonusHeader', 'reactionHeader', 'legendaryActions', 'legendaryActionsLair', 'spellcasting',
  'environment', 'attachedItems', 'resist', 'immune', 'vulnerable', 'conditionImmune',
  'legendaryGroup', 'variant', 'isNpc', 'isNamedCreature', 'familiar', 'dragonCastingColor',
  'dragonAge', 'group', 'level', 'entries', 'initiative', 'gear', 'treasure',
];

/** Monster und Objekte als Statblock. */
function statblock(wb: Werkbank, sb: Entity, e: Knoten): void {
  const S = 'Statblock';
  wb.feld(sb, S, 'size', GROESSE[String(liste(e['size'])[0] ?? '')]);
  const typ = e['type'];
  if (typeof typ === 'string') wb.feld(sb, S, 'creatureType', typ);
  else if (typ && typeof typ === 'object') {
    const t = typ as Knoten;
    const art = typeof t['type'] === 'object' ? liste((t['type'] as Knoten)['choose']).join(' or ') : String(t['type'] ?? '');
    const marken = liste(t['tags']).map((x) => (typeof x === 'string' ? x : String((x as Knoten)['tag'] ?? '')));
    wb.feld(sb, S, 'creatureType', `${t['swarmSize'] ? `swarm of ${GROESSE[String(t['swarmSize'])] ?? ''} ${art}s` : art}${marken.length ? ` (${marken.join(', ')})` : ''}`);
    wb.marke(sb, ...marken);
  }
  wb.feld(sb, S, 'alignment', [e['alignmentPrefix'] ? String(e['alignmentPrefix']) : '', gesinnung(e['alignment'])].join('').trim());

  const ac = liste(e['ac']);
  const erste = ac[0];
  const acZahl = typeof erste === 'number' ? erste : zahl((erste as Knoten | undefined)?.['ac']);
  wb.feld(sb, S, 'ac', acZahl);
  const noten = ac
    .map((a, i) => {
      if (typeof a === 'number') return i === 0 ? '' : String(a);
      const o = a as Knoten;
      if (o['special']) return wb.zeile(String(o['special']));
      const von = liste(o['from']).map((x) => wb.zeile(x)).join(', ');
      const bed = o['condition'] ? wb.zeile(String(o['condition'])) : '';
      return i === 0 ? [von, bed].filter(Boolean).join(' ') : `${String(o['ac'])} ${[von, bed].filter(Boolean).join(' ')}`.trim();
    })
    .filter(Boolean);
  wb.feld(sb, S, 'acNote', noten.join('; '));

  const hp = (e['hp'] as Knoten | undefined) ?? {};
  if (typeof e['hp'] === 'number') wb.feld(sb, S, 'hp', e['hp']);
  wb.feld(sb, S, 'hp', zahl(hp['average']));
  wb.feld(sb, S, 'hpFormula', hp['formula'] ?? (hp['special'] ? wb.zeile(String(hp['special'])) : undefined));
  wb.feld(sb, S, 'speed', tempo(e['speed']));

  const cr = e['cr'];
  const crText = typeof cr === 'object' && cr ? String((cr as Knoten)['cr']) : cr !== undefined ? String(cr) : undefined;
  wb.feld(sb, S, 'cr', crText);
  const prof = profAusCr(cr);
  if (crText !== undefined) wb.feld(sb, S, 'prof', prof);

  wb.feld(sb, S, 'senses', liste(e['senses']).map((s) => wb.zeile(s)).join(', '));
  wb.feld(sb, S, 'resistances', schadenSatz(wb, e['resist'], 'resist'));
  wb.feld(sb, S, 'immunities', schadenSatz(wb, e['immune'], 'immune'));
  wb.feld(sb, S, 'vulnerabilities', schadenSatz(wb, e['vulnerable'], 'vulnerable'));
  /* Zustandsimmunitäten zeigen auf `Condition`-Artikel (T-078). Was
     keiner ist — „disease" —, steht als Notiz am Statblock, nicht als
     Verweis ins Leere. */
  const zustaende: string[] = [];
  const keinZustand: string[] = [];
  const zustandNoten: string[] = [];
  const zustand = (roh: string) => {
    const ziel = wb.finde('condition', [roh]);
    if (ziel) zustaende.push(ziel.id);
    else keinZustand.push(roh.replace(/^./, (x) => x.toUpperCase()));
  };
  for (const c of liste(e['conditionImmune'])) {
    if (typeof c === 'string') zustand(c);
    else {
      const o = c as Knoten;
      for (const x of liste(o['conditionImmune'])) zustand(String(x));
      if (o['note']) zustandNoten.push(wb.zeile(String(o['note'])));
    }
  }
  wb.feld(sb, S, 'conditionImmunities', [...new Set(zustaende)]);
  if (keinZustand.length) wb.anmerkung(sb, 'condition-immunities', `Condition immunities: ${[...new Set(keinZustand)].join(', ')}`);
  if (zustandNoten.length) wb.notiz('Zustandsimmunität mit Bedingung (Bedingung entfällt)');
  wb.feld(sb, S, 'legendaryActions', zahl(e['legendaryActions']) ?? (e['legendary'] ? 3 : undefined));

  /* Werte, Rettungswürfe, Fertigkeiten. Was nicht aus Übung und
     Übungsbonus folgt, steht als fester Bonus (S1). */
  const A = 'Abilities';
  for (const a of ATTRIBUTE) wb.feld(sb, A, a, zahl(e[a]));
  const geuebt: string[] = [];
  const experte: string[] = [];
  const boni: Record<string, number> = {};
  const saves: string[] = [];
  for (const [a, b] of Object.entries((e['save'] as Knoten | undefined) ?? {})) {
    if (!ATTRIBUTE.includes(a as (typeof ATTRIBUTE)[number])) continue;
    saves.push(a);
    const bonus = zahl(b);
    if (bonus !== undefined && bonus !== mod(Number(e[a] ?? 10)) + prof) boni[a] = bonus;
  }
  for (const [k, b] of Object.entries((e['skill'] as Knoten | undefined) ?? {})) {
    if (k === 'other') continue;
    const name = wb.finde('skill', [k])?.name ?? fertigkeit(k);
    const bonus = zahl(b);
    const basis = mod(Number(e[ATTR_VON_SKILL[k] ?? 'dex'] ?? 10));
    if (bonus === basis + 2 * prof) experte.push(name);
    else {
      geuebt.push(name);
      if (bonus !== undefined && bonus !== basis + prof) boni[name] = bonus;
    }
  }
  const sprachen: string[] = [];
  const sprachNoten: string[] = [];
  for (const l of liste(e['languages'])) {
    const s = String(l);
    const treffer = wb.finde('language', [s]);
    if (treffer) sprachen.push(treffer.name);
    else sprachNoten.push(wb.zeile(s));
  }
  wb.feld(sb, 'Proficiencies', 'proficient', [...geuebt, ...sprachen]);
  wb.feld(sb, 'Proficiencies', 'expertise', experte);
  wb.feld(sb, 'Proficiencies', 'saves', saves);
  if (Object.keys(boni).length) wb.feld(sb, S, 'bonuses', boni);
  wb.feld(sb, S, 'languageNote', sprachNoten.join(', '));

  for (const u of liste(e['environment'])) wb.marke(sb, String(u));
  for (const g of liste(e['attachedItems'])) {
    const [n = '', q = ''] = String(g).split('|');
    const ziel = wb.finde('item', [n, q]);
    if (ziel) wb.kante(sb, 'equips', ziel.id);
    else wb.ctx.insLeere('item', String(g));
  }
}

/**
 * Woraus der Text ein Monster nennt (`platzhalter`). Die Wörter: der Name
 * ohne Klammer, `shortName` und der Kreaturtyp samt Marken — das Buch
 * schreibt beim Giant Rat „the rat", beim Swarm of Rats „the swarm", beim
 * Black Dragon Wyrmling „the dragon" und bei der Storm Giant Quintessent
 * „the giant". Die Eigennamen nur bei benannten Kreaturen (`isNamedCreature`,
 * `shortName`): der volle Name, `shortName` und jeder grossgeschriebene Teil
 * („Gar" an Gar Shatterkeel, „Serissa" an Princess Serissa). Ersetzt wird
 * nur im Text dieses Statblocks — ohne die kurzen Namen stünden Pack
 * Tactics und Keen Smell je Kreatur einmal.
 */
export function selbst(e: Knoten): Selbst {
  const voll = String(e['name']).replace(/\s*\(.*\)\s*$/, '');
  const klammer = /\((.*)\)\s*$/.exec(String(e['name']))?.[1];
  const kurz = typeof e['shortName'] === 'string' ? e['shortName'] : undefined;
  const woerter = new Set<string>();
  const gross = new Set<string>();
  const eigen = new Set<string>();
  const benannt = Boolean(e['isNamedCreature'] || e['shortName']);
  const nimm = (s: string, name: boolean) => {
    for (const w of s.split(/[\s,()]+/)) {
      if (!w) continue;
      woerter.add(w.toLowerCase());
      if (!name || !/^\p{Lu}/u.test(w)) continue;
      gross.add(w);
      if (benannt && w.length > 2 && !FUELL.has(w.toLowerCase())) eigen.add(w);
    }
  };
  nimm(voll, true);
  if (kurz) nimm(kurz, true);
  /* „Affliction Devil (Kocrachon)" heisst im Text „the kocrachon". */
  if (klammer) nimm(klammer, false);
  const typ = e['type'];
  if (typeof typ === 'string') nimm(typ, false);
  else if (typ && typeof typ === 'object') {
    const t = typ as Knoten;
    if (typeof t['type'] === 'string') nimm(t['type'], false);
    else nimm(liste((t['type'] as Knoten | undefined)?.['choose']).join(' '), false);
    for (const m of liste(t['tags'])) nimm(typeof m === 'string' ? m : String((m as Knoten)['tag'] ?? ''), false);
  }
  const ganz = benannt ? [...new Set([voll, ...(kurz ? [kurz] : [])])] : [];
  return { woerter, gross, eigen, ganz };
}

/**
 * Was 5e.tools in Vorlagen (`_templates`, „Drow" an einem NSC) offen
 * lässt: `<$short_name$>` ist „the drow" oder der Eigenname — genau, was
 * `{CREATURE}` trägt —, `<$dc__con$>` und Verwandte sind Zahlen aus den
 * Werten dieses Statblocks. Eingesetzt wird vor der Namenserkennung, die
 * daraus wieder den Platzhalter macht.
 */
export function vorlagenwerte(text: string, e: Knoten): string {
  if (!text.includes('<$')) return text;
  const voll = String(e['name']);
  const kurzRoh = e['shortName'] === true ? voll : typeof e['shortName'] === 'string' ? e['shortName'] : voll.replace(/\s*\(.*\)\s*$/, '');
  const kurz = e['isNamedCreature'] ? kurzRoh : `the ${kurzRoh.toLowerCase()}`;
  const prof = profAusCr(e['cr']);
  const m = (a: string) => mod(Number(e[a] ?? 10));
  const vz = (n: number) => `${n >= 0 ? '+' : ''}${n}`;
  return text.replace(/<\$([a-z_]+)\$>/g, (roh, v: string) => {
    if (v === 'name') return voll;
    if (v === 'short_name') return kurz;
    if (v === 'title_short_name') return kurz.charAt(0).toUpperCase() + kurz.slice(1);
    const a = /(str|dex|con|int|wis|cha)/.exec(v)?.[1];
    if (!a) return roh;
    if (/(^|_)dc_/.test(v)) return String(8 + prof + m(a));
    if (v.startsWith('to_hit')) return vz(prof + m(a));
    if (v.includes('mod')) return vz(m(a));
    return roh;
  });
}

export const MONSTER: Zuordnung[] = [
  {
    art: 'monster',
    tag: 'creature',
    typ: () => 'Statblock',
    name: (e) => String(e['name']),
    genutzt: GENUTZT_MONSTER,
    fuellen(wb, sb, e) {
      const geteilt = wb.geteilt;
      statblock(wb, sb, e);
      abschnitte(wb, sb, e, selbst(e), geteilt);
      /* Spielarten („Variant: Familiars") bleiben Text am Statblock. */
      if (e['variant']) wb.prosa(sb, wb.text(e['variant'], 4));
      if (e['entries']) wb.prosa(sb, wb.text(e['entries'], 4));
      const lg = e['legendaryGroup'] as Knoten | undefined;
      if (lg) {
        const gruppe = wb.hole('legroup', lg['name'], lg['source']);
        const teile = gruppe ? wb.legendaer.get(gruppe.id) : undefined;
        if (teile) for (const t of teile) wb.kante(sb, 'composedOf', t.id);
        else wb.ctx.insLeere('legroup', `${String(lg['name'])}|${String(lg['source'])}`);
      }
      const f = wb.fluff('monsterFluff', String(e['name']), String(e['source']));
      if (f) wb.lore(sb, wb.text(f['entries']));
      if (e['_versions']) wb.notiz('Spielarten (_versions) nicht ausgeschrieben');
    },
  },
  {
    art: 'object',
    tag: 'object',
    typ: () => 'Statblock',
    name: (e) => String(e['name']),
    genutzt: [...GENUTZT_MONSTER, 'objectType', 'actionEntries'],
    fuellen(wb, sb, e) {
      statblock(wb, sb, e);
      const OBJ: Record<string, string> = { SW: 'siege weapon', GEN: 'object', U: 'unknown' };
      wb.feld(sb, 'Statblock', 'creatureType', OBJ[String(e['objectType'])] ?? 'object');
      wb.prosa(sb, wb.text(e['entries']));
      for (const a of liste(e['actionEntries'])) {
        if (a && typeof a === 'object') teil(wb, sb, e, a as Knoten, 'action', selbst({ name: e['name'] }), wb.geteilt);
      }
    },
  },
];

/**
 * Legendäre Gruppen: Hortaktionen und Regionaleffekte eines Drachen, die
 * sich alle Altersstufen teilen. Je Gruppe eine `Action` (Lair Action) und
 * ein `Feature` (regional); die Statblöcke zeigen über `composedOf` darauf.
 */
export const LEGENDAER: Zuordnung = {
  art: 'legendaryGroup',
  tag: 'legroup',
  typ: () => 'Rule',
  name: (e) => `${String(e['name'])} (legendary group)`,
  schluessel: (e) => [[e['name'], e['source']]],
  genutzt: ['name', 'lairActions', 'regionalEffects', 'mythicEncounter', '_versions'],
  fuellen(wb, ent, e) {
    wb.feld(ent, 'Rule', 'kind', 'rule');
    wb.marke(ent, 'legendary group');
    const teile: Entity[] = [];
    const neu = (typ: string, name: string, roh: unknown, wort?: string) => {
      const x = wb.anlegen(typ, name, `legroup|${ent.id}|${name}`, e);
      if (wort) wb.feld(x, 'Action', 'actionType', aktionsart(wb, wort).id);
      else wb.feld(x, 'Feature', 'featureType', 'regional');
      wb.prosa(x, wb.text(roh, 5));
      teile.push(x);
    };
    if (e['lairActions']) neu('Action', `Lair Actions (${String(e['name'])})`, e['lairActions'], 'lair');
    if (e['regionalEffects']) neu('Feature', `Regional Effects (${String(e['name'])})`, e['regionalEffects']);
    if (e['mythicEncounter']) neu('Feature', `Mythic Encounter (${String(e['name'])})`, e['mythicEncounter']);
    wb.legendaer.set(ent.id, teile);
    wb.prosa(ent, teile.map((t) => `- [[${wb.nummer(t)}|${t.name}]]`).join('\n'));
  },
};
