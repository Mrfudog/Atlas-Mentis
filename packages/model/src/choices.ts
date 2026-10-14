/**
 * **Wahlen als Feld** (REQ-238, E-015 a): was eine Klasse, Unterklasse,
 * Abstammung, ein Hintergrund oder ein Talent zur Wahl stellt, steht als
 * Eintrag in `Choices.choices` am Artikel — was, wie viele, woraus, ab
 * welcher Stufe. Die Figur speichert **nur ihre Antworten**: je Wahl eine
 * Kante `chose` auf den Artikel, der fragt, mit `props.choice` (die `id`
 * der Wahl) und `props.picks`.
 *
 * **Gerechnet wird beim Lesen** (D8): welche Übungen, welche Attributsboni,
 * welche Talente eine Figur aus ihren Wahlen hat, ergibt sich aus Antworten
 * und Quellen zusammen. Ändert die Leitung eine Wahl am Artikel (+2 statt
 * +1), ändert sich jede Figur mit; eine Antwort auf eine Wahl, die es nicht
 * mehr gibt, ist **verwaist** und wird gezeigt, nicht still verworfen.
 *
 * Feste Gaben bleiben, was sie waren: Merkmale an `grants` (mit
 * `props.level`), Übungen in `Proficiencies`, Attributsboni der Abstammung
 * in `Ancestry.abilityBonus`. **Eine Wahl ohne Spielraum ist beantwortet**
 * — „eines aus [con]" fragt niemanden.
 */

import type { Entity, EntityId } from './types.js';

/** Die Sorten einer Wahl. Die Liste steht am Feld (`Choices.choices`). */
export const CHOICE_KINDS = ['proficiency', 'ability', 'feat', 'spell', 'equipment', 'feature', 'subclass'] as const;
export type ChoiceKind = (typeof CHOICE_KINDS)[number];

/**
 * **Woraus gewählt wird** — eine von drei Formen, die sich nicht mischen:
 * Werte aus Listen (`values`, Namen aus `enumRef`-Zeilen oder Artikeln wie
 * bei `Proficiencies.proficient`), Artikel (`interfaces` und Filter, wie
 * `LinkTarget`) oder benannte Möglichkeiten (`options`, die Ausrüstung (a)
 * oder (b)). Fehlt alles, ist die Wahl frei, und `note` sagt, was gemeint
 * ist („two standard languages of your choice").
 */
export interface ChoiceFrom {
  /** Die Werte, aus denen gewählt wird. */
  values?: string[];
  /** Die Listen, aus denen gewählt wird, wenn es keine feste Aufzählung gibt. */
  enumRef?: string[];
  /** Artikelarten, Untertypen eingeschlossen. Die Antwort hält Ids. */
  interfaces?: string[];
  /** Ein Vorschlag wie `LinkTarget.tags`: eine der Marken genügt. */
  tags?: string[];
  /** Ein Vorschlag wie `LinkTarget.where`. */
  where?: { component: string; property: string; value?: unknown };
  /** Nur Artikel mit dieser Kante: `{type: 'subclassOf', to: <Klasse>}`. */
  edge?: { type: string; to: EntityId };
  /** Benannte Möglichkeiten; die Antwort hält den Schlüssel. */
  options?: { key: string; label: string }[];
}

/** Ein Eintrag von `Choices.choices`. */
export interface Choice {
  /** Aus dem Text, nicht durchgezählt: daran hängt die Antwort. */
  id: string;
  kind: ChoiceKind | string;
  /** Ab welcher Stufe; ohne Angabe ab der ersten. */
  level?: number;
  /**
   * An einer Klasse: nur für die erste Klasse der Figur (`start`) oder nur
   * beim Einstieg als weitere (`multiclass`). Ohne Angabe: immer.
   */
  when?: 'start' | 'multiclass';
  from?: ChoiceFrom;
  /** Wie viele; ohne Angabe eines. */
  count?: number;
  /** Bei `ability`: der Bonus je Wahl, in der Reihenfolge der Antwort. */
  bonus?: number[];
  note?: string;
}

/** Eine Antwort der Figur: die Kante `chose`, gelesen. */
export interface ChoiceAnswer {
  /** Der Artikel, der fragt. */
  source: EntityId;
  choice: string;
  picks: string[];
  relationId: string;
}

