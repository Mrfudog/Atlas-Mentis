/**
 * Obsidian statblock notes → articles.
 *
 * The vault writes statblocks as an Obsidian callout: every body line is
 * `>`-prefixed, label lines are `**Label** value`, the ability scores are a
 * markdown table, and `# Traits` / `# Actions` / … open sections of
 * `**Name.** text` entries.
 *
 * Four details that a parser written from memory gets wrong:
 *
 * - **`**Geschwindigkeit:**` carries a colon inside the bold** where every
 *   other label does not.
 * - **Ability tables use U+2212 MINUS**, not a hyphen: `3 (−4)`. Parsing with
 *   `-` silently reads −4 as 4.
 * - **Entry text wraps** across several `>` lines. A line-at-a-time reader
 *   keeps the first line and loses the rest.
 * - **`cr` may be a fraction** (`1/8`), so it is a string, not a number.
 *
 * `kreatur: "[[Grimmhauer]]"` links the statblock to the creature that uses
 * it — the D4 split, already present in the vault.
 */

import type { Entity } from '@nw/model';
import { list, num, parseFrontmatter, str } from './frontmatter.js';
import { slug } from './gegenstand.js';

/** Section heading → the relation section it becomes. */
export const SECTIONS = [
  'Traits',
  'Actions',
  'Bonus Actions',
  'Reactions',
  'Villain Actions',
  'Legendary Actions',
] as const;

/** Label line → component field. */
const LABELS: Record<string, string> = {
  rüstungsklasse: 'acText',
  trefferpunkte: 'tpText',
  geschwindigkeit: 'tempo',
  'saving throws': 'rettungswuerfe',
  skills: 'fertigkeiten',
  'damage resistances': 'resistenzen',
  immunities: 'immunitaeten',
  vulnerabilities: 'verwundbarkeiten',
  senses: 'sinne',
  languages: 'sprachen',
  'proficiency bonus': 'prof',
};

const ABILITIES = ['str', 'dex', 'con', 'int', 'wis', 'cha'] as const;

export interface StatblockEntry {
  name: string;
  text: string;
}

export interface ImportedStatblock {
  entity: Entity;
  /** Section → entries, in file order. Each becomes a pooled rule + reference. */
  sections: { section: string; entries: StatblockEntry[] }[];
  /** `kreatur:` wikilink, if the statblock names its creature. */
  creature: string | null;
  unplaced: string[];
}

/** `—`, `-` and `–` all mean "nothing here" in this vault. */
function meaningful(value: string): boolean {
  const trimmed = value.trim();
  return trimmed !== '' && !/^[—–-]+$/.test(trimmed);
}

/** Normalise the Unicode minus so `(−4)` parses as −4. */
export function normaliseMinus(text: string): string {
  return String(text ?? '').replace(/−/g, '-');
}

let counter = 0;
function newId(prefix: string): string {
  counter += 1;
  return `${prefix}_${Date.now().toString(36)}${counter.toString(36)}`;
}

function linkTarget(raw: string): string {
  const inner = /\[\[([^\]]+)\]\]/.exec(String(raw ?? ''));
  if (!inner) return '';
  return (inner[1] ?? '').split('|')[0]?.split('#')[0]?.trim() ?? '';
}

