/**
 * Der einzige Weg ans Backend.
 *
 * Alles geht über `fetch` mit `credentials: 'include'` — der Sitzungskeks
 * ist `httpOnly` und wird vom Browser mitgeschickt; die Anwendung sieht ihn
 * nie und kann ihn deshalb auch nicht verlieren.
 *
 * Fehler kommen als `ApiError` mit dem Status zurück, nicht als geworfener
 * Text: „401" und „422" heissen am Tisch Verschiedenes, und eine Maske, die
 * beides gleich behandelt, sagt dem Nutzer das Falsche.
 */

import { Injectable, signal } from '@angular/core';
import type { AbilityMethod, Audience, AudienceSource, TransformStep, VisibilityRule, AssetMeta, Entity, EquipmentMethod, GlossaryEntry, GoldRoll, HitPointRule, MapRules, Purchase, Registry, RegistryUsage, Relation, RollEntry, PlanStep, PlanTile, RolledScores, RuleSortState, TurnPlan } from '@nw/model';

export class ApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
    readonly issues?: unknown,
    /** Die ganze Antwort — eine abgelehnte Massenänderung sagt darin, was und warum. */
    readonly body?: unknown,
  ) {
    super(message);
  }
}

/* ------------------------------------------------------------ Werkbank (W9) */

export interface CheckHit {
  id: string;
  name: string;
  type: string;
  reason: string;
  group?: string[];
  /** Eine Registerzeile statt eines Artikels (T-123): Abfrage für `/registry`. */
  registry?: Record<string, string>;
}
export interface CheckResult {
  key: string;
  label: string;
  description: string;
  count: number;
  hits: CheckHit[];
  ms: number;
}
export interface ChecksAntwort {
  total: number;
  ms: number;
  checks: CheckResult[];
}
export interface BulkZeile {
  id: string;
  name: string;
  type: string;
  change: 'update' | 'delete' | 'create';
  summary: string[];
}
export interface BulkAntwort {
  dryRun: boolean;
  selected: number;
  changed: number;
  deleted: number;
  examples: BulkZeile[];
  rejected: { id: string; name: string; type: string; issues: string[] }[];
  rejectedCount: number;
  skipped: { id: string; name: string; type: string; reason: string }[];
  skippedCount: number;
  ms: number;
  id?: string | null;
  error?: string;
}
export interface BulkLauf {
  id: string;
  at: string;
  undone: boolean;
  by?: { id: string; name: string };
  token?: string | null;
  changed: number;
  deleted: number;
  summary?: string[];
}
/** Die Übernahme dev ↔ prod (T-130). */
export interface TransferStand {
  env: string | null;
  accept: boolean;
  canTrigger: boolean;
  backup: boolean;
  peer: { name: string; url: string } | null;
  peerState: { env?: string | null; accept?: boolean; articles?: number; error?: string } | null;
  runs: TransferLauf[];
}
export interface TransferLauf {
  id: string;
  at: string;
  kind: 'transfer' | 'transfer.clone';
  undone: boolean;
  direction?: 'push' | 'pull' | 'clone';
  by?: { id: string; name: string };
  items?: { id: string; name: string; type: string; status: string }[];
  count?: number;
  backup?: string | null;
}
export interface TransferFeld {
  key: string;
  kind: 'types' | 'field' | 'adhoc' | 'edge';
  base?: unknown;
  source?: unknown;
  target?: unknown;
  state: 'same' | 'source' | 'target' | 'conflict';
}
export interface TransferEintrag {
  id: string;
  kind: 'entity' | 'registry';
  name: string;
  type: string;
  number: string;
  layers: string[];
  status: 'new' | 'changed' | 'unchanged' | 'conflict' | 'target-ahead';
  fields: TransferFeld[];
  sourceKey: string;
  targetKey: string;
}
export interface TransferVorschau {
  direction: 'push' | 'pull';
  source: string;
  target: string;
  items: TransferEintrag[];
  counts: Record<string, number>;
  ms: number;
}
export interface TransferErgebnis {
  id: string;
  direction: 'push' | 'pull';
  written: number;
  numbers: Record<string, string>;
  notAligned?: { id: string; name: string; issues: string[] }[];
  backup?: string | null;
}
export interface KlonAntwort {
  dryRun?: boolean;
  here?: number;
  incoming?: number;
  text?: string;
  id?: string;
  backup?: string;
  written?: number;
  removed?: number;
  files?: number;
}

export interface UndoAntwort {
  dryRun?: boolean;
  restored: number;
  conflicts: { id: string; name: string; reason: string }[];
  rejected: { id: string; name: string; issues: string[] }[];
  error?: string;
}
export interface TokenZeile {
  id: string;
  name: string;
  scope: 'read' | 'write';
  expiresAt: string;
  createdAt: string | null;
  lastUsedAt: string | null;
  /** Nur in der Antwort auf das Anlegen — einmal. */
  token?: string;
}

/** Eine Kante, die auf einen Artikel zeigt — mit der Kurzfassung ihres Ursprungs. */
export interface Rueckbezug {
  from: Entity;
  relation: Relation;
}

/** Wohin Sachen wandern können (T-127): das Regelset der Kampagne, ihre Gruppen und deren Figuren. */
export interface InventarLage {
  campaign: { id: string; name: string } | null;
  rules: 'grid' | 'weight' | 'slots';
  /** Wie lange Unverstautes liegen darf (T-140); fehlt es, beliebig lange. */
  stowing?: 'anytime' | 'bySessionEnd' | 'immediately';
  parties: {
    id: string;
    name: string;
    inventory: string | null;
    members: { id: string; name: string; inventory: string | null }[];
  }[];
}

/** Ein Spieler der laufenden Kampagne: sein Name und die Figuren, die er führt (T-100). */
export interface Spieler {
  name: string;
  actors: { id: string; name: string }[];
}

export type TableRole = 'gm' | 'co-gm' | 'player' | 'spectator';
export const TABLE_ROLES: readonly TableRole[] = ['gm', 'co-gm', 'player', 'spectator'];

/**
 * Die Namen, die ein geöffneter Artikel braucht (W7): Kantenziele,
 * Verweisfelder, Sichtbarkeitslisten (`names`) und die Treffer jedes
 * `[[…]]` (`links`). Der Server rechnet sie beim Ausliefern, gespeichert
 * werden sie nie.
 */
export interface Bezuege {
  names: Record<string, string>;
  links: Record<string, { id: string; name: string }[]>;
  /** Lässt sich für die laufende Kampagne anpassen (E-018, T-082) — die Regeln der Route `adapt`. */
  adaptable?: boolean;
  /** In welche Ebenen eine Fassung ginge (T-098): wer den Artikel nicht
   *  schreibt, bekommt an „Edit" eine Fassung in einer davon. */
  adaptTo?: { id: string; name: string }[];
  /** Wohin sich der Artikel in die Geschichte holen lässt (E-026): die laufende
   *  Kampagne und ihre Arcs — leer heisst, nicht anbieten. */
  takeInto?: { id: string; name: string; type: string }[];
  /**
   * **Ein älterer fertiger Stand gilt** (REQ-237, E-012): nur für wen den
   * Arbeitsstand sieht (Verfasserin, Leitung). `at` ist das Datum des
   * fertigen Stands, `old`, ob die Antwort dieser Stand ist (`?stand=ready`).
   */
  ready?: { at: string; old: boolean };
  /** „Im Buch lesen" (T-091): die Ebene mit Text und die Stelle — der Abschnitt selbst oder die Seite. */
  reading?: LeseZiel;
  /** Eine Fassung aus einer Vergleichsebene (T-092): nicht im Spiel, auf Wunsch sichtbar. */
  compare?: boolean;
  /** Die Leitung kann ihn einzeln in die laufende Kampagne holen (T-187) … */
  enable?: { campaign: string };
  /** … oder hat es getan: zurück an derselben Stelle. */
  enabled?: { campaign: string };
  /** Womit an einem Rezept gefertigt wird (T-122): am Tisch und je eigener Figur. */
  craft?: Fertigungswerte;
  /** Was ein Laden führt, und zu welchem Preis (T-129). */
  shop?: Ladenwaren;
}

/** Wer einen Fertigungswert gesetzt hat (`craftCheck`): die Quelle oder ein Träger einer `craftsWith`-Kante. */
export interface FertigungsQuelle {
  by: 'recipe' | 'campaign' | 'party' | 'actor';
  holder?: string;
  name?: string;
  on?: 'recipe' | 'tool';
}
export interface Fertigungswert {
  tool: string;
  ability: string;
  dc: number;
  source: { tool: FertigungsQuelle; ability: FertigungsQuelle; dc: FertigungsQuelle };
}
export interface Fertigungswerte {
  table: Fertigungswert;
  mine: { id: string; name: string; check: Fertigungswert }[];
}

/** Woher ein Abschlag am Preis kommt (`shopWares`, T-129); Namen nur, wo der Betrachter den Geber sieht. */
export interface Preisschritt {
  by: 'shop' | 'ware' | 'discount';
  giver?: string;
  giverName?: string;
  target?: string;
  targetName?: string;
  rank?: string;
  mod: string;
  delta: number;
  invalid?: boolean;
}
export interface Ware {
  edge: string;
  item: string;
  name: string;
  qty?: number;
  available: boolean;
  list?: number;
  /** Woher der Listenpreis kommt (`Item.priceNote`, T-139). */
  listNote?: string;
  base?: number;
  price?: number;
  steps: Preisschritt[];
}
/** Ein Stück, das die Figur diesem Laden verkaufen kann (T-133), mit dem Ankaufspreis. */
export interface Verkaeuflich {
  inventory: string;
  edge: string;
  item: string;
  name: string;
  qty: number;
  price?: number;
}
export interface Ladenwaren {
  table: Ware[];
  /** Je eigener Figur: ihre Preise, ihr Geld und was sie verkaufen kann (T-133) — ohne Inventar fehlt beides. */
  mine: { id: string; name: string; wares: Ware[]; inventory?: string; purse?: number; sellable?: Verkaeuflich[] }[];
}
/** Was ein Handel ergab (T-133): gerechnet am Server. */
export interface Handel {
  item: { id: string; name: string };
  qty: number;
  unit: number;
  total: number;
  copper: number;
}

/** Die Regeln des Handwerks am Tisch (T-128, T-165, `craftRulesOf`): an der Kampagne, in Sätzen. */
export interface HandwerkRegeln {
  failure: string;
  critSuccess: string;
  critFailure: string;
  confirm: string;
  /** Ein Satz je Regel (`craftRuleSentences`). */
  sentences: string[];
  /** Wo sie stehen — die Leitung ändert sie dort. */
  campaign: { id: string; name: string } | null;
}
/** Ein Kreis am Auftrag (T-165): leer, ✓ oder ✗ (ein Wurf mit natürlicher 20/1 als crit…). */
export interface HandwerkKreis {
  index: number;
  mark: 'success' | 'failure' | 'critSuccess' | 'critFailure' | null;
  pending: boolean;
  ignored: boolean;
  open: boolean;
  by?: string;
  total?: number;
  nat?: number;
  dc?: number;
}
/** Ein freies Stück, das ein Rezept braucht, in einem Inventar der Figur oder ihrer Gruppe. */
export interface HandwerkVorrat {
  item: string;
  inventory: string;
  owner: string;
  edge: string;
  qty: number;
}
/**
 * `GET /api/crafting/:id/materials?actor=` — die Materialwahl beim Start
 * (T-197): je Bestandteil, was passt (auch als Ersatz), und was nicht, mit Grund.
 */
