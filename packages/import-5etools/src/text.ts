/**
 * **Der Textbaum von 5e.tools als Markdown** (M10) und seine Inline-Marken
 * als unsere Zeichen (M11, M12).
 *
 * `entries` ist kein Text, sondern ein Darstellungsbaum: Zeichenketten und
 * Objekte (`entries`, `list`, `table`, `inset` …), beliebig geschachtelt.
 * Daraus wird hier genau das Markdown, das `parseMarkdown` liest —
 * Überschriften, Listen, Tabellen, Einschübe, Absätze — und nichts, was
 * HTML wäre.
 *
 * In den Zeichenketten stehen Marken `{@art name|quelle|anzeige}`. Eine,
 * die auf einen Eintrag zeigt, wird ein Verweis auf **unseren** Artikel
 * (`[[spell-0123|fireball]]`); eine Rechenmarke ein Würfel (`{{1d6 + 2}}`,
 * `{{+4}}`); alles andere Text. Was auf etwas zeigt, das nicht
 * hereinkommt, wird Text **und gezählt** — ein stiller Verlust sähe später
 * aus wie ein Wort, das nie ein Verweis war (Abgleich §4.2, Schritt 15).
 */

import { isDice } from '@nw/model';

/** Was der Text über den Bestand wissen muss. */
export interface TextKontext {
  /** Die Nummer des Artikels zu einer Marke, oder nichts. */
  finde(tag: string, teile: string[]): string | undefined;
  /** Eine Marke, deren Ziel nicht hereinkommt. */
  insLeere(tag: string, ziel: string): void;
  /** Eine Eintragsart oder Marke, die der Importer nicht kennt. */
  unbekannt(was: string): void;
}

/** Ein Kontext, der nichts findet und nichts zählt — für Namen. */
export const OHNE: TextKontext = {
  finde: () => undefined,
  insLeere: () => {},
  unbekannt: () => {},
};

/** Marken, die auf einen Eintrag zeigen: Name | Quelle | Anzeige. */
export const VERWEIS_MARKEN = new Set([
  'creature', 'spell', 'item', 'condition', 'status', 'disease', 'skill', 'sense',
  'action', 'class', 'subclass', 'race', 'background', 'feat', 'deity', 'table',
  'variantrule', 'language', 'itemProperty', 'itemMastery', 'reward', 'hazard', 'trap',
  'object', 'cult', 'boon', 'charoption', 'legroup', 'optfeature', 'classFeature',
  'subclassFeature', 'vehicle', 'vehupgrade', 'card', 'deck', 'recipe', 'facility',
  'psionic', 'tableGroup',
]);

/* Die Anzeige einer Verweismarke steht an verschiedenen Stellen — bei den
   meisten an dritter, bei Merkmalen und Gottheiten weiter hinten. */
function anzeigeVon(tag: string, teile: string[]): string {
  const an = (i: number): string | undefined => (teile[i] && teile[i]!.trim() ? teile[i] : undefined);
  switch (tag) {
    case 'classFeature':
      return an(5) ?? teile[0] ?? '';
    case 'subclassFeature':
      return an(7) ?? teile[0] ?? '';
    case 'deity':
      return an(3) ?? teile[0] ?? '';
    case 'card':
      return an(3) ?? teile[0] ?? '';
    case 'class':
      return an(2) ?? teile[0] ?? '';
    default:
      return an(2) ?? teile[0] ?? '';
  }
}

/** Teilt den Inhalt einer Marke an `|`, aber nicht innerhalb einer inneren Marke. */
function teile(inhalt: string): string[] {
  const out: string[] = [];
  let tiefe = 0;
  let cur = '';
  for (const c of inhalt) {
    if (c === '{') tiefe += 1;
    if (c === '}') tiefe -= 1;
    if (c === '|' && tiefe === 0) {
      out.push(cur);
      cur = '';
    } else cur += c;
  }
  out.push(cur);
  return out;
}

