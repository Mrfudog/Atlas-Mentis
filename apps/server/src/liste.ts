/**
 * Die Liste am Server (W7): Kompendium, Bereiche und jede Auswahl, die nach
 * Artikeln sucht.
 *
 * Bis zum 13.10. holte der Browser die Kurzfassung **aller** Artikel
 * (`?as=summary`, 7,7 MB bei den 24 157 aus 5e.tools) und rechnete Liste,
 * Filter und Verweise selbst — und die Artikelseite wartete mit, weil
 * Register und Kurzfassung in einem Zug kamen. Jetzt rechnet der Server
 * über den gesiebten Bestand und schickt ein Blatt.
 *
 * **Der Index gilt je Stempel und Betrachter.** Gesiebt wird einmal
 * (`sieve` in `app.ts`: Stapel, Sichtbarkeit, Wissen), danach liegt je
 * Artikel eine schmale Zeile da — Name, Art, Ebenen, Quelle, die Spalten
 * der Art und ein Suchtext. Blättern, Suchen und Filtern laufen über diese
 * Zeilen und nicht über die Artikel. Ändert sich der Bestand (Stempel) oder
 * das Register, wird neu gerechnet; ein Spieler bekommt seinen eigenen
 * Index, weil er andere Artikel und andere Felder sieht.
 *
 * Was eine Zeile zeigt, sagt die Art: die Felder ihrer `overview`
 * (`listColumns`). Wonach gefiltert wird, sagen die Felder selbst — eine
 * Aufzählung (`enum`/`enumRef`) wird zu Häkchen, eine Zahl zu einer
 * Spanne. Im Code steht keine Spalte und kein Filter je Art.
 */

import {
  articleImage,
  assetMeta,
  assetVersion,
  type AssetMeta,
  areaOf,
  allOf,
  commonFacets,
  effectLabel,
  facetFieldValues,
  facetNumber,
  facetsFor,
  articleId,
  BASE_COLUMNS,
  cleanColumns,
  columnField,
  columnKind,
  derivedInputs,
  derivedValue,
  entityName,
  enumOptions,
  fieldTitle,
  isBookPart,
  isInstance,
  LAYER_RELATION,
  layoutFor,
  listColumns,
  inTimeWindow,
  HAS_REF,
  hasEdgeChoices,
  hasFieldAllowed,
  hasFieldChoices,
  hasValue,
  isHasEdge,
  matchesHas,
  parseHasTerm,
  meetsRequirement,
  parseRequirement,
  parseTimeWindow,
  primaryInterface,
  requirementContext,
  requirementKeys,
  requirementLabel,
  spellListRequirement,
  tagsOf,
  typeChain,
  versionGroups,
  isLayer,
} from '@nw/model';
import type { CharacterProfile, Entity, FacetDef, HasFacts, HasTerm, TimeWindow, LayoutElement, PropertySchema, Registry, Requirement, RequirementContext } from '@nw/model';

/** Ein Artikel ohne Ebenenkante steht in der Liste unter „keine Ebene". */
export const NO_LAYER = '∅';

interface Spalte {
  ref: string;
  type: string;
  key: string;
  prop: PropertySchema;
}

/** Eine Zeile im Index — nicht der Artikel, nur was die Liste braucht. */
interface IndexZeile {
  id: string;
  name: string;
  /** Kleingeschrieben, für die Sortierung ohne `localeCompare` je Vergleich. */
  sortName: string;
  type: string;
  area: string;
  layers: string[];
  source: string;
  status: string;
  /** Name, Aliasse, Deckname, Nummer — klein, durch Zeilenumbrüche getrennt. */
  such: string;
  /** Wie viele Artikel über eine Abschnittskante hierher zeigen (`composedOf`). */
  users: number;
  /** Die Werte der Spalten, Verweise schon als Namen. */
  cols: Record<string, unknown>;
  /** Das Vorschaubild (T-114): die Asset-Id oder Adresse — nur, wenn `overview` ein Bild zeigt. */
  image?: string;
  /** Die Version der Bilddatei (T-211): mit ihr darf der Browser das Bild behalten. */
  imageVersion?: string;
  /** An einem Bild die Masse der Datei (T-201): Galerie und Liste zeigen sie, ohne den Artikel zu holen. */
  asset?: AssetMeta;
  tags: string[];
  /** Die Werte je Facette seiner Art (T-174): Wörter, Zahlen als Text, Ids. */
  fv: Record<string, string[]>;
  /** Seine Voraussetzung in prüfbarer Form (T-180), wenn seine Art eine nennt. */
  req?: Requirement;
  /** Die Kanten des Artikels (geteilt, nicht kopiert) — für `rel=`. */
  relations: NonNullable<Entity['relations']>;
  /** Die gesiebten Karten (geteilt, nicht kopiert): woraus eine gewählte
   *  Spalte liest (T-343) — nur, was der Betrachter sieht. */
  karten: NonNullable<Entity['components']>;
  /** Die ausgegebene Nummer (`npc-0042`) für die Spalte `@id`. */
  nummer: string;
  /** Die Gruppe seiner Fassungen (T-092), wenn er welche hat. */
  fassung?: string;
  /** Der Rang der obersten aufgeschalteten Ebene, die ihn bringt — die
   *  Fassung mit dem höchsten steht als Kopfzeile. */
  rang: number;
  /** Wann angelegt und zuletzt geschrieben (T-382), ISO — vom Server, nicht aus dem Artikel. */
  createdAt?: string;
  updatedAt?: string;
  /** Wer ihn hinzugefügt hat (T-382): die Konto-Id, wenn bekannt. */
  addedBy?: string;
}

/** **Herkunft der Zeilen** (T-382): Zeiten und Konto, neben dem Artikel gespeichert. */
export interface ListProvenance {
  /** Die Zeiten aus dem ungesiebten Bestand — ein sichtbarer Artikel verrät mit ihnen nichts. */
  times?: (id: string) => { createdAt?: string | undefined; updatedAt?: string | undefined } | undefined;
  /** Artikel-Id → Konto-Id. */
  creators?: ReadonlyMap<string, string>;
  /** Konto-Id → Name. */
  users?: ReadonlyMap<string, string>;
}

export interface ListIndex {
  rows: IndexZeile[];
  /** Id → Name, für alles, was dieser Betrachter sieht. */
  names: Map<string, string>;
  /** Je Art: Beschriftung, Bereich, `extends`-Kette und Spalten. */
  types: Map<string, { label: string; area: string; chain: string[]; columns: Spalte[]; bild: boolean; facets: FacetDef[] }>;
  /** Id → Art, für die Gruppen einer Artikelwahl (T-174). */
  typeOf: Map<string, string>;
  /** Die Gegenrichtung der Kanten über das Gesiebte — für `in.kante` als Spalte (T-343). */
  ein: Map<string, { type: string; from: string }[]>;
  registry: Registry;
  /** Konto-Id → Name, für „Added by" (T-382). */
  users: ReadonlyMap<string, string>;
}

/**
 * Den Index aus dem gesiebten Bestand bauen. `visible` ist schon durch
 * `sieve` gegangen: was hier liegt, darf dieser Betrachter sehen, mit den
 * Feldern, die er sehen darf, und dem Decknamen statt des Namens.
 */