export interface HandwerkMaterialwahl {
  actor: { id: string; name: string };
  needs: {
    key: string;
    item: string;
    name: string;
    group: boolean;
    qty: number;
    consumed: boolean;
    options: (HandwerkVorrat & { name: string; ratio: number; via?: { id: string; name: string } })[];
    rejected: (HandwerkVorrat & { name: string; reason: string })[];
  }[];
  substitutions: { id: string; name: string; does: string }[];
}
export interface HandwerkAuftrag {
  id: string;
  name: string;
  actor: { id: string; name: string } | null;
  recipe: { id: string; name: string } | null;
  progress: number;
  needed: number;
  unit: 'checks' | 'days';
  daysLeft: number;
  outcome: 'open' | 'succeeded' | 'failed' | 'aborted';
  /** Wie er beim Abschluss ausginge (aus den Kreisen gerechnet). */
  result: 'open' | 'succeeded' | 'failed' | 'aborted';
  settle: 'success' | 'all' | 'half' | 'none' | null;
  started: string;
  circles: HandwerkKreis[];
  /** Der Verlauf: was jede zählende Probe ausgelöst hat. */
  lines: { index: number; note: string }[];
  waiting: number;
  check: { tool: string; ability: string; dc: number };
  yields: { id: string; name: string; count: number } | null;
  /** `for`: der Bestandteil, für den ein Stück aus einer Gruppe oder als Ersatz steht (T-197). */
  reserved: (HandwerkVorrat & { name: string; consumed: boolean; lost?: number; for?: string })[];
  /** Was die Quelle beim Misslingen sagt — gilt nicht. */
  sourceFailure: string;
  may: { mark: boolean; roll: boolean; work: boolean; confirm: boolean; finish: boolean; abort: boolean; fail: boolean };
}
/** Eine Zeile der Rezeptliste in der Handwerksübersicht (T-196). */
export interface HandwerkRezept {
  id: string;
  name: string;
  trade: string;
  tradeId?: string;
  tools: string[];
  ability: string;
  dc: number | null;
  time: string;
  days: number | null;
  checks: number | null;
  yields: { id: string; name: string; rarity: string } | null;
  needs: { item: string; name: string; qty: number }[];
  /** Ob die Figur es gelernt hat — nur an einer Figur, für Leitung und Führende. */
  learned?: boolean;
}
export interface HandwerkWerkzeug {
  name: string;
  id?: string;
}
/** Beruf, Werkzeug, Figur: was man womit fertigt (T-196). */
export type HandwerkUebersicht =
  | {
      kind: 'trade';
      trade: { id: string; name: string; tools: HandwerkWerkzeug[] };
      recipes: HandwerkRezept[];
      materials: { item: string; name: string; recipes: number; qty: number }[];
    }
  | { kind: 'tool'; tool: { id: string; name: string }; trades: { id: string; name: string }[]; recipes: HandwerkRezept[] }
  | {
      kind: 'actor';
      actor: { id: string; name: string };
      statblock: boolean;
      tools: (HandwerkWerkzeug & { trades: { id: string; name: string }[]; recipes: HandwerkRezept[] })[];
      /** Der Reiter Crafting (T-247): alle Blaupausen, ob das Werkzeug geübt ist. */
      recipes?: (HandwerkRezept & { toolOk: boolean })[];
      /** Freies Material bei der Figur und ihrer Gruppe, nach Grundartikel — nur für sie selbst und die Leitung. */
      stock?: Record<string, { qty: number; where: string[] }>;
      orders?: { id: string; name: string; recipe: { id: string; name: string } | null; progress: number; needed: number; outcome: string }[];
    };

/** `GET /api/crafting/:id` — am Rezept oder am Auftrag (T-128), an Beruf, Werkzeug und Figur (T-196). */
export type Handwerk =
  | HandwerkUebersicht
  | { kind: 'none' }
  | { kind: 'order'; rules: HandwerkRegeln; leitet: boolean; order: HandwerkAuftrag }
  | {
      kind: 'recipe';
      rules: HandwerkRegeln;
      leitet: boolean;
      recipe: { id: string; name: string; unit: 'checks' | 'days'; needed: number; sourceFailure: string; yields: { id: string; name: string } | null };
      needs: { key: string; item: string; name: string; group: boolean; qty: number; consumed: boolean }[];
      actors: { id: string; name: string; learned: boolean; check: { tool: string; ability: string; dc: number }; stock: HandwerkVorrat[] }[];
      orders: { id: string; name: string; actor: string; progress: number; outcome: string }[];
    };

/** Was der Reiter Knowledge zeigt (`GET /api/knowledge/of/:id`, T-286). */
export interface Wissensreiter {
  article: { id: string; name: string };
  infos: {
    id: string;
    name: string;
    fields: string[];
    tier: string;
    /** `attached` über `knowledge`, `article` Geltung genau dieser, `group` eine Regel für viele. */
    scope: 'attached' | 'article' | 'group';
    applies?: string;
    bundles: { id: string; name: string }[];
    knownBy: { id: string; name: string }[];
    canEdit: boolean;
  }[];
  bundles: { id: string; name: string; canEdit: boolean; knownBy: { id: string; name: string }[] }[];
}

/** Was ein Wissen vereint (`GET /api/knowledge/:id/contents`, T-287). */
export interface Wisseninhalt {
  knowledge: { id: string; name: string };
  known: boolean;
  infos: {
    id: string;
    name: string;
    applies?: string;
    articles: { id: string; name: string; type: string; cells: { ref: string; label: string; text: string; long: boolean }[] }[];
    more: number;
  }[];
}

/** Eine Ebene, aus der eine Fassung kommt (`GET /api/entities/:id/versions`). */
export interface FassungsEbene {
  id: string;
  name: string;
  /** Das Kürzel am Feld; der Name steht im Tooltip. */
  short: string;
  compare: boolean;
  play: boolean;
  /** Platz im Stapel, wenn im Spiel — grösser heisst weiter oben (T-173). */
  rank?: number;
}

/** Eine andere Fassung derselben Sache (T-092, E-021 d). */
export interface Fassung {
  entity: Entity;
  layers: string[];
  /** Im Spiel (eine aufgeschaltete Ebene bringt sie, nichts überschreibt sie). */
  play: boolean;
  /** Aus einer Vergleichsebene. */
  compare: boolean;
  /** Die Leitung kann sie als Überschreibung übernehmen. */
  adoptable: boolean;
  /** Schon übernommen: die Kopie in der Kampagnenebene. */
  adoptedAs?: string;
}

export interface Fassungen {
  layers: FassungsEbene[];
  versions: Fassung[];
  campaign?: { id: string; name: string };
}

/** Wohin „im Buch lesen" führt (`refs.reading`, T-091). */
export interface LeseZiel {
  layer: string;
  at?: string;
  page?: string;
  /** An einer Ebene ohne Buchtext (T-167): „Read" steht ausgegraut da. */
  empty?: true;
}

/** Ein Eintrag im Inhaltsverzeichnis der Leseansicht (`GET /api/read/:layer`, T-091). */
export interface LeseZeile {
  /** Die Id des Originals — Anker, Lesestand und Stück nennen sie. */
  id: string;
  /** Die Fassung dieser Kampagne, wenn sie gilt (E-018). */
  article?: string;
  name: string;
  type: string;
  depth: number;
  /** Das Stück (Kapitel), in dem er steht. */
  unit: string;
  page?: string;
}
export interface LeseBuch {
  layer: { id: string; name: string; kind: string };
  toc: LeseZeile[];
  /** Wo dieses Konto zuletzt stand. */
  position: string | null;
  /** Die Ebene hat keinen Buchtext — eingelesen ist nur, was kein Kapitel ist (T-126). */
  empty?: 'noText';
  /** Die laufende Kampagne schaltet die Ebene nicht auf (T-167). */
  inactive?: true;
  /** … und dieser Betrachter liest sie trotzdem, als Vorschau. */
  preview?: true;
  /** An einer Gruppe: ihre Bücher, ein Regal (T-167). */
  shelf?: LeseRegalBuch[];
}
/** Ein Buch im Regal einer Gruppe (T-167). */
export interface LeseRegalBuch {
  id: string;
  name: string;
  kind: string;
  group?: true;
  hasText: boolean;
  active: boolean;
}
/** Ein Stück am Stück (`GET /api/read/:layer/unit/:unit`). */
export interface LeseStueck {
  layer: string;
  unit: string;
  /** `toc: false` für Absätze, Vorlesetexte, Verweise (T-108); `target` am Verweis-Teil sein Ziel. */
  sections: { id: string; depth: number; toc?: false; entity: Entity; embeds: Entity[]; target?: Entity }[];
  refs: Bezuege;
}
/** `GET /api/entities/:id/parts` (T-108): die Teile in Reihenfolge, ein Verweis-Teil mit seinem Ziel. */
export interface Teile {
  id: string;
  parts: { id: string; entity: Entity; target?: Entity }[];
  refs: Bezuege;
}
export interface LeseTreffer {
  id: string;
  unit: string;
  name: string;
  snippet: string;
}

/** Eine Zeile „not ready, by players" (`GET /api/unready`, REQ-237). */
export interface Wartend {
  id: string;
  name: string;
  type: string;
  status: string;
  authors: string[];
  /** Gilt schon ein fertiger Stand, sein Datum. */
  readyAt: string | null;
  updatedAt: string | null;
  /** Ob dieser Betrachter „ready" setzen darf (`gm`, nicht `co-gm`). */
  canReady: boolean;
}

/**
 * Eine Facette (T-174): Häkchen — Wörter, ja/nein (`of: 'bool'`) oder
 * Artikel (`of: 'link'`, mit Name und Art) — oder eine Spanne.
 */
export type Facette =
  | {
      ref: string;
      label: string;
      kind: 'enum';
      /** `requirement` (T-180): eine Voraussetzung — daneben steht „usable by". */
      of?: 'bool' | 'link' | 'requirement';
      options: { value: string; count: number; label?: string; group?: string }[];
      more?: number;
    }
  | { ref: string; label: string; kind: 'range'; min: number; max: number };

/** Ein Blatt der Liste (`GET /api/list`) — die Form steht in `apps/server/src/liste.ts`. */
export interface Liste {
  total: number;
  offset: number;
  limit: number;
  columns: { ref: string; label: string; kind: 'number' | 'bool' | 'list' | 'text' }[];
  rows: ListenZeile[];
  facets: {
    types: { type: string; label: string; area: string; count: number }[];
    layers: { id: string; name: string; count: number }[];
    /** Die Facetten der gewählten Art, aus dem Register abgeleitet (T-174). */
    fields: Facette[];
    /** Die Marken der Treffer, gezählt (T-119). */
    tags?: { tag: string; count: number }[];
    partsHidden: number;
    /** Mit `usable` (T-180): für wen, wie viele die Figur nicht erfüllt, wie viele unprüfbar bleiben. */
    usable?: Brauchbar;
  };
  /** Was fehlt, weil die laufende Kampagne seine Ebene nicht aufschaltet
   *  (T-069) — mit denselben Filtern gezählt; fehlt, wenn nichts fehlt. */
  unactivated?: Ausgeblendet;
  /** Mit `compare` (T-213): was nur eine Vergleichsebene bringt — eigener Block, eigene Zahl. */
  compare?: Vergleichsblock<ListenZeile>;
}

/**
 * **Artikel aus Vergleichsebenen** (T-213) unter dem Blatt des Spiels —
 * dieselben Filter, nicht mitgezählt. `canEnable`: die Leitung holt einen
 * mit „Enable" einzeln ins Spiel (`setEnabled`).
 */
export interface Vergleichsblock<Z> {
  total: number;
  offset: number;
  limit: number;
  rows: (Z & { notInPlay: true })[];
  canEnable: { campaign: string } | null;
}

/** „Usable by <Figur>" (T-180): was der Server ausblendet und was er nicht prüfen konnte. */
export interface Brauchbar {
  id: string;
  name: string;
  hidden: number;
  unknown: number;
}

export interface Ausgeblendet {
  campaign: { id: string; name: string };
  total: number;
  /** Ob dieses Konto an der Kampagne Ebenen schaltet (T-207) — welche, steht nur dort. */
  canManage: boolean;
}

