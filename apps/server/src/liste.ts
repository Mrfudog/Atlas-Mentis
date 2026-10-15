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
  areaOf,
  commonFacets,
  facetFieldValues,
  facetNumber,
  facetsFor,
  articleId,
  entityName,
  enumOptions,
  fieldTitle,
  isBookPart,
  isInstance,
  LAYER_RELATION,
  layoutFor,
  listColumns,
  primaryInterface,
  tagsOf,
  typeChain,
  versionGroups,
} from '@nw/model';
import type { Entity, FacetDef, LayoutElement, PropertySchema, Registry } from '@nw/model';

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
  tags: string[];
  /** Die Werte je Facette seiner Art (T-174): Wörter, Zahlen als Text, Ids. */
  fv: Record<string, string[]>;
  /** Die Kanten des Artikels (geteilt, nicht kopiert) — für `rel=`. */
  relations: NonNullable<Entity['relations']>;
  /** Die Gruppe seiner Fassungen (T-092), wenn er welche hat. */
  fassung?: string;
  /** Der Rang der obersten aufgeschalteten Ebene, die ihn bringt — die
   *  Fassung mit dem höchsten steht als Kopfzeile. */
  rang: number;
}

export interface ListIndex {
  rows: IndexZeile[];
  /** Id → Name, für alles, was dieser Betrachter sieht. */
  names: Map<string, string>;
  /** Je Art: Beschriftung, Bereich, `extends`-Kette und Spalten. */
  types: Map<string, { label: string; area: string; chain: string[]; columns: Spalte[]; bild: boolean; facets: FacetDef[] }>;
  /** Id → Art, für die Gruppen einer Artikelwahl (T-174). */
  typeOf: Map<string, string>;
  registry: Registry;
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
): ListIndex {
  const genannt = (e: Entity) => !shown || primaryInterface(e) !== 'Layer' || shown.has(e.id);
  visible = shown ? visible.filter(genannt) : visible;
  /* Fassungen derselben Sache (T-092): einmal über das Gesiebte. */
  const fassungen = versionGroups(visible);
  const names = new Map<string, string>();
  const typeOf = new Map<string, string>();
  /* **Kanten von drüben** (T-174): die Gegenrichtung ist eine Abfrage —
     einmal über das Gesiebte, also zählt nur, wessen Quelle man sieht. */
  const ein = new Map<string, { type: string; from: string }[]>();
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
      ...(art.bild ? bildVon(e, art.chain, names) : {}),
      tags: tagsOf(e),
      fv: facettenWerte(art.facets, e, names, ein),
      relations: e.relations ?? [],
      ...(fassungen.has(e.id) ? { fassung: fassungen.get(e.id)! } : {}),
      rang: rank(e),
    });
  }
  rows.sort((a, b) => (a.sortName < b.sortName ? -1 : a.sortName > b.sortName ? 1 : a.id < b.id ? -1 : 1));
  return { rows, names, types, typeOf, registry };
}

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
): Record<string, string[]> {
  const raus: Record<string, string[]> = {};
  for (const f of facets) {
    let w: string[];
    if (f.relation?.dir === 'out') {
      w = (e.relations ?? []).filter((r) => r.type === f.relation!.type && names.has(r.to)).map((r) => r.to);
    } else if (f.relation?.dir === 'in') {
      w = (ein.get(e.id) ?? []).filter((r) => r.type === f.relation!.type).map((r) => r.from);
    } else {
      w = facetFieldValues(f, e);
    }
    if (w.length) raus[f.ref] = [...new Set(w)];
  }
  return raus;
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
    return { ...e, components };
  };
}

/** Zeigt `overview` dieser Art ein Bild (Element `image`, T-114)? Das Register sagt es, nicht der Code. */
function zeigtBild(registry: Registry, typ: string): boolean {
  const flach = (l: LayoutElement[]): LayoutElement[] => l.flatMap((el) => (el.el === 'tabs' ? (el.tabs ?? []).flatMap((t) => flach(t.layout)) : [el]));
  return flach(layoutFor(registry, 'overview', typ).layout).some((el) => el.el === 'image');
}

