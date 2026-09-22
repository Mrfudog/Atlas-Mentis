/**
 * The compound backbone, as types.
 *
 *   entity   = peg   — an opaque id and nothing else
 *   type     = row   — what a kind of thing records, and what it inherits
 *   card     = one payload per type per entity, absent when unused
 *   relation = string — a typed, directed edge that may carry its own props
 *
 * Membership is asserted with `Typed` and verified by Validation (D5). Every
 * definition below is a REGISTRY ROW, not code — adding a kind of thing is an
 * insert, never a migration.
 *
 * Komponenten gibt es nicht mehr. Eine Art trägt ihre Felder selbst; was
 * mehrere Arten teilten, ist ein Obertyp geworden.
 */

/** Opaque entity id. No pack, type or version encoded in it (D15 / REQ-163). */
export type EntityId = string;

export type PropertyType = 'string' | 'number' | 'integer' | 'boolean' | 'array' | 'object';

export interface PropertySchema {
  type: PropertyType;
  title?: string;
  enum?: string[];
  /** `long` asks for a textarea; `signed` prints +3 / -1; `color`, `link`,
   *  `asset` and `date` each pick their own input. `measure` says the text
   *  carries numbers with units and may be converted on read. */
  format?: 'long' | 'signed' | 'color' | 'link' | 'asset' | 'date' | 'measure' | string;
  /**
   * Die Einheit, in der **der gespeicherte Wert** steht — `ft`, `lb`, `m`.
   * Umgerechnet wird beim Lesen und nie gespeichert (D8): zwei Zahlen für
   * dasselbe Mass sind zwei Zahlen, die sich widersprechen können.
   *
   * An einem Text mit `format: 'measure'` ist es das **Ausgangsmass**: die
   * Einheit, in der die Zahlen gemeint sind, die keine nennen. „40 ft,
   * climb 20 ft" sagt es selbst, „40" nicht — und ohne Ausgangsmass rechnet
   * an einem solchen Feld nichts, was aussieht wie „diese Kampagne ist
   * eben imperial". Darum verlangt die Prüfung es: `measure` ohne `unit`
   * ist keine Angabe, sondern eine, die stillschweigend ausfällt.
   */
  unit?: string;
  /**
   * **Eins oder mehrere.** Ein Feld mit `many` trägt eine Liste von
   * Einträgen statt eines Werts, und jeder Eintrag ist `{id, value}`.
   *
   * Die `id` ist nicht Zierde: an ihr hängt die Wissensfreigabe. Ein
   * Geheimnis von dreien freizugeben heisst, genau diesen Eintrag
   * freizugeben — über den Index ginge das auch, bis jemand die Reihenfolge
   * ändert, und dann gehört die Freigabe still zum falschen Satz.
   *
   * Das waren einmal **Blöcke**: `{blockType, body, anchor}` neben den
   * Feldern. Ein eigener Begriff für Text, der neben den Feldern lag, war
   * eine zweite Art, dasselbe zu sagen — die Blockart ist jetzt das Feld
   * (`secret`, `lore`, `readaloud`), und der Anker ist die `id`.
   */
  many?: boolean;
  items?: { type: PropertyType };
  /**
   * Calculation engine: an expression evaluated on read and never stored (D8).
   * Names resolve against sibling fields of the same component.
   * Examples: `mod(str)`, `10+mod(wis)`, `mod(dex)+prof`.
   */
  derived?: string;
  /** Render this derived value inside the named sibling's cell: STÄ 16 (+3). */
  of?: string;
  /**
   * **Eine Aufzählung, die mehrere Felder teilen.** Statt der Werte steht
   * hier der Name einer Aufzählungszeile (`Registry.enums`), und die Werte
   * stehen dort einmal.
   *
   * `Skill.ability` und `Recipe.ability` trugen dieselben sechs Wörter
   * zweimal. Zwei Listen für eine Sache halten genau so lange, wie jemand
   * an beide denkt — und die eine, die niemand nachzieht, ist danach still
   * falsch. Gelesen wird beides über `enumOptions()`: ein Feld nennt seine
   * Werte selbst **oder** eine Zeile, nie beides.
   *
   * **Mehrere Zeilen sind erlaubt**, und dann gelten sie zusammen: worin
   * jemand geübt ist, kommt aus Fertigkeiten, Werkzeugen, Sprachen, Waffen,
   * Rüstungen und Wissensgebieten — sechs Listen, ein Feld. Ein Feld je
   * Liste hiesse, dieselbe Frage sechsmal zu stellen, und die siebte Sorte
   * bräuchte ein siebtes Feld. Die Herkunft eines Werts bleibt lesbar,
   * solange die Listen sich nicht überschneiden; `enumGroups()` gibt sie
   * getrennt zurück, damit eine Maske sie gruppieren kann.
   *
   * Zusammen mit `type: 'array'` heisst das: **mehrere Werte aus diesen
   * Listen.** Das ist der Unterschied zwischen „welches Attribut trägt die
   * Probe" (eines) und „auf welche Rettungswürfe ist sie geübt" (mehrere).
   */
  enumRef?: string | string[];
  /**
   * Die Spanne einer Zahl, beide Grenzen eingeschlossen. Eine Stufe von 1
   * bis 20 ist eine Spanne und keine Aufzählung von zwanzig Wörtern: die
   * Grenzen sagen, was gilt, und die Maske darf daraus ein Zahlenfeld mit
   * Anschlag machen.
   */
  min?: number;
  max?: number;
  default?: unknown;
  /**
   * **Worauf ein Verweisfeld zeigen darf.** Ein Feld mit `format: 'link'`
   * hält die Id eines Artikels; ohne Zielangabe hält es die Id von
   * *irgendeinem*, und „Scene in play" nahm eine Rüstung.
   *
   * Kanten sagen das längst (`RelationDef.from` / `to`), und hier gilt
   * dasselbe: die Artikelart, Untertypen eingeschlossen, denn eine
   * Spielerfigur ist eine Kreatur. Zwei Mechanismen für eine Frage wären
   * zwei Antworten, von denen eine irgendwann veraltet.
   */
  target?: LinkTarget;
  /**
   * **Ausgegeben, nicht eingetippt.** Das Feld bekommt keine Eingabe: es
   * wird beim Anlegen gesetzt und ändert sich danach nicht mehr.
   *
   * Das ist nicht `derived`: ein gerechneter Wert entsteht bei jedem Lesen
   * neu (D8), eine ausgegebene Nummer muss stehen bleiben — sonst hiesse
   * derselbe Artikel morgen anders.
   */
  readOnly?: boolean;
}