/** Eine Ebene auf der Kampagnenseite (`GET /api/campaigns/:c/layers`). */
export interface KampagnenEbene {
  id: string;
  name: string;
  kind: string;
  /** Wer sie herausgibt (T-094): der Name ihrer Herausgeber-Gruppe, sonst „Homebrew" oder „Unassigned" (T-109); bei einer Gruppe leer. */
  publisher: string;
  /** Warum (T-109): der Satz, der an der Marke steht. */
  publisherWhy?: string;
  /** Bei einer Gruppe, wonach sie ordnet (T-094). */
  groupBy?: 'category' | 'publisher';
  /** Die Gruppen, an denen die Ebene mit `partOf` hängt (T-088, E-022 b). */
  groups: string[];
  /** Bei einer Gruppe ihre Mitglieder, nach Erscheinen. */
  members?: string[];
  articles: number;
  /** Was sie enthält, je Art — gerechnet (D8). */
  content: Record<string, number>;
  /** Wie sie sich beschreibt (REQ-245): Kürzel, Erscheinen, Autor, Regelstand … */
  about: {
    abbreviation: string;
    published: string;
    author: string;
    version: string;
    levels: string;
    storyline: string;
    description: string;
  };
  /** Ausdrücklich aufgeschaltet (eine Kante `activates`). */
  active: boolean;
  /** Im Spiel — ausdrücklich oder über eine aufgeschaltete Gruppe. */
  inPlay: boolean;
  /** Ausdrücklich aus, obwohl eine Gruppe sie brächte (T-088). */
  off: boolean;
  /** Eine Vergleichsebene (T-092): nicht im Spiel, ihre Fassungen auf Wunsch sichtbar. */
  compare?: boolean;
  /** Was sie bringt (T-105): Bereiche und Arten an ihrer eigenen Kante; fehlt es, alles. */
  only?: { areas?: string[]; types?: string[] };
  /** An einer Gruppe: ihre Typ-Regel für jede Ebene darin (T-187). */
  rule?: { areas?: string[]; types?: string[] };
  /** Die Typ-Regel, die für diese Ebene gilt, und von welcher Gruppe (T-187). */
  ruleFrom?: { id: string; name: string; only: { areas?: string[]; types?: string[] } | null };
  /** Von den Typ-Regeln ausgenommen (T-187). */
  exempt?: boolean;
  /** Was die Reihenfolge bewirkt (T-188): über wen sie gewinnt, gegen wen sie verliert — in Artikeln. */
  wins?: Stapeltreffer[];
  loses?: Stapeltreffer[];
  /** Die anderen Kampagnen, die sie aufschalten. */
  alsoIn: string[];
  canActivate: boolean;
  /** Hat Text, den die Leseansicht zeigt (T-091). */
  readable?: boolean;
}
/** Ein Treffer zwischen zwei Ebenen (T-188): `layer` leer heisst Artikel ohne Ebene. */
export interface Stapeltreffer {
  layer: string;
  name: string;
  how: 'version' | 'removal';
  n: number;
}
/** Ein Geschichtsartikel auf der Kampagnenseite (`GET /api/campaigns/:c/story`, T-082). */
export interface GeschichtsZeile {
  id: string;
  name: string;
  type: string;
  kind: string;
  /** Eine Fassung dieser Kampagne über dem Original (E-018). */
  adapted: boolean;
}
export interface KampagnenGeschichte {
  campaign: string;
  own: GeschichtsZeile[];
  adventures: (GeschichtsZeile & { layer: string; chapters: GeschichtsZeile[] })[];
}

export interface KampagnenEbenen {
  campaign: { id: string; name: string };
  may: Recht;
  /** Die aufgeschalteten von unten nach oben, darunter die übrigen. */
  layers: KampagnenEbene[];
  /** Wer die Vergleichsebenen sieht (T-092). */
  compareFor?: 'gm' | 'players';
  /** Einzeln freigegebene Artikel (T-187). */
  extra?: ExtraInhalt[];
}
/** Ein einzeln freigegebener Artikel (T-187): im Spiel, sein Buch nicht. */
export interface ExtraInhalt {
  id: string;
  name: string;
  type: string;
  layers: string[];
  /** Eine Herausnahme aus dem Stapel schlägt die Freigabe. */
  inPlay: boolean;
}

/**
 * **Eine gespeicherte Ebenenauswahl** (T-186, `/api/me/layer-sets`): ein
 * Stand des Stapels unter einem Namen, je Konto, wahlweise nur für eine
 * Kampagne (`campaign`). Geladen wird über `setCampaignLayers`.
 */
export interface Ebenenauswahl {
  id: string;
  name: string;
  campaign: string | null;
  /** Ausdrücklich aufgeschaltet, von unten nach oben. */
  layers: string[];
  /** Aus, obwohl eine aufgeschaltete Gruppe sie brächte. */
  off: string[];
  savedAt: string;
}

/** Was „Use as …" an einem Bild getan hat (T-201). */
export interface BildVerwendet {
  /** Ob die Klasse des Bildes jetzt so steht (nicht, wenn man es nicht schreibt). */
  kind: boolean;
  open: { id: string; name: string; type: string } | null;
}

export interface ListenZeile {
  id: string;
  name: string;
  type: string;
  layers: string[];
  source: string;
  status: string;
  /** Wie viele Artikel diesen über eine Abschnittskante nutzen. */
  users?: number;
  cols: Record<string, unknown>;
  /** Das Vorschaubild — Asset-Id oder Adresse —, wenn `overview` der Art eines zeigt (T-114). */
  image?: string;
  /** An einem Bild die Masse der Datei (T-201). */
  asset?: AssetMeta;
  tags?: string[];
  /** Die Ziele der Kantenarten, nach denen `rel=` fragte. */
  rels?: Record<string, string[]>;
  /** Die übrigen Fassungen derselben Sache (T-092, mit `versions`). */
  versions?: { id: string; name: string; layers: string[]; source: string }[];
  /** Mit `usable` (T-180): die Voraussetzung liess sich nicht prüfen. */
  usable?: 'unknown';
}

/** Was die Liste gefragt wird. Leere Angaben fallen weg. */
/** Ein Blatt der übergreifenden Suche (`GET /api/search`, T-138) — die Form steht in `apps/server/src/liste.ts`. */
export interface Suchergebnis {
  q: string;
  total: number;
  offset: number;
  limit: number;
  rows: {
    id: string;
    name: string;
    type: string;
    typeLabel: string;
    area: string;
    layers: string[];
    publishers: string[];
    source: string;
    image?: string;
    /** Mit `usable` (T-180): die Voraussetzung liess sich nicht prüfen. */
    usable?: 'unknown';
  }[];
  facets: {
    types: { type: string; label: string; area: string; count: number }[];
    layers: { id: string; name: string; count: number }[];
    publishers: { name: string; count: number }[];
    /** Die Facetten der einen gewählten Art (T-180) — dieselben wie im Kompendium. */
    fields?: Facette[];
    usable?: Brauchbar;
  };
  /** Mit `compare` (T-213): Treffer aus Vergleichsebenen, für sich. */
  compare?: Vergleichsblock<Suchergebnis['rows'][number]>;
}

export interface SuchFrage {
  q: string;
  type?: string[];
  layer?: string[];
  publisher?: string[];
  area?: string;
  offset?: number;
  limit?: number;
  /** Facetten der gewählten Art (T-180): `Typ.feld:Wert|Wert` oder `Typ.feld:1..3`. */
  f?: string[];
  /** Nur, was diese Figur erfüllt (T-180). */
  usable?: string;
  /** Auch Treffer aus Vergleichsebenen (T-213). */
  compare?: boolean;
}

export interface ListenFrage {
  area?: string | undefined;
  type?: string | undefined;
  of?: string[] | undefined;
  /** Ohne diese Arten und ihre Untertypen (T-137). */
  notype?: string[] | undefined;
  /** Nur in diesem Stand (T-137); ohne Status-Karte zählt `ready`. */
  status?: string[] | undefined;
  /** Nur diese Artikel. */
  ids?: string[] | undefined;
  /** Diese Kantenarten je Zeile mitschicken. */
  rel?: string[] | undefined;
  q?: string | undefined;
  layer?: string[] | undefined;
  nolayer?: string[] | undefined;
  parts?: boolean | undefined;
  /** Fassungen derselben Sache als eine Zeile (T-092). */
  versions?: boolean | undefined;
  sort?: string | undefined;
  offset?: number | undefined;
  limit?: number | undefined;
  /** `Typ.feld:Wert|Wert` oder `Typ.feld:1..3`. */
  f?: string[] | undefined;
  /** Nur mit allen diesen Marken (T-119). */
  tag?: string[] | undefined;
  /** Nur Bilder, die kein sichtbarer Artikel zeigt (T-119). */
  unused?: boolean | undefined;
  /** Auch Ebenen, die die Kampagne nicht aufschaltet (T-207) — nur die Werkbank; der Server gibt sie Verwaltung und Leitung. */
  allLayers?: boolean | undefined;
  /** Nur, was diese Figur erfüllt (T-180); Unprüfbares bleibt, markiert. */
  usable?: string | undefined;
  /** Auch die Artikel der Vergleichsebenen, als eigener Block (T-213). */
  compare?: boolean | undefined;
}

/**
 * **Eine Filtergruppe** (T-137, `/api/filters`): ein benannter Filter einer
 * Listenseite, als Unterreiter und in der Kopfleiste. `of`, `notype`,
 * `tag`, `status` grenzen ein; `q` und `f` setzen die Seitenleiste beim
 * Betreten. Ebenen nicht mehr (T-186): die sagt der globale Stand.
 */
export interface GespeicherterFilter {
  of?: string[];
  notype?: string[];
  tag?: string[];
  status?: string[];
  q?: string;
  /** Die Facetten (T-174), wie in der Adresse: `Typ.feld:a|b`, `Typ.feld:1..3`, `in.grants:<id>`. */
  f?: string[];
}
export interface Filtergruppe {
  id: string;
  page: string;
  name: string;
  scope: 'campaign' | 'own';
  filter: GespeicherterFilter;
  default: boolean;
  rank: number;
  canEdit: boolean;
}
export interface FiltergruppenStand {
  campaign: string | null;
  canManage: boolean;
  groups: Filtergruppe[];
}

/** Wo ein Bild verwendet wird (T-119, `GET /api/assets/:id/uses`) — nur, was dieser Betrachter sieht. */
export interface BildVerwendung {
  uses: { id: string; name: string; type: string; via: string }[];
  variants: { id: string; name: string; type: string }[];
  variantOf: { id: string; name: string; type: string } | null;
}

/**
 * Eine Klasse samt allem, was ihre Ansicht braucht (W6, `GET /api/classes/:id`):
 * ihre Unterklassen, die Stufentabellen und die Merkmale, die eine davon
 * gewährt oder einbettet — ganz, gesiebt.
 */
export interface KlassenBuendel {
  class: Entity;
  subclasses: Entity[];
  tables: Entity[];
  features: Entity[];
}

/**
 * Eine Herkunft oder ein Hintergrund samt allem, was die Ansicht braucht
 * (T-166, `GET /api/origins/:id`) — gebaut wie `KlassenBuendel`.
 */
export interface HerkunftBuendel {
  origin: Entity;
  variants: Entity[];
  tables: Entity[];
  features: Entity[];
}

export interface Me {
  user: {
    id: string;
    name: string;
    isAdmin: boolean;
    actorIds?: string[];
    /** Kampagnen-Id → Rolle darin. Steht am Konto und in keinem Artikel. */
    roles?: Record<string, TableRole>;
    /** Seit wann es das Konto gibt (ISO) — „What's new" zeigt nur, was danach kam (T-163). */
    createdAt?: string;
  } | null;
  /**
   * Welche Artikel dieser Betrachter schreiben darf. **`null` heisst alles**
   * (die Spielleitung), eine Liste heisst genau diese. Sie kommt vom Server,
   * weil er die Regel ohnehin anwenden muss — sie hier nachzurechnen wäre
   * die zweite Stelle, an der jemand eine Kante vergisst.
   */
  writable: string[] | null;
  /** Steht nur auf einem frischen Server: wie man das erste Konto anlegt. */
  setup: string | null;
  /** Welche Umgebung antwortet (`ATLAS_ENV`); auf `dev` steht oben ein Band (T-070). */
  env?: 'dev' | 'prod' | null;
  /** Über welches API-Token gefragt wurde, sonst `null`. */
  token?: { name: string; scope: 'read' | 'write'; expiresAt: string } | null;
  /**
   * Ob dieser Betrachter das Register ändern darf (die Verwaltung und die
   * Leitung der laufenden Kampagne). Vom Server, der es beim Schreiben
   * ohnehin prüft.
   */
  registry?: boolean;
  /** Ob es überhaupt eine offene Einladung gibt — nur dann lohnt „Sign up". */
  invites?: boolean;
  /** Ob „New article" angeboten wird: die Verwaltung und Spielende der
   *  laufenden Kampagne (REQ-237). Vom Server, der es beim Anlegen prüft. */
  create?: boolean;
  /** Ob die Maske `ready` anbietet: die Verwaltung und die Leitung (`gm`).
   *  Spielende setzen es nicht (REQ-237, E-011); der Server prüft je Artikel. */
  ready?: boolean;
  /** Die eigene Figur samt Statblock und Inventar: dort setzt auch ein
   *  Spieler `ready` (E-014 d). */
  character?: string[];
  /** **In der Sicht eines Mitglieds** (REQ-241): wer gesehen wird und wer
   *  schaut. `user` ist dann das gesehene Konto, und nichts ist schreibbar. */
  viewAs?: { id: string; name: string; role: TableRole | null; by: { id: string; name: string } } | null;
  /** Der Kopf `X-View-As` galt nicht (mehr) — die Maske vergisst ihn. */
  viewAsRefused?: boolean;
}

