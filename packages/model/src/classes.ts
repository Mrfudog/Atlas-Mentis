/**
 * **Die Klassenansicht** (W6): eine Klasse, wie 5e.tools sie zeigt — die
 * Stufentabelle, die Merkmale je Stufe, die Unterklassen zum Vergleichen.
 *
 * Gerechnet wird nur aus dem, was ohnehin dasteht: `grants` mit
 * `props.level` (D50), `subclassOf`, `tableFor` und die Marke `optional`.
 * Es gibt keine zweite Liste „Merkmale der Stufe 3" — die wäre am Tag der
 * nächsten Kante falsch.
 *
 * **Eingebettet ist, was allein in einem Absatz steht.** 5e.tools zieht
 * ein Merkmal in ein anderes hinein (`refSubclassFeature`,
 * `refOptionalfeature`); der Importer schreibt dafür einen Absatz, der nur
 * aus dem Verweis besteht (`[[feature-0479|Abjuration Savant]]`). Die
 * Ansicht liest einen solchen Absatz als „hier steht dieses Merkmal" — der
 * Kopf „School of Abjuration" trägt so seine Teile, und „Fighting Style"
 * seine Stile. Ein Verweis mitten im Satz bleibt ein Verweis.
 *
 * Server und Oberfläche rechnen damit gleich: der Server, um zu wissen,
 * welche Artikel er mitschickt, die Oberfläche, um sie anzuordnen.
 */

import {
  articleId,
  entityName,
  entriesOf,
  primaryInterface,
  tagsOf,
} from "./entity.js";
import type { Entity } from "./types.js";

/** Wie tief Merkmale ineinander stecken dürfen (Battle Master › Maneuver Options › Manöver). */
export const EMBED_DEPTH = 2;

/** Die Marke, die ein optionales oder Varianten-Merkmal trägt (`isClassFeatureVariant`). */
export const OPTIONAL_TAG = "optional";

/** Übungsbonus nach Gesamtstufe — die Regel, nicht eine Spalte der Tabelle. */
export function proficiencyBonus(level: number): number {
  return Math.ceil(level / 4) + 1;
}

export function isOptionalFeature(feature: Entity | undefined): boolean {
  return tagsOf(feature).includes(OPTIONAL_TAG);
}

/** Was eine Klasse oder Unterklasse auf welcher Stufe gewährt, nach Stufe geordnet. */
export function grantsByLevel(giver: Entity): { level: number; to: string }[] {
  const out: { level: number; to: string; i: number }[] = [];
  (giver.relations ?? []).forEach((r, i) => {
    if (r.type !== "grants") return;
    const level = Number(r.props?.["level"]);
    out.push({
      level: Number.isInteger(level) && level >= 1 ? level : 0,
      to: r.to,
      i,
    });
  });
  /* Stabil nach Stufe: innerhalb einer Stufe gilt die Reihenfolge der
     Kanten — so stand es im Buch. */
  return out
    .sort((a, b) => a.level - b.level || a.i - b.i)
    .map(({ level, to }) => ({ level, to }));
}

/** Der Regeltext eines Merkmals: alle Absätze von `Prose.paragraph`. */
export function featureText(feature: Entity | undefined): string {
  const karte = feature?.components?.["Prose"] as
    { paragraph?: unknown } | undefined;
  return entriesOf(karte?.paragraph)
    .map((e) => e.value)
    .join("\n\n");
}

const ALLEIN = /^\s*\[\[([^\]|]+)(?:\|[^\]]*)?\]\]\s*$/;

/**
 * Die Verweise, die in diesem Text **allein in einem Absatz** stehen — in
 * der Reihenfolge des Texts. Gefragt wird nach dem Ziel, nicht ob es ein
 * Merkmal ist: das weiss erst, wer den Bestand hat.
 */
export function soleLinks(text: string): string[] {
  const out: string[] = [];
  for (const absatz of text.split(/\n\s*\n/)) {
    const m = ALLEIN.exec(absatz);
    if (m?.[1]) out.push(m[1].trim());
  }
  return out;
}

/** Ein Nachschlagewerk für Verweise: Nummer (`feature-0479`) und Peg-Id. */
export function linkIndex(entities: Iterable<Entity>): Map<string, Entity> {
  const m = new Map<string, Entity>();
  for (const e of entities) {
    m.set(e.id, e);
    const nr = articleId(e);
    if (nr) m.set(nr.toLowerCase(), e);
  }
  return m;
}

function nachschlagen(
  index: ReadonlyMap<string, Entity>,
  ref: string,
): Entity | undefined {
  return index.get(ref) ?? index.get(ref.toLowerCase());
}

/** Die Merkmale, die dieses Merkmal einbettet — eine Ebene tief. */
export function embeddedFeatures(
  feature: Entity,
  index: ReadonlyMap<string, Entity>,
): Entity[] {
  const out: Entity[] = [];
  for (const ref of soleLinks(featureText(feature))) {
    const z = nachschlagen(index, ref);
    if (
      z &&
      z.id !== feature.id &&
      primaryInterface(z) === "Feature" &&
      !out.includes(z)
    )
      out.push(z);
  }
  return out;
}

/** Ob dieser Absatz nur ein eingebettetes Merkmal nennt — die Ansicht zeichnet ihn nicht als Text. */
export function isEmbedParagraph(
  paragraph: string,
  index: ReadonlyMap<string, Entity>,
): boolean {
  const m = ALLEIN.exec(paragraph);
  const z = m?.[1] ? nachschlagen(index, m[1].trim()) : undefined;
  return !!z && primaryInterface(z) === "Feature";
}