export function buildListIndex(
  registry: Registry,
  visible: Entity[],
  /** Der Rang der obersten Spielebene je Artikel (`playStack().rank`). */
  rank: (e: Entity) => number = () => 0,
  /** **Die Ebenen, die genannt werden** (T-207, `shownLayers`): eine andere
   *  steht weder als Zeile noch als Name, Facette oder Ebene einer Zeile da.
   *  `null`: alle. */
  shown: ReadonlySet<string> | null = null,
  herkunft: ListProvenance = {},
): ListIndex {
  const genannt = (e: Entity) => !shown || !isLayer(e) || shown.has(e.id);
  visible = shown ? visible.filter(genannt) : visible;
  /* Fassungen derselben Sache (T-092): einmal über das Gesiebte. */
  const fassungen = versionGroups(visible);
  const names = new Map<string, string>();
  const typeOf = new Map<string, string>();
  /* **Kanten von drüben** (T-174): die Gegenrichtung ist eine Abfrage —
     einmal über das Gesiebte, also zählt nur, wessen Quelle man sieht. */
  const ein = new Map<string, { type: string; from: string }[]>();
  /* Die Namen, gegen die eine Voraussetzung gelesen wird (T-180): nur, was
     dieser Betrachter sieht. */
  const ctx = requirementContext(visible);
  for (const e of visible) {
    names.set(e.id, entityName(e));
    typeOf.set(e.id, primaryInterface(e));
    for (const r of e.relations ?? []) {
      if (!r.to || r.type === LAYER_RELATION) continue;
      (ein.get(r.to) ?? ein.set(r.to, []).get(r.to)!).push({ type: r.type, from: e.id });
    }
  }

  /* **Teile eines Statblocks** (W7): ein Merkmal, auf das genau ein Artikel
     über eine Abschnittskante zeigt, gehört zu diesem und steht nicht für
     sich in der Liste. Gezählt wird über das, was der Betrachter sieht —
     ein verborgener Statblock soll einen Teil nicht zum geteilten machen. */
  const abschnitt = new Set(
    Object.values(registry.relations ?? {})
      .filter((r) => r.section)
      .map((r) => r.type),
  );
  const nutzer = new Map<string, Set<string>>();
  if (abschnitt.size) {
    for (const e of visible) {
      for (const r of e.relations ?? []) {
        if (!abschnitt.has(r.type) || !r.to) continue;
        (nutzer.get(r.to) ?? nutzer.set(r.to, new Set()).get(r.to)!).add(e.id);
      }
    }
  }

  const types: ListIndex['types'] = new Map();
  const artVon = (typ: string) => {
    let t = types.get(typ);
    if (!t) {
      const columns = listColumns(registry, typ);
      t = {
        label: registry.interfaces[typ]?.label ?? typ,
        area: areaOf(registry, typ),
        chain: typeChain(registry, typ),
        columns,
        bild: zeigtBild(registry, typ),
        facets: facetsFor(registry, typ, columns.map((c) => c.ref)),
      };
      types.set(typ, t);
    }
    return t;
  };

  /* Für das Bild einer Zeile (T-211): das Asset hinter der Id, um seine
     Version zu nennen, und die Statblöcke einer Kreatur — beides aus dem
     Gesiebten, also nichts, was der Betrachter nicht sähe. */
  const byId = new Map(visible.map((e) => [e.id, e]));
  const statblocks = (id: string) =>
    (ein.get(id) ?? []).filter((k) => k.type === 'belongsTo').map((k) => byId.get(k.from)).filter((x): x is Entity => !!x);

  const rows: IndexZeile[] = [];
  for (const e of visible) {
    /* Eine Instanz steht in keiner Liste (D82): sie gehört ihrer Kreatur. */
    if (isInstance(e)) continue;
    /* Ein Teil eines Buchs auch nicht (T-108): er gehört seinem Kapitel. */
    if (isBookPart(e)) continue;
    const type = primaryInterface(e);
    const art = artVon(type);
    const name = entityName(e);
    const ident = (e.components?.['Identity'] ?? {}) as { aliases?: unknown; cover?: unknown };
    const aliases = Array.isArray(ident.aliases) ? ident.aliases.map(String) : [];
    const quelle = e.components?.['Source'] as { publication?: string; page?: string } | undefined;
    const cols: Record<string, unknown> = {};
    for (const c of art.columns) {
      const wert = (e.components?.[c.type] as Record<string, unknown> | undefined)?.[c.key];
      if (wert === undefined || wert === null || wert === '') continue;
      /* Ein Verweisfeld hält eine Id; gezeigt wird der Name — oder nichts,
         wenn der Betrachter das Ziel nicht sehen darf. */
      cols[c.ref] =
        c.prop.format === 'link'
          ? Array.isArray(wert)
            ? wert.map((w) => names.get(String(w))).filter(Boolean)
            : names.get(String(wert))
          : wert;
      if (cols[c.ref] === undefined) delete cols[c.ref];
    }
    rows.push({
      id: e.id,
      name,
      sortName: name.toLowerCase(),
      type,
      area: art.area,
      layers: (e.relations ?? [])
        .filter((r) => r.type === LAYER_RELATION && (!shown || shown.has(r.to)))
        .map((r) => r.to),
      source: [quelle?.publication, quelle?.page ? `p. ${quelle.page}` : ''].filter(Boolean).join(' '),
      status: String((e.components?.['Status'] as { status?: unknown } | undefined)?.status ?? ''),
      such: [name, ...aliases, typeof ident.cover === 'string' ? ident.cover : '', articleId(e), e.id]
        .filter(Boolean)
        .join('\n')
        .toLowerCase(),
      users: nutzer.get(e.id)?.size ?? 0,
      cols,
      ...(art.bild ? bildVon(registry, e, byId, statblocks) : {}),
      ...(art.chain.includes('Asset') ? { asset: assetMeta(e) } : {}),
      tags: tagsOf(e),
      ...facettenWerte(art.facets, e, names, ein, ctx),
      relations: e.relations ?? [],
      karten: e.components ?? {},
      nummer: articleId(e),
      ...(fassungen.has(e.id) ? { fassung: fassungen.get(e.id)! } : {}),
      rang: rank(e),
      ...zeitenVon(e, herkunft),
    });
  }
  rows.sort((a, b) => (a.sortName < b.sortName ? -1 : a.sortName > b.sortName ? 1 : a.id < b.id ? -1 : 1));
  return { rows, names, types, typeOf, ein, registry, users: herkunft.users ?? new Map() };
}

/** Zeiten und Konto einer Zeile (T-382) — leere fallen weg. */
function zeitenVon(e: Entity, h: ListProvenance): Pick<IndexZeile, 'createdAt' | 'updatedAt' | 'addedBy'> {
  const t = h.times?.(e.id) ?? { createdAt: e.createdAt, updatedAt: e.updatedAt };
  const von = h.creators?.get(e.id);
  return {
    ...(t.createdAt ? { createdAt: t.createdAt } : {}),
    ...(t.updatedAt ? { updatedAt: t.updatedAt } : {}),
    ...(von ? { addedBy: von } : {}),
  };
}

/** „Added by" ohne bekanntes Konto. */
export const UNKNOWN_CREATOR = '∅';

/**
 * Die Werte eines Artikels je Facette (T-174). Eine Kante zählt nur, wenn
 * ihr anderes Ende sichtbar ist (`names`) und die Art hat, die die Facette
 * nennt — „granted by" am Zauber meint Klassen und Abstammungen, nicht
 * jeden Artikel, der eine Kante `grants` trägt.
 */
function facettenWerte(
  facets: FacetDef[],
  e: Entity,
  names: Map<string, string>,
  ein: Map<string, { type: string; from: string }[]>,
  ctx: RequirementContext,
): { fv: Record<string, string[]>; req?: Requirement } {
  const raus: Record<string, string[]> = {};
  const reqs: Requirement[] = [];
  for (const f of facets) {
    let w: string[];
    if (f.kind === 'requirement' && f.field) {
      /* Eine Voraussetzung (T-180): der Satz zerlegt; jedes Feld gilt. */
      const text = (e.components?.[f.field.type] as Record<string, unknown> | undefined)?.[f.field.key];
      const r = parseRequirement(typeof text === 'string' ? text : '', ctx);
      reqs.push(r);
      w = requirementKeys(r);
    } else if (f.relation?.dir === 'out') {
      w = (e.relations ?? []).filter((r) => r.type === f.relation!.type && names.has(r.to)).map((r) => r.to);
    } else if (f.relation?.dir === 'in') {
      w = (ein.get(e.id) ?? []).filter((r) => r.type === f.relation!.type).map((r) => r.from);
    } else {
      w = facetFieldValues(f, e);
    }
    if (w.length) raus[f.ref] = [...new Set(w)];
  }
  /* **Die Zauberliste** (T-212): ein Zauber auf der Liste einer Klasse
     oder Unterklasse, die dieser Betrachter sieht, mit seinem Grad — so
     prüft „usable by", ob die Figur ihn dort wirken kann. */
  const listen = (ein.get(e.id) ?? []).filter((r) => r.type === 'spellList').map((r) => r.from);
  const grad = (e.components?.['Spell'] as { level?: unknown } | undefined)?.level;
  if (listen.length && typeof grad === 'number') reqs.push(spellListRequirement(listen, grad));
  return reqs.length ? { fv: raus, req: allOf(reqs) } : { fv: raus };
}

/**
 * Was der Index von einem Artikel liest: `Identity` (Name, Aliasse,
 * Deckname, Nummer), `Source`, `Status`, die Karten der Spalten — und die
 * Kanten (Ebenen, Abschnitte). Das Sieb kürzt vorher darauf (`sieve`,
 * `schmal`): das Wissen gilt je Feld, also ändert das Kürzen an keinem
 * übrigen Feld etwas, und ein Spieler-Index braucht so die Hälfte.
 */