/** Wo der Tab sich merkt, wessen Sicht er einnimmt: über Seitenwechsel und
 *  Neuladen, nicht über das Schliessen des Tabs (REQ-241). */
const SICHT_SCHLUESSEL = 'atlas.viewAs';
function leseSicht(): string | null {
  try {
    return globalThis.sessionStorage?.getItem(SICHT_SCHLUESSEL) || null;
  } catch {
    return null;
  }
}

/* ---- Verwaltung (W3). Was ein Konto an einer Kampagne darf, sagt der
   Server (`may`): `manage` ändert, `see` liest nur (co-gm). ---- */
export type Recht = 'manage' | 'see' | null;
export interface Figur {
  id: string;
  /** `null`: die Figur gibt es als Artikel nicht mehr. */
  name: string | null;
}
export interface KampagneKurz {
  id: string;
  name: string;
  exists: boolean;
  role: TableRole | null;
  may: Recht;
}
/** Die laufende Kampagne (T-143), für jeden am Tisch. */
export interface LaufendeKampagne {
  id: string;
  name: string;
  role: TableRole | null;
  may: Recht;
  /** Wie viele Ebenen im Spiel sind (Gruppen aufgelöst). */
  layers: number;
  /** Wie viele Vergleichsebenen dieses Konto sieht (T-213) — ohne eine kein Schalter. */
  compare?: number;
  /** Die Ebene der Kampagne (T-251) — Listen nennen nur andere. */
  campaignLayer?: { id: string; name: string } | null;
}
export interface Kampagnen {
  campaigns: KampagneKurz[];
  canCreate: boolean;
  isAdmin: boolean;
  current?: LaufendeKampagne | null;
}
export interface Mitglied {
  id: string;
  name: string;
  role: TableRole;
  isAdmin: boolean;
  disabled: boolean;
  self: boolean;
  actors: Figur[];
  /** Ob „View as" angeboten wird — der Server sagt es (`mayViewAs`, REQ-241). */
  viewAs?: boolean;
}
/** Eine Spalte der Sichtbarkeitsübersicht (T-252). */
export interface SichtSpalte {
  key: string;
  label: string;
  kind: 'public' | 'table' | 'player' | 'gm';
  bearers?: string[];
}
/** Ein Knoten der Übersicht: eine Gruppe mit Zählern je Spalte. */
export interface SichtKnoten {
  key: string;
  dim: string;
  value: string;
  label: string;
  depth: number;
  count: number;
  cells: Record<string, number>;
  levels: Partial<Record<Audience, number>>;
  sources: Partial<Record<AudienceSource, number>>;
  rule?: VisibilityRule;
  exceptions: { count: number; items: { id: string; name: string; own: string }[] };
  children: SichtKnoten[];
}
export interface SichtUebersicht {
  campaign: { id: string; name: string };
  may: Recht;
  columns: SichtSpalte[];
  dimensions: { key: string; label: string }[];
  steps: TransformStep[];
  unknown: string[];
  total: number;
  levels: Audience[];
  rules: VisibilityRule[];
  nodes: SichtKnoten[];
}
export interface Mitglieder {
  campaign: { id: string; name: string; exists: boolean };
  may: Recht;
  members: Mitglied[];
  /** Die Figuren, die diese Kampagne vergeben darf. */
  characters: { id: string; name: string }[];
}
export interface Einladung {
  label: string | null;
  isAdmin: boolean;
  actorId: string | null;
  actorName: string | null;
  campaignId: string | null;
  role: TableRole | null;
  usesLeft: number | null;
  expiresAt: string | null;
  createdAt: string | null;
  may: Recht;
  handle: string;
}
export interface NeueEinladung {
  campaignId?: string;
  role?: TableRole;
  actorId?: string;
  label?: string;
  uses?: number;
  days?: number;
}
export interface Konto {
  id: string;
  name: string;
  isAdmin: boolean;
  disabled: boolean;
  self: boolean;
  actors: Figur[];
  roles: { campaign: string; name: string; role: TableRole }[];
  /** In welchen Ebenen es schreibt (T-098), ohne die Ebenen der Kampagnen, die es leitet. */
  layers?: { id: string; name: string | null; owner: boolean }[];
}

/** Wer in einer Ebene schreibt (T-098). */
export interface EbenenSchreiber {
  id: string;
  name: string;
  owner: boolean;
}

/** Der Herausgeber einer Ebene (T-109, `GET /api/layers/:id/publisher`): gerechnet, mit Begründung und Auswahl. */
export interface EbenenHerausgeber {
  name: string;
  why: string;
  groups: string[];
  options?: { id: string; name: string }[];
  canChange?: boolean;
}

/** Eine Ebene, in der dieses Konto schreibt (T-098, `GET /api/layers/mine`). */
export interface MeineEbene {
  id: string;
  name: string;
  owner: boolean;
  granted: boolean;
  /** Als Leitung dieser Kampagnen (ihre Ebene). */
  campaigns: { id: string; name: string; role: string }[];
  /** In der laufenden Kampagne aufgeschaltet — erst dann wirkt, was darin liegt. */
  inPlay: boolean;
  /** Nur an einer Ebene, die man besitzt (oder als Verwaltung). */
  editors?: EbenenSchreiber[];
  /** Hierhin wird angelegt, wenn niemand eine Ebene nennt (T-164). */
  default?: boolean;
  /** Eine Spielerebene (T-164): in welcher Kampagne, und ob es die eigene ist. */
  player?: { campaign: { id: string; name: string }; mine: boolean };
}

/** Eine Ebene zur Wahl als Schreibebene (T-161), mit Grund. */
export interface SchreibOption {
  id: string;
  name: string;
  /** Warum ich darin schreibe: eigene Spielerebene, besessen, zugeteilt, als Leitung, als Verwaltung, die Spielerebene von jemandem am Tisch. */
  reason: 'player' | 'playerOf' | 'owner' | 'granted' | 'gm' | 'co-gm' | 'admin';
  /** Bei `playerOf`: wessen. */
  player?: string;
  selectable: boolean;
  /** Warum nicht wählbar. */
  why?: string;
}

/** Wohin ich in der laufenden Kampagne anlege (`GET /api/layers/write`, T-161). */
export interface Schreibstand {
  campaign: { id: string; name: string } | null;
  /** Hierhin geht, was ich ohne Nennung anlege; `null` mit `none`: in keine Ebene (die Verwaltung ohne Wahl). */
  layer: { id: string; name: string } | null;
  /** Die Vorgabe ohne Wahl (T-164). */
  default: { id: string; name: string } | null;
  chosen: boolean;
  /** Eine Wahl, die gerade nicht gilt — aus dem Stapel gefallen oder ohne Recht. */
  dropped: { id: string; name: string } | null;
  none: boolean;
  options: SchreibOption[];
}

/** Was `POST /api/layers/:id/takeover` meldet (T-164). */
export interface EbenenUebernahme {
  into: { id: string; name: string };
  moved: { id: string; name: string }[];
  kept: { id: string; name: string }[];
  deleted: boolean;
}

/** Die Teile des Registers, die `PUT /api/registry/:part` nimmt. */
export type RegisterTeil = 'interfaces' | 'relations' | 'views' | 'vars' | 'enums' | 'settings';

/** Wie das Banner nennt, was eine Anfrage lädt. */
export function wasLaedt(path: string): string {
  if (path.startsWith('/api/registry')) return 'registry';
  if (path.startsWith('/api/list')) return 'list';
  if (path.startsWith('/api/search')) return 'search';
  if (path.startsWith('/api/entities') || path.startsWith('/api/links')) return 'articles';
  if (path.startsWith('/api/classes')) return 'classes';
  if (path.startsWith('/api/origins')) return 'origins';
  if (path.startsWith('/api/abilities')) return 'ability methods';
  if (path.startsWith('/api/campaigns')) return 'campaign';
  if (path.startsWith('/api/checks') || path.startsWith('/api/bulk') || path.startsWith('/api/transfer')) return 'workbench';
  if (path.startsWith('/api/read')) return 'book';
  if (path.startsWith('/api/layers')) return 'layers';
  if (path.startsWith('/api/filters')) return 'filter groups';
  if (path.startsWith('/api/maps') || path.startsWith('/api/play')) return 'map';
  return 'data';
}

@Injectable({ providedIn: 'root' })
export class Api {
  /** Leer heisst: derselbe Ursprung. Im Betrieb liefert der Server die
   *  Oberfläche selbst aus, in der Entwicklung steht ein Proxy davor. */
  readonly base = '';

  /** Was gerade geladen wird, je laufender Anfrage ein Wort (`registry`,
   *  `articles`, `list` …) — das Banner nennt es ab 300 ms, statt die Seite
   *  still stehen zu lassen (T-086, REQ-246). */
  readonly laufend = signal<string[]>([]);
  /** Der Server startet gerade und liest so viele Artikel (503 mit
   *  `starting`). Die Anfrage wartet und fragt nach, statt zu scheitern. */
  readonly anlauf = signal<number | null>(null);
  /** Eine Leseanfrage kam nicht durch (Netz weg, Server 5xx). Sie wartet,
   *  bis jemand „Retry" drückt, und wer sie gestellt hat, bekommt dann die
   *  Antwort — die Seite muss dafür nichts wissen. */
  readonly fehler = signal<{ was: string; nochmal: () => void } | null>(null);
  /** Der Server liefert eine neuere Oberfläche aus als die, die hier läuft
   *  (`X-Atlas-Build`, T-086): nach einem Deploy fehlen die alten Teile,
   *  und ein Seitenwechsel lädt ins Leere. Die Seite sagt es, statt still
   *  neu zu laden — wer gerade tippt, verlöre sonst seine Eingabe. */
  readonly neueVersion = signal(false);
  private bau: string | null = null;

  /**
   * **Wessen Sicht dieser Tab einnimmt** (REQ-241, E-019 a): eine Konto-Id,
   * die als `X-View-As` an jeder Anfrage steht. Gerechnet wird am Server —
   * hier steht nur, wen man fragt.
   */
  readonly viewAs = signal<string | null>(leseSicht());
  setViewAs(id: string | null): void {
    this.viewAs.set(id);
    try {
      if (id) globalThis.sessionStorage?.setItem(SICHT_SCHLUESSEL, id);
      else globalThis.sessionStorage?.removeItem(SICHT_SCHLUESSEL);
    } catch {
      /* Ohne Speicher hält die Sicht nur bis zum Neuladen. */
    }
  }
  private sichtKopf(): Record<string, string> {
    const id = this.viewAs();
    return id ? { 'x-view-as': id } : {};
  }

  /** `halten: false` — ein Ausfall geht gleich an den Aufrufer, statt auf
   *  „Retry" zu warten: die Sitzung muss sich auch ohne Server festlegen,
   *  sonst bliebe die Seite ohne Kopfleiste stehen. */
  private async call<T>(path: string, init: RequestInit = {}, halten = true): Promise<T> {
    const was = wasLaedt(path);
    this.laufend.update((l) => [...l, was]);
    try {
      for (;;) {
        try {
          const antwort = await this.rufe<T>(path, init);
          this.anlauf.set(null);
          return antwort;
        } catch (e) {
          const start = (e as ApiError).body as { starting?: { articles?: number } } | undefined;
          if (e instanceof ApiError && e.status === 503 && start?.starting) {
            this.anlauf.set(start.starting.articles ?? 0);
            await new Promise((r) => setTimeout(r, 1000));
            continue;
          }
          /* Nur Lesen wird wiederholt: ein Schreiben zweimal zu schicken
             könnte zweimal schreiben. Ein 4xx ist eine Antwort, kein
             Ausfall. */
          const ausfall = !(e instanceof ApiError) || e.status >= 500;
          if (!halten || (init.method ?? 'GET') !== 'GET' || !ausfall) throw e;
          this.anlauf.set(null);
          await new Promise<void>((r) => this.fehler.set({ was, nochmal: r }));
          this.fehler.set(null);
        }
      }
    } finally {
      this.laufend.update((l) => {
        const i = l.indexOf(was);
        return i < 0 ? l : [...l.slice(0, i), ...l.slice(i + 1)];
      });
    }
  }

  private merkeBau(res: Response): void {
    const bau = res.headers?.get?.('x-atlas-build');
    if (!bau) return;
    if (this.bau === null) this.bau = bau;
    else if (bau !== this.bau) this.neueVersion.set(true);
  }