/**
 * **Das Vorschaubild einer Zeile** (T-114): an einem Asset das Asset
 * selbst, sonst `Image.image`. Ein Asset, das der Betrachter nicht sieht
 * (es steht nicht in `names`), bleibt weg — die Zeile zeigte sonst ein
 * Bild, das der Server dann verweigert.
 */
function bildVon(e: Entity, kette: string[], names: Map<string, string>): { image?: string } {
  const asset = e.components?.['Asset'] as { ref?: unknown } | undefined;
  if (kette.includes('Asset') && typeof asset?.ref === 'string' && asset.ref) return { image: e.id };
  const wert = (e.components?.['Image'] as { image?: unknown } | undefined)?.image;
  if (typeof wert !== 'string' || !wert.trim()) return {};
  const w = wert.trim();
  if (/^https?:\/\//i.test(w)) return { image: w };
  return names.has(w) ? { image: w } : {};
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
  /** Diese Kantenarten gehen je Zeile mit (`rels`): wohin ein Board oder
   *  eine Sitzung gehört (`partOf`), ohne den Artikel ganz zu holen. */
  rel?: string[] | undefined;
  /** Nur Artikel mit **allen** diesen Marken (T-119): jede Marke engt ein. */
  tag?: string[] | undefined;
  /** Diese Artikel nicht — am Server gesetzt, nie aus der Adresse (die Galerie: „unbenutzt"). */
  exclude?: ReadonlySet<string> | undefined;
  /** `name` (Vorgabe), `type` oder eine Spalte `Typ.feld`; `-` davor kehrt um. */
  sort?: string | undefined;
  /** **Nach Nähe ordnen** (T-138): mit `q` zuerst der genaue Name, dann
   *  der Anfang, ein Wortanfang, ein Alias oder Deckname, zuletzt „enthält".
   *  Innerhalb einer Stufe nach Namen. Gilt nur ohne `sort`. */
  rank?: boolean | undefined;
  offset: number;
  limit: number;
  /** `Typ.feld` → Werte oder Spanne. */
  fields: Record<string, FieldFilter>;
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
      /** `bool` ja/nein, `link` eine Artikelwahl — gezeichnet wie Häkchen. */
      of?: 'bool' | 'link';
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
    tags?: string[];
    rels?: Record<string, string[]>;
    /** Die übrigen Fassungen dieser Sache (T-092, mit `versions=1`). */
    versions?: { id: string; name: string; layers: string[]; source: string }[];
  }[];
  facets: {
    types: { type: string; label: string; area: string; count: number }[];
    layers: { id: string; name: string; count: number }[];
    fields: FieldFacet[];
    /** Die Marken der Treffer, je Marke gezählt (T-119) — die gewählten stehen mit da. */
    tags: { tag: string; count: number }[];
    /** Wie viele Teile von Statblöcken gerade ausgeblendet sind. */
    partsHidden: number;
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
  const marken = q.tag?.length ? q.tag : null;
  const einTyp = q.type?.length === 1 ? q.type[0]! : undefined;
  const spalten = einTyp ? (idx.types.get(einTyp)?.columns ?? listColumns(idx.registry, einTyp)) : [];
  /* **Die Facetten** (T-174): die gewählten Arten, sonst die eine Art, die
     eine Filtergruppe eingrenzt (`of`) — und davon, was alle haben. */
  const facettenTypen = q.type?.length ? q.type : q.of?.length === 1 ? q.of : [];
  const facetten = facettenDerArten(idx, facettenTypen);
  const filter = Object.entries(q.fields).filter(([ref]) => facetten.some((f) => f.ref === ref));
  const mitFeldern = filter.length > 0 || facetten.length > 0;

  const inEbene = (z: IndexZeile): boolean => {
    const ls = z.layers.length ? z.layers : [NO_LAYER];
    if (ebenen && !ls.some((l) => ebenen.has(l))) return false;
    return !ohneEbenen || !ls.every((l) => ohneEbenen.has(l));
  };

  /* Was für jede Facette gilt: Bereich, Auswahl-Arten, Suche. */
  const grund: IndexZeile[] = [];
  for (const z of idx.rows) {
    if (nurIds && !nurIds.has(z.id)) continue;
    if (q.area && z.area !== q.area) continue;
    if (ofSet && !idx.types.get(z.type)?.chain.some((t) => ofSet.has(t))) continue;
    if (ohneTypen && idx.types.get(z.type)?.chain.some((t) => ohneTypen.has(t))) continue;
    if (staende && !staende.has(z.status || 'ready')) continue;
    if (such && !z.such.includes(such)) continue;
    if (marken && !marken.every((t) => z.tags.includes(t))) continue;
    if (q.exclude?.has(z.id)) continue;
    grund.push(z);
  }

  const istTeil = (z: IndexZeile): boolean => z.users === 1;
  const teilOk = (z: IndexZeile): boolean => q.parts === true || !!nurIds || !istTeil(z);
  const felderOk = (z: IndexZeile, ausser?: string): boolean =>
    filter.every(([ref, f]) => ref === ausser || trifft(z, ref, f));

  const typZahl = new Map<string, number>();
  const ebenenZahl = new Map<string, number>();
  const treffer: IndexZeile[] = [];
  const getypt: IndexZeile[] = [];
  let partsHidden = 0;
  for (const z of grund) {
    const ebeneOk = inEbene(z);
    const typOk = !typSet || typSet.has(z.type);
    const felder = !mitFeldern || felderOk(z);
    if (ebeneOk && felder && typOk && istTeil(z) && !teilOk(z)) partsHidden += 1;
    if (!teilOk(z)) continue;
    /* Die Arten zählen ohne die Art und ohne die Feldfilter: die gelten
       nur für die gewählte. */
    if (ebeneOk) typZahl.set(z.type, (typZahl.get(z.type) ?? 0) + 1);
    if (typOk && felder) {
      const ls = z.layers.length ? z.layers : [NO_LAYER];
      for (const l of ls) ebenenZahl.set(l, (ebenenZahl.get(l) ?? 0) + 1);
    }
    if (typOk && ebeneOk) getypt.push(z);
    if (typOk && ebeneOk && felder) treffer.push(z);
  }

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
      nach === 'name' ? z.sortName : nach === 'type' ? (idx.types.get(z.type)?.label ?? z.type) : z.cols[nach];
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
    columns: spalten.map((c) => ({
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
      cols: z.cols,
      ...(z.image ? { image: z.image } : {}),
      ...(z.tags.length ? { tags: z.tags } : {}),
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
    },
  };
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
  /* Eine Aufzählung oder Sorte. */
  const reihe = def.field ? (enumOptions(idx.registry, def.field.prop) ?? []) : [];
  const options: FacetOption[] = [...zahl.entries()]
    .map(([value, count]) => ({ value, count }))
    .sort((a, b) => {
      const ia = reihe.indexOf(a.value);
      const ib = reihe.indexOf(b.value);
      if (ia >= 0 || ib >= 0) return (ia < 0 ? 1e9 : ia) - (ib < 0 ? 1e9 : ib);
      return b.count - a.count || a.value.localeCompare(b.value, 'en');
    });
  /* Gewählte Werte bleiben stehen, auch wenn gerade nichts sie trägt. */
  for (const v of werte) if (!options.some((o) => o.value === v)) options.push({ value: v, count: 0 });
  if (!options.length || (options.length === 1 && options[0]!.count === basis.length && !werte.length)) return null;
  return { ref, label, kind: 'enum', options };
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
  const zahl = (v: unknown, vorgabe: number): number => {
    const n = Number(v);
    return Number.isFinite(n) ? Math.floor(n) : vorgabe;
  };
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
    rel: liste(raw['rel']),
    tag: liste(raw['tag']),
    parts: raw['parts'] === '1' || raw['parts'] === 'true',
    versions: raw['versions'] === '1' || raw['versions'] === 'true',
    rank: raw['rank'] === '1' || raw['rank'] === 'true',
    sort: typeof raw['sort'] === 'string' && raw['sort'] ? raw['sort'] : undefined,
    offset: Math.max(0, zahl(raw['offset'], 0)),
    /* Höchstens 200 je Blatt: wer mehr will, blättert. */
    limit: Math.min(200, Math.max(1, zahl(raw['limit'], 50))),
    fields,
  };
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
      };
    }),
    facets: {
      types: roh.facets.types,
      layers: ohne.facets.layers,
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