export function listProjection(registry: Registry): (e: Entity) => Entity {
  const je = new Map<string, string[]>();
  return (e) => {
    const typ = primaryInterface(e);
    let karten = je.get(typ);
    if (!karten) {
      const spalten = listColumns(registry, typ);
      /* Dazu die Karten der Facetten (T-174): gefiltert wird am Server. */
      const facetten = facetsFor(registry, typ, spalten.map((c) => c.ref)).flatMap((f) => (f.field ? [f.field.type] : []));
      karten = [...new Set(['Identity', 'Source', 'Status', 'Tags', ...(zeigtBild(registry, typ) ? ['Image', 'Asset'] : []), ...spalten.map((c) => c.type), ...facetten])];
      je.set(typ, karten);
    }
    const components: Entity['components'] = {};
    for (const k of karten) {
      const karte = e.components?.[k];
      if (karte) components[k] = karte;
    }
    /* **Die übrigen Karten der Art** für die Spaltenwahl (T-343): ohne
       Prosa — eine Spalte zeigt keinen langen Text (`columnField`), und
       der Index bliebe sonst so gross wie der Bestand. */
    for (const [k, karte] of Object.entries(e.components ?? {})) {
      if (components[k] || !karte) continue;
      const felder = registry.interfaces[k]?.schema?.properties;
      if (!felder) continue;
      const schmal: Record<string, unknown> = {};
      for (const [f, v] of Object.entries(karte as Record<string, unknown>)) {
        if (felder[f] && columnField(felder[f]!)) schmal[f] = v;
        /* „Hat ein Feld" (T-389, `@has`) fragt nur, ob etwas dasteht —
           die Rasterform eines Gegenstands ist keine Spalte. Ein Platzhalter
           statt des Werts; gesiebt wird danach je Feld wie sonst. Felder mit
           `many` nicht: deren Einträge siebt das Wissen einzeln. */
        else if (felder[f] && !felder[f]!.many && !felder[f]!.derived && hasValue(v)) schmal[f] = true;
      }
      if (Object.keys(schmal).length) components[k] = schmal as typeof karte;
    }
    return { ...e, components };
  };
}

/** Zeigt `overview` dieser Art ein Bild (Element `image`, T-114)? Das Register sagt es, nicht der Code. */
function zeigtBild(registry: Registry, typ: string): boolean {
  const flach = (l: LayoutElement[]): LayoutElement[] => l.flatMap((el) => (el.el === 'tabs' ? (el.tabs ?? []).flatMap((t) => flach(t.layout)) : [el]));
  return flach(layoutFor(registry, 'overview', typ).layout).some((el) => el.el === 'image');
}

/**
 * **Das Vorschaubild einer Zeile** (T-114): `articleImage` — das Asset
 * selbst, `Image.image`, an einer Kreatur ohne eigenes das ihres
 * Statblocks (T-211). Ein Asset, das der Betrachter nicht sieht (es steht
 * nicht im Gesiebten), bleibt weg — die Zeile zeigte sonst ein Bild, das
 * der Server dann verweigert. **Mit Version** (`imageVersion`): sonst darf
 * der Browser das Vorschaubild nicht behalten und fragt bei jeder Liste
 * neu — bei fünfzig Zeilen fünfzig Rundreisen.
 */