  private async rufe<T>(path: string, init: RequestInit): Promise<T> {
    const res = await fetch(this.base + path, {
      ...init,
      credentials: 'include',
      /* Der Typ nur mit Körper: Fastify lehnt ein leeres JSON ab (DELETE). */
      headers: {
        ...(init.body ? { 'content-type': 'application/json' } : {}),
        ...this.sichtKopf(),
        ...(init.headers ?? {}),
      },
    });
    this.merkeBau(res);
    const text = await res.text();
    const body: unknown = text ? JSON.parse(text) : null;
    if (!res.ok) {
      const b = body as { error?: string; issues?: unknown } | null;
      throw new ApiError(res.status, b?.error ?? `Request failed (${res.status})`, b?.issues, body);
    }
    return body as T;
  }

  me(): Promise<Me> {
    return this.call<Me>('/api/me', {}, false);
  }
  putEntity(entity: Entity): Promise<Entity> {
    return this.call<Entity>(`/api/entities/${encodeURIComponent(entity.id)}`, {
      method: 'PUT',
      body: JSON.stringify(entity),
    });
  }
  login(name: string, password: string): Promise<{ user: Me['user'] }> {
    return this.call('/api/login', { method: 'POST', body: JSON.stringify({ name, password }) });
  }
  register(name: string, password: string, invite: string): Promise<{ user: Me['user'] }> {
    return this.call('/api/register', {
      method: 'POST',
      body: JSON.stringify({ name, password, invite }),
    });
  }
  logout(): Promise<{ ok: true }> {
    return this.call('/api/logout', { method: 'POST' });
  }
  registry(): Promise<Registry> {
    return this.call<Registry>('/api/registry');
  }
  /** Einen Teil des Registers ganz schreiben; der Server prüft ihn im Zusammenhang. */
  putRegistry<T extends RegisterTeil>(part: T, value: Registry[T]): Promise<{ ok: true; part: T }> {
    return this.call(`/api/registry/${part}`, { method: 'PUT', body: JSON.stringify(value ?? {}) });
  }
  /** Was der Bestand an jeder Zeile trägt — nur für wer das Register ändert. */
  registryUsage(): Promise<RegistryUsage> {
    return this.call<RegistryUsage>('/api/registry/usage');
  }
  /** Ein Blatt der Liste — Kompendium, Bereiche und jede Auswahl (W7). */
  list(frage: ListenFrage, init: RequestInit = {}): Promise<Liste> {
    const p = new URLSearchParams();
    for (const [k, v] of Object.entries(frage)) {
      if (v === undefined || v === '' || v === false || (Array.isArray(v) && !v.length)) continue;
      if (k === 'f') for (const f of v as string[]) p.append('f', f);
      else p.set(k, Array.isArray(v) ? v.join(',') : v === true ? '1' : String(v));
    }
    return this.call<Liste>(`/api/list?${p.toString()}`, init);
  }
  /**
   * **Die übergreifende Suche** (T-138). Hält nicht an einem Ausfall fest
   * (`halten = false`): beim Tippen ist die nächste Frage schon unterwegs,
   * und das Suchfeld sagt selbst, wenn nichts kam.
   */
  search(frage: SuchFrage, init: RequestInit = {}): Promise<Suchergebnis> {
    const p = new URLSearchParams({ q: frage.q });
    if (frage.type?.length) p.set('type', frage.type.join(','));
    if (frage.layer?.length) p.set('layer', frage.layer.join(','));
    if (frage.publisher?.length) p.set('publisher', frage.publisher.join(','));
    if (frage.area) p.set('area', frage.area);
    if (frage.offset) p.set('offset', String(frage.offset));
    if (frage.limit) p.set('limit', String(frage.limit));
    for (const f of frage.f ?? []) p.append('f', f);
    if (frage.usable) p.set('usable', frage.usable);
    if (frage.compare) p.set('compare', '1');
    return this.call<Suchergebnis>(`/api/search?${p.toString()}`, init, false);
  }
  /** `[[Name]]` → `[[nummer|Name]]`, wo genau ein Artikel so heisst (M11). */
  links(texts: string[]): Promise<{ texts: string[]; open: string[] }> {
    return this.call('/api/links', { method: 'POST', body: JSON.stringify({ texts }) });
  }
  /** Einen Artikel anlegen; Id, Nummer und Vorgaben setzt der Server. */
  createEntity(
    type: string,
    name: string,
    fields: Record<string, unknown> = {},
    relations: { type: string; to: string; props?: Record<string, unknown> }[] = [],
  ): Promise<Entity> {
    return this.call<Entity>('/api/entities', {
      method: 'POST',
      body: JSON.stringify({ type, name, fields, relations }),
    });
  }
  /** Die Attributsverfahren der laufenden Kampagne, ihre Gruppen (E-016 a) und ihre Sprachen (REQ-251). */
  abilities(): Promise<{
    campaign: { id: string; name: string } | null;
    methods: AbilityMethod[];
    parties: { id: string; name: string; pools: Record<string, RolledScores & { at?: string }> }[];
    /** Die Sprachen der Kampagne (REQ-251); leer heisst jede. */
    languages?: string[];
    /** Talente am Tisch (T-107); ohne Angabe ja. */
    feats?: boolean;
    /** Trefferpunkte je Stufe (T-194); ohne Angabe wählen. */
    hitPoints?: HitPointRule;
  }> {
    return this.call('/api/abilities');
  }
  /** Das Glossar (T-242): Wörter der App und die sichtbaren Glossarartikel im Stapel. */
  glossary(): Promise<{ terms: GlossaryEntry[] }> {
    return this.call('/api/glossary');
  }
  /** Wo ein Glossarbegriff genannt wird — gezählt nach dem Sieb (T-242). */
  glossaryUses(id: string): Promise<{ counted: boolean; total: number; rows: { id: string; name: string; type: string }[] }> {
    return this.call(`/api/glossary/${encodeURIComponent(id)}/uses`);
  }
  /** Die Regeloptionen einer Kampagne, nach Sorte, mit ihren Regelartikeln (T-190). */
  /** Die Regelartikel — System, Regel, Option — ganz, gesiebt (T-270). */
  ruleArticles(): Promise<Entity[]> {
    return this.call<Entity[]>('/api/rule-articles');
  }
  campaignRules(id: string): Promise<{ campaign: { id: string; name: string }; sorts: RuleSortState[]; missing?: number }> {
    return this.call(`/api/campaigns/${encodeURIComponent(id)}/rules`);
  }
  /** Regelset und Gruppen der laufenden Kampagne, mit den Inventaren, zwischen denen Sachen wandern (T-127). */
  inventory(): Promise<InventarLage> {
    return this.call('/api/inventory');
  }
  /** Das Handwerk an einem Rezept oder Auftrag (T-128). */
  crafting(id: string): Promise<Handwerk> {
    return this.call(`/api/crafting/${encodeURIComponent(id)}`);
  }
  /** Einen Fertigungsauftrag starten; das Material wird reserviert (T-128). */
  /** Was beim Start gewählt werden kann (T-197). */
  craftingMaterials(recipe: string, actor: string): Promise<HandwerkMaterialwahl> {
    return this.call(`/api/crafting/${encodeURIComponent(recipe)}/materials?actor=${encodeURIComponent(actor)}`);
  }
  startCrafting(recipe: string, actor: string, materials: { inventory: string; edge: string; qty: number; need?: string }[]): Promise<{ id: string }> {
    return this.call('/api/crafting', { method: 'POST', body: JSON.stringify({ recipe, actor, materials }) });
  }
  /** Am Auftrag: `roll`, `confirm`, `work`, `abort`, `fail` (T-128). */
  /** Einen Kreis am Auftrag setzen (T-165): der Zielstand, nicht „weiter". */
  craftingCheck(id: string, index: number, mark: 'success' | 'failure' | null): Promise<unknown> {
    return this.call(`/api/crafting/${encodeURIComponent(id)}/checks/${index}`, { method: 'PUT', body: JSON.stringify({ mark }) });
  }
  craftingAction(id: string, action: 'roll' | 'confirm' | 'work' | 'finish' | 'abort' | 'fail', body: Record<string, unknown> = {}): Promise<unknown> {
    return this.call(`/api/crafting/${encodeURIComponent(id)}/${action}`, { method: 'POST', body: JSON.stringify(body) });
  }
  /** Im Laden kaufen (T-133): Ware und Menge; den Preis rechnet der Server. */
  /** **Geben** (T-150): ein Stück ins Inventar, als Instanz des Gegenstands — Beute, Geschenk, Eigenes. */
  give(inventory: string, item: string, qty = 1): Promise<{ item: { id: string; name: string }; piece: string; qty: number; created: boolean }> {
    return this.call(`/api/inventories/${encodeURIComponent(inventory)}/give`, { method: 'POST', body: JSON.stringify({ item, qty }) });
  }