/** Eine Quelle von Wahlen an einer Figur, mit der Stufe, die für sie zählt. */
export interface ChoiceSource {
  entity: Entity;
  level: number;
  /** Woher: `hasClass`, `subclass`, `hasAncestry`, `hasBackground`, `grants`, `chose`. */
  via: string;
  /** Bei einer Klasse: ist es die erste der Figur (die erste Kante `hasClass`)? */
  start?: boolean;
}

/** Die Wahlen eines Artikels, in der gespeicherten Reihenfolge. */
export function choicesOf(e: Entity | undefined): Choice[] {
  const roh = e?.components?.['Choices']?.['choices'];
  if (!Array.isArray(roh)) return [];
  return roh
    .filter((c): c is Choice => !!c && typeof c === 'object' && typeof (c as Choice).id === 'string' && !!(c as Choice).id)
    .map(sprachwahl);
}

const ZAHLWORT: Record<string, number> = { one: 1, two: 2, three: 3, four: 4, five: 5, six: 6 };

/**
 * **Eine Sprachwahl ohne Liste zieht aus den Sprachen** (T-095). Ältere
 * Wahlen (die Karte `ProficiencyChoice`, Migration 028) und von Hand
 * angelegte tragen oft nur einen Satz: „two standard languages of your
 * choice". Daraus wurde ein Freitext, obwohl es die Sprachen als Artikel
 * gibt. Nennt eine Übungswahl **ohne `from`** in Id oder Satz Sprachen,
 * zieht sie aus den `Language`-Artikeln; fehlt `count`, gilt die Zahl am
 * Anfang des Satzes. Gespeichert wird nichts davon — gelesen wie bisher,
 * nur mit der Liste, die der Satz meint.
 */
function sprachwahl(c: Choice): Choice {
  if ((c.kind ?? 'proficiency') !== 'proficiency') return c;
  if (c.from && Object.keys(c.from).length) return c;
  const satz = `${c.id} ${c.note ?? ''}`;
  if (!/\blanguages?\b/i.test(satz)) return c;
  const raus: Choice = { ...c, from: { enumRef: ['Language'] } };
  if (c.count === undefined) {
    const z = /^\s*(\d+|one|two|three|four|five|six)\b/i.exec(c.note ?? '')?.[1]?.toLowerCase();
    const n = z ? (ZAHLWORT[z] ?? Number(z)) : NaN;
    if (Number.isInteger(n) && n >= 1) raus.count = n;
  }
  return raus;
}

/** Die Antworten einer Figur: jede Kante `chose`. */
export function answersOf(character: Entity | undefined): ChoiceAnswer[] {
  const raus: ChoiceAnswer[] = [];
  for (const r of character?.relations ?? []) {
    if (r.type !== 'chose') continue;
    const choice = r.props?.['choice'];
    if (typeof choice !== 'string' || !choice) continue;
    const picks = Array.isArray(r.props?.['picks']) ? (r.props['picks'] as unknown[]).map(String) : [];
    raus.push({ source: r.to, choice, picks, relationId: r.id });
  }
  return raus;
}

/**
 * **Die Antwort, die keiner geben muss**: eine Wahl aus genau so vielen
 * Werten, wie zu wählen sind. Dasselbe gilt für eine Möglichkeit allein.
 */
export function fixedPicks(choice: Choice): string[] | undefined {
  const n = choice.count ?? 1;
  const werte = choice.from?.values;
  if (werte?.length && werte.length === n && !choice.from?.interfaces && !choice.from?.options) return [...werte];
  const opt = choice.from?.options;
  if (opt?.length === 1 && n === 1 && !werte) return [opt[0]!.key];
  return undefined;
}

/** Die Gesamtstufe: die Summe der Klassenkanten (`sum(hasClass.level)`). */
export function characterLevel(character: Entity | undefined): number {
  let n = 0;
  for (const r of character?.relations ?? []) {
    if (r.type !== 'hasClass') continue;
    const l = Number(r.props?.['level']);
    if (Number.isFinite(l) && l > 0) n += l;
  }
  return n || 1;
}

/**
 * **Welche Artikel an dieser Figur Wahlen stellen** — und mit welcher
 * Stufe. Eine Klasse zählt mit ihrer eigenen Stufe (die Kante `hasClass`),
 * ihre Unterklasse mit derselben; Abstammung, Hintergrund und Talente mit
 * der Gesamtstufe. Talente kommen hinzu, wenn eine Quelle sie gewährt
 * (`grants`) oder die Figur sie gewählt hat (`chose` mit einer Id) — ein
 * gewähltes Talent fragt selbst wieder (+1 auf welches Attribut?).
 */