const ANGRIFF: Record<string, string> = {
  m: 'Melee', r: 'Ranged', mw: 'Melee Weapon', rw: 'Ranged Weapon', ms: 'Melee Spell',
  rs: 'Ranged Spell', 'mw,rw': 'Melee or Ranged Weapon', 'ms,rs': 'Melee or Ranged Spell',
  'm,r': 'Melee or Ranged',
};

const ATTRIBUT: Record<string, string> = {
  str: 'Strength', dex: 'Dexterity', con: 'Constitution', int: 'Intelligence', wis: 'Wisdom', cha: 'Charisma',
};

/** Ein Würfel, wenn es einer ist; sonst der Text. */
function wuerfel(ausdruck: string, anzeige?: string): string {
  const roh = ausdruck.trim();
  if (isDice(roh)) return `{{${roh}}}`;
  return anzeige ?? roh;
}

/** Eine einzelne Marke. `inhalt` ist alles nach `{@tag `. */
function marke(tag: string, inhalt: string, ctx: TextKontext): string {
  const t = teile(inhalt);
  const erstes = (t[0] ?? '').trim();
  const anzeigeRoh = t.length > 1 ? t[t.length - 1] : undefined;
  switch (tag) {
    case 'b': case 'bold':
      return `**${inline(inhalt, ctx).trim()}**`;
    case 'i': case 'italic':
      return `*${inline(inhalt, ctx).trim()}*`;
    case 'u': case 'underline': case 's': case 'strike': case 'sup': case 'sub': case 'kbd':
    case 'code': case 'note': case 'tip': case 'comic': case 'comicH1': case 'comicH2':
    case 'comicH3': case 'comicH4': case 'comicNote': case 'hom': case 'help':
    case 'highlight': case 'small': case 'style': case 'font': case 'color':
      return inline(erstes, ctx);
    case 'dice': case 'damage': case 'autodice':
      return wuerfel(erstes, t[1] ? inline(t[1], ctx) : undefined);
    case 'scaledamage': case 'scaledice':
      /* `8d6|3-9|1d6`: der Würfel, um den es je Grad steigt. */
      return wuerfel(t[2] ?? erstes, t[3] ? inline(t[3], ctx) : undefined);
    case 'd20': {
      const zahl = Number(erstes);
      return Number.isFinite(zahl) ? `{{${zahl >= 0 ? '+' : ''}${zahl}}}` : erstes;
    }
    case 'hit': {
      const zahl = Number(erstes.replace(/^\+/, ''));
      return Number.isFinite(zahl) ? `{{${zahl >= 0 ? '+' : ''}${zahl}}}` : erstes;
    }
    case 'dc':
      return `DC ${t[1] ? t[1] : erstes}`;
    case 'chance':
      return t[1] ? inline(t[1], ctx) : `${erstes} percent`;
    case 'recharge':
      return erstes ? `(Recharge ${erstes === '6' ? '6' : `${erstes}–6`})` : '(Recharge 6)';
    case 'atk':
      return `*${ANGRIFF[erstes] ?? 'Melee'} Attack:*`;
    case 'atkr':
      return `*${ANGRIFF[erstes] ?? 'Melee'} Attack Roll:*`;
    case 'h':
      return '*Hit:* ';
    case 'm':
      return '*Miss:* ';
    case 'hitYourSpellAttack':
      return anzeigeRoh ?? 'your spell attack modifier';
    case 'dcYourSpellSave':
      return anzeigeRoh ?? 'your spell save DC';
    case 'actSave':
      return `*${ATTRIBUT[erstes] ?? erstes} Saving Throw:*`;
    case 'actSaveFail':
      return erstes ? `*Failure by ${erstes} or More:*` : '*Failure:*';
    case 'actSaveFailBy':
      return `*Failure by ${erstes} or More:*`;
    case 'actSaveSuccess':
      return '*Success:*';
    case 'actSaveSuccessOrFail':
      return '*Failure or Success:*';
    case 'actTrigger':
      return '*Trigger:*';
    case 'actResponse':
      return '*Response:*';
    case 'skillCheck':
      return t[1] ? inline(t[1], ctx) : erstes;
    case 'unit':
      return erstes;
    case 'area':
      return t[1] ? inline(t[1], ctx) : erstes;
    case 'book': case 'adventure':
      /* `{@book Chapter 8|DMG|8}` — der Text und das Buch, ohne Link. */
      return t[1] ? `${inline(erstes, ctx)} (${t[1]})` : inline(erstes, ctx);
    case 'filter': case '5etools': case 'link': case 'quickref': case 'loader':
    case 'footnote': case 'homebrew': case 'coinflip':
      return inline(tag === 'quickref' ? (t[4] ?? erstes) : erstes, ctx);
  }
  if (VERWEIS_MARKEN.has(tag)) {
    const anzeige = inline(anzeigeVon(tag, t), ctx).trim();
    const nummer = ctx.finde(tag, t);
    if (nummer) return `[[${nummer}|${anzeige.replace(/[[\]|]/g, '')}]]`;
    ctx.insLeere(tag, t.slice(0, 2).join('|'));
    return anzeige;
  }
  ctx.unbekannt(`@${tag}`);
  return inline(erstes, ctx);
}