  buy(shop: string, actor: string, edge: string, qty: number): Promise<Handel> {
    return this.call(`/api/shops/${encodeURIComponent(shop)}/buy`, { method: 'POST', body: JSON.stringify({ actor, edge, qty }) });
  }
  /** Die Sitzung beenden (T-140): je nach Kampagne bleibt Unverstautes liegen. */
  endSession(id: string): Promise<{ rule: string; left: { inventory: string; edge: string; item: string; qty: number }[] }> {
    return this.call(`/api/sessions/${encodeURIComponent(id)}/end`, { method: 'POST', body: '{}' });
  }
  /** Liegengelassenes aufheben (T-140): in ein Inventar, das man schreibt. */
  pickUp(session: string, edge: string, inventory: string): Promise<{ item: string; qty: number; inventory: string }> {
    return this.call(`/api/sessions/${encodeURIComponent(session)}/pick-up`, { method: 'POST', body: JSON.stringify({ edge, inventory }) });
  }
  /** Dem Laden verkaufen (T-133): ein Stapel aus dem Inventar der Figur. */
  sell(shop: string, actor: string, inventory: string, edge: string, qty: number): Promise<Handel> {
    return this.call(`/api/shops/${encodeURIComponent(shop)}/sell`, { method: 'POST', body: JSON.stringify({ actor, inventory, edge, qty }) });
  }
  /** Die Spieler der laufenden Kampagne mit ihren Figuren (T-100, E-007) — ohne Konto-Id. */
  players(): Promise<{ campaign: { id: string; name: string } | null; players: Spieler[] }> {
    return this.call('/api/players');
  }
  /** Würfeln am Server — der Wurf steht im Protokoll (E-016 a). */
  rollAbilities(method: string, party?: string): Promise<RolledScores & { at: string }> {
    return this.call('/api/abilities/roll', { method: 'POST', body: JSON.stringify({ method, ...(party ? { party } : {}) }) });
  }
  /** **Würfeln am Server** (T-172): der Wurf steht im Log des Artikels. */
  roll(body: RollAnfrage): Promise<RollEntry> {
    return this.call('/api/rolls', { method: 'POST', body: JSON.stringify(body) });
  }
  /** Das Log eines Artikels (T-172), neueste zuerst, gesiebt am Server. */
  rolls(subject: string, filter: { by?: string; session?: string; offset?: number; limit?: number } = {}): Promise<WurfLog> {
    const q = new URLSearchParams({ subject });
    for (const [k, v] of Object.entries(filter)) if (v !== undefined && v !== '') q.set(k, String(v));
    return this.call(`/api/rolls?${q.toString()}`);
  }
  /** Die Verfahren für die Startausrüstung der laufenden Kampagne (T-096). */
  equipmentMethods(): Promise<{ methods: EquipmentMethod[] }> {
    return this.call('/api/equipment');
  }
  /** Das Startgold würfeln — `event` ist der Beleg für das Anlegen (T-096). */
  rollGold(method: string, cls?: string): Promise<GoldRoll & { expr: string; event: string }> {
    return this.call('/api/equipment/roll', { method: 'POST', body: JSON.stringify({ method, ...(cls ? { class: cls } : {}) }) });
  }
  /** Die Startausrüstung ins Inventar der Figur; der Server prüft Budget und Grenzen (T-096). */
  applyEquipment(
    id: string,
    method: string,
    purchases: Purchase[] = [],
    roll?: string,
  ): Promise<{ inventory: string; items: Purchase[]; copper: number; skipped: string[] }> {
    return this.call(`/api/entities/${encodeURIComponent(id)}/equipment`, {
      method: 'POST',
      body: JSON.stringify({ method, purchases, ...(roll ? { roll } : {}) }),
    });
  }
  /** Diese Artikel ganz, gesiebt — die Teile eines Statblocks (W2). */
  entitiesById(ids: readonly string[]): Promise<Entity[]> {
    return this.call<Entity[]>(`/api/entities?ids=${ids.map(encodeURIComponent).join(',')}`);
  }
  /** Was neben einer Karte steht: Brotkrumen, Unterkarten, Markerziele, Gruppe (T-115). */
  mapContext(id: string): Promise<KartenKontext> {
    return this.call<KartenKontext>(`/api/maps/${encodeURIComponent(id)}/context`);
  }
  /** Eine Begegnung beginnen (T-203): Initiative, vorplatzierte Tokens aufdecken, die Sitzung führt sie. */
  startEncounter(id: string, body: { map?: string; session?: string | null }): Promise<{ encounter: string; revealed: number; session: string | null }> {
    return this.call(`/api/encounters/${encodeURIComponent(id)}/start`, { method: 'POST', body: JSON.stringify(body) });
  }
  /** Die Seitenleiste der Karte (T-203): Gruppe, und für die Leitung die Begegnungen der Sitzung. */
  mapSide(id: string, session?: string | null): Promise<KartenSeite> {
    const q = session ? `?session=${encodeURIComponent(session)}` : '';
    return this.call<KartenSeite>(`/api/maps/${encodeURIComponent(id)}/side${q}`);
  }
  /** Was die Aktionsleiste auf dieser Karte braucht (T-198). */
  turnPlan(map: string, actor?: string | null): Promise<ZugLage> {
    return this.call<ZugLage>(`/api/maps/${encodeURIComponent(map)}/turn-plan${actor ? `?actor=${encodeURIComponent(actor)}` : ''}`);
  }
  /** Einen Zug einreichen — oder einen eingereichten ersetzen (`plan`). */
  submitTurnPlan(
    map: string,
    body: { actor: string; steps: PlanStep[]; plan?: string; nat?: { w: number; h: number } },
  ): Promise<TurnPlan & { text: string }> {
    return this.call(`/api/maps/${encodeURIComponent(map)}/turn-plan`, { method: 'POST', body: JSON.stringify(body) });
  }
  /** Die Antwort auf einen Gelegenheitsangriff (T-198, Runde 2). */
  reactTurnPlan(map: string, plan: string, attack: boolean): Promise<TurnPlan> {
    return this.call(`/api/maps/${encodeURIComponent(map)}/turn-plan/${encodeURIComponent(plan)}/react`, {
      method: 'POST',
      body: JSON.stringify({ attack }),
    });
  }
  /** Die Leitung bestätigt oder lehnt ab; bestätigt wird gewürfelt (T-172). */
  decideTurnPlan(map: string, plan: string, decision: 'confirm' | 'reject', note?: string): Promise<TurnPlan> {
    return this.call(`/api/maps/${encodeURIComponent(map)}/turn-plan/${encodeURIComponent(plan)}/decide`, {
      method: 'POST',
      body: JSON.stringify({ decision, ...(note ? { note } : {}) }),
    });
  }
  /**
   * **Die eigene Figur ziehen** (T-204): `free` zieht sofort (`moved`),
   * `confirm` legt einen Vorschlag an (`proposal`), den die Leitung bestätigt.
   */
  moveToken(
    map: string,
    body: { rel: string; to: { x: number; y: number }; nat?: { w: number; h: number }; path?: { x: number; y: number }[]; feet?: number },
  ): Promise<{ moved?: string; proposal?: TurnPlan }> {
    return this.call(`/api/maps/${encodeURIComponent(map)}/move`, { method: 'POST', body: JSON.stringify(body) });
  }
  /**
   * **Eine Tür schalten** (T-118): die Leitung jede, Spielende eine neben
   * ihrer Figur, wenn die Kampagne es erlaubt. Der Server deckt auf, was
   * man durch die offene Tür sieht.
   */
  door(map: string, body: { wall: string; state: 'open' | 'closed' | 'locked'; nat?: { w: number; h: number } }): Promise<{ wall: string; state: string }> {
    return this.call(`/api/maps/${encodeURIComponent(map)}/door`, { method: 'POST', body: JSON.stringify(body) });
  }
  /** Welche Karte auf dem Tisch liegt (`SessionState.activeMap`, T-115). */
  play(session?: string): Promise<Tisch> {
    return this.call<Tisch>(`/api/play${session ? `?session=${encodeURIComponent(session)}` : ''}`);
  }
  /** Alle Karten, die man sieht, als Baum (T-202). */
  maps(): Promise<{ maps: KartenZeile[] }> {
    return this.call('/api/maps');
  }
  /** Sitzungen, Szenen und Kämpfe, in denen eine Karte vorkommt (T-202). */
  mapUses(id: string): Promise<{ uses: KartenVerwendung[] }> {
    return this.call(`/api/maps/${encodeURIComponent(id)}/uses`);
  }
  backlinks(id: string): Promise<Rueckbezug[]> {
    return this.call<Rueckbezug[]>(`/api/entities/${encodeURIComponent(id)}/backlinks`);
  }
  klasse(id: string): Promise<KlassenBuendel> {
    return this.call<KlassenBuendel>(`/api/classes/${encodeURIComponent(id)}`);
  }
  herkunft(id: string): Promise<HerkunftBuendel> {
    return this.call<HerkunftBuendel>(`/api/origins/${encodeURIComponent(id)}`);
  }
  /** Der ganze Artikel, gesiebt, mit den Namen, die er braucht (`refs`). */
  entity(id: string): Promise<Entity & { refs?: Bezuege }> {
    return this.call<Entity & { refs?: Bezuege }>(`/api/entities/${encodeURIComponent(id)}`);
  }
  // ------------------------------------------------------- Leseansicht (T-091)
  readBook(layer: string): Promise<LeseBuch> {
    return this.call<LeseBuch>(`/api/read/${encodeURIComponent(layer)}`);
  }
  /** Die Teile eines Kapitels, einer Szene, eines Arcs in Reihenfolge (T-108, Element `parts`). */
  parts(id: string): Promise<Teile> {
    return this.call<Teile>(`/api/entities/${encodeURIComponent(id)}/parts`);
  }
  readUnit(layer: string, unit: string): Promise<LeseStueck> {
    return this.call<LeseStueck>(`/api/read/${encodeURIComponent(layer)}/unit/${encodeURIComponent(unit)}`);
  }
  searchBook(layer: string, q: string): Promise<{ q: string; hits: LeseTreffer[] }> {
    return this.call(`/api/read/${encodeURIComponent(layer)}/search?q=${encodeURIComponent(q)}`);
  }
  /** Den Lesestand merken — leise: ein verlorenes Lesezeichen ist kein Fehler, den man melden muss. */
  keepPosition(layer: string, id: string): Promise<void> {
    return this.call<void>(`/api/read/${encodeURIComponent(layer)}/position`, { method: 'PUT', body: JSON.stringify({ id }) }, false);
  }

  /** Eine Fassung, die das Original ersetzt (E-018, T-082) — in der Ebene der Kampagne oder, mit `layer`, in einer eigenen (T-098). */
  adapt(id: string, layer?: string): Promise<{ id: string; created: boolean }> {
    return this.call(`/api/entities/${encodeURIComponent(id)}/adapt`, {
      method: 'POST',
      body: JSON.stringify(layer ? { layer } : {}),
    });
  }

  /**
   * **In die Geschichte holen** (E-026): ein Kapitel oder eine Szene samt allem darunter
   * als Fassung in die Ebene der Kampagne, gehängt an `into` (die Kampagne
   * oder einer ihrer Arcs). Gibt die Fassung des Artikels selbst zurück.
   */
  take(id: string, into: string, use = false): Promise<{ id: string; created: number; taken: number; used?: boolean }> {
    return this.call(`/api/entities/${encodeURIComponent(id)}/take`, {
      method: 'POST',
      /* `use` (E-028): statt einer Fassung ein Verweis-Teil aufs Original. */
      body: JSON.stringify(use ? { into, use: true } : { into }),
    });
  }

  /* ------------------------------------------- Schreibrechte je Ebene (T-098) */

  /** Die Ebenen, in denen ich schreibe. */
  myLayers(): Promise<{
    layers: MeineEbene[];
    campaign: { id: string; name: string } | null;
    default: { id: string; name: string } | null;
  }> {
    return this.call('/api/layers/mine');
  }
  /** Die Vorgabe-Schreibebene in der laufenden Kampagne (T-164) — als `player` die eigene Spielerebene. */
  defaultLayer(): Promise<{ layer: { id: string; name: string; player: boolean } | null; campaign: { id: string; name: string } | null }> {
    return this.call('/api/layers/default');
  }
  /** Der Reiter Knowledge (T-286): die Informationen eines Artikels und die Bündel. */
  knowledgeOf(id: string): Promise<Wissensreiter> {
    return this.call(`/api/knowledge/of/${encodeURIComponent(id)}`);
  }
  addInformation(id: string, body: { name?: string; fields: string[]; bundles: string[]; newBundle?: string }): Promise<Wissensreiter> {
    return this.call(`/api/knowledge/of/${encodeURIComponent(id)}`, { method: 'POST', body: JSON.stringify(body) });
  }
  updateInformation(info: string, body: { name?: string; fields?: string[]; bundles?: string[]; newBundle?: string; article: string }): Promise<Wissensreiter> {
    return this.call(`/api/knowledge/info/${encodeURIComponent(info)}`, { method: 'PUT', body: JSON.stringify(body) });
  }
  /** Was ein Wissen vereint, gesiebt für diesen Betrachter (T-287). */
  knowledgeContents(id: string): Promise<Wisseninhalt> {
    return this.call(`/api/knowledge/${encodeURIComponent(id)}/contents`);
  }
  deleteInformation(info: string): Promise<{ ok: true }> {
    return this.call(`/api/knowledge/info/${encodeURIComponent(info)}`, { method: 'DELETE' });
  }
  /** Die Schreibebene in der laufenden Kampagne und die Ebenen zur Wahl (T-161). */
  writeLayer(): Promise<Schreibstand> {
    return this.call('/api/layers/write');
  }
  /** Die Schreibebene wählen — `null` heisst: wieder die Vorgabe. Der Server prüft. */
  setWriteLayer(layer: string | null): Promise<Schreibstand> {
    return this.call('/api/layers/write', { method: 'PUT', body: JSON.stringify({ layer }) });
  }
  /** Die Schreibebene wählen (T-176): hierhin wird angelegt, solange die Ebene im Spiel ist. */
  chooseDefaultLayer(id: string): Promise<{ layer: { id: string; name: string } }> {
    return this.call(`/api/layers/${encodeURIComponent(id)}/default`, { method: 'PUT', body: JSON.stringify({}) });
  }
  /** Eine Ebene leeren (T-176): erst `dryRun`, dann mit der Zahl aus der Vorschau. Zurück über `undo`. */
  emptyLayer(id: string, body: { dryRun?: boolean; confirmDelete?: number }): Promise<BulkAntwort> {
    return this.call<BulkAntwort>(`/api/layers/${encodeURIComponent(id)}/empty`, { method: 'POST', body: JSON.stringify(body) });
  }
  /** Eine Spielerebene übernehmen (T-164): Inhalt in die Ebene der Kampagne, die leere Ebene weg. */
  takeOverLayer(id: string): Promise<EbenenUebernahme> {
    return this.call(`/api/layers/${encodeURIComponent(id)}/takeover`, { method: 'POST' });
  }
  /** Eine eigene Ebene anlegen — sie gehört mir. */
  createLayer(name: string): Promise<{ id: string; name: string }> {
    return this.call('/api/layers', { method: 'POST', body: JSON.stringify({ name }) });
  }
  /** Jemanden in einer Ebene schreiben lassen: beim Namen, oder (Verwaltung) bei der Id. */
  addLayerEditor(layer: string, wer: { name: string } | { user: string }): Promise<EbenenSchreiber> {
    return this.call(`/api/layers/${encodeURIComponent(layer)}/editors`, { method: 'POST', body: JSON.stringify(wer) });
  }
  /** Der Herausgeber einer Ebene (T-109). */
  layerPublisher(layer: string): Promise<EbenenHerausgeber> {
    return this.call(`/api/layers/${encodeURIComponent(layer)}/publisher`);
  }
  /** Die Ebene unter diese Herausgeber-Gruppen hängen; leer heisst unter keine. */
  setLayerPublisher(layer: string, groups: string[]): Promise<EbenenHerausgeber> {
    return this.call(`/api/layers/${encodeURIComponent(layer)}/publisher`, { method: 'PUT', body: JSON.stringify({ groups }) });
  }
  dropLayerEditor(layer: string, user: string): Promise<{ ok: true }> {
    return this.call(`/api/layers/${encodeURIComponent(layer)}/editors/${encodeURIComponent(user)}`, { method: 'DELETE' });
  }
  /** Einen Artikel löschen — hier: eine Fassung, zurück zum Original. */
  deleteEntity(id: string): Promise<{ ok: true }> {
    return this.call(`/api/entities/${encodeURIComponent(id)}`, { method: 'DELETE' });
  }