function bildVon(
  registry: Registry,
  e: Entity,
  byId: ReadonlyMap<string, Entity>,
  statblocks: (id: string) => Entity[],
): { image?: string; imageVersion?: string } {
  const b = articleImage(registry, e, byId, statblocks);
  if (!b) return {};
  if (/^https?:\/\//i.test(b.id)) return { image: b.id };
  if (!byId.has(b.id)) return {};
  const v = assetVersion(byId.get(b.id));
  return { image: b.id, ...(v ? { imageVersion: v } : {}) };
}

// ------------------------------------------------------------------ Abfrage

export interface FieldFilter {
  values?: string[];
  min?: number;
  max?: number;
}

export interface ListQuery {
  area?: string | undefined;
  /** Genau diese Arten. */
  type?: string[] | undefined;
  /** Diese Arten oder ein Untertyp davon (`extends`-Kette) — für Auswahlen. */
  of?: string[] | undefined;
  /** Ohne diese Arten und ihre Untertypen (T-137): „World ohne Items". */
  notype?: string[] | undefined;
  /** Nur Artikel in diesem Vorbereitungsstand (T-137); ohne Status-Karte
   *  zählt ein Artikel als `ready` (D72). */
  status?: string[] | undefined;
  q?: string | undefined;
  /** Nur diese Ebenen (`NO_LAYER` für „keine"); leer heisst alle. */
  layer?: string[] | undefined;
  /** Ohne diese Ebenen: ein Artikel fällt weg, wenn **alle** seine Ebenen
   *  abgewählt sind — so arbeitet die Seitenleiste (ein Häkchen weg nimmt
   *  eine Ebene heraus). */
  nolayer?: string[] | undefined;
  /** Teile von Statblöcken einblenden. */
  parts?: boolean | undefined;
  /** Fassungen derselben Sache als eine Zeile (T-092): die aus der
   *  obersten Spielebene oben, die anderen unter `versions`. */
  versions?: boolean | undefined;
  /** Nur diese Artikel (Peg-Ids) — für eine Seite, die Namen und Arten zu
   *  Ids braucht, die sie schon kennt. Teile stehen dann mit da. */
  ids?: string[] | undefined;
  /** **Genau diese Namen** (T-398), klein: Name, Alias, Deckname oder
   *  Nummer, ganz und nicht als Teilwort. Eine Frage für viele Namen statt
   *  einer Suche je Name — der Statblock fragte so je Übung einzeln. */
  name?: string[] | undefined;
  /** Diese Kantenarten gehen je Zeile mit (`rels`): wohin ein Board oder
   *  eine Sitzung gehört (`partOf`), ohne den Artikel ganz zu holen. */
  rel?: string[] | undefined;
  /** Nur Artikel mit **allen** diesen Marken (T-119): jede Marke engt ein. */
  tag?: string[] | undefined;
  /** Diese Artikel nicht — am Server gesetzt, nie aus der Adresse (die Galerie: „unbenutzt"). */
  exclude?: ReadonlySet<string> | undefined;
  /** `name` (Vorgabe), `type`, `created`, `updated` oder eine Spalte `Typ.feld`; `-` davor kehrt um. */
  sort?: string | undefined;
  /** **Kürzlich hinzugefügt / geändert** (T-382): das Fenster aus `added=`/`changed=` (`parseTimeWindow`). */
  added?: TimeWindow | undefined;
  changed?: TimeWindow | undefined;
  /** **Hinzugefügt von** (T-382): diese Konten; `UNKNOWN_CREATOR` für „nicht bekannt". */
  by?: string[] | undefined;
  /** **Nach Beziehungen** (T-389): Bedingungen aus `f=@has:…`, alle zusammen (`parseHasTerm`). */
  has?: HasTerm[] | undefined;
  /** **Nach Nähe ordnen** (T-138): mit `q` zuerst der genaue Name, dann
   *  der Anfang, ein Wortanfang, ein Alias oder Deckname, zuletzt „enthält".
   *  Innerhalb einer Stufe nach Namen. Gilt nur ohne `sort`. */
  rank?: boolean | undefined;
  offset: number;
  limit: number;
  /** `Typ.feld` → Werte oder Spanne. */
  fields: Record<string, FieldFilter>;
  /** **Nur, was diese Figur erfüllt** (T-180): am Server aus `usable=<id>`
   *  gerechnet, mit dem, was der Betrachter an ihr sieht. Unbekanntes
   *  bleibt in der Liste und ist markiert. */
  usable?: CharacterProfile | undefined;
  /** **Gewählte Spalten** (T-343, `cols=`): statt der Felder der
   *  `overview` genau diese — `Typ.feld`, `out.kante`, `in.kante`,
   *  `@angabe`. Ohne: wie immer. */
  columns?: string[] | undefined;
}

export interface ListColumn {
  ref: string;
  label: string;
  kind: 'number' | 'bool' | 'list' | 'text';
}

/** Ein Wert einer Facette: das Wort, die Zahl der Treffer — und für einen
 *  Verweis oder eine Kante der Name des Artikels und seine Art (T-174). */
export interface FacetOption {
  value: string;
  count: number;
  label?: string;
  group?: string;
}

export type FieldFacet =
  | {
      ref: string;
      label: string;
      kind: 'enum';
      /** `bool` ja/nein, `link` eine Artikelwahl — gezeichnet wie Häkchen;
       *  `requirement` eine Voraussetzung (T-180): daneben steht „usable by". */
      of?: 'bool' | 'link' | 'requirement';
      options: FacetOption[];
      /** Wie viele Werte über die gezeigten hinaus Treffer haben. */
      more?: number;
    }
  | { ref: string; label: string; kind: 'range'; min: number; max: number };

/** So viele Artikel stehen in einer Artikelwahl; der Rest zählt nur. */
const WAHL = 40;

export interface ListResult {
  total: number;
  offset: number;
  limit: number;
  columns: ListColumn[];
  rows: {
    id: string;
    name: string;
    type: string;
    layers: string[];
    source: string;
    status: string;
    users?: number;
    cols: Record<string, unknown>;
    /** Das Vorschaubild (T-114). */
    image?: string;
    /** Die Version der Bilddatei (T-211): mit ihr darf der Browser das Bild behalten. */
    imageVersion?: string;
    /** An einem Bild die Masse der Datei (T-201). */
    asset?: AssetMeta;
    tags?: string[];
    rels?: Record<string, string[]>;
    /** Die übrigen Fassungen dieser Sache (T-092, mit `versions=1`). */
    versions?: { id: string; name: string; layers: string[]; source: string }[];
    /** Mit `usable`: die Voraussetzung lässt sich nicht prüfen (T-180). */
    usable?: 'unknown';
    /** Wann und von wem (T-382). */
    createdAt?: string;
    updatedAt?: string;
    addedBy?: string;
  }[];
  facets: {
    types: { type: string; label: string; area: string; count: number }[];
    layers: { id: string; name: string; count: number }[];
    fields: FieldFacet[];
    /** Die Marken der Treffer, je Marke gezählt (T-119) — die gewählten stehen mit da. */
    tags: { tag: string; count: number }[];
    /** Wie viele Teile von Statblöcken gerade ausgeblendet sind. */
    partsHidden: number;
    /** **Hinzugefügt von** (T-382): je Konto gezählt, über die Treffer aller übrigen Filter. */
    addedBy: { id: string; name: string; count: number }[];
    /** **Beziehungen und Felder** (T-389): wonach `@has` fragen kann, je
     *  Wahl die Treffer, die sie haben; dazu je gewählter Kante die anderen
     *  Enden mit Zahl, für „zu diesem Artikel". Nur Sichtbares zählt. */
    has: {
      choices: { ref: string; label: string; kind: 'edge' | 'field'; count: number }[];
      targets: Record<string, { id: string; name: string; count: number }[]>;
    };
    /** Mit `usable` (T-180): für wen, wie viele die Figur nicht erfüllt
     *  und wie viele unbekannt in der Liste bleiben. */
    usable?: { id: string; name: string; hidden: number; unknown: number };
  };
}

/** Eine Zahl, auch aus „1/4" — so steht der Herausforderungsgrad da. */
export const asNumber = facetNumber;

function werteVon(v: unknown): string[] {
  if (v === undefined || v === null || v === '') return [];
  return Array.isArray(v) ? v.map(String) : [String(v)];
}

/** UND zwischen Facetten, ODER innerhalb: ein Wert genügt (T-174). */
function trifft(z: IndexZeile, ref: string, f: FieldFilter): boolean {
  const w = z.fv[ref] ?? werteVon(z.cols[ref]);
  if (f.values?.length) {
    if (!w.some((x) => f.values!.includes(x))) return false;
  }
  if (f.min !== undefined || f.max !== undefined) {
    const n = w.length ? asNumber(w[0]) : NaN;
    if (Number.isNaN(n)) return false;
    if (f.min !== undefined && n < f.min) return false;
    if (f.max !== undefined && n > f.max) return false;
  }
  return true;
}

/**
 * **Wie nah ein Treffer liegt** (T-138): 0 der Name genau, 1 sein Anfang,
 * 2 ein Wortanfang im Namen, 3 ein Alias, der Deckname oder die Nummer
 * genau oder am Anfang, 4 irgendwo enthalten. Gerechnet über die Zeile
 * des Index — der Name ist dort schon der, den dieser Betrachter sieht
 * (Deckname statt Name, wenn das Sieb es so will).
 */
export function naehe(name: string, such: string, q: string): number {
  if (name === q) return 0;
  if (name.startsWith(q)) return 1;
  if (name.includes(` ${q}`) || name.includes(`-${q}`) || name.includes(`(${q}`)) return 2;
  for (const teil of such.split('\n')) if (teil.startsWith(q)) return 3;
  return 4;
}

/**
 * Die Treffer nach Nähe in Eimern — **ein Gang, keine Sortierung**: der
 * Index liegt schon nach Namen, und die Eimer behalten die Reihenfolge.
 * Ein Buchstabe trifft bei einer Viertelmillion Artikeln die Hälfte; ein
 * Vergleich je Paar wäre dort das, was beim Tippen wartet.
 */
function nachNaehe<T extends { sortName: string; such: string }>(treffer: T[], q: string): T[] {
  const eimer: T[][] = [[], [], [], [], []];
  for (const z of treffer) eimer[naehe(z.sortName, z.such, q)]!.push(z);
  return eimer.flat();
}

function spaltenArt(prop: PropertySchema): ListColumn['kind'] {
  if (prop.type === 'array') return 'list';
  if (prop.type === 'boolean') return 'bool';
  if (prop.type === 'number' || prop.type === 'integer') return 'number';
  return 'text';
}

/**
 * Ein Blatt der Liste samt Facetten.
 *
 * Jede Facette zählt über die Zeilen, die **alle anderen** Filter
 * bestehen: die Arten ohne die gewählte Art, die Ebenen ohne die gewählten
 * Ebenen, ein Feld ohne seinen eigenen Filter. Sonst verschwände mit dem
 * ersten Häkchen jede andere Wahl aus der Leiste.
 */
export function queryList(idx: ListIndex, q: ListQuery): ListResult {
  const such = q.q?.trim().toLowerCase() ?? '';
  const ofSet = q.of?.length ? new Set(q.of) : null;
  const ohneTypen = q.notype?.length ? new Set(q.notype) : null;
  const staende = q.status?.length ? new Set(q.status) : null;
  const typSet = q.type?.length ? new Set(q.type) : null;
  const ebenen = q.layer?.length ? new Set(q.layer) : null;
  const ohneEbenen = q.nolayer?.length ? new Set(q.nolayer) : null;
  const nurIds = q.ids?.length ? new Set(q.ids) : null;
  const nurNamen = q.name?.length ? new Set(q.name) : null;
  const marken = q.tag?.length ? q.tag : null;
  const autoren = q.by?.length ? new Set(q.by) : null;
  const autorVon = (z: IndexZeile) => z.addedBy ?? UNKNOWN_CREATOR;
  const autorOk = (z: IndexZeile) => !autoren || autoren.has(autorVon(z));
  const einTyp = q.type?.length === 1 ? q.type[0]! : undefined;
  const spalten = einTyp ? (idx.types.get(einTyp)?.columns ?? listColumns(idx.registry, einTyp)) : [];
  /* Gewählt (T-343): dann genau diese, in dieser Reihenfolge. */
  const gewaehlt = q.columns ? spaltenWahl(idx, q.columns, einTyp) : null;
  const zellen = new Map<IndexZeile, Record<string, unknown>>();
  const zellenVon = (z: IndexZeile): Record<string, unknown> => {
    let c = zellen.get(z);
    if (!c) zellen.set(z, (c = gewaehlteZellen(idx, z, gewaehlt!)));
    return c;
  };
  /* **Die Facetten** (T-174): die gewählten Arten, sonst die eine Art, die
     eine Filtergruppe eingrenzt (`of`) — und davon, was alle haben. */
  const facettenTypen = q.type?.length ? q.type : q.of?.length === 1 ? q.of : [];
  const facetten = facettenDerArten(idx, facettenTypen);
  const filter = Object.entries(q.fields).filter(([ref]) => facetten.some((f) => f.ref === ref));
  const mitFeldern = filter.length > 0 || facetten.length > 0;

  /* **Beziehungen** (T-389): eine Kante zählt nur mit sichtbarem anderem
     Ende — `names` und `ein` stehen über dem Gesiebten. Ein Feld nur, wenn
     nach ihm gefragt werden darf (`hasFieldAllowed`): sonst gilt die
     Bedingung nicht, wie jeder Unsinn in der Adresse. */
  const hat = (q.has ?? []).filter((t) => {
    if (isHasEdge(t.ref)) return true;
    const [typ, feld] = t.ref.split('.');
    return hasFieldAllowed(idx.registry, typ!, feld!);
  });
  /* Ein Ziel (`=id`) erst danach: so zählen die anderen Ziele derselben
     Kante weiter, und man kann eins gegen das andere tauschen. */
  const hatGrund = hat.filter((t) => t.to === undefined);
  const hatZiel = hat.filter((t) => t.to !== undefined);
  const fakten = new Map<IndexZeile, HasFacts>();
  const faktenVon = (z: IndexZeile): HasFacts => {
    let f = fakten.get(z);
    if (!f) fakten.set(z, (f = hasFakten(idx, z)));
    return f;
  };
  const zielOk = (z: IndexZeile, ausser?: string): boolean =>
    hatZiel.every((t) => t.ref === ausser || matchesHas(t, faktenVon(z)));

  const inEbene = (z: IndexZeile): boolean => {
    const ls = z.layers.length ? z.layers : [NO_LAYER];
    if (ebenen && !ls.some((l) => ebenen.has(l))) return false;
    return !ohneEbenen || !ls.every((l) => ohneEbenen.has(l));
  };

  /* Was für jede Facette gilt: Bereich, Auswahl-Arten, Suche — und die
     Figur, für die gesucht wird (T-180). */
  const grund: IndexZeile[] = [];
  let nichtErfuellt = 0;
  const unbekannt = new Set<string>();
  for (const z of idx.rows) {
    if (nurIds && !nurIds.has(z.id)) continue;
    if (q.area && z.area !== q.area) continue;
    if (ofSet && !idx.types.get(z.type)?.chain.some((t) => ofSet.has(t))) continue;
    if (ohneTypen && idx.types.get(z.type)?.chain.some((t) => ohneTypen.has(t))) continue;
    if (staende && !staende.has(z.status || 'ready')) continue;
    if (such && !z.such.includes(such)) continue;
    if (nurNamen && !z.such.split('\n').some((t) => nurNamen.has(t))) continue;
    if (marken && !marken.every((t) => z.tags.includes(t))) continue;
    if (hatGrund.length && !hatGrund.every((t) => matchesHas(t, faktenVon(z)))) continue;
    if (q.added && !inTimeWindow(z.createdAt, q.added)) continue;
    if (q.changed && !inTimeWindow(z.updatedAt, q.changed)) continue;
    if (q.exclude?.has(z.id)) continue;
    if (q.usable && z.req) {
      const v = meetsRequirement(z.req, q.usable);
      if (v === 'no') {
        if (!typSet || typSet.has(z.type)) nichtErfuellt += 1;
        continue;
      }
      if (v === 'unknown') unbekannt.add(z.id);
    }
    grund.push(z);
  }

  const istTeil = (z: IndexZeile): boolean => z.users === 1;
  const teilOk = (z: IndexZeile): boolean => q.parts === true || !!nurIds || !istTeil(z);
  const felderOk = (z: IndexZeile, ausser?: string): boolean =>
    filter.every(([ref, f]) => ref === ausser || trifft(z, ref, f));

  const typZahl = new Map<string, number>();
  const ebenenZahl = new Map<string, number>();
  const autorZahl = new Map<string, number>();
  const treffer: IndexZeile[] = [];
  const getypt: IndexZeile[] = [];
  let partsHidden = 0;
  const zielRefs = [...new Set(hat.filter((t) => isHasEdge(t.ref)).map((t) => t.ref))];
  const zielZahl = new Map<string, Map<string, number>>(zielRefs.map((r) => [r, new Map()]));
  const zieleZaehlen = (z: IndexZeile): void => {
    for (const ref of zielRefs) {
      if (!zielOk(z, ref)) continue;
      const [dir, typ] = ref.split('.') as ['out' | 'in', string];
      const m = zielZahl.get(ref)!;
      for (const id of new Set(faktenVon(z).edges(dir, typ))) m.set(id, (m.get(id) ?? 0) + 1);
    }
  };
  for (const z of grund) {
    const ebeneOk = inEbene(z);
    const typOk = !typSet || typSet.has(z.type);
    const felder = !mitFeldern || felderOk(z);
    if (ebeneOk && felder && typOk && istTeil(z) && !teilOk(z)) partsHidden += 1;
    if (!teilOk(z)) continue;
    /* „Added by" zählt ohne seinen eigenen Filter (T-382), wie jede Facette. */
    if (typOk && ebeneOk && felder) autorZahl.set(autorVon(z), (autorZahl.get(autorVon(z)) ?? 0) + 1);
    if (!autorOk(z)) continue;
    /* Die Arten zählen ohne die Art und ohne die Feldfilter: die gelten
       nur für die gewählte. */
    if (ebeneOk) typZahl.set(z.type, (typZahl.get(z.type) ?? 0) + 1);
    if (typOk && felder) {
      const ls = z.layers.length ? z.layers : [NO_LAYER];
      for (const l of ls) ebenenZahl.set(l, (ebenenZahl.get(l) ?? 0) + 1);
    }
    /* Die Ziele einer gewählten Kante (T-389) zählen ohne ihr eigenes `=id`. */
    if (typOk && ebeneOk && felder) zieleZaehlen(z);
    if (!zielOk(z)) continue;
    if (typOk && ebeneOk) getypt.push(z);
    if (typOk && ebeneOk && felder) treffer.push(z);
  }

  const has = hasFacette(idx, facettenTypen, treffer, hat, zielZahl, faktenVon);

  // Facetten — nur bei gewählten Arten.
  const fields: FieldFacet[] = [];
  for (const def of facetten) {
    const f = facetteZaehlen(idx, def, getypt.filter((z) => felderOk(z, def.ref)), q.fields[def.ref]);
    if (f) fields.push(f);
  }

  // Sortieren — der Index liegt schon nach Namen.
  let liste = treffer;
  const sort = q.sort ?? 'name';
  const ab = sort.startsWith('-');
  const nach = ab ? sort.slice(1) : sort;
  if (q.rank && such && !q.sort) {
    liste = nachNaehe(treffer, such);
  } else if (nach !== 'name' || ab) {
    const wert = (z: IndexZeile): unknown =>
      nach === 'name'
        ? z.sortName
        : nach === 'type' || nach === '@type'
          ? (idx.types.get(z.type)?.label ?? z.type)
          : nach === 'created' || nach === '@created'
            ? z.createdAt
            : nach === 'updated' || nach === '@updated'
              ? z.updatedAt
              : nach === '@addedBy'
                ? (z.addedBy ? idx.users.get(z.addedBy) : undefined)
                : gewaehlt
            ? leerWeg(zellenVon(z)[nach] ?? (nach === '@source' ? z.source || undefined : undefined))
            : z.cols[nach];
    liste = [...treffer].sort((a, b) => {
      const va = wert(a);
      const vb = wert(b);
      /* Leere Zellen stehen immer hinten, in beide Richtungen. */
      if (va === undefined && vb === undefined) return 0;
      if (va === undefined) return 1;
      if (vb === undefined) return -1;
      const na = asNumber(va);
      const nb = asNumber(vb);
      /* Zahlen vor Text, in beide Richtungen: „Unknown" steht hinter jedem
         Grad, wie eine leere Zelle. */
      if (Number.isNaN(na) !== Number.isNaN(nb)) return Number.isNaN(na) ? 1 : -1;
      const r = !Number.isNaN(na)
        ? na - nb
        : werteVon(va).join(', ').localeCompare(werteVon(vb).join(', '), 'en');
      return (ab ? -r : r) || (a.sortName < b.sortName ? -1 : 1);
    });
  }

  /* **Fassungen als eine Zeile** (T-092, E-021 d): je Gruppe bleibt die
     Fassung aus der obersten Spielebene stehen, an der Stelle, an der sie
     in der Sortierung steht; die übrigen hängen an ihr. Gruppiert wird
     über die Treffer — wer nach „(VGM)" sucht, findet die Fassung als
     eigene Zeile, wenn die geltende nicht trifft. */
  const unter = new Map<string, IndexZeile[]>();
  if (q.versions) {
    const kopf = new Map<string, IndexZeile>();
    for (const z of liste) {
      if (!z.fassung) continue;
      const k = kopf.get(z.fassung);
      if (!k || z.rang > k.rang) kopf.set(z.fassung, z);
    }
    const gruppiert: IndexZeile[] = [];
    for (const z of liste) {
      if (!z.fassung) {
        gruppiert.push(z);
        continue;
      }
      const k = kopf.get(z.fassung)!;
      if (k === z) gruppiert.push(z);
      else (unter.get(k.id) ?? unter.set(k.id, []).get(k.id)!).push(z);
    }
    liste = gruppiert;
  }

  const offset = Math.max(0, Math.min(q.offset, Math.max(0, liste.length - 1)));
  const blatt = liste.slice(offset, offset + q.limit);

  const typen = [...typZahl.entries()].map(([type, count]) => ({
    type,
    label: idx.types.get(type)?.label ?? type,
    area: idx.types.get(type)?.area ?? '',
    count,
  }));
  for (const t of q.type ?? []) {
    if (!typZahl.has(t) && idx.registry.interfaces[t]) {
      typen.push({ type: t, label: idx.registry.interfaces[t]?.label ?? t, area: areaOf(idx.registry, t), count: 0 });
    }
  }
  typen.sort((a, b) => a.label.localeCompare(b.label, 'en'));

  const markenZahl = new Map<string, number>();
  for (const z of treffer) for (const t of z.tags) markenZahl.set(t, (markenZahl.get(t) ?? 0) + 1);
  for (const t of marken ?? []) if (!markenZahl.has(t)) markenZahl.set(t, 0);
  const tags = [...markenZahl.entries()]
    .map(([tag, count]) => ({ tag, count }))
    .sort((a, b) => b.count - a.count || a.tag.localeCompare(b.tag, 'en'));

  return {
    total: liste.length,
    offset,
    limit: q.limit,
    columns: gewaehlt
      ? gewaehlt.map(({ ref, label, kind }) => ({ ref, label, kind }))
      : spalten.map((c) => ({
          ref: c.ref,
          label: fieldTitle(idx.registry, einTyp, c),
          kind: spaltenArt(c.prop),
        })),
    rows: blatt.map((z) => ({
      id: z.id,
      name: z.name,
      type: z.type,
      layers: z.layers.map((l) => idx.names.get(l) ?? l),
      source: z.source,
      status: z.status,
      ...(z.users ? { users: z.users } : {}),
      cols: gewaehlt ? zellenVon(z) : z.cols,
      ...(z.image ? { image: z.image } : {}),
      ...(z.imageVersion ? { imageVersion: z.imageVersion } : {}),
      ...(z.asset ? { asset: z.asset } : {}),
      ...(z.tags.length ? { tags: z.tags } : {}),
      ...(unbekannt.has(z.id) ? { usable: 'unknown' as const } : {}),
      ...(z.createdAt ? { createdAt: z.createdAt } : {}),
      ...(z.updatedAt ? { updatedAt: z.updatedAt } : {}),
      ...(z.addedBy && idx.users.has(z.addedBy) ? { addedBy: idx.users.get(z.addedBy)! } : {}),
      ...(unter.has(z.id)
        ? {
            versions: unter.get(z.id)!.map((v) => ({
              id: v.id,
              name: v.name,
              layers: v.layers.map((l) => idx.names.get(l) ?? l),
              source: v.source,
            })),
          }
        : {}),
      ...(q.rel?.length
        ? {
            rels: Object.fromEntries(
              q.rel.map((t) => [t, z.relations.filter((r) => r.type === t).map((r) => r.to)]),
            ),
          }
        : {}),
    })),
    facets: {
      types: typen,
      layers: [...ebenenZahl.entries()]
        .map(([id, count]) => ({ id, count, name: id === NO_LAYER ? 'No layer' : (idx.names.get(id) ?? id) }))
        .sort((a, b) => a.name.localeCompare(b.name, 'en')),
      fields,
      tags,
      partsHidden,
      addedBy: [...new Set([...autorZahl.keys(), ...(q.by ?? [])])]
        .map((id) => ({
          id,
          name: id === UNKNOWN_CREATOR ? 'Unknown' : (idx.users.get(id) ?? 'Unknown'),
          count: autorZahl.get(id) ?? 0,
        }))
        .sort((a, b) => (a.id === UNKNOWN_CREATOR ? 1 : b.id === UNKNOWN_CREATOR ? -1 : b.count - a.count || a.name.localeCompare(b.name, 'en'))),
      has,
      ...(q.usable
        ? { usable: { id: q.usable.id, name: q.usable.name, hidden: nichtErfuellt, unknown: treffer.filter((z) => unbekannt.has(z.id)).length } }
        : {}),
    },
  };
}

interface GewaehlteSpalte extends ListColumn {
  /** Ein Feld: wem es gehört und wie es aussieht. */
  feld?: { type: string; key: string; prop: PropertySchema };
  /** Eine Kante: welche, in welcher Richtung. */
  kante?: { type: string; dir: 'out' | 'in' };
}

/**
 * **Die gewählten Spalten** (T-343), aufgelöst gegen das Register. Was es
 * nicht kennt, fällt weg — eine Wahl ist ein Name, und ein Feld, das es
 * nicht mehr gibt, ist keine Spalte.
 */
function spaltenWahl(idx: ListIndex, refs: readonly string[], einTyp: string | undefined): GewaehlteSpalte[] {
  const raus: GewaehlteSpalte[] = [];
  for (const ref of refs) {
    const basis = BASE_COLUMNS.find((b) => b.ref === ref);
    if (basis) {
      raus.push({ ref, label: basis.label, kind: ref === '@layers' || ref === '@tags' ? 'list' : 'text' });
      continue;
    }
    const punkt = ref.indexOf('.');
    const [vorn, hinten] = [ref.slice(0, punkt), ref.slice(punkt + 1)];
    if (vorn === 'out' || vorn === 'in') {
      const def = idx.registry.relations?.[hinten];
      if (!def) continue;
      raus.push({
        ref,
        label: (vorn === 'out' ? def.label : def.inverseLabel || def.label) || hinten,
        kind: 'list',
        kante: { type: hinten, dir: vorn },
      });
      continue;
    }
    const prop = idx.registry.interfaces[vorn]?.schema?.properties?.[hinten];
    if (!prop || !columnField(prop)) continue;
    raus.push({
      ref,
      label: fieldTitle(idx.registry, einTyp, { type: vorn, key: hinten, prop }),
      kind: columnKind(prop),
      feld: { type: vorn, key: hinten, prop },
    });
  }
  return raus;
}

/**
 * Die Werte der gewählten Spalten einer Zeile — aus ihren gesiebten
 * Karten und Kanten. Ein Verweis steht als Name, und nur, wenn der
 * Betrachter das Ziel sieht; eine Rechnung nur, wenn alles, was sie liest,
 * dasteht (`derivedInputs`): eine 0 für ein zurückgehaltenes Feld wäre
 * falsch und verriete, dass dort etwas fehlt.
 */
function gewaehlteZellen(idx: ListIndex, z: IndexZeile, spalten: readonly GewaehlteSpalte[]): Record<string, unknown> {
  const raus: Record<string, unknown> = {};
  const kette = idx.types.get(z.type)?.chain ?? [];
  for (const s of spalten) {
    let wert: unknown;
    if (s.ref === '@type') wert = idx.types.get(z.type)?.label ?? z.type;
    else if (s.ref === '@layers') wert = z.layers.map((l) => idx.names.get(l) ?? l);
    else if (s.ref === '@tags') wert = z.tags;
    else if (s.ref === '@status') wert = z.status || undefined;
    else if (s.ref === '@id') wert = z.nummer || undefined;
    /* Wann und von wem (T-382): der Tag reicht in einer Zeile; sortiert wird nach der vollen Zeit. */
    else if (s.ref === '@created') wert = z.createdAt?.slice(0, 10);
    else if (s.ref === '@updated') wert = z.updatedAt?.slice(0, 10);
    else if (s.ref === '@addedBy') wert = z.addedBy ? idx.users.get(z.addedBy) : undefined;
    else if (s.kante) {
      const ids =
        s.kante.dir === 'out'
          ? z.relations.filter((r) => r.type === s.kante!.type).map((r) => r.to)
          : (idx.ein.get(z.id) ?? []).filter((r) => r.type === s.kante!.type).map((r) => r.from);
      wert = [...new Set(ids.map((id) => idx.names.get(id)).filter((n): n is string => !!n))];
    } else if (s.feld && kette.includes(s.feld.type)) {
      const karte = z.karten[s.feld.type] as Record<string, unknown> | undefined;
      if (s.feld.prop.derived) {
        const da = (k: string) =>
          (karte && karte[k] !== undefined) || Object.values(z.karten).some((c) => (c as Record<string, unknown>)?.[k] !== undefined);
        if (derivedInputs(String(s.feld.prop.derived)).every(da)) {
          wert = derivedValue(s.feld.prop, karte ?? {}, z.karten as Record<string, Record<string, unknown>>, z.relations);
        }
      } else {
        wert = karte?.[s.feld.key];
        if (s.feld.prop.format === 'link' && wert !== undefined) {
          wert = Array.isArray(wert) ? wert.map((w) => idx.names.get(String(w))).filter(Boolean) : idx.names.get(String(wert));
        }
      }
    }
    wert = leerWeg(wert);
    if (wert !== undefined) raus[s.ref] = wert;
  }
  return raus;
}

/** Leer ist leer: keine Zeichenkette, keine leere Liste, kein `null`. */
function leerWeg(v: unknown): unknown {
  if (v === null || v === '' || (Array.isArray(v) && !v.length)) return undefined;
  return v;
}

/** Die Facetten der Arten, einmal je Index und Auswahl. */
const facettenJe = new WeakMap<ListIndex, Map<string, FacetDef[]>>();
function facettenDerArten(idx: ListIndex, typen: readonly string[]): FacetDef[] {
  if (!typen.length) return [];
  let m = facettenJe.get(idx);
  if (!m) facettenJe.set(idx, (m = new Map()));
  const k = [...typen].sort().join(',');
  let f = m.get(k);
  if (!f) {
    f = typen.length === 1 && idx.types.get(typen[0]!)
      ? idx.types.get(typen[0]!)!.facets
      : commonFacets(idx.registry, typen, (t) => listColumns(idx.registry, t).map((c) => c.ref));
    m.set(k, f);
  }
  return f;
}

/**
 * Eine Facette über die Zeilen, die alle **anderen** Filter bestehen.
 * Häkchen nach der Reihenfolge der Liste (Aufzählung) oder nach Zahl
 * (Sorte, Artikel); eine Spanne aus dem, was dasteht. Eine Facette, die
 * nichts unterscheidet — ein Wert, den jede Zeile trägt, und nichts
 * gewählt —, fällt weg.
 */
function facetteZaehlen(idx: ListIndex, def: FacetDef, basis: IndexZeile[], gewaehlt: FieldFilter | undefined): FieldFacet | null {
  const ref = def.ref;
  const label = def.label;
  if (def.kind === 'range' || def.kind === 'auto') {
    /* Eine Spanne: eine Zahl — oder ein Text, der fast überall eine Zahl
       ist (der Herausforderungsgrad steht als „1/4" da, und ein paar
       Statblöcke sagen „Unknown"; die fallen beim Filtern heraus). */
    let min = Infinity;
    let max = -Infinity;
    let zahlen = 0;
    let andere = 0;
    for (const z of basis) {
      const v = z.fv[ref]?.[0];
      if (v === undefined) continue;
      const n = facetNumber(v);
      if (Number.isNaN(n)) {
        andere += 1;
        continue;
      }
      zahlen += 1;
      if (n < min) min = n;
      if (n > max) max = n;
    }
    const istZahl = def.kind === 'range' || zahlen >= 9 * andere;
    return zahlen && istZahl && min < max ? { ref, label, kind: 'range', min, max } : null;
  }
  const zahl = new Map<string, number>();
  for (const z of basis) for (const w of z.fv[ref] ?? []) zahl.set(w, (zahl.get(w) ?? 0) + 1);
  const werte = gewaehlt?.values ?? [];
  if (def.kind === 'bool') {
    const options: FacetOption[] = ['true', 'false']
      .filter((v) => zahl.has(v) || werte.includes(v))
      .map((v) => ({ value: v, count: zahl.get(v) ?? 0, label: v === 'true' ? 'Yes' : 'No' }));
    if (options.length < 2 && !werte.length) return null;
    return { ref, label, kind: 'enum', of: 'bool', options };
  }
  if (def.kind === 'link') {
    let options: FacetOption[] = [...zahl.entries()]
      .filter(([id]) => idx.names.has(id))
      .map(([value, count]) => ({ value, count, label: idx.names.get(value)!, group: typLabel(idx, idx.typeOf.get(value)) }))
      .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label, 'en'));
    const alle = options.length;
    options = options.slice(0, WAHL);
    for (const v of werte) {
      if (options.some((o) => o.value === v) || !idx.names.has(v)) continue;
      options.push({ value: v, count: zahl.get(v) ?? 0, label: idx.names.get(v)!, group: typLabel(idx, idx.typeOf.get(v)) });
    }
    if (!options.length || (alle === 1 && options[0]!.count === basis.length && !werte.length)) return null;
    return { ref, label, kind: 'enum', of: 'link', options, ...(alle > WAHL ? { more: alle - WAHL } : {}) };
  }
  /* Eine Aufzählung oder Sorte — oder abgeleitete Wörter (T-180), die
     ihre Beschriftung mitbringen. */
  const reihe = def.field && def.kind === 'enum' ? (enumOptions(idx.registry, def.field.prop) ?? []) : [];
  const beschriftung =
    def.kind === 'effect'
      ? effectLabel
      : def.kind === 'requirement'
        ? (v: string) => requirementLabel(v, (id) => idx.names.get(id))
        : null;
  const options: FacetOption[] = [...zahl.entries()]
    .map(([value, count]) => (beschriftung ? { value, count, label: beschriftung(value) } : { value, count }))
    .sort((a, b) => {
      const ia = reihe.indexOf(a.value);
      const ib = reihe.indexOf(b.value);
      if (ia >= 0 || ib >= 0) return (ia < 0 ? 1e9 : ia) - (ib < 0 ? 1e9 : ib);
      return b.count - a.count || a.value.localeCompare(b.value, 'en');
    });
  /* Gewählte Werte bleiben stehen, auch wenn gerade nichts sie trägt. */
  for (const v of werte) if (!options.some((o) => o.value === v)) options.push(beschriftung ? { value: v, count: 0, label: beschriftung(v) } : { value: v, count: 0 });
  if (!options.length || (options.length === 1 && options[0]!.count === basis.length && !werte.length)) return null;
  return { ref, label, kind: 'enum', ...(def.kind === 'requirement' ? { of: 'requirement' as const } : {}), options };
}