/**
 * Eine Zeichenkette mit Marken als unser Inline-Text. Verschachtelte Marken
 * (`{@b {@spell fireball}}`) gehen von aussen nach innen.
 */
export function inline(text: string, ctx: TextKontext): string {
  const s = String(text ?? '');
  let out = '';
  let i = 0;
  while (i < s.length) {
    const start = s.indexOf('{@', i);
    if (start < 0) {
      out += s.slice(i);
      break;
    }
    out += s.slice(i, start);
    /* Das schliessende Gegenstück, über innere Klammern hinweg. */
    let tiefe = 0;
    let ende = -1;
    for (let j = start; j < s.length; j++) {
      if (s[j] === '{') tiefe += 1;
      else if (s[j] === '}') {
        tiefe -= 1;
        if (tiefe === 0) {
          ende = j;
          break;
        }
      }
    }
    if (ende < 0) {
      out += s.slice(start);
      break;
    }
    const roh = s.slice(start + 2, ende);
    const leer = roh.search(/\s/);
    const tag = leer < 0 ? roh : roh.slice(0, leer);
    const inhalt = leer < 0 ? '' : roh.slice(leer + 1);
    out += marke(tag, inhalt, ctx);
    i = ende + 1;
  }
  return out;
}

/** Ein Name ohne Marken: `Fire Breath {@recharge 5}` → `Fire Breath (Recharge 5–6)`. */
export function klartext(text: string): string {
  return inline(text, OHNE).replace(/\*+/g, '').replace(/\{\{([^}]*)\}\}/g, '$1').replace(/\s+/g, ' ').trim();
}

/** Ein Zelleninhalt: eine Zeile, `|` ausserhalb von Verweisen maskiert. */
function zelle(text: string): string {
  let out = '';
  let imVerweis = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (c === '[' && text[i + 1] === '[') imVerweis = true;
    if (c === ']' && text[i + 1] === ']') imVerweis = false;
    out += c === '|' && !imVerweis ? '\\|' : c;
  }
  return out.replace(/\s*\n+\s*/g, ' ').trim();
}

type Knoten = Record<string, unknown>;

/** Eine Würfelspanne in einer Tabellenzelle: `{roll: {min: 1, max: 3}}`. */
function rollText(roll: Knoten): string {
  if (typeof roll['exact'] === 'number') return String(roll['exact']);
  const min = roll['min'];
  const max = roll['max'];
  return `${min}–${max}`;
}