export function choiceSources(character: Entity, byId: ReadonlyMap<EntityId, Entity>): ChoiceSource[] {
  const gesamt = characterLevel(character);
  const raus: ChoiceSource[] = [];
  const gesehen = new Set<EntityId>();
  const dazu = (id: unknown, level: number, via: string, start?: boolean) => {
    if (typeof id !== 'string' || gesehen.has(id)) return;
    const e = byId.get(id);
    if (!e) return;
    gesehen.add(id);
    raus.push({ entity: e, level, via, ...(start === undefined ? {} : { start }) });
  };
  let ersteKlasse = true;
  for (const r of character.relations ?? []) {
    if (r.type === 'hasClass') {
      const l = Number(r.props?.['level']) || 1;
      dazu(r.to, l, 'hasClass', ersteKlasse);
      dazu(r.props?.['subclass'], l, 'subclass');
      ersteKlasse = false;
    } else if (r.type === 'hasAncestry' || r.type === 'hasBackground') dazu(r.to, gesamt, r.type);
  }
  /* Was eine Quelle fest gewährt oder die Figur gewählt hat und selbst
     fragt — bis nichts Neues mehr dazukommt. */
  const antworten = answersOf(character);
  for (let i = 0; i < raus.length; i++) {
    const q = raus[i]!;
    for (const r of q.entity.relations ?? []) {
      if (r.type !== 'grants') continue;
      const ab = Number(r.props?.['level']) || 1;
      if (ab <= q.level && choicesOf(byId.get(r.to)).length) dazu(r.to, gesamt, 'grants');
    }
    for (const a of antworten) {
      if (a.source !== q.entity.id) continue;
      for (const p of a.picks) if (choicesOf(byId.get(p)).length) dazu(p, gesamt, 'chose');
    }
  }
  return raus;
}

/** Eine Wahl, die an der Figur gilt: die Quelle, die Wahl, die Antwort. */
export interface ChoiceAtCharacter {
  source: ChoiceSource;
  choice: Choice;
  /** Die Antwort — gespeichert oder, ohne Spielraum, von selbst. */
  picks?: string[];
  /** Ohne gespeicherte Antwort beantwortet, weil es nichts zu wählen gab. */
  fixed?: boolean;
}

/** Jede Wahl, die an der Figur auf ihrer Stufe gilt, mit Antwort, wo es eine gibt. */
export function choicesAtCharacter(character: Entity, byId: ReadonlyMap<EntityId, Entity>): ChoiceAtCharacter[] {
  const antworten = new Map(answersOf(character).map((a) => [`${a.source}#${a.choice}`, a] as const));
  const raus: ChoiceAtCharacter[] = [];
  for (const q of choiceSources(character, byId)) {
    for (const c of choicesOf(q.entity)) {
      if ((c.level ?? 1) > q.level) continue;
      /* Die Startwahl einer Klasse gilt nur für die erste, die Wahl beim
         Mehrklassen-Einstieg nur für jede weitere. */
      if (q.start !== undefined && ((c.when === 'start' && !q.start) || (c.when === 'multiclass' && q.start))) continue;
      const a = antworten.get(`${q.entity.id}#${c.id}`);
      const fest = a ? undefined : fixedPicks(c);
      raus.push({ source: q, choice: c, ...(a ? { picks: a.picks } : fest ? { picks: fest, fixed: true } : {}) });
    }
  }
  return raus;
}

/** Was noch zu wählen ist: die Schritte, die ein Assistent daraus baut (T-080). */
export function pendingChoices(character: Entity, byId: ReadonlyMap<EntityId, Entity>): ChoiceAtCharacter[] {
  return choicesAtCharacter(character, byId).filter((c) => !c.picks);
}

/**
 * **Verwaiste Antworten**: die Quelle hängt nicht mehr an der Figur, oder
 * sie stellt die Wahl nicht mehr. Gezeigt, nicht gelöscht — wer die Wahl
 * am Artikel umbenannt hat, will die Antwort vielleicht zurück.
 */
export function orphanAnswers(character: Entity, byId: ReadonlyMap<EntityId, Entity>): ChoiceAnswer[] {
  const quellen = new Map(choiceSources(character, byId).map((q) => [q.entity.id, q] as const));
  return answersOf(character).filter((a) => {
    const q = quellen.get(a.source);
    return !q || !choicesOf(q.entity).some((c) => c.id === a.choice);
  });
}