  /** Die übrigen Fassungen dieses Artikels (T-092). */
  versions(id: string): Promise<Fassungen> {
    return this.call<Fassungen>(`/api/entities/${encodeURIComponent(id)}/versions`);
  }
  /** Die Filtergruppen der laufenden Kampagne und die eigenen (T-137). */
  filters(): Promise<FiltergruppenStand> {
    return this.call<FiltergruppenStand>('/api/filters', {}, false);
  }
  createFilter(g: { page: string; name: string; scope: 'campaign' | 'own'; filter: GespeicherterFilter; default?: boolean }): Promise<Filtergruppe> {
    return this.call<Filtergruppe>('/api/filters', { method: 'POST', body: JSON.stringify(g) });
  }
  updateFilter(id: string, g: { name?: string; filter?: GespeicherterFilter; default?: boolean; rank?: number }): Promise<Filtergruppe> {
    return this.call<Filtergruppe>(`/api/filters/${encodeURIComponent(id)}`, { method: 'PUT', body: JSON.stringify(g) });
  }
  deleteFilter(id: string): Promise<{ ok: true }> {
    return this.call(`/api/filters/${encodeURIComponent(id)}`, { method: 'DELETE' });
  }
  /** Was sich das Konto merkt (T-092). */
  prefs(): Promise<Record<string, unknown>> {
    return this.call<Record<string, unknown>>('/api/me/prefs', {}, false);
  }
  setPref(key: string, value: unknown): Promise<{ ok: true }> {
    return this.call(`/api/me/prefs/${encodeURIComponent(key)}`, {
      method: 'PUT',
      body: JSON.stringify({ value }),
    });
  }
  /** Eine Fassung aus einer Vergleichsebene als Überschreibung übernehmen (T-092). */
  adopt(campaign: string, version: string, over: string): Promise<Entity> {
    return this.call<Entity>(`/api/campaigns/${encodeURIComponent(campaign)}/adopt`, {
      method: 'POST',
      body: JSON.stringify({ version, over }),
    });
  }
  /** Die Übernahme zurücknehmen; `over` ist, was danach wieder gilt. */
  unadopt(campaign: string, copy: string): Promise<{ ok: true; over?: string }> {
    return this.call(
      `/api/campaigns/${encodeURIComponent(campaign)}/adopt/${encodeURIComponent(copy)}`,
      { method: 'DELETE' },
    );
  }

  /** Der letzte fertige Stand (E-012) — für Verfasserin und Leitung. */
  readyVersion(id: string): Promise<Entity & { refs?: Bezuege }> {
    return this.call<Entity & { refs?: Bezuege }>(`/api/entities/${encodeURIComponent(id)}?stand=ready`);
  }

  /** Was Spielende angelegt haben und noch nicht `ready` ist (REQ-237). */
  unready(): Promise<{ rows: Wartend[] }> {
    return this.call<{ rows: Wartend[] }>('/api/unready');
  }

  /** „ready" per Knopf (REQ-237); der Server prüft, wer darf. */
  setReady(id: string): Promise<Entity> {
    return this.call<Entity>(`/api/entities/${encodeURIComponent(id)}/ready`, { method: 'POST' });
  }

  /** Prüfungen; `limit` 0 heisst nur die Zahlen, `'all'` jeden Treffer. */
  checks(check?: string, limit: number | 'all' = 0): Promise<ChecksAntwort> {
    const q = new URLSearchParams({ limit: String(limit) });
    if (check) q.set('check', check);
    return this.call<ChecksAntwort>(`/api/checks?${q.toString()}`);
  }
  bulk(auftrag: unknown): Promise<BulkAntwort> {
    return this.call<BulkAntwort>('/api/bulk', { method: 'POST', body: JSON.stringify(auftrag) });
  }
  /* Die Übernahme dev ↔ prod (T-130): gerechnet am Server, das Token der
     Gegenstelle bleibt dort. */
  transferStand(): Promise<TransferStand> {
    return this.call<TransferStand>('/api/transfer');
  }
  transferVorschau(auftrag: unknown): Promise<TransferVorschau> {
    return this.call<TransferVorschau>('/api/transfer/preview', { method: 'POST', body: JSON.stringify(auftrag) });
  }
  transferLauf(lauf: unknown): Promise<TransferErgebnis> {
    return this.call<TransferErgebnis>('/api/transfer/run', { method: 'POST', body: JSON.stringify(lauf) });
  }
  transferUndo(id: string, body: { force?: boolean; dryRun?: boolean } = {}): Promise<{ restored: number }> {
    return this.call<{ restored: number }>(`/api/transfer/${encodeURIComponent(id)}/undo`, { method: 'POST', body: JSON.stringify(body) });
  }
  transferKlon(body: { confirm?: string; dryRun?: boolean }): Promise<KlonAntwort> {
    return this.call<KlonAntwort>('/api/transfer/clone', { method: 'POST', body: JSON.stringify(body) });
  }
  bulks(): Promise<BulkLauf[]> {
    return this.call<BulkLauf[]>('/api/bulk?limit=20');
  }
  undo(id: string, force = false): Promise<UndoAntwort> {
    return this.call<UndoAntwort>(`/api/bulk/${encodeURIComponent(id)}/undo`, {
      method: 'POST',
      body: JSON.stringify({ force }),
    });
  }
  tokens(): Promise<TokenZeile[]> {
    return this.call<TokenZeile[]>('/api/tokens');
  }
  /** `expiresAt` als Tag (`2026-11-13`) — gilt bis zu dessen Ende (T-112). */
  createToken(name: string, scope: 'read' | 'write', expiresAt: string): Promise<TokenZeile> {
    return this.call<TokenZeile>('/api/tokens', { method: 'POST', body: JSON.stringify({ name, scope, expiresAt }) });
  }
  dropToken(id: string): Promise<{ ok: true }> {
    return this.call(`/api/tokens/${encodeURIComponent(id)}`, { method: 'DELETE' });
  }