/** Eine Zelle als Inline-Text, gleich welcher Form. */
export function zellText(c: unknown, ctx: TextKontext): string {
  if (typeof c === 'string') return zelle(inline(c, ctx));
  if (typeof c === 'number') return String(c);
  if (c && typeof c === 'object') {
    const o = c as Knoten;
    if (o['type'] === 'cell') {
      if (o['roll']) return rollText(o['roll'] as Knoten);
      if (o['entry'] !== undefined) return zellText(o['entry'], ctx);
      if (Array.isArray(o['entries'])) return (o['entries'] as unknown[]).map((x) => zellText(x, ctx)).join(' ');
    }
    return zelle(markdown([c], ctx, 3).replace(/\n+/g, ' '));
  }
  return '';
}

/** Eine Markdown-Tabelle aus Kopf und Zeilen. */
export function tabelle(kopf: string[], zeilen: string[][]): string {
  const breite = Math.max(kopf.length, ...zeilen.map((z) => z.length), 1);
  const k = Array.from({ length: breite }, (_, i) => kopf[i] ?? ' ');
  const zeile = (z: string[]) => `| ${Array.from({ length: breite }, (_, i) => z[i] || ' ').join(' | ')} |`;
  return [zeile(k), `|${' --- |'.repeat(breite)}`, ...zeilen.map(zeile)].join('\n');
}

/** Rückt jede Zeile ausser der ersten ein — für einen Listenpunkt. */
function einruecken(text: string, um: string): string {
  return text
    .split('\n')
    .map((z, i) => (i === 0 || !z ? z : um + z))
    .join('\n');
}

/** Jede Zeile als Einschub. */
function zitat(text: string): string {
  return text
    .split('\n')
    .map((z) => (z ? `> ${z}` : '>'))
    .join('\n');
}

/**
 * Ein Name vor einem Absatz, wo eine Überschrift zu viel wäre: tief im
 * Baum stehen bei 5e.tools benannte Einträge als fetter Satzanfang.
 */