/** Was die Wahlen einer Figur ergeben — beim Lesen gerechnet (D8). */
export interface ChosenResult {
  /** Übungen aus Wahlen der Sorte `proficiency`, als Namen. */
  proficiencies: string[];
  /** Attributsboni: fest aus `Ancestry.abilityBonus`, dazu aus Wahlen der Sorte `ability`. */
  abilityBonus: Record<string, number>;
  /** Gewählte Artikel (Talent, Zauber, Merkmal, Unterklasse), nach Sorte. */
  articles: { kind: string; id: EntityId; source: EntityId }[];
  /** Gewählte Ausrüstung: der Schlüssel der Möglichkeit, samt Beschriftung. */
  equipment: { source: EntityId; choice: string; key: string; label: string }[];
}

export function chosenResult(character: Entity, byId: ReadonlyMap<EntityId, Entity>): ChosenResult {
  const raus: ChosenResult = { proficiencies: [], abilityBonus: {}, articles: [], equipment: [] };
  const bonus = (a: string, n: number) => {
    if (!Number.isFinite(n) || !a) return;
    raus.abilityBonus[a] = (raus.abilityBonus[a] ?? 0) + n;
  };
  for (const q of choiceSources(character, byId)) {
    if (q.via !== 'hasAncestry') continue;
    const fest = q.entity.components?.['Ancestry']?.['abilityBonus'];
    if (fest && typeof fest === 'object') for (const [a, n] of Object.entries(fest)) bonus(a, Number(n));
  }
  for (const { source, choice, picks } of choicesAtCharacter(character, byId)) {
    if (!picks?.length) continue;
    const n = choice.count ?? 1;
    const genommen = picks.slice(0, n);
    switch (choice.kind) {
      case 'proficiency':
        for (const p of genommen) if (!raus.proficiencies.includes(p)) raus.proficiencies.push(p);
        break;
      case 'ability':
        genommen.forEach((a, i) => bonus(a, choice.bonus?.[i] ?? choice.bonus?.[0] ?? 1));
        break;
      case 'equipment':
        for (const k of genommen) {
          raus.equipment.push({
            source: source.entity.id,
            choice: choice.id,
            key: k,
            label: choice.from?.options?.find((o) => o.key === k)?.label ?? k,
          });
        }
        break;
      default:
        for (const id of genommen) raus.articles.push({ kind: choice.kind, id, source: source.entity.id });
    }
  }
  return raus;
}

/**
 * **Eine Id aus dem Text** (`skills`, `fighting-style-2`): klein, mit
 * Bindestrichen. Gibt es sie schon, kommt die nächste freie Endung dazu —
 * gezählt wird nur, wenn zwei Wahlen denselben Text tragen.
 */
export function choiceId(text: string, taken: Iterable<string> = []): string {
  const basis = text
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'choice';
  const belegt = new Set(taken);
  if (!belegt.has(basis)) return basis;
  for (let i = 2; ; i++) if (!belegt.has(`${basis}-${i}`)) return `${basis}-${i}`;
}

/**
 * **Eine Wahl als Satz** — für Ansichten, die sie nur nennen (die
 * Klassenansicht, eine Listenzeile): „Choose 2 from Athletics, Perception",
 * „(a) chain mail or (b) leather armor", „+2/+1 from str, dex, con".
 */
export function choiceText(c: Choice): string {
  const n = c.count ?? 1;
  const f = c.from ?? {};
  let satz: string;
  if (f.options?.length) satz = f.options.map((o) => `(${o.key}) ${o.label}`).join(' or ');
  else if (c.kind === 'ability' && f.values?.length) {
    const b = c.bonus?.length ? c.bonus : [1];
    satz = `${b.map((x) => `+${x}`).join('/')}${b.length < n ? ` to ${n}` : ''} from ${f.values.join(', ')}`;
  } else if (f.values?.length) satz = `Choose ${n} from ${f.values.join(', ')}`;
  else if (f.interfaces?.length) satz = `Choose ${n} ${[...(f.tags ?? []), f.interfaces.join(' or ').toLowerCase()].join(' ')}`;
  else if (f.enumRef?.length) satz = `Choose ${n} from ${f.enumRef.join(', ')}`;
  else satz = c.note ?? `Choose ${n}`;
  const zusatz = [c.note && satz !== c.note ? c.note : '', c.when === 'start' ? 'first class only' : c.when === 'multiclass' ? 'when multiclassing' : '']
    .filter(Boolean)
    .join('; ');
  return zusatz ? `${satz} (${zusatz})` : satz;
}
