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
 *
 * **Ein Merkmal, das mehrfach gewährt wird, fragt jedes Mal** (T-107,
 * E-027): „Ability Score Improvement" ist ein Artikel, den der Kämpfer auf
 * Stufe 4, 6, 8 … bekommt (`grants` mit `props.level`, D50). Jede dieser
 * Kanten macht das Merkmal zu einer eigenen Quelle (`ChoiceSource.grant`),
 * und die Antwort merkt sich, zu welcher sie gehört (`chose` mit
 * `props.by` und `props.level`). Sieben Kanten tragen so sieben Antworten
 * — für jedes Merkmal, nicht nur für dieses.
 */

import { entityName } from './entity.js';
import { itemSlotIn } from './slots.js';
import type { Entity, EntityId } from './types.js';

/** Die Sorten einer Wahl. Die Liste steht am Feld (`Choices.choices`). */
export const CHOICE_KINDS = ['proficiency', 'ability', 'feat', 'spell', 'equipment', 'feature', 'subclass', 'option'] as const;
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
  /**
   * Nur Artikel, auf die dieser Artikel mit dieser Kante zeigt (T-309):
   * `{type: 'spellList', from: <Klasse>}` — die Zauberliste der Klasse.
   * Die Gegenrichtung von `edge`.
   */
  listedBy?: { type: string; from: EntityId };
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
  /**
   * Derselbe Wert darf mehrmals gewählt werden (T-107): „+1 auf zwei
   * Attribute, dasselbe zweimal erlaubt" ist +2 auf eines.
   */
  repeat?: boolean;
  /**
   * Gilt nur, wenn eine andere Wahl **derselben Quelle** diesen Wert trägt
   * (T-107): die Attributspunkte nur, wenn die Steigerung gewählt ist, das
   * Talent nur an ihrer Stelle. Die genannte Wahl steht davor.
   */
  onlyIf?: { choice: string; pick: string };
  /**
   * Gilt, solange niemand anders geantwortet hat (`assumed`). Eine Wahl
   * zwischen zwei Wegen hat so einen gewöhnlichen, und die Wahlen dahinter
   * stehen sofort da.
   */
  default?: string[];
  /** Bei `spell` (T-309): das Attribut des gewählten Zaubers (sonst das der Quelle) und wie er gilt. */
  ability?: string;
  mode?: 'prepared' | 'known' | 'innate';
  note?: string;
}

/**
 * **Welche Gewährung**: der Artikel, der das Merkmal gewährt (`by`), und
 * die Stufe an seiner Kante `grants` (T-107).
 */
export interface ChoiceGrant {
  by: EntityId;
  level: number;
}

/** Eine Antwort der Figur: die Kante `chose`, gelesen. */
export interface ChoiceAnswer {
  /** Der Artikel, der fragt. */
  source: EntityId;
  choice: string;
  picks: string[];
  relationId: string;
  /** Zu welcher Gewährung (`props.by`, `props.level`); fehlt an älteren Antworten. */
  grant?: ChoiceGrant;
  /**
   * Was in die offenen Stellen der gewählten Möglichkeit kommt (T-162,
   * `props.items`): Artikel-Ids der Reihe nach, Stelle für Stelle, `''`
   * für eine noch leere — „two martial weapons" sind zwei Einträge.
   */
  items?: string[];
}

/** Eine Quelle von Wahlen an einer Figur, mit der Stufe, die für sie zählt. */
export interface ChoiceSource {
  entity: Entity;
  level: number;
  /** Woher: `hasClass`, `subclass`, `hasAncestry`, `hasBackground`, `grants`, `chose`. */
  via: string;
  /** Bei einer Klasse: ist es die erste der Figur (die erste Kante `hasClass`)? */
  start?: boolean;
  /** Über `grants` erreicht: welche Kante — je Kante eine Quelle (T-107). */
  grant?: ChoiceGrant;
}

/** Wo eine Antwort hingehört: `quelle#wahl`, mit Gewährung `quelle#wahl@von:stufe`. */
export function answerKey(source: EntityId, choice: string, grant?: ChoiceGrant): string {
  return grant ? `${source}#${choice}@${grant.by}:${grant.level}` : `${source}#${choice}`;
}