/**
 * Wohin ein Verweisfeld zeigen darf. Drei Filter, alle freiwillig, mit UND
 * verbunden — und nur der erste ist eine **Regel**.
 *
 * `interfaces` prüft die Validierung: die Art eines Artikels ändert sich
 * nicht, weil jemand anderes etwas bearbeitet, also hält die Prüfung. `tags`
 * und `where` lesen den **heutigen** Zustand des Ziels; daraus eine Regel zu
 * machen hiesse, dass ein entfernter Marker einen längst gespeicherten
 * Verweis rückwirkend falsch macht. Also: **die Art hält, der Filter
 * schlägt vor** — die Maske bietet weniger an, die Prüfung lehnt nur ab,
 * was die Art verfehlt.
 */
export interface LinkTarget {
  /** Artikelarten, **Untertypen eingeschlossen**. Leer heisst: jede. */
  interfaces?: string[];
  /** Marken: eine davon genügt. Ein Vorschlag für die Maske. */
  tags?: string[];
  /** Ein Feldwert, der stimmen soll. Auch das ein Vorschlag. */
  where?: { component: string; property: string; value?: unknown };
}

export interface ObjectSchema {
  type: 'object';
  required?: string[];
  properties: Record<string, PropertySchema>;
  additionalProperties?: boolean;
}

/**
 * A row of `interface` — the only registry row for a kind of thing.
 *
 * Es gab hier einmal zwei: `ComponentDef` trug die Felder, `InterfaceDef`
 * zählte auf, welche Komponenten eine Artikelart verlangt und welche sie
 * erlaubt. Gemessen hatte das wenig Wert: **38 von 43** Komponenten hatten
 * genau einen Nutzer, und **13 von 18** `requires`-Einträgen verlangten eine
 * Karte, die kein einziges Pflichtfeld hat — eine leere Karte trägt nichts.
 * Was mehrere Arten teilten, ist jetzt ein Obertyp; was einer gehörte, sind
 * ihre Felder.
 *
 * Gespeichert wird weiterhin eine Karte je Art (`Entity.components`), weil
 * genau das `hp` an der Kreatur von `hp` am Statblock unterscheidet, ohne
 * dass jemand eins von beiden umbenennen muss.
 */