function typLabel(idx: ListIndex, typ: string | undefined): string {
  if (!typ) return '';
  return idx.types.get(typ)?.label ?? idx.registry.interfaces[typ]?.label ?? typ;
}

/**
 * Die Abfrage aus der Adresse. Mehrere Werte stehen durch Kommas getrennt
 * (`type=Spell,Feat`), ein Feldfilter als `f=Typ.feld:Wert|Wert` oder
 * `f=Typ.feld:1..3` — der senkrechte Strich, weil Aufzählungswerte Kommas
 * tragen dürfen.
 */
export function parseListQuery(raw: Record<string, unknown>): ListQuery {
  const liste = (v: unknown): string[] | undefined => {
    if (v === undefined || v === null || v === '') return undefined;
    const teile = (Array.isArray(v) ? v : [v]).flatMap((x) => String(x).split(','));
    const sauber = teile.map((x) => x.trim()).filter(Boolean);
    return sauber.length ? sauber : undefined;
  };
  const namen = (v: unknown): string[] | undefined => {
    if (v === undefined || v === null || v === '') return undefined;
    const sauber = (Array.isArray(v) ? v : [v]).map((x) => String(x).trim().toLowerCase()).filter(Boolean);
    return sauber.length ? sauber : undefined;
  };
  const zahl = (v: unknown, vorgabe: number): number => {
    const n = Number(v);
    return Number.isFinite(n) ? Math.floor(n) : vorgabe;
  };
  /* Die gewählten Spalten (T-343): `cols=Spell.level,@source`. Leer
     gesagt (`cols=`) heisst: nur der Name. */
  const cols = raw['cols'] === undefined ? null : cleanColumns(Array.isArray(raw['cols']) ? raw['cols'].flatMap((x) => String(x).split(',')) : String(raw['cols']));
  const fields: Record<string, FieldFilter> = {};
  for (const f of Array.isArray(raw['f']) ? raw['f'] : raw['f'] ? [raw['f']] : []) {
    const s = String(f);
    const punkt = s.indexOf(':');
    if (punkt <= 0) continue;
    const ref = s.slice(0, punkt);
    const rest = s.slice(punkt + 1);
    const spanne = /^(-?[\d.]*)\.\.(-?[\d.]*)$/.exec(rest);
    if (spanne) {
      const min = spanne[1] ? Number(spanne[1]) : undefined;
      const max = spanne[2] ? Number(spanne[2]) : undefined;
      fields[ref] = {
        ...(min !== undefined && Number.isFinite(min) ? { min } : {}),
        ...(max !== undefined && Number.isFinite(max) ? { max } : {}),
      };
    } else {
      const values = rest.split('|').filter(Boolean);
      if (values.length) fields[ref] = { values };
    }
  }
  /* **Zeit und Autor als Facetten** (T-382): `f=@added:7d`, `f=@by:<id>|<id>`
     — so tragen Adresse und Filtergruppen sie wie jede andere Wahl. */
  const meta: Record<string, string[] | undefined> = {};
  for (const k of ['@added', '@changed', '@by', HAS_REF]) {
    if (fields[k]) meta[k] = fields[k].values;
    delete fields[k];
  }
  return {
    area: typeof raw['area'] === 'string' && raw['area'] ? raw['area'] : undefined,
    type: liste(raw['type']),
    of: liste(raw['of']),
    notype: liste(raw['notype']),
    status: liste(raw['status']),
    q: typeof raw['q'] === 'string' ? raw['q'] : undefined,
    layer: liste(raw['layer']),
    nolayer: liste(raw['nolayer']),
    ids: liste(raw['ids']),
    /* Ein Name darf ein Komma tragen: je Name ein `name=`, nicht getrennt. */
    name: namen(raw['name']),
    rel: liste(raw['rel']),
    tag: liste(raw['tag']),
    parts: raw['parts'] === '1' || raw['parts'] === 'true',
    versions: raw['versions'] === '1' || raw['versions'] === 'true',
    rank: raw['rank'] === '1' || raw['rank'] === 'true',
    sort: typeof raw['sort'] === 'string' && raw['sort'] ? raw['sort'] : undefined,
    ...zeitfilter({ ...raw, added: raw['added'] ?? meta['@added']?.[0], changed: raw['changed'] ?? meta['@changed']?.[0] }),
    by: liste(raw['by']) ?? meta['@by'],
    has: hasBedingungen(meta[HAS_REF]),
    offset: Math.max(0, zahl(raw['offset'], 0)),
    /* Höchstens 200 je Blatt: wer mehr will, blättert. */
    limit: Math.min(200, Math.max(1, zahl(raw['limit'], 50))),
    fields,
    ...(cols ? { columns: cols } : {}),
  };
}

