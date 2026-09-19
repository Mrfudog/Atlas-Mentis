/**
 * Obsidian item notes → articles.
 *
 * The contract this implements is the vault's, read off real files, not one
 * invented here. Two things in it are easy to get wrong:
 *
 * - **`Rarität` and `Kaufrarität` are different axes.** The first is the 5e
 *   magic-item rarity and reads `-` when the item is mundane; the second is
 *   a homebrew scale for how hard the thing is to *buy*. Collapsing them
 *   loses the distinction the vault was careful to make.
 * - **`Eigenschaften: ["[[Versatil]]"]` is a reference, not a string.** Weapon
 *   properties are pooled rule articles. Importing them as text would copy
 *   what should be shared — the same loss the old app's statblock export made.
 *
 * Whatever the importer cannot place is kept verbatim in `RawContent`
 * (REQ-019), so nothing is lost merely because this parser did not expect it.
 */

import type { Entity, Relation } from '@nw/model';
import { keys, list, num, parseFrontmatter, str } from './frontmatter.js';

/** `Gegenstandstyp` → the interface the article claims. */
const INTERFACE_BY_TYPE: Record<string, string> = {
  waffe: 'Waffe',
  ausrüstung: 'Ruestung',
  ausruestung: 'Ruestung',
  rüstung: 'Ruestung',
  material: 'Material',
  verbrauchsgut: 'Verbrauchsgut',
  werkzeug: 'Gegenstand',
  wundersam: 'Gegenstand',
  sonstiges: 'Gegenstand',
};

/** Keys the importer places itself; everything else is reported as unplaced. */
const HANDLED = new Set(
  [
    'gegenstandstyp', 'rarität', 'raritaet', 'kaufrarität', 'kaufraritaet',
    'kupferpreis', 'stapelgrösse', 'stapelgroesse', 'formfaktor', 'tags',
    'aliases', 'schaden', 'schadenstyp', 'reichweite', 'eigenschaften',
    'rüstungsklasse', 'ruestungsklasse', 'rüstungstyp', 'ruestungstyp',
    'materialtyp', 'berufe',
  ].map((k) => k.toLowerCase()),
);

export interface ImportedItem {
  entity: Entity;
  /** Wikilink targets this article points at, by name — resolved after the batch. */
  pending: { relation: string; target: string }[];
  /** Frontmatter keys carried but not placed by this importer. */
  unplaced: string[];
  /** Image embeds found in the body, as vault filenames. */
  images: string[];
}

export function slug(name: string): string {
  return (
    String(name ?? '')
      .toLowerCase()
      .replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue').replace(/ß/g, 'ss')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 60) || 'ohne-namen'
  );
}

/** Strip the rendering-only Dataview block; it is identical in every file. */
export function stripDataview(body: string): string {
  return String(body ?? '')
    .replace(/#+\s*Inventar\s*\r?\n+```dataviewjs[\s\S]*?```/gi, '')
    .replace(/```dataviewjs[\s\S]*?```/gi, '')
    .trim();
}

/** `[[Ziel]]` or `[[Ziel#Abschnitt]]` or `[[Ziel|Anzeige]]` → `Ziel`. */
function linkTarget(raw: string): string {
  const inner = /\[\[([^\]]+)\]\]/.exec(String(raw ?? ''));
  const text = inner ? (inner[1] ?? '') : String(raw ?? '');
  return (text.split('|')[0] ?? '').split('#')[0]?.trim() ?? '';
}

let counter = 0;
function newId(prefix: string): string {
  counter += 1;
  return `${prefix}_${Date.now().toString(36)}${counter.toString(36)}`;
}