export function parseStatblock(text: string, filename: string): ImportedStatblock {
  const fm = parseFrontmatter(text);
  const name = str(fm, 'name') || filename.replace(/\.md$/i, '').trim();

  // Drop the callout marker and the `>` gutter; keep the lines.
  const lines = normaliseMinus(fm.body)
    .split(/\r?\n/)
    .filter((line) => line.trimStart().startsWith('>'))
    .map((line) => line.replace(/^\s*>\s?/, ''));

  const info: Record<string, unknown> = { system: 'dnd5e-2014' };

  // `grösse: Klein (Ankheg)` carries both the size and the creature type.
  const groesse = str(fm, 'grösse');
  if (groesse) {
    const parts = /^([^(]+?)\s*(?:\(([^)]*)\))?$/.exec(groesse.trim());
    if (parts?.[1]) info['groesse'] = parts[1].trim();
    if (parts?.[2]) info['art'] = parts[2].trim();
  }
  if (str(fm, 'ausrichtung')) info['gesinnung'] = str(fm, 'ausrichtung');
  if (str(fm, 'cr')) info['cr'] = str(fm, 'cr'); // may be `1/8`
  if (str(fm, 'rolle')) info['kampfrolle'] = str(fm, 'rolle');

  // `ac: 12 (Natürlicher Panzer)` — the number is the value, the rest a note.
  const acRaw = str(fm, 'ac');
  if (acRaw) {
    const acNum = /(-?\d+)/.exec(acRaw);
    if (acNum?.[1]) info['ac'] = Number(acNum[1]);
    const acNote = /\(([^)]*)\)/.exec(acRaw);
    if (acNote?.[1]) info['acNotiz'] = acNote[1].trim();
  }
  const leben = num(fm, 'leben');
  if (leben !== undefined) info['tp'] = leben;
  if (str(fm, 'lebenswürfel')) info['tpFormel'] = str(fm, 'lebenswürfel');
  const tempo = list(fm, 'geschwindigkeit');
  if (tempo.length) info['tempo'] = tempo.join(', ');

  // Label lines from the callout. A trailing colon inside the bold is allowed.
  for (const line of lines) {
    const label = /^\*\*([^*]+?):?\*\*\s*(.*)$/.exec(line);
    if (!label) continue;
    const key = LABELS[(label[1] ?? '').trim().toLowerCase()];
    const value = (label[2] ?? '').trim();
    if (!key || !meaningful(value)) continue;
    if (key === 'prof') {
      const parsed = Number(value.replace('+', ''));
      if (Number.isFinite(parsed)) info['prof'] = parsed;
      continue;
    }
    // The callout repeats AC, HP and speed from the frontmatter; the
    // frontmatter is the structured one, so only take what it lacks.
    if (key === 'acText' || key === 'tpText') continue;
    if (key === 'tempo' && info['tempo']) continue;
    info[key] = value;
  }

  // The ability table: a header row of names, then one row of `16 (+3)`.
  const headerAt = lines.findIndex((line) => /^\|\s*STR\s*\|/i.test(line));
  if (headerAt >= 0) {
    const valueRow = lines.slice(headerAt + 1).find((line) => /^\|/.test(line) && !/^\|\s*-/.test(line));
    if (valueRow) {
      const cells = valueRow.split('|').slice(1, -1).map((c) => c.trim());
      ABILITIES.forEach((ability, i) => {
        const score = /(-?\d+)/.exec(cells[i] ?? '');
        if (score?.[1]) info[ability] = Number(score[1]);
      });
    }
  }

  // Sections and their entries. Entry text wraps, so lines accumulate until
  // the next entry or the next heading.
  const sections: ImportedStatblock['sections'] = [];
  let current: { section: string; entries: StatblockEntry[] } | null = null;
  let entry: StatblockEntry | null = null;

  const closeEntry = (): void => {
    if (current && entry && entry.name) {
      entry.text = entry.text.trim();
      current.entries.push(entry);
    }
    entry = null;
  };

  for (const line of lines) {
    const heading = /^#+\s*(.+?)\s*$/.exec(line);
    if (heading) {
      closeEntry();
      if (current) sections.push(current);
      current = { section: (heading[1] ?? '').trim(), entries: [] };
      continue;
    }
    if (!current) continue;

    const start = /^\*\*([^*]+?)\.?\*\*\s*(.*)$/.exec(line);
    if (start) {
      closeEntry();
      entry = { name: (start[1] ?? '').trim(), text: (start[2] ?? '').trim() };
      continue;
    }
    if (entry) {
      if (line.trim() === '' || /^-{3,}$/.test(line.trim())) continue;
      entry.text += ` ${line.trim()}`;
    }
  }
  closeEntry();
  if (current) sections.push(current);

  const entity: Entity = {
    id: newId('sb'),
    interfaces: ['Statblock'],
    name,
    tags: [],
    components: {
      Name: { text: name },
      Identity: { key: `statblock/${slug(name)}`, aliases: list(fm, 'aliases') },
      Status: { value: 'used' },
      StatblockInfo: info,
      RawContent: {
        raw: text,
        format: 'obsidian',
        importedAt: new Date().toISOString().slice(0, 10),
      },
    },
    adhoc: [],
    blocks: [],
    relations: [],
    createdAt: new Date().toISOString(),
  };

  const handled = new Set([
    'typ', 'kreatur', 'name', 'cr', 'rolle', 'ausrichtung', 'grösse', 'ac',
    'leben', 'lebenswürfel', 'geschwindigkeit', 'cssclasses', 'aliases',
  ]);
  const unplaced = Object.keys(fm.raw).filter((key) => {
    if (handled.has(key.toLowerCase())) return false;
    const value = fm.raw[key];
    const empty = Array.isArray(value) ? value.length === 0 : String(value ?? '').trim() === '';
    return !empty;
  });

  return { entity, sections, creature: linkTarget(str(fm, 'kreatur')) || null, unplaced };
}