function mitTitel(name: string, rest: string): string {
  if (!rest) return `**${name}.**`;
  const [erster, ...weitere] = rest.split('\n\n');
  if (erster && !/^(#|\||-|>|\d+\.)/.test(erster)) {
    return [`**${name}.** ${erster}`, ...weitere].join('\n\n');
  }
  return [`**${name}.**`, rest].join('\n\n');
}

/**
 * Der Baum als Markdown. `ebene` ist die Überschriftenebene für benannte
 * Einträge auf dieser Tiefe; ab Ebene 5 steht der Name als fetter
 * Satzanfang, wie 5e.tools es zeichnet.
 */
export function markdown(entries: unknown, ctx: TextKontext, ebene = 2): string {
  const liste = Array.isArray(entries) ? entries : entries === undefined || entries === null ? [] : [entries];
  return liste
    .map((e) => block(e, ctx, ebene))
    .filter((b) => b.trim() !== '')
    .join('\n\n');
}

function benannt(o: Knoten, ctx: TextKontext, ebene: number, kinder: unknown): string {
  const name = typeof o['name'] === 'string' ? inline(o['name'], ctx).trim() : '';
  const rumpf = markdown(kinder, ctx, Math.min(ebene + 1, 6));
  if (!name) return rumpf;
  if (ebene >= 5) return mitTitel(name, rumpf);
  return [`${'#'.repeat(ebene)} ${name}`, rumpf].filter(Boolean).join('\n\n');
}

function block(e: unknown, ctx: TextKontext, ebene: number): string {
  if (typeof e === 'string') return inline(e, ctx);
  if (typeof e === 'number') return String(e);
  if (!e || typeof e !== 'object') return '';
  const o = e as Knoten;
  const typ = String(o['type'] ?? 'entries');
  switch (typ) {
    case 'entries': case 'section': case 'options': case 'variantInner': case 'variantSub':
    case 'flowBlock': case 'homebrew':
      return benannt(o, ctx, ebene, o['entries'] ?? o['entry']);
    case 'inset': case 'insetReadaloud': case 'variant': {
      const name = typeof o['name'] === 'string' ? inline(o['name'], ctx).trim() : '';
      const kopf = typ === 'variant' && name ? `**Variant: ${name}**` : name ? `**${name}**` : '';
      const rumpf = markdown(o['entries'], ctx, 6);
      return zitat([kopf, rumpf].filter(Boolean).join('\n\n'));
    }
    case 'quote': {
      const rumpf = markdown(o['entries'], ctx, 6);
      const von = o['by'] ? `— ${inline(String(o['by']), ctx)}${o['from'] ? `, ${inline(String(o['from']), ctx)}` : ''}` : '';
      return zitat([rumpf, von].filter(Boolean).join('\n\n'));
    }
    case 'list': {
      const punkte = (Array.isArray(o['items']) ? o['items'] : []).map((p) => {
        const inhalt = typeof p === 'string' ? inline(p, ctx) : listenpunkt(p as Knoten, ctx);
        return `- ${einruecken(inhalt, '  ')}`;
      });
      const kopf = o['name'] ? `**${inline(String(o['name']), ctx)}**\n\n` : '';
      return kopf + punkte.join('\n');
    }
    case 'item': case 'itemSub': case 'itemSpell':
      return listenpunkt(o, ctx);
    case 'table':
      return tabellenBlock(o, ctx);
    case 'tableGroup':
      return markdown(o['tables'], ctx, ebene);
    case 'row':
      return (Array.isArray(o['row']) ? o['row'] : []).map((c) => zellText(c, ctx)).join(' · ');
    case 'cell':
      return zellText(o, ctx);
    case 'hr':
      return '---';
    case 'inline': case 'inlineBlock':
      return (Array.isArray(o['entries']) ? o['entries'] : []).map((x) => (typeof x === 'string' ? inline(x, ctx) : block(x, ctx, 6))).join('');
    case 'link':
      return inline(String(o['text'] ?? ''), ctx);
    case 'dice':
      return Array.isArray(o['toRoll'])
        ? wuerfel((o['toRoll'] as Knoten[]).map((d) => `${d['number']}d${d['faces']}${d['modifier'] ? `+${d['modifier']}` : ''}`).join('+'))
        : '';
    case 'abilityDc':
      return `**${inline(String(o['name'] ?? 'Spell'), ctx)} save DC** = 8 + your proficiency bonus + your ${attribute(o['attributes'])} modifier`;
    case 'abilityAttackMod':
      return `**${inline(String(o['name'] ?? 'Spell'), ctx)} attack modifier** = your proficiency bonus + your ${attribute(o['attributes'])} modifier`;
    case 'abilityGeneric':
      return `**${inline(String(o['name'] ?? ''), ctx)}** ${inline(String(o['text'] ?? ''), ctx)}`.trim();
    case 'refClassFeature': case 'refSubclassFeature': case 'refOptionalfeature': {
      const feld = typ === 'refClassFeature' ? 'classFeature' : typ === 'refSubclassFeature' ? 'subclassFeature' : 'optionalfeature';
      const tag = typ === 'refOptionalfeature' ? 'optfeature' : feld;
      return inline(`{@${tag} ${String(o[feld] ?? '')}}`, ctx);
    }
    case 'statblock': case 'statblockInline': {
      const tag = String(o['tag'] ?? 'creature');
      const name = String(o['name'] ?? (o['data'] as Knoten | undefined)?.['name'] ?? '');
      return inline(`{@${tag} ${name}${o['source'] ? `|${o['source']}` : ''}}`, ctx);
    }
    case 'spellcasting':
      return zauberwirken(o, ctx);
    case 'actions': case 'attack': {
      if (typ === 'attack') {
        const art = ANGRIFF[String(o['attackType'] ?? 'MW').toLowerCase()] ?? 'Melee';
        return `*${art} Attack:* ${markdown(o['attackEntries'], ctx, 6)} *Hit:* ${markdown(o['hitEntries'], ctx, 6)}`;
      }
      return benannt(o, ctx, ebene, o['entries']);
    }
    case 'image': case 'gallery': case 'wrapper': case 'flowchart':
      if (typ === 'flowchart') return markdown(o['blocks'], ctx, ebene);
      ctx.unbekannt(`Eintrag ${typ} (weggelassen)`);
      return '';
    default:
      ctx.unbekannt(`Eintrag ${typ}`);
      if (o['entries']) return benannt(o, ctx, ebene, o['entries']);
      return '';
  }
}

function attribute(a: unknown): string {
  const liste = Array.isArray(a) ? (a as string[]) : [];
  return liste.map((x) => ATTRIBUT[x] ?? x).join(' or ') || 'spellcasting ability';
}

function listenpunkt(o: Knoten, ctx: TextKontext): string {
  const name = typeof o['name'] === 'string' ? inline(o['name'], ctx).trim() : '';
  const rumpf = o['entry'] !== undefined ? markdown([o['entry']], ctx, 6) : markdown(o['entries'], ctx, 6);
  if (!name) return rumpf;
  const titel = /[.:?!]$/.test(name) ? `**${name}**` : `**${name}.**`;
  return rumpf ? `${titel} ${rumpf}` : titel;
}

function tabellenBlock(o: Knoten, ctx: TextKontext): string {
  const kopf = (Array.isArray(o['colLabels']) ? o['colLabels'] : []).map((c) => zellText(c, ctx));
  const zeilen = (Array.isArray(o['rows']) ? o['rows'] : []).map((r) => {
    const zellen = Array.isArray(r) ? r : (r as Knoten | undefined)?.['row'];
    return (Array.isArray(zellen) ? zellen : [r]).map((c) => zellText(c, ctx));
  });
  const titel = o['caption'] ? `**${inline(String(o['caption']), ctx)}**\n\n` : '';
  const fuss = Array.isArray(o['footnotes']) ? `\n\n${markdown(o['footnotes'], ctx, 6)}` : '';
  return titel + tabelle(kopf, zeilen) + fuss;
}

/** Ein Zauberwirken-Block als Text: Kopf, Zauberlisten, Fuss. */
export function zauberwirken(o: Knoten, ctx: TextKontext): string {
  const teile: string[] = [];
  const kopf = markdown(o['headerEntries'], ctx, 6);
  if (kopf) teile.push(kopf);
  const zeilen: string[] = [];
  const liste = (x: unknown) => (Array.isArray(x) ? (x as unknown[]) : []).map((s) => (typeof s === 'string' ? inline(s, ctx) : zellText(s, ctx))).join(', ');
  if (o['constant']) zeilen.push(`- **Constant:** ${liste(o['constant'])}`);
  if (o['will']) zeilen.push(`- **At will:** ${liste(o['will'])}`);
  for (const feld of ['daily', 'rest', 'restLong', 'weekly', 'monthly', 'yearly', 'charges'] as const) {
    const gruppe = o[feld] as Record<string, unknown> | undefined;
    if (!gruppe) continue;
    const wort: Record<string, string> = { daily: 'day', rest: 'rest', restLong: 'long rest', weekly: 'week', monthly: 'month', yearly: 'year', charges: 'charges' };
    for (const [k, v] of Object.entries(gruppe)) {
      const n = k.replace(/e$/, '');
      zeilen.push(`- **${n}/${wort[feld]}${k.endsWith('e') ? ' each' : ''}:** ${liste(v)}`);
    }
  }
  const grade = o['spells'] as Record<string, Knoten> | undefined;
  if (grade) {
    for (const [grad, g] of Object.entries(grade)) {
      const plaetze = g['slots'] !== undefined ? ` (${g['slots']} slot${g['slots'] === 1 ? '' : 's'})` : g['lower'] ? '' : grad === '0' ? ' (at will)' : '';
      const titel = grad === '0' ? 'Cantrips' : `Level ${grad}`;
      zeilen.push(`- **${titel}${plaetze}:** ${liste(g['spells'])}`);
    }
  }
  if (zeilen.length) teile.push(zeilen.join('\n'));
  const fuss = markdown(o['footerEntries'], ctx, 6);
  if (fuss) teile.push(fuss);
  return teile.join('\n\n');
}