export function parseGegenstand(text: string, filename: string): ImportedItem {
  const fm = parseFrontmatter(text);
  const name = filename.replace(/\.md$/i, '').trim();

  const typ = str(fm, 'Gegenstandstyp').toLowerCase();
  const iface = INTERFACE_BY_TYPE[typ] ?? 'Gegenstand';

  const body = stripDataview(fm.body);

  // Image embeds lead the body in this vault; they become the Bild component.
  const images: string[] = [];
  for (const m of body.matchAll(/!\[\[([^\]|#]+\.(?:png|jpe?g|webp|gif))(?:\|[^\]]*)?\]\]/gi)) {
    if (m[1]) images.push(m[1].trim());
  }

  const pending: { relation: string; target: string }[] = [];
  for (const raw of list(fm, 'Eigenschaften')) {
    const target = linkTarget(raw);
    if (target) pending.push({ relation: 'hatEigenschaft', target });
  }

  const components: Entity['components'] = {
    Name: { text: name },
    Identity: { key: `${slug(iface)}/${slug(name)}`, aliases: list(fm, 'aliases') },
    Status: { value: 'used' },
    RawContent: { raw: text, format: 'obsidian', importedAt: new Date().toISOString().slice(0, 10) },
  };

  const itemInfo: Record<string, unknown> = {};
  const gegenstandstyp = str(fm, 'Gegenstandstyp');
  if (gegenstandstyp) itemInfo['gegenstandstyp'] = gegenstandstyp;
  // `-` is the vault's way of saying "not a magic item", which is not a rarity.
  const raritaet = str(fm, 'Rarität');
  if (raritaet && raritaet !== '-') itemInfo['raritaet'] = raritaet;
  const kauf = str(fm, 'Kaufrarität');
  if (kauf && kauf !== '-') itemInfo['kaufraritaet'] = kauf;
  const kupfer = num(fm, 'Kupferpreis');
  if (kupfer !== undefined) itemInfo['kupferpreis'] = kupfer;
  const stapel = num(fm, 'Stapelgrösse');
  if (stapel !== undefined) itemInfo['stapel'] = stapel;
  if (Object.keys(itemInfo).length) components['ItemInfo'] = itemInfo;

  const rows = list(fm, 'Formfaktor');
  if (rows.length) components['Formfaktor'] = { rows };

  if (iface === 'Waffe') {
    const waffe: Record<string, unknown> = {};
    if (str(fm, 'Schaden')) waffe['schaden'] = str(fm, 'Schaden');
    if (str(fm, 'Schadenstyp')) waffe['schadenstyp'] = str(fm, 'Schadenstyp');
    if (str(fm, 'Reichweite')) waffe['reichweite'] = str(fm, 'Reichweite');
    if (Object.keys(waffe).length) components['WaffenInfo'] = waffe;
  }

  if (iface === 'Ruestung') {
    const ruestung: Record<string, unknown> = {};
    const rk = num(fm, 'rüstungsklasse');
    if (rk !== undefined) ruestung['rk'] = rk;
    if (str(fm, 'rüstungstyp')) ruestung['ruestungstyp'] = str(fm, 'rüstungstyp');
    if (Object.keys(ruestung).length) components['RuestungsInfo'] = ruestung;
  }

  if (iface === 'Material') {
    const material: Record<string, unknown> = {};
    if (str(fm, 'Materialtyp')) material['materialtyp'] = str(fm, 'Materialtyp');
    const berufe = list(fm, 'Berufe');
    if (berufe.length) material['berufe'] = berufe;
    if (Object.keys(material).length) components['MaterialInfo'] = material;
  }

  if (images[0]) components['Bild'] = { url: images[0], bu: '' };

  // Prose that is neither the image embed nor the Dataview block.
  const prose = body
    .replace(/!\[\[[^\]]+\]\]/g, '')
    .replace(/^#+\s*Eigenschaften[\s\S]*$/im, '')
    .trim();

  const blocks: Entity['blocks'] = [];
  if (prose) {
    blocks.push({ id: newId('b'), blockType: 'paragraph', body: prose, order: 0 });
  }

  // `tags` always carries `gegenstand` plus, inconsistently, a type tag.
  const tags = list(fm, 'tags').filter((t) => t !== 'gegenstand');

  const entity: Entity = {
    id: newId('g'),
    interfaces: [iface],
    name,
    tags,
    components,
    adhoc: [],
    blocks,
    relations: [],
    createdAt: new Date().toISOString(),
  };

  const unplaced = keys(fm).filter((k) => {
    if (HANDLED.has(k.toLowerCase())) return false;
    const value = fm.raw[k];
    const empty = Array.isArray(value) ? value.length === 0 : String(value ?? '').trim() === '';
    return !empty; // an empty key carries nothing, so it is not a loss
  });

  return { entity, pending, unplaced, images };
}

export interface ImportReport {
  entities: Entity[];
  /** References that found no article — candidates for the pool. */
  unresolved: { from: string; relation: string; target: string }[];
  /** Frontmatter keys carried but not placed, by file. */
  unplaced: { from: string; keys: string[] }[];
  /** Images referenced but not uploadable by this importer. */
  images: { from: string; file: string }[];
}

/**
 * Import a batch and resolve `[[links]]` within it. Anything still unresolved
 * is reported rather than dropped — with dead links being creatable in the
 * editor, an unresolved reference is a to-do, not a failure.
 */
export function importGegenstaende(
  files: { name: string; text: string }[],
  existing: Entity[] = [],
): ImportReport {
  const parsed = files.map((f) => parseGegenstand(f.text, f.name));
  const entities = parsed.map((p) => p.entity);

  const byName = new Map<string, string>();
  for (const entity of [...existing, ...entities]) {
    byName.set(entity.name.toLowerCase(), entity.id);
    const aliases = entity.components?.['Identity']?.['aliases'];
    if (Array.isArray(aliases)) {
      for (const alias of aliases) byName.set(String(alias).toLowerCase(), entity.id);
    }
  }

  const unresolved: ImportReport['unresolved'] = [];
  parsed.forEach((item) => {
    const relations: Relation[] = [];
    for (const link of item.pending) {
      const targetId = byName.get(link.target.toLowerCase());
      if (targetId) relations.push({ id: newId('r'), type: link.relation, to: targetId });
      else unresolved.push({ from: item.entity.name, relation: link.relation, target: link.target });
    }
    item.entity.relations = relations;
  });

  return {
    entities,
    unresolved,
    unplaced: parsed.filter((p) => p.unplaced.length).map((p) => ({ from: p.entity.name, keys: p.unplaced })),
    images: parsed.flatMap((p) => p.images.map((file) => ({ from: p.entity.name, file }))),
  };
}