/** Die Bedingungen von `f=@has:…` (T-389); Unsinn fällt weg. */
function hasBedingungen(werte: string[] | undefined): HasTerm[] | undefined {
  const t = (werte ?? []).map(parseHasTerm).filter((x): x is HasTerm => !!x);
  return t.length ? t : undefined;
}

/**
 * **Was eine Zeile an Beziehungen hat** (T-389): ausgehend die Kanten mit
 * sichtbarem Ziel, eingehend die aus `ein` (dort steht nur, wessen Quelle
 * man sieht), ein Feld aus den gesiebten Karten. Die Ebenenkante nicht.
 */
function hasFakten(idx: ListIndex, z: IndexZeile): HasFacts {
  return {
    edges: (dir, typ) =>
      typ === LAYER_RELATION
        ? []
        : dir === 'out'
          ? z.relations.filter((r) => r.type === typ && idx.names.has(r.to)).map((r) => r.to)
          : (idx.ein.get(z.id) ?? []).filter((r) => r.type === typ).map((r) => r.from),
    field: (typ, feld) => hasValue((z.karten[typ] as Record<string, unknown> | undefined)?.[feld]),
  };
}

/**
 * Die Wahl der Seitenleiste (T-389): die Kanten, die für die gewählten
 * Arten gelten (ohne Art: die, die in den Treffern vorkommen), und mit
 * gewählter Art ihre Felder — je mit der Zahl der Treffer, die sie haben.
 */