export interface InterfaceDef {
  name: string;
  label?: string;
  /** Abstract interfaces are extended but never instantiated. */
  abstract?: boolean;
  extends?: string[];
  /** The fields this type records itself. Inherited ones come from `extends`. */
  schema?: ObjectSchema;
  /**
   * In welchen Bereich der Oberfläche diese Artikelart gehört: `world`,
   * `history`, `rules` oder `play`. Steht hier und nicht im Code, weil eine
   * neue Artikelart sonst eine Codeänderung bräuchte, um überhaupt
   * auffindbar zu sein — und das wäre genau die Sorte Ausnahme, die das
   * Rückgrat vermeidet. Ohne Angabe: taucht nur im Kompendium auf.
   *
   * Register und Kompendium sind **keine** Bereiche: das eine zeigt die
   * Zeilen, das andere alle Artikel ohne Rücksicht darauf, wo sie hingehören.
   */
  area?: 'world' | 'history' | 'rules' | 'play';
  /**
   * **Die Anordnung wohnt am Typ**, nicht an der Ansicht: eine Kreatur
   * ordnet ihre `full` anders als ein Rezept, und das steht bei der
   * Kreatur. Untertypen erben sie, bis einer etwas Eigenes sagt; sagt
   * niemand in der Kette etwas, gilt die Grundanordnung der Ansicht.
   *
   * Sie stand einmal an der Ansicht (`ViewDef.byInterface`). Wer wissen
   * wollte, wie eine Art gezeichnet wird, musste dafür drei Ansichten
   * aufmachen und in jeder nach ihr suchen.
   */
  views?: Record<string, LayoutElement[]>;
  /**
   * In welchem System die Masse dieser Artikelart dastehen. Wird wie `area`
   * die `extends`-Kette hoch geerbt; ohne Angabe gilt die Einstellung der
   * Kampagne. Eine Kreatur darf imperial bleiben, weil ihre Zahlen aus dem
   * Regelwerk kommen, während der Rest metrisch dasteht.
   */
  units?: 'imperial' | 'metric' | 'both';
  /**
   * **Wie ein geerbtes Feld hier heissen soll.** Eine Karte `Typ.feld` →
   * Beschriftung, aufgelöst die `extends`-Kette hoch wie `area` und
   * `units`: `Recipe` nennt `Time.duration` „Burn time", `Quest` nennt es
   * „Deadline", und sonst heisst es „Duration".
   *
   * Es ist **keine** zweite Feldliste: der Bestandteil bleibt einer, und
   * ein Feld, das morgen dazukommt, trägt seinen eigenen Namen, ohne dass
   * hier jemand nachzieht. Es steht hier und nicht am Bestandteil, weil
   * derselbe `Time.duration` bei einem Rezept etwas anderes meint als bei
   * einer Quest — den Bestandteil dafür zu verdoppeln wäre der teurere
   * Weg zum selben Satz.
   */
  titles?: Record<string, string>;
}

/**
 * Eine Einheit als Registerzeile. Umgerechnet wird über die Grundeinheit
 * der Grösse: `base` sagt, wie viel eine davon darin ist — ein Fuss sind
 * 0,3048 Meter. Damit ist jede Umrechnung eine Division, und eine neue
 * Einheit ist ein Einfügen und keine Codeänderung.
 */
export interface UnitDef {
  /** Wie sie geschrieben wird: `ft`. */
  code: string;
  label: string;
  /** Was sie misst: `length`, `weight`, `volume`. */
  quantity: string;
  system: 'imperial' | 'metric';
  /** Wie viel eine Einheit davon in der Grundeinheit der Grösse ist. */
  base: number;
  /** Andere Schreibweisen, die im Text vorkommen: `feet`, `Fuss`, `'`. */
  aliases?: string[];
  /** Nachkommastellen beim Anzeigen. */
  decimals?: number;
}