export interface StatblockReport {
  /** Statblocks, plus the rule articles their entries were pooled into. */
  entities: Entity[];
  rules: Entity[];
  /** `kreatur:` links that found no article. */
  unresolved: { from: string; target: string }[];
  unplaced: { from: string; keys: string[] }[];
}

/**
 * Import a batch. Every section entry becomes a `Regel` article of its own,
 * referenced by the statblock through `composedOf` — so a trait shared by two
 * creatures is one article, not two copies. Identical name and text are
 * treated as the same rule.
 */
export function importStatbloecke(
  files: { name: string; text: string }[],
  existing: Entity[] = [],
): StatblockReport {
  const parsed = files.map((f) => parseStatblock(f.text, f.name));
  const rules: Entity[] = [];
  const ruleByKey = new Map<string, string>();

  const kindOf = (section: string): string => {
    const lower = section.toLowerCase();
    if (lower.startsWith('bonus')) return 'bonus';
    if (lower.startsWith('reaction')) return 'reaction';
    if (lower.startsWith('villain') || lower.startsWith('legendary')) return 'legendary';
    if (lower.startsWith('action')) return 'action';
    return 'trait';
  };

  for (const item of parsed) {
    for (const group of item.sections) {
      for (const entry of group.entries) {
        const key = `${entry.name}\u0000${entry.text}`;
        let ruleId = ruleByKey.get(key);
        if (!ruleId) {
          ruleId = newId('r');
          ruleByKey.set(key, ruleId);
          rules.push({
            id: ruleId,
            interfaces: ['Regel'],
            name: entry.name,
            tags: [],
            components: {
              Name: { text: entry.name },
              Identity: { key: `regel/${slug(entry.name)}`, aliases: [] },
              Status: { value: 'used' },
              RuleInfo: { kind: kindOf(group.section) },
              Description: { raw: entry.text },
            },
            adhoc: [],
            blocks: [],
            relations: [],
            createdAt: new Date().toISOString(),
          });
        }
        item.entity.relations = item.entity.relations ?? [];
        item.entity.relations.push({
          id: newId('rel'),
          type: 'composedOf',
          to: ruleId,
          props: { abschnitt: group.section },
        });
      }
    }
  }

  // `kreatur:` points at a Creature, never at a Statblock — and in this vault
  // the two routinely share a name (`Grimmhauer` is both). Matching by name
  // across everything would resolve a statblock to itself, so statblocks are
  // excluded from the index the creature link is resolved against.
  const byName = new Map<string, string>();
  for (const entity of existing) {
    if ((entity.interfaces ?? []).includes('Statblock')) continue;
    byName.set(entity.name.toLowerCase(), entity.id);
  }

  const unresolved: StatblockReport['unresolved'] = [];
  for (const item of parsed) {
    if (!item.creature) continue;
    const targetId = byName.get(item.creature.toLowerCase());
    if (targetId) {
      item.entity.relations = item.entity.relations ?? [];
      item.entity.relations.push({ id: newId('rel'), type: 'gehoertZu', to: targetId });
    } else {
      unresolved.push({ from: item.entity.name, target: item.creature });
    }
  }

  return {
    entities: parsed.map((p) => p.entity),
    rules,
    unresolved,
    unplaced: parsed.filter((p) => p.unplaced.length).map((p) => ({ from: p.entity.name, keys: p.unplaced })),
  };
}