function hasFacette(
  idx: ListIndex,
  typen: readonly string[],
  treffer: readonly IndexZeile[],
  hat: readonly HasTerm[],
  zielZahl: ReadonlyMap<string, ReadonlyMap<string, number>>,
  faktenVon: (z: IndexZeile) => HasFacts,
): ListResult['facets']['has'] {
  const kanten = hasEdgeChoices(idx.registry, typen);
  const felder = hasFieldChoices(idx.registry, typen);
  const zahl = new Map<string, number>();
  const feldRefs = felder.map((f) => [f.ref, ...f.ref.split('.')] as const);
  for (const z of treffer) {
    const da = new Set<string>();
    for (const r of z.relations) if (r.type !== LAYER_RELATION && idx.names.has(r.to)) da.add(`out.${r.type}`);
    for (const r of idx.ein.get(z.id) ?? []) da.add(`in.${r.type}`);
    for (const ref of da) zahl.set(ref, (zahl.get(ref) ?? 0) + 1);
    const f = faktenVon(z);
    for (const [ref, typ, feld] of feldRefs) if (f.field(typ!, feld!)) zahl.set(ref, (zahl.get(ref) ?? 0) + 1);
  }
  const gewaehlt = new Set(hat.map((t) => t.ref));
  const choices = [...kanten, ...felder]
    .map((c) => ({ ...c, count: zahl.get(c.ref) ?? 0 }))
    /* Ohne Art stünden alle Kanten des Registers da; dann nur, was vorkommt. */
    .filter((c) => typen.length > 0 || c.count > 0 || gewaehlt.has(c.ref));
  const targets: Record<string, { id: string; name: string; count: number }[]> = {};
  for (const [ref, m] of zielZahl) {
    const gesucht = new Set(hat.filter((t) => t.ref === ref && t.to !== undefined).map((t) => t.to!));
    targets[ref] = [...m]
      .map(([id, count]) => ({ id, name: idx.names.get(id) ?? id, count }))
      .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name, 'en'))
      .slice(0, 100);
    /* Das gewählte Ziel steht mit da, auch ohne Treffer — sonst fehlte es im Wähler. */
    for (const id of gesucht) {
      if (!targets[ref].some((x) => x.id === id) && idx.names.has(id)) targets[ref].push({ id, name: idx.names.get(id)!, count: 0 });
    }
  }
  return { choices, targets };
}