/** A row of `relation_def`. */
export interface RelationDef {
  type: string;
  label: string;
  /** How the edge reads from its target. One edge, two labels (REQ-182). */
  inverseLabel: string;
  /** Source interfaces; `*` for any. */
  from?: string[];
  /** Target interfaces; `*` for any, `same` for the source's own interface. */
  to?: string[];
  /** The target is deleted with the source. */
  owned?: boolean;
  cardinality?: 'one' | 'many';
  /**
   * **An welchem Ende diese Verbindung sich wie ein Feld liest** — `from`
   * oder `to`.
   *
   * Die Zahlen einer Kreatur stehen am Statblock, und der Statblock ist ein
   * eigener Artikel: austauschbar, wiederverwendbar, mit eigenem Namen. Für
   * die Kreatur ist er trotzdem kein Verweis auf etwas Fremdes, sondern der
   * Teil von ihr, der woanders wohnt. Genau das sagt diese Angabe: das
   * Register zeigt die Felder des anderen Typs am Typ mit an, und der
   * Artikel lässt sie **dort** bearbeiten, wo man ist, statt auf einen
   * zweiten Artikel zu springen.
   *
   * `belongsTo` steht `to`: die Kante geht vom Statblock zur Kreatur, und
   * die **Kreatur** ist das Ende, das ihn wie ein Feld liest. `carries`
   * steht `from`: dort geht sie von der Kreatur zum Inventar.
   *
   * **Nicht** für einen Verweis auf etwas, das für sich steht: ein Rezept
   * liefert einen Gegenstand, eine Begegnung wird auf einer Karte
   * gefochten — beide gäbe es auch ohne. Das Mass ist: **ohne das andere
   * wäre dieser Artikel unvollständig, und es gehört keinem zweiten.**
   */
  asField?: 'from' | 'to';
  /** When set, the edge renders as a composition section under this heading. */
  section?: string;
  props?: ObjectSchema;
}

/**
 * A Darstellungsstufe (facet, REQ-164): what a view shows, not what it may read.
 * Selection can only narrow — Access and Knowledge filter before layout.
 */
/** The kinds of element a view layout may hold. */
export type LayoutElementKind =
  | 'heading'
  | 'text'
  | 'fields'
  | 'prose'
  | 'description'
  | 'composed'
  | 'relations'
  | 'image'
  /**
   * **Was woanders wohnt, hier bearbeiten.** Die Felder der Artikel, die
   * über eine `asField`-Kante hängen — der Statblock einer Kreatur, das
   * Inventar einer Gruppe. Gezeichnet werden ihre eigenen Eingaben, die in
   * ihren eigenen Artikel schreiben; ein Verweis, auf den man springen
   * muss, um eine Zahl zu ändern, ist der Umweg, den niemand zweimal geht.
   */
  | 'linked'
  | 'knowledge'
  | 'map'
  | 'sheet'
  | 'inventory'
  | 'crafting'
  | 'board'
  | 'initiative'
  | 'quests'
  | 'timeline'
  | 'live'
  | 'table'
  | 'prep'
  | 'crawl'
  | 'standing'
  | 'stack'
  | 'tabs';

/**
 * One element of a view's layout. A view is an ordered list of these, so the
 * sequence is a statement in the registry rather than a side effect of
 * whatever the renderer happens to do first.
 *
 * Deliberately one shape with optional settings rather than a discriminated
 * union: these rows are hand-edited JSON, and a reader that has to cope with
 * a half-filled element anyway gains nothing from a type that promises the
 * element is complete.
 */
export interface LayoutElement {
  id: string;
  el: LayoutElementKind;
  /** `heading` and `text`. */
  text?: string;
  /** `fields`: `all` or a list of `Component` / `Component.field`. */
  fields?: 'all' | string[];
  /**
   * Was weggelassen wird — bei `fields` wie bei `prose`.
   *
   * Weil ein anderes Element desselben Layouts sie schon zeichnet (der
   * Bogen die Kampfwerte, die Feldtabelle den Rest), oder weil „alles
   * ausser den Geheimnissen" richtig bleiben soll, wenn ein neues Feld
   * dazukommt.
   *
   * In beiden Fällen dasselbe Argument: eine ausgeschriebene Liste ist am
   * Tag der nächsten Registerzeile falsch, und niemand merkt es — das Neue
   * steht einfach nirgends.
   */
  except?: string[];
  /** `fields`: 0 fits the width. */
  columns?: number;
  /**
   * `tabs`: benannte Gruppen desselben Layouts.
   *
   * Ein Charakterbogen ist keine Liste von Abschnitten untereinander — am
   * Tisch schaut man auf **einen** davon. Statt dafür eine Darstellungsstufe
   * je Reiter anzulegen (dann wären es wieder einundzwanzig), enthält ein
   * Element benannte Gruppen, und jede Gruppe ist ein gewöhnliches Layout.
   *
   * Was **über** den Reitern stehen bleiben soll, steht vor diesem Element
   * im selben Layout: der Vitalstreifen gehört dorthin, weil man ihn
   * braucht, ohne umzuschalten — dieselbe Regel wie bei der Initiative auf
   * dem Spieltisch.
   */
  tabs?: LayoutTab[];
}

