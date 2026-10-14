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
import type { Entity, LayoutElement, PropertySchema, Registry } from '@nw/model';

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
  types: Map<string, { label: string; area: string; chain: string[]; columns: Spalte[]; bild: boolean }>;
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
): ListIndex {
  /* Fassungen derselben Sache (T-092): einmal über das Gesiebte. */
  const fassungen = versionGroups(visible);
  const names = new Map<string, string>();
  for (const e of visible) names.set(e.id, entityName(e));

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
      t = {
        label: registry.interfaces[typ]?.label ?? typ,
        area: areaOf(registry, typ),
        chain: typeChain(registry, typ),
        columns: listColumns(registry, typ),
        bild: zeigtBild(registry, typ),
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
      layers: (e.relations ?? []).filter((r) => r.type === LAYER_RELATION).map((r) => r.to),
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
      relations: e.relations ?? [],
      ...(fassungen.has(e.id) ? { fassung: fassungen.get(e.id)! } : {}),
      rang: rank(e),
    });
  }
  rows.sort((a, b) => (a.sortName < b.sortName ? -1 : a.sortName > b.sortName ? 1 : a.id < b.id ? -1 : 1));
  return { rows, names, types, registry };
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
      karten = [...new Set(['Identity', 'Source', 'Status', 'Tags', ...(zeigtBild(registry, typ) ? ['Image', 'Asset'] : []), ...listColumns(registry, typ).map((c) => c.type)])];
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

export type FieldFacet =
  | { ref: string; label: string; kind: 'enum'; options: { value: string; count: number }[] }
  | { ref: string; label: string; kind: 'range'; min: number; max: number };

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
export function asNumber(v: unknown): number {
  if (typeof v === 'number') return v;
  if (typeof v !== 'string') return NaN;
  const bruch = /^\s*(\d+)\s*\/\s*(\d+)\s*$/.exec(v);
  if (bruch) return Number(bruch[1]) / Number(bruch[2]);
  return /^\s*-?\d+(\.\d+)?\s*$/.test(v) ? Number(v) : NaN;
}

function werteVon(v: unknown): string[] {
  if (v === undefined || v === null || v === '') return [];
  return Array.isArray(v) ? v.map(String) : [String(v)];
}

function trifft(z: IndexZeile, ref: string, f: FieldFilter): boolean {
  const v = z.cols[ref];
  if (f.values?.length) {
    const w = werteVon(v);
    if (!w.some((x) => f.values!.includes(x))) return false;
  }
  if (f.min !== undefined || f.max !== undefined) {
    const n = asNumber(v);
    if (Number.isNaN(n)) return false;
    if (f.min !== undefined && n < f.min) return false;
    if (f.max !== undefined && n > f.max) return false;
  }
  return true;
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
  const filter = Object.entries(q.fields).filter(([ref]) => spalten.some((c) => c.ref === ref));

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
    const felder = !einTyp || felderOk(z);
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

  // Facetten der Felder — nur bei einer gewählten Art.
  const fields: FieldFacet[] = [];
  for (const c of spalten) {
    const label = fieldTitle(idx.registry, einTyp, c);
    const basis = getypt.filter((z) => felderOk(z, c.ref));
    const auswahl = enumOptions(idx.registry, c.prop);
    const hatListe = !!auswahl?.length || !!c.prop.enumRef;
    if (hatListe) {
      const zahl = new Map<string, number>();
      for (const z of basis) for (const w of werteVon(z.cols[c.ref])) zahl.set(w, (zahl.get(w) ?? 0) + 1);
      const reihe = auswahl ?? [];
      const options = [...zahl.entries()]
        .map(([value, count]) => ({ value, count }))
        .sort((a, b) => {
          const ia = reihe.indexOf(a.value);
          const ib = reihe.indexOf(b.value);
          if (ia >= 0 || ib >= 0) return (ia < 0 ? 1e9 : ia) - (ib < 0 ? 1e9 : ib);
          return b.count - a.count || a.value.localeCompare(b.value, 'en');
        });
      /* Gewählte Werte bleiben stehen, auch wenn gerade nichts sie trägt. */
      for (const v of q.fields[c.ref]?.values ?? []) {
        if (!options.some((o) => o.value === v)) options.push({ value: v, count: 0 });
      }
      if (options.length) fields.push({ ref: c.ref, label, kind: 'enum', options });
      continue;
    }
    /* Eine Spanne: eine Zahl — oder ein Text, der fast überall eine Zahl
       ist (der Herausforderungsgrad steht als „1/4" da, und ein paar
       Statblöcke sagen „Unknown"; die fallen beim Filtern heraus). */
    if (c.prop.type === 'boolean' || c.prop.type === 'array' || c.prop.format === 'link') continue;
    let min = Infinity;
    let max = -Infinity;
    let zahlen = 0;
    let andere = 0;
    for (const z of basis) {
      const v = z.cols[c.ref];
      if (v === undefined) continue;
      const n = asNumber(v);
      if (Number.isNaN(n)) {
        andere += 1;
        continue;
      }
      zahlen += 1;
      if (n < min) min = n;
      if (n > max) max = n;
    }
    const istZahl = c.prop.type === 'number' || c.prop.type === 'integer' || zahlen >= 9 * andere;
    if (zahlen && istZahl && min < max) fields.push({ ref: c.ref, label, kind: 'range', min, max });
  }

  // Sortieren — der Index liegt schon nach Namen.
  let liste = treffer;
  const sort = q.sort ?? 'name';
  const ab = sort.startsWith('-');
  const nach = ab ? sort.slice(1) : sort;
  if (nach !== 'name' || ab) {
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
    sort: typeof raw['sort'] === 'string' && raw['sort'] ? raw['sort'] : undefined,
    offset: Math.max(0, zahl(raw['offset'], 0)),
    /* Höchstens 200 je Blatt: wer mehr will, blättert. */
    limit: Math.min(200, Math.max(1, zahl(raw['limit'], 50))),
    fields,
  };
}