/**
 * `added=`, `changed=` (T-382): `today`, `7d`, `30d` oder `von..bis`, mit
 * der Zeitzone des Browsers (`tz`, Minuten wie `getTimezoneOffset`).
 * Unsinn filtert nicht — er steht in der Adresse und ist sonst harmlos.
 */
function zeitfilter(raw: Record<string, unknown>, jetzt: Date = new Date()): Pick<ListQuery, 'added' | 'changed'> {
  const tz = Number(raw['tz']);
  const fenster = (v: unknown) => (typeof v === 'string' ? parseTimeWindow(v, jetzt, Number.isFinite(tz) ? tz : 0) : null);
  const added = fenster(raw['added']);
  const changed = fenster(raw['changed']);
  return { ...(added ? { added } : {}), ...(changed ? { changed } : {}) };
}

// ------------------------------------------------------------------ Suche

/** Eine Zeile der übergreifenden Suche (T-138): wenig — mehr zeigt das „+" (Ansicht `search`). */
export interface SearchRow {
  id: string;
  name: string;
  type: string;
  typeLabel: string;
  area: string;
  layers: string[];
  publishers: string[];
  source: string;
  image?: string;
  /** Die Version der Bilddatei (T-211): mit ihr darf der Browser das Bild behalten. */
  imageVersion?: string;
  usable?: 'unknown';
}

export interface SearchResult {
  q: string;
  total: number;
  offset: number;
  limit: number;
  rows: SearchRow[];
  facets: {
    types: ListResult['facets']['types'];
    layers: ListResult['facets']['layers'];
    publishers: { name: string; count: number }[];
    /** Die Facetten der gewählten Art (T-180): dieselben wie im Kompendium. */
    fields: FieldFacet[];
    usable?: ListResult['facets']['usable'];
  };
}

/**
 * **Die übergreifende Suche** (T-138): dieselbe Liste wie überall
 * (`queryList` über den gesiebten Index), nach Nähe geordnet, Fassungen
 * als eine Zeile — und ein Filter nach **Herausgeber**, der zu einer
 * Ebenenauswahl wird. Wer etwas nicht sehen darf, findet es nicht: der
 * Index ist schon gesiebt, und der Name darin ist der, den dieser
 * Betrachter sieht (Deckname).
 *
 * `verlagVon` gibt je Ebenen-Id den Herausgeber (`publisherOf`); eine
 * Ebene, die der Betrachter nicht sieht, kommt nicht vor, weil der Index
 * ihren Namen nicht kennt.
 */
export function search(
  idx: ListIndex,
  q: ListQuery,
  publisher: string[] | undefined,
  verlagVon: (layer: string) => string,
): SearchResult {
  let layer = q.layer;
  if (publisher?.length) {
    const gewaehlt = new Set(publisher);
    const ebenen = [...idx.names.keys()].filter((id) => {
      const v = verlagVon(id);
      return v !== '' && gewaehlt.has(v);
    });
    const schnitt = layer?.length ? ebenen.filter((l) => layer!.includes(l)) : ebenen;
    /* Nichts trifft: eine Ebene, die es nicht gibt, statt „alle". */
    layer = schnitt.length ? schnitt : ['∅∅'];
  }
  const roh = queryList(idx, { ...q, layer, versions: true, rank: true, parts: false });
  /* Die Ebenen-Facette ohne den Herausgeberfilter: sonst verschwände mit
     dem ersten Verlag jeder andere aus der Leiste. */
  const ohne = publisher?.length ? queryList(idx, { ...q, versions: true, parts: false, offset: 0, limit: 1 }) : roh;
  const verlage = new Map<string, number>();
  for (const l of ohne.facets.layers) {
    if (l.id === NO_LAYER) continue;
    const v = verlagVon(l.id);
    if (v) verlage.set(v, (verlage.get(v) ?? 0) + l.count);
  }
  for (const v of publisher ?? []) if (!verlage.has(v)) verlage.set(v, 0);
  const zeilen = zeilenVon(idx);
  return {
    q: q.q ?? '',
    total: roh.total,
    offset: roh.offset,
    limit: roh.limit,
    rows: roh.rows.map((z) => {
      const art = idx.types.get(z.type);
      const ids = zeilen.get(z.id)?.layers ?? [];
      return {
        id: z.id,
        name: z.name,
        type: z.type,
        typeLabel: art?.label ?? z.type,
        area: art?.area ?? '',
        layers: z.layers,
        publishers: [...new Set(ids.map(verlagVon).filter(Boolean))],
        source: z.source,
        ...(z.image ? { image: z.image } : {}),
      ...(z.imageVersion ? { imageVersion: z.imageVersion } : {}),
        ...(z.usable ? { usable: z.usable } : {}),
      };
    }),
    facets: {
      types: roh.facets.types,
      layers: ohne.facets.layers,
      fields: roh.facets.fields,
      ...(roh.facets.usable ? { usable: roh.facets.usable } : {}),
      publishers: [...verlage.entries()]
        .map(([name, count]) => ({ name, count }))
        .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name, 'en')),
    },
  };
}

/** Id → Zeile, einmal je Index — der Index gilt je Stempel und Betrachter. */
const zeilenJe = new WeakMap<ListIndex, Map<string, IndexZeile>>();
function zeilenVon(idx: ListIndex): Map<string, IndexZeile> {
  let m = zeilenJe.get(idx);
  if (!m) {
    m = new Map(idx.rows.map((z) => [z.id, z]));
    zeilenJe.set(idx, m);
  }
  return m;
}