/**
 * Die Ids aller Artikel, die die Ansicht einer Klasse braucht: die
 * Klasse, ihre Tabelle, ihre Unterklassen samt deren Tabellen, und jedes
 * Merkmal, das eine davon gewährt oder einbettet (bis `EMBED_DEPTH`).
 * Der Server schickt genau diese — nicht 7 000 Merkmale.
 */
export function classParts(
  all: Iterable<Entity>,
  classId: string,
): {
  klass: string;
  subclasses: string[];
  tables: string[];
  features: string[];
} | null {
  const liste = [...all];
  const byId = new Map(liste.map((e) => [e.id, e]));
  const klasse = byId.get(classId);
  if (!klasse || primaryInterface(klasse) !== "Class") return null;
  const subclasses = liste
    .filter(
      (e) =>
        primaryInterface(e) === "Subclass" &&
        (e.relations ?? []).some(
          (r) => r.type === "subclassOf" && r.to === classId,
        ),
    )
    .map((e) => e.id);
  const tables: string[] = [];
  const features = new Set<string>();
  const index = linkIndex(liste);
  const einbetten = (f: Entity, tiefe: number) => {
    if (tiefe >= EMBED_DEPTH) return;
    for (const k of embeddedFeatures(f, index)) {
      if (features.has(k.id)) continue;
      features.add(k.id);
      einbetten(k, tiefe + 1);
    }
  };
  for (const id of [classId, ...subclasses]) {
    const g = byId.get(id);
    if (!g) continue;
    for (const r of g.relations ?? []) {
      if (r.type === "tableFor" && byId.has(r.to)) tables.push(r.to);
    }
    for (const { to } of grantsByLevel(g)) {
      const f = byId.get(to);
      if (!f) continue;
      features.add(to);
      einbetten(f, 0);
    }
  }
  return { klass: classId, subclasses, tables, features: [...features] };
}

/** Ein Merkmal an seiner Stufe, mit dem, was es einbettet. */
export interface LevelFeature {
  level: number;
  feature: Entity;
  optional: boolean;
  /** Eingebettete Merkmale (Teile eines Kopfes, Optionen einer Wahl). */
  embeds: Entity[];
  /**
   * Was die Tabellenzeile nennt. Ein Kopf, der Merkmale **derselben
   * Sorte** einbettet („School of Abjuration" › „Abjuration Savant"),
   * heisst dort nach seinen Teilen; ein Merkmal mit Optionen („Fighting
   * Style" › „Archery") nach sich selbst.
   */
  names: { id: string; name: string; optional: boolean }[];
}

/** Die Merkmale eines Gebenden je Stufe, mit Einbettung und Namen für die Tabelle. */
export function levelFeatures(
  giver: Entity,
  index: ReadonlyMap<string, Entity>,
): LevelFeature[] {
  const out: LevelFeature[] = [];
  for (const { level, to } of grantsByLevel(giver)) {
    const f = index.get(to);
    if (!f) continue;
    const embeds = embeddedFeatures(f, index);
    const sorte = (e: Entity) =>
      String(e.components?.["Feature"]?.["featureType"] ?? "");
    const teile = embeds.filter(
      (k) => sorte(k) === sorte(f) && sorte(f) !== "",
    );
    const optional = isOptionalFeature(f);
    /* Ein optionaler Teil (Battle Master › „Maneuver Options") ist
       optional, auch wenn sein Kopf es nicht ist. */
    const names = (teile.length ? teile : [f]).map((e) => ({
      id: e.id,
      name: entityName(e),
      optional: optional || isOptionalFeature(e),
    }));
    out.push({ level, feature: f, optional, embeds, names });
  }
  return out;
}

/** Eine Zeile der Stufentabelle: Stufe, Übungsbonus, Merkmale, Zusatzspalten. */
export interface ClassTableRow {
  level: number;
  proficiencyBonus: number;
  features: { id: string; name: string; optional: boolean }[];
  /** Die Zellen der Zusatzspalten, ohne die Stufe. */
  extra: string[];
}

/**
 * Die Stufentabelle wie im Buch. Die Zusatzspalten kommen aus den
 * `Table`-Artikeln (`classTableGroups`, `subclassTableGroups`); ihre erste
 * Spalte ist die Stufe und wird nicht zweimal gezeigt.
 */
export function classTable(
  features: LevelFeature[],
  tables: Entity[],
): { columns: string[]; rows: ClassTableRow[] } {
  const columns: string[] = [];
  const zellen: string[][] = Array.from({ length: 20 }, () => []);
  for (const t of tables) {
    const karte = (t.components?.["Table"] ?? {}) as {
      columns?: unknown;
      rows?: unknown;
    };
    const spalten = Array.isArray(karte.columns)
      ? karte.columns.map(String)
      : [];
    const zeilen = Array.isArray(karte.rows)
      ? (karte.rows as { cells?: unknown }[])
      : [];
    const ohneStufe = spalten[0]?.toLowerCase() === "level";
    const breite = spalten.length - (ohneStufe ? 1 : 0);
    if (breite <= 0) continue;
    columns.push(...spalten.slice(ohneStufe ? 1 : 0));
    for (let i = 0; i < 20; i++) {
      const cells = Array.isArray(zeilen[i]?.cells)
        ? (zeilen[i]!.cells as unknown[]).map(String)
        : [];
      const teil = cells.slice(ohneStufe ? 1 : 0);
      for (let j = 0; j < breite; j++) zellen[i]!.push(teil[j] ?? "");
    }
  }
  const rows: ClassTableRow[] = [];
  for (let level = 1; level <= 20; level++) {
    rows.push({
      level,
      proficiencyBonus: proficiencyBonus(level),
      features: features
        .filter((f) => f.level === level)
        .flatMap((f) => f.names),
      extra: zellen[level - 1]!,
    });
  }
  return { columns, rows };
}