export interface LayoutTab {
  id: string;
  label: string;
  /** Leere Reiter zeichnet niemand: ein Reiter, der nichts zeigt, ist ein
   *  Knopf, der nichts tut. */
  layout: LayoutElement[];
}

export interface ViewDef {
  label: string;
  order?: number;
  /** `all`, `none`, or a list of `Component` / `Component.field` entries. */
  fields: 'all' | 'none' | string[];
  description?: boolean;
  /** Composition sections built from `section` relations. */
  composed?: boolean;
  /** The relations panel. */
  relations?: boolean;
  /** Per-reference variable bindings. */
  bindings?: boolean;
  image?: boolean;
  /**
   * Was diese Ansicht zeichnet, **solange keine Artikelart etwas Eigenes
   * sagt.** Die eigene Anordnung einer Art steht an der Art
   * (`InterfaceDef.views`); hier steht der Rückfall, damit eine neu
   * angelegte Art nicht mit einer leeren Seite anfängt.
   */
  layout?: LayoutElement[];
}

export interface Registry {
  interfaces: Record<string, InterfaceDef>;
  relations: Record<string, RelationDef>;
  /**
   * Aufzählungen, die mehrere Felder teilen — eine Liste von Wörtern mit
   * einem Namen. Ein Feld nennt sie über `enumRef`.
   *
   * Das ist dieselbe Sorte Zeile wie ein Typ: es steht im Register, es
   * gehört keinem Artikel, und wer die Liste ändert, ändert sie einmal.
   * Optional, weil ein Register ohne geteilte Aufzählung vollständig ist.
   */
  enums?: Record<string, EnumDef>;
  views: Record<string, ViewDef>;
  /** Einheiten und wie sie ineinander umgerechnet werden. */
  units: Record<string, UnitDef>;
  /** Campaign-wide defaults for {VAR} substitution — the last resort. */
  vars: Record<string, string>;
  /**
   * Campaign settings (REQ-043): a key-value store each area reads the keys
   * it knows from and ignores the rest. Deliberately untyped — a setting
   * that needs a schema before anyone can set it does not get set.
   */
  settings?: Record<string, string>;
}


/**
 * Eine Aufzählungszeile: ein Name und die Wörter, die er meint.
 *
 * Sie trägt keine Felder, also ist sie kein `InterfaceDef` — und sie ist
 * trotzdem ein Typ im Register: `Skill` hat ein Feld `ability`, und dessen
 * Typ ist `Ability`. Wer die sechs Wörter ändert, ändert sie hier.
 */
export interface EnumDef {
  name: string;
  label?: string;
  values: string[];
}

export interface RelationProps {
  /** Per-reference bindings for the target's {VAR} placeholders (REQ-174). */
  vars?: Record<string, string>;
  note?: string;
  menge?: number;
  [key: string]: unknown;
}

export interface Relation {
  id: string;
  type: string;
  to: EntityId;
  props?: RelationProps;
}

/** An article-local field, not yet promoted into the interface (REQ-181). */
export interface AdhocField {
  key: string;
  label: string;
  type: PropertyType;
  value: unknown;
}

export type ComponentValue = Record<string, unknown>;

export interface Entity {
  id: EntityId;
  /** Asserted interface membership — the `Typed` card, flattened. */
  interfaces: string[];
  name: string;
  /**
   * Die Feldwerte, gruppiert nach der Art, die sie erklärt. Die Gruppierung
   * ist kein Rest der alten Komponenten: sie hält `hp` an der Kreatur und
   * `hp` am Statblock auseinander, ohne dass eins von beiden einen Namen
   * bekommt, den niemand gewählt hätte.
   */
  components: Record<string, ComponentValue>;
  adhoc?: AdhocField[];
  /** Forward edges only. The reverse is always a query. */
  relations?: Relation[];
  createdAt?: string;
  updatedAt?: string;
}

/** One edge seen from its target. */
export interface Backlink {
  from: Entity;
  relation: Relation;
  def: RelationDef;
}