/** Die Wahlen eines Artikels, in der gespeicherten Reihenfolge. */
export function choicesOf(e: Entity | undefined): Choice[] {
  const roh = e?.components?.['Choices']?.['choices'];
  if (!Array.isArray(roh)) return [];
  return roh
    .filter((c): c is Choice => !!c && typeof c === 'object' && typeof (c as Choice).id === 'string' && !!(c as Choice).id)
    .map(sprachwahl)
    .map(werkzeugwahl);
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

/**
 * **Eine Werkzeugwahl zieht aus ihrer Sorte** (T-162): „1 any artisans
 * tool tool of your choice" und „three musical instruments of your
 * choice" standen als Satz an einer Übungswahl, die aus **jedem**
 * Gegenstand zog oder gar aus keinem (ein Freitext). Nennt der Satz eine
 * Gegenstandssorte (`itemSlotIn`), zieht die Wahl aus den `Item`-Artikeln
 * dieser Sorte (`where` auf `Item.itemType`), und ohne `count` gilt die
 * Zahl im Satz. Gespeichert wird nichts davon, wie bei der Sprachwahl.
 */
function werkzeugwahl(c: Choice): Choice {
  if ((c.kind ?? 'proficiency') !== 'proficiency' || !c.note) return c;
  const f = c.from ?? {};
  const nurItem = !Object.keys(f).length || (Object.keys(f).length === 1 && f.enumRef?.length === 1 && f.enumRef[0] === 'Item');
  if (!nurItem) return c;
  const stelle = itemSlotIn(c.note);
  if (!stelle || stelle.type !== 'Item' || !stelle.itemTypes?.length) return c;
  return {
    ...c,
    from: { enumRef: ['Item'], where: { component: 'Item', property: 'itemType', value: stelle.itemTypes } },
    count: c.count ?? stelle.count,
  };
}

/** Die Antworten einer Figur: jede Kante `chose`. */
export function answersOf(character: Entity | undefined): ChoiceAnswer[] {
  const raus: ChoiceAnswer[] = [];
  for (const r of character?.relations ?? []) {
    if (r.type !== 'chose') continue;
    const choice = r.props?.['choice'];
    if (typeof choice !== 'string' || !choice) continue;
    const picks = Array.isArray(r.props?.['picks']) ? (r.props['picks'] as unknown[]).map(String) : [];
    const by = r.props?.['by'];
    const level = Number(r.props?.['level']);
    const grant = typeof by === 'string' && by && Number.isFinite(level) && level >= 1 ? { by, level } : undefined;
    const items = Array.isArray(r.props?.['items']) ? (r.props['items'] as unknown[]).map((x) => (typeof x === 'string' ? x : '')) : undefined;
    raus.push({ source: r.to, choice, picks, relationId: r.id, ...(grant ? { grant } : {}), ...(items?.some(Boolean) ? { items } : {}) });
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
  const gesehen = new Set<string>();
  const dazu = (id: unknown, level: number, via: string, start?: boolean, grant?: ChoiceGrant) => {
    if (typeof id !== 'string') return;
    const schluessel = grant ? `${id}@${grant.by}:${grant.level}` : id;
    if (gesehen.has(schluessel)) return;
    const e = byId.get(id);
    if (!e) return;
    gesehen.add(schluessel);
    raus.push({ entity: e, level, via, ...(start === undefined ? {} : { start }), ...(grant ? { grant } : {}) });
  };
  let ersteKlasse = true;
  for (const r of character.relations ?? []) {
    if (r.type === 'hasClass') {
      const l = Number(r.props?.['level']) || 1;
      dazu(r.to, l, 'hasClass', ersteKlasse);
      dazu(r.props?.['subclass'], l, 'subclass');
      ersteKlasse = false;
    } else if (r.type === 'hasAncestry') {
      /* Eine Unterart bringt ihre Grundart mit (T-193): „Elf (High)" trägt
         nur, was die Hochelfen anders haben — Dex +2, Darkvision und Trance
         stehen am Elf (`subraceOf`, C4). */
      for (const id of ancestryLine(r.to, byId)) dazu(id, gesamt, r.type);
    } else if (r.type === 'hasBackground') dazu(r.to, gesamt, r.type);
  }
  /* Was eine Quelle fest gewährt oder die Figur gewählt hat und selbst
     fragt — bis nichts Neues mehr dazukommt. */
  const antworten = answersOf(character);
  for (let i = 0; i < raus.length; i++) {
    const q = raus[i]!;
    for (const r of q.entity.relations ?? []) {
      if (r.type !== 'grants') continue;
      const ab = Number(r.props?.['level']) || 1;
      if (ab <= q.level && choicesOf(byId.get(r.to)).length) dazu(r.to, gesamt, 'grants', undefined, { by: q.entity.id, level: ab });
    }
    for (const a of antworten) {
      if (a.source !== q.entity.id) continue;
      for (const p of a.picks) if (choicesOf(byId.get(p)).length) dazu(p, gesamt, 'chose');
    }
  }
  return raus;
}

/**
 * **Eine Herkunft und ihre Grundarten** (T-193): der Artikel, dann der, auf
 * den er mit `subraceOf` zeigt, und so weiter — die Unterart zuerst. Fehlt
 * ein Glied in `byId` oder schliesst sich ein Kreis, endet die Reihe dort.
 */
export function ancestryLine(id: EntityId, byId: ReadonlyMap<EntityId, Entity>): EntityId[] {
  const raus: EntityId[] = [];
  let jetzt: EntityId | undefined = id;
  while (jetzt && !raus.includes(jetzt) && byId.has(jetzt) && raus.length < 4) {
    raus.push(jetzt);
    jetzt = byId.get(jetzt)!.relations?.find((r) => r.type === 'subraceOf')?.to;
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
  /** Ohne gespeicherte Antwort beantwortet mit der Vorgabe der Wahl (`default`). */
  assumed?: boolean;
  /** Die Kante `chose`, aus der die Antwort kommt. */
  relationId?: string;
  /** Die Stücke für die offenen Stellen der gewählten Möglichkeit (T-162). */
  items?: string[];
}

/**
 * Jede Wahl, die an der Figur auf ihrer Stufe gilt, mit Antwort, wo es eine
 * gibt. Eine Antwort gehört zu ihrer Gewährung (`answerKey`); eine ältere
 * ohne Gewährung nimmt die **erste** Quelle dieses Artikels, die sie
 * brauchen kann — so steht, was vor T-107 gewählt wurde, weiter da.
 */
export function choicesAtCharacter(character: Entity, byId: ReadonlyMap<EntityId, Entity>): ChoiceAtCharacter[] {
  const antworten = new Map<string, ChoiceAnswer>();
  for (const a of answersOf(character)) {
    const k = answerKey(a.source, a.choice, a.grant);
    if (!antworten.has(k)) antworten.set(k, a);
  }
  const verbraucht = new Set<string>();
  const raus: ChoiceAtCharacter[] = [];
  for (const q of choiceSources(character, byId)) {
    /* Was diese Quelle schon beantwortet hat — für `onlyIf`. */
    const hier = new Map<string, string[]>();
    for (const c of choicesOf(q.entity)) {
      if ((c.level ?? 1) > q.level) continue;
      /* Die Startwahl einer Klasse gilt nur für die erste, die Wahl beim
         Mehrklassen-Einstieg nur für jede weitere. */
      if (q.start !== undefined && ((c.when === 'start' && !q.start) || (c.when === 'multiclass' && q.start))) continue;
      if (c.onlyIf && !(hier.get(c.onlyIf.choice) ?? []).includes(c.onlyIf.pick)) continue;
      let a = antworten.get(answerKey(q.entity.id, c.id, q.grant));
      if (!a && q.grant) {
        const alt = antworten.get(answerKey(q.entity.id, c.id));
        if (alt && !verbraucht.has(alt.relationId)) a = alt;
      }
      if (a && verbraucht.has(a.relationId)) a = undefined;
      if (a) verbraucht.add(a.relationId);
      const fest = a ? undefined : fixedPicks(c);
      const vorgabe = a || fest || !c.default?.length ? undefined : [...c.default];
      const eintrag: ChoiceAtCharacter = a
        ? { source: q, choice: c, picks: a.picks, relationId: a.relationId, ...(a.items ? { items: a.items } : {}) }
        : fest
          ? { source: q, choice: c, picks: fest, fixed: true }
          : vorgabe
            ? { source: q, choice: c, picks: vorgabe, assumed: true }
            : { source: q, choice: c };
      if (eintrag.picks) hier.set(c.id, eintrag.picks);
      raus.push(eintrag);
    }
  }
  return raus;
}

/** Was noch zu wählen ist: die Schritte, die ein Assistent daraus baut (T-080). */
export function pendingChoices(character: Entity, byId: ReadonlyMap<EntityId, Entity>): ChoiceAtCharacter[] {
  return choicesAtCharacter(character, byId).filter((c) => !c.picks);
}

/**
 * **Verwaiste Antworten**: die Quelle hängt nicht mehr an der Figur, sie
 * stellt die Wahl nicht mehr, oder die Gewährung, zu der die Antwort
 * gehört, gibt es nicht mehr (T-107). Gezeigt, nicht gelöscht — wer die
 * Wahl am Artikel umbenannt hat, will die Antwort vielleicht zurück.
 */
export function orphanAnswers(character: Entity, byId: ReadonlyMap<EntityId, Entity>): ChoiceAnswer[] {
  const quellen = new Map<EntityId, ChoiceSource[]>();
  for (const q of choiceSources(character, byId)) quellen.set(q.entity.id, [...(quellen.get(q.entity.id) ?? []), q]);
  return answersOf(character).filter((a) => {
    const qs = quellen.get(a.source);
    if (!qs || !choicesOf(qs[0]!.entity).some((c) => c.id === a.choice)) return true;
    return !!a.grant && !qs.some((q) => q.grant?.by === a.grant!.by && q.grant.level === a.grant!.level);
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
  equipment: { source: EntityId; choice: string; key: string; label: string; items?: string[] }[];
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
  for (const { source, choice, picks, items } of choicesAtCharacter(character, byId)) {
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
      /* Eine Möglichkeit steuert nur, welche Wahlen dahinter gelten. */
      case 'option':
        break;
      case 'equipment':
        for (const k of genommen) {
          raus.equipment.push({
            source: source.entity.id,
            choice: choice.id,
            key: k,
            label: choice.from?.options?.find((o) => o.key === k)?.label ?? k,
            ...(items ? { items } : {}),
          });
        }
        break;
      default:
        for (const id of genommen) raus.articles.push({ kind: choice.kind, id, source: source.entity.id });
    }
  }
  return raus;
}

/** Was am Tisch gilt und die Wahlen einengt (T-107). */
export interface ChoiceRules {
  /** Erlaubt die Kampagne Talente? `false` nimmt das Talent als Ausweg weg. */
  feats?: boolean;
}

/**
 * **Welche Möglichkeiten eine Wahl anbietet** (T-107). Erlaubt die
 * Kampagne keine Talente, fällt eine Möglichkeit weg, hinter der nur
 * Talentwahlen stehen (`onlyIf`) — „Steigerung oder Talent" wird dann
 * „Steigerung", und mit einer Möglichkeit allein ist es kein Schritt mehr.
 */
export function offeredOptions(choice: Choice, siblings: readonly Choice[], rules: ChoiceRules = {}): { key: string; label: string }[] {
  const alle = choice.from?.options ?? [];
  if (rules.feats !== false) return alle;
  return alle.filter((o) => {
    const dahinter = siblings.filter((c) => c.onlyIf?.choice === choice.id && c.onlyIf.pick === o.key);
    return !dahinter.length || dahinter.some((c) => c.kind !== 'feat');
  });
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
  if (f.options?.length && c.kind === 'option') satz = f.options.map((o) => o.label).join(' or ');
  else if (f.options?.length) satz = f.options.map((o) => `(${o.key}) ${o.label}`).join(' or ');
  else if (c.kind === 'ability' && f.values?.length) {
    const b = c.bonus?.length ? c.bonus : [1];
    satz = `${b.map((x) => `+${x}`).join('/')}${b.length < n ? ` to ${n}` : ''} from ${f.values.join(', ')}${c.repeat ? ' (the same one more than once allowed)' : ''}`;
  } else if (f.values?.length) satz = `Choose ${n} from ${f.values.join(', ')}`;
  else if (f.interfaces?.length) satz = `Choose ${n} ${[...(f.tags ?? []), f.interfaces.join(' or ').toLowerCase()].join(' ')}`;
  /* Eine Werkzeugwahl sagt in ihrer Notiz, aus welcher Sorte (T-162). */
  else if (f.enumRef?.length && f.where && c.note) satz = c.note;
  else if (f.enumRef?.length) satz = `Choose ${n} from ${f.enumRef.join(', ')}`;
  else satz = c.note ?? `Choose ${n}`;
  const zusatz = [c.note && satz !== c.note ? c.note : '', c.when === 'start' ? 'first class only' : c.when === 'multiclass' ? 'when multiclassing' : '']
    .filter(Boolean)
    .join('; ');
  return zusatz ? `${satz} (${zusatz})` : satz;
}

/* Wie eine Übungswahl heisst, nach ihrer Id (`skills`, `multiclass-tools-2`). */
const UEBUNG: Record<string, string> = {
  skills: 'Skill proficiencies',
  languages: 'Languages',
  tools: 'Tool proficiencies',
  weapons: 'Weapon proficiencies',
  armor: 'Armor proficiencies',
  'other-proficiencies': 'Other proficiencies',
};
const SORTE: Record<string, string> = {
  equipment: 'Starting equipment',
  ability: 'Ability score increase',
  feat: 'Feat',
  spell: 'Spell',
  subclass: 'Subclass',
  feature: 'Feature',
  option: 'Option',
  proficiency: 'Proficiency',
};

/** `fighting-style-2` → „Fighting style". */
function ausId(id: string): string {
  const t = id.replace(/^multiclass-/, '').replace(/-\d+$/, '').replace(/-/g, ' ').trim();
  return t ? t[0]!.toUpperCase() + t.slice(1) : '';
}

/**
 * **Wie eine Wahl heisst** (T-162): „Skill proficiencies (choose 2)",
 * „Starting equipment", „Fighting Style". Eine kurze Notiz ist der Name,
 * den der Artikel ihr gibt; sonst sagt es die Id (eine Übungswahl) oder
 * die Sorte. Was sie anbietet, sagt `choiceText` — das hier ist die
 * Überschrift.
 */
export function choiceLabel(c: Choice): string {
  const kind = String(c.kind ?? 'proficiency');
  const basis = c.id.replace(/^multiclass-/, '').replace(/-\d+$/, '');
  const notiz = c.note?.trim() ?? '';
  const kurz = notiz && notiz.length <= 32 && !notiz.includes('[[') && !/^\d|\bof your choice\b|^also:/i.test(notiz) ? notiz : '';
  let name: string;
  /* Eine Wahl aus Gegenständen ist eine Werkzeugwahl, wie auch immer ihre Id heisst. */
  if (kind === 'proficiency' && c.from?.enumRef?.length === 1 && c.from.enumRef[0] === 'Item') name = UEBUNG['tools']!;
  else if (kind === 'proficiency') name = UEBUNG[basis] ?? (kurz || ausId(c.id) || SORTE['proficiency']!);
  else if (kind === 'equipment') name = SORTE['equipment']!;
  else if (kind === 'subclass') name = ausId(c.id) || SORTE['subclass']!;
  else name = kurz || (kind === 'spell' && (c.count ?? 1) > 1 ? 'Spells' : SORTE[kind] ?? (ausId(c.id) || kind));
  const n = c.count ?? 1;
  const teile = [n > 1 && kind !== 'equipment' ? `choose ${n}` : '', c.when === 'multiclass' ? 'multiclass' : ''].filter(Boolean);
  return teile.length ? `${name} (${teile.join(', ')})` : name;
}

/**
 * **Die Überschrift einer Wahl an der Figur**: „Fighter · Skill
 * proficiencies (choose 2)". Der Name der Quelle steht in `Identity`
 * (`entityName`) — an einem eingelesenen Artikel ist `name` leer, und die
 * Überschrift hiess „: equipment".
 */
export function choiceTitle(at: ChoiceAtCharacter): string {
  return `${entityName(at.source.entity)} · ${choiceLabel(at.choice)}`;
}