  // ------------------------------------------------------- Verwaltung
  /**
   * Die Kampagne als Datei (T-077): der Körper als Blob, der Name aus
   * `content-disposition` — den Namen sagt der Server, nicht ein zweites
   * Mal die Seite.
   */
  async exportCampaign(campaign: string): Promise<{ blob: Blob; name: string }> {
    const res = await fetch(`${this.base}/api/export?campaign=${encodeURIComponent(campaign)}`, {
      credentials: 'include',
      headers: this.sichtKopf(),
    });
    if (!res.ok) {
      const b = (await res.json().catch(() => null)) as { error?: string } | null;
      throw new ApiError(res.status, b?.error ?? `Request failed (${res.status})`, undefined, b);
    }
    const name = /filename="([^"]+)"/.exec(res.headers.get('content-disposition') ?? '')?.[1] ?? 'campaign.json';
    return { blob: await res.blob(), name };
  }

  // ------------------------------------------------------- Bilder (T-114)
  /**
   * Ein Bild hochladen: der Server legt einen `Asset`-Artikel an und gibt
   * ihn mit `url` und `thumb` zurück. `for` ist der Artikel, aus dem
   * heraus hochgeladen wird — das Bild übernimmt seine Sichtbarkeit.
   * Eigenes `fetch` und nicht `call`: der Körper ist multipart, und den
   * Typ samt Grenze setzt der Browser, nicht `application/json`.
   */
  async uploadAsset(
    datei: Blob,
    felder: { for?: string; name?: string; filename?: string; kind?: string; variantOf?: string } = {},
  ): Promise<Entity & { url: string; thumb: string }> {
    const form = new FormData();
    if (felder.for) form.append('for', felder.for);
    if (felder.name) form.append('name', felder.name);
    /* Die Klasse, die das Feld anbietet (T-119), und die Fassung eines Bildes. */
    if (felder.kind) form.append('kind', felder.kind);
    if (felder.variantOf) form.append('variantOf', felder.variantOf);
    form.append('file', datei, felder.filename ?? ((datei as File).name || 'image'));
    return this.sendeBild('POST', '/api/assets', form);
  }

  /**
   * **Quelle ersetzen** (T-119): derselbe Asset-Artikel, eine neue Datei —
   * jeder Verwender zeigt sofort das neue Bild. Gegen die gelesene
   * Revision, wie jedes Schreiben.
   */
  async replaceAssetFile(id: string, datei: Blob, revision: number | null | undefined): Promise<Entity & { url: string; thumb: string }> {
    const form = new FormData();
    if (revision !== undefined && revision !== null) form.append('revision', String(revision));
    form.append('file', datei, (datei as File).name || 'image');
    return this.sendeBild('PUT', `/api/assets/${encodeURIComponent(id)}/file`, form);
  }

  /**
   * **Ein Bild als Karte, Token oder Requisite** (T-201): setzt die Klasse
   * (wo man das Bild schreibt) und legt an, was dazugehört — `open` ist der
   * Artikel, zu dem „Open" springt.
   */
  useAsset(id: string, als: 'map' | 'token' | 'prop', fuer?: string): Promise<BildVerwendet> {
    return this.call<BildVerwendet>(`/api/assets/${encodeURIComponent(id)}/use`, {
      method: 'POST',
      body: JSON.stringify({ as: als, ...(fuer ? { for: fuer } : {}) }),
    });
  }

  assetUses(id: string): Promise<BildVerwendung> {
    return this.call<BildVerwendung>(`/api/assets/${encodeURIComponent(id)}/uses`);
  }

  private async sendeBild(method: 'POST' | 'PUT', url: string, form: FormData): Promise<Entity & { url: string; thumb: string }> {
    const res = await fetch(`${this.base}${url}`, {
      method,
      credentials: 'include',
      headers: this.sichtKopf(),
      body: form,
    });
    this.merkeBau(res);
    const b = (await res.json().catch(() => null)) as (Entity & { url: string; thumb: string; error?: string; issues?: unknown }) | null;
    if (!res.ok) throw new ApiError(res.status, b?.error ?? `Upload failed (${res.status})`, b?.issues, b);
    return b!;
  }

  campaigns(): Promise<Kampagnen> {
    return this.call<Kampagnen>('/api/campaigns');
  }
  createCampaign(name: string, lead: boolean): Promise<{ id: string; name: string }> {
    return this.call('/api/campaigns', { method: 'POST', body: JSON.stringify({ name, lead }) });
  }
  /** Die Sichtbarkeit je Gruppe (T-252): gerechnet am Server, je Spalte gezählt. */
  campaignVisibility(campaign: string, steps: string): Promise<SichtUebersicht> {
    const q = steps ? `?steps=${encodeURIComponent(steps)}` : '';
    return this.call<SichtUebersicht>(`/api/campaigns/${encodeURIComponent(campaign)}/visibility${q}`);
  }
  setVisibilityRule(
    campaign: string,
    rule: { id: string; audience?: Audience | null; show?: string[]; hide?: string[] },
  ): Promise<{ ok: true; rules: VisibilityRule[] }> {
    return this.call(`/api/campaigns/${encodeURIComponent(campaign)}/visibility/rules`, { method: 'PUT', body: JSON.stringify(rule) });
  }
  followGroup(campaign: string, ids: string[]): Promise<{ ok: true; done: string[]; refused: { id: string; error: string }[] }> {
    return this.call(`/api/campaigns/${encodeURIComponent(campaign)}/visibility/follow`, { method: 'POST', body: JSON.stringify({ ids }) });
  }
  members(campaign: string): Promise<Mitglieder> {
    return this.call<Mitglieder>(`/api/campaigns/${encodeURIComponent(campaign)}/members`);
  }
  addMember(
    campaign: string,
    wer: { name?: string; user?: string },
    role: TableRole,
  ): Promise<unknown> {
    return this.call(`/api/campaigns/${encodeURIComponent(campaign)}/members`, {
      method: 'POST',
      body: JSON.stringify({ ...wer, role }),
    });
  }
  setRole(campaign: string, user: string, role: TableRole): Promise<unknown> {
    return this.call(
      `/api/campaigns/${encodeURIComponent(campaign)}/members/${encodeURIComponent(user)}`,
      {
        method: 'PUT',
        body: JSON.stringify({ role }),
      },
    );
  }
  removeMember(campaign: string, user: string): Promise<unknown> {
    return this.call(
      `/api/campaigns/${encodeURIComponent(campaign)}/members/${encodeURIComponent(user)}`,
      {
        method: 'DELETE',
      },
    );
  }
  setActors(campaign: string, user: string, actorIds: string[]): Promise<unknown> {
    return this.call(
      `/api/campaigns/${encodeURIComponent(campaign)}/members/${encodeURIComponent(user)}/actors`,
      { method: 'PUT', body: JSON.stringify({ actorIds }) },
    );
  }
  /** Die Ebenen einer Kampagne, aufgeschaltet oder nicht (T-069). */
  campaignStory(campaign: string): Promise<KampagnenGeschichte> {
    return this.call<KampagnenGeschichte>(`/api/campaigns/${encodeURIComponent(campaign)}/story`);
  }
  campaignLayers(campaign: string): Promise<KampagnenEbenen> {
    return this.call<KampagnenEbenen>(`/api/campaigns/${encodeURIComponent(campaign)}/layers`);
  }
  /** Die gespeicherten Ebenenauswahlen dieses Kontos (T-186). */
  layerSets(): Promise<{ sets: Ebenenauswahl[] }> {
    return this.call('/api/me/layer-sets', {}, false);
  }
  /** Speichern; derselbe Name für dieselbe Kampagne ersetzt. */
  saveLayerSet(set: { name: string; campaign: string | null; layers: string[]; off: string[] }): Promise<Ebenenauswahl> {
    return this.call('/api/me/layer-sets', { method: 'POST', body: JSON.stringify(set) });
  }
  deleteLayerSet(id: string): Promise<{ ok: true }> {
    return this.call(`/api/me/layer-sets/${encodeURIComponent(id)}`, { method: 'DELETE' });
  }
  /** Der ganze Stapel, von unten nach oben; was fehlt, ist danach aus.
   *  `off` (T-088): die Ebenen, die trotz aufgeschalteter Gruppe aus sind;
   *  ohne bleiben die Abschaltungen, wie sie sind. */
  setCampaignLayers(campaign: string, layers: string[], off?: string[]): Promise<{ ok: true; layers: string[]; state?: KampagnenEbenen | null }> {
    return this.call(`/api/campaigns/${encodeURIComponent(campaign)}/layers`, {
      method: 'PUT',
      body: JSON.stringify(off ? { layers, off } : { layers }),
    });
  }
  /** Quellenkürzel → voller Titel (T-088) und → Herausgeber (T-094). */
  sources(): Promise<{ sources: Record<string, string>; publishers?: Record<string, string> }> {
    return this.call<{ sources: Record<string, string>; publishers?: Record<string, string> }>('/api/sources');
  }
  /** Die Vergleichsebenen und wer sie sieht (T-092); was fehlt, bleibt, wie es ist. */
  setCampaignCompare(
    campaign: string,
    neu: { layers?: string[]; players?: boolean },
  ): Promise<{ ok: true; layers: string[]; state?: KampagnenEbenen | null }> {
    return this.call(`/api/campaigns/${encodeURIComponent(campaign)}/compare`, {
      method: 'PUT',
      body: JSON.stringify(neu),
    });
  }
  /** Eine Ebene dazuschalten; der Server sucht ihr den Platz im Stapel. */
  /** Was eine Ebene bringt (T-105); `null` heisst wieder alles. */
  setLayerOnly(
    campaign: string,
    layer: string,
    only: { areas?: string[]; types?: string[] } | null,
  ): Promise<{ ok: true; state?: KampagnenEbenen | null }> {
    return this.call(
      `/api/campaigns/${encodeURIComponent(campaign)}/layers/${encodeURIComponent(layer)}/only`,
      { method: 'PUT', body: JSON.stringify(only ?? {}) },
    );
  }
  /** Von den Typ-Regeln ausnehmen oder wieder folgen (T-187). */
  setLayerExempt(campaign: string, layer: string, exempt: boolean): Promise<{ ok: true; state?: KampagnenEbenen | null }> {
    return this.call(
      `/api/campaigns/${encodeURIComponent(campaign)}/layers/${encodeURIComponent(layer)}/only`,
      { method: 'PUT', body: JSON.stringify({ exempt }) },
    );
  }
  /** Die Typ-Regel einer Gruppe (T-187); `null` nimmt sie weg. */
  setLayerRule(
    campaign: string,
    group: string,
    rule: { areas?: string[]; types?: string[] } | null,
  ): Promise<{ ok: true; state?: KampagnenEbenen | null }> {
    return this.call(
      `/api/campaigns/${encodeURIComponent(campaign)}/rules/${encodeURIComponent(group)}`,
      { method: 'PUT', body: JSON.stringify(rule ?? {}) },
    );
  }
  /** Der Inhalt einer Quelle als Baum, mit dem Stand in der laufenden Kampagne (T-189). */
  layerContents(layer: string): Promise<Quelleninhalt> {
    return this.call<Quelleninhalt>(`/api/layers/${encodeURIComponent(layer)}/contents`);
  }
  /** Einen Artikel einzeln freigeben oder zurücknehmen (T-187). */
  setEnabled(campaign: string, id: string, on: boolean): Promise<{ ok: true; state?: KampagnenEbenen | null }> {
    return this.call(`/api/campaigns/${encodeURIComponent(campaign)}/enabled/${encodeURIComponent(id)}`, {
      method: on ? 'PUT' : 'DELETE',
    });
  }
  /** Die laufende Kampagne wechseln — nur die Verwaltung (T-143). */
  setCurrentCampaign(id: string): Promise<{ ok: true; current: string }> {
    return this.call('/api/campaigns/current', { method: 'PUT', body: JSON.stringify({ id }) });
  }
  /** Eine ganze Gruppe an oder aus, mit allem darin (T-185). */
  switchGroup(campaign: string, group: string, on: boolean): Promise<{ ok: true; layers: string[]; state?: KampagnenEbenen | null }> {
    return this.call(
      `/api/campaigns/${encodeURIComponent(campaign)}/layers/${encodeURIComponent(group)}/group`,
      { method: 'PUT', body: JSON.stringify({ on }) },
    );
  }
  activateLayer(campaign: string, layer: string): Promise<{ ok: true; layers: string[]; state?: KampagnenEbenen | null }> {
    return this.call(
      `/api/campaigns/${encodeURIComponent(campaign)}/layers/${encodeURIComponent(layer)}`,
      { method: 'POST' },
    );
  }
  users(): Promise<Konto[]> {
    return this.call<Konto[]>('/api/users');
  }
  invites(): Promise<Einladung[]> {
    return this.call<Einladung[]>('/api/invites');
  }
  createInvite(neu: NeueEinladung): Promise<{ code: string; handle: string }> {
    return this.call('/api/invites', { method: 'POST', body: JSON.stringify(neu) });
  }
  dropInvite(handle: string): Promise<unknown> {
    return this.call(`/api/invites/${encodeURIComponent(handle)}`, { method: 'DELETE' });
  }
}

/** Die Lage für den Zugplan (`GET /api/maps/:id/turn-plan`, T-198). */
export interface ZugLage {
  leitet: boolean;
  actors: { id: string; name: string; own: boolean; rel: string | null }[];
  /** `reaction`: hat die Figur ihre Reaktion (Runde 2: verbraucht bis zum eigenen nächsten Zug)? */
  actor: { id: string; name: string; speed: number; rel: string | null; reaction: boolean } | null;
  /** Läuft auf der Karte eine Begegnung? Dann zieht nur der Plan. */
  encounter: { id: string } | null;
  tiles: PlanTile[];
  /** `chances`: Trefferchance in Prozent je Angriffskachel; `ac` nur für die Leitung. */
  targets: { id: string; name: string; type: string; chances: Record<string, number>; ac?: number }[];
  /** Wer die Figur bedroht: Token (`rel`) der Gegenseite und seine Reichweite in Fuss. */
  threats: { id: string; name: string; rel: string; reach: number }[];
  /** `canAnswer`: dieser Betrachter beantwortet die offene Reaktionsfrage. */
  plans: (TurnPlan & { at: string; canAnswer?: boolean })[];
}

/** Was neben einer Karte steht (`GET /api/maps/:id/context`, T-115). */
export interface KartenKontext {
  parents: { id: string; name: string }[];
  children: { id: string; name: string; frame: { x: number; y: number; w: number; h: number } }[];
  targets: Record<string, { name: string; type: string; image?: string }>;
  party: { id: string; name: string; x: number; y: number; mapId: string; mapName: string; direct: boolean } | null;
  /** Der laufende Kampf auf dieser Karte (REQ-144): wessen Token dran ist und wessen danach. */
  turn: { encounter: string; name: string; round: number; current: string | null; next: string | null } | null;
  /** Nur für die Leitung: die Teilnehmer, und ob sie hier schon ein Token haben. */
  combatants: { id: string; name: string; placed: boolean }[];
  /** Die Kartenregeln der Kampagne (T-204). Fehlt bei einem älteren Server. */
  rules?: MapRules;
  /** Die eigenen Figuren mit Token hier — die darf der Betrachter ziehen (T-204). */
  own?: string[];
  /** Offene Zugvorschläge: für die Leitung alle, für Spielende die eigenen (T-204). */
  proposals?: { plan: string; actor: string; actorName: string; by: string; to: { x: number; y: number } }[];
  /** Dunkelsicht in Fuss je Figur, deren Sicht die Seite zeichnet (T-216). Fehlt bei einem älteren Server. */
  darkvision?: Record<string, number>;
}

/** Die Seitenleiste der Karte (`GET /api/maps/:id/side`, T-203). */
export interface KartenSeite {
  party: { id: string; name: string } | null;
  figures: {
    id: string;
    name: string;
    hp: number | null;
    hpMax: number | null;
    hpTemp: number | null;
    conditions: { id: string; name: string }[];
  }[];
  session: { id: string; name: string } | null;
  encounters: {
    id: string;
    name: string;
    phase: string;
    round: number;
    /** `Encounter.kind` (T-184); leer: nicht gesagt. */
    kind: string[];
    here: boolean;
    active: boolean;
    participants: { id: string; name: string }[];
  }[];
}

/** Was auf dem Tisch liegt (`GET /api/play`, T-115). */
export interface Tisch {
  campaign: { id: string; name: string } | null;
  sessions: { id: string; name: string; activeMap: string | null; mapName: string | null }[];
  session: string | null;
  map: string | null;
  maps: { id: string; name: string }[];
}

/** Eine Zeile der Kartenliste (`GET /api/maps`, T-202): als Baum, mit Bild, Marken und Ebenen. */
export interface KartenZeile {
  id: string;
  name: string;
  image: string;
  kind: string;
  tags: string[];
  layers: { id: string; name: string }[];
  depth: number;
  parent: string | null;
}

/** Wo eine Karte vorkommt (`GET /api/maps/:id/uses`, T-202). */
export interface KartenVerwendung {
  id: string;
  name: string;
  type: string;
  via: string;
}

/** Ein Wurf, wie die Oberfläche ihn schickt (T-172). */
export interface RollAnfrage {
  expr: string;
  subject?: string | undefined;
  label?: string | undefined;
  mode?: 'adv' | 'dis' | undefined;
  hidden?: boolean | undefined;
  actor?: string | undefined;
  session?: string | undefined;
}

/** Das Log eines Artikels (`GET /api/rolls`). */
export interface WurfLog {
  entries: RollEntry[];
  total: number;
  next: number | null;
  people: { id: string; name: string }[];
  sessions: { id: string; name: string }[];
  subjects: string[];
  leitet: boolean;
}

/** Der Inhaltsbaum einer Quelle (T-189, `GET /api/layers/:layer/contents`). */
export interface Quelleninhalt {
  layer: { id: string; name: string; group?: true };
  campaign: { id: string; name: string } | null;
  /** `manage`: ändern; `see`: nur sehen; `null`: keine Leitung dieser Kampagne. */
  may: 'manage' | 'see' | null;
  state: {
    inPlay: boolean;
    own: boolean;
    only?: { areas?: string[]; types?: string[] };
    brings?: { areas?: string[]; types?: string[] };
    ruleFrom?: { id: string; name: string };
    compare?: true;
    off?: true;
  };
  types?: {
    type: string;
    label: string;
    area: string;
    on: boolean;
    articles: { id: string; name: string; state: 'layer' | 'enabled' | 'off'; replaced?: true; blocked?: true }[];
  }[];
  layers?: { id: string; name: string; group?: true; articles: number; inPlay: boolean }[];
  removes?: number;
  onlyInPlay?: true;
}
