/**
 * A small YAML-subset reader for Obsidian frontmatter.
 *
 * Deliberately not a full YAML parser: the vault's frontmatter is flat keys,
 * scalars and `- ` lists, and a real parser would drag in a dependency plus
 * its own opinions about quoting. What it does handle is what the vault
 * actually contains — including the thing that would otherwise bite:
 *
 * **Keys are matched case-insensitively.** The vault writes `Rarität` and
 * `Formfaktor` but `rüstungsklasse` and `rüstungstyp`, because Dataview
 * lowercases property names and the files were written against Dataview.
 * A parser keyed on exact case silently drops armour class.
 */

export interface Frontmatter {
  /** Values by their original key. */
  raw: Record<string, string | string[]>;
  /** Lowercased key → original key, for case-insensitive lookup. */
  index: Record<string, string>;
  /** Everything after the closing `---`. */
  body: string;
}

function stripQuotes(value: string): string {
  const trimmed = value.trim();
  if (trimmed.length >= 2 && /^(".*"|'.*')$/s.test(trimmed)) return trimmed.slice(1, -1);
  return trimmed;
}

export function parseFrontmatter(text: string): Frontmatter {
  const source = String(text ?? '').replace(/^\uFEFF/, '');
  const match = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?/.exec(source);
  if (!match) return { raw: {}, index: {}, body: source };

  const raw: Record<string, string | string[]> = {};
  const lines = (match[1] ?? '').split(/\r?\n/);
  let currentKey: string | null = null;

  for (const line of lines) {
    const listItem = /^\s*-\s+(.*)$/.exec(line);
    if (listItem && currentKey) {
      const existing = raw[currentKey];
      const list = Array.isArray(existing) ? existing : [];
      list.push(stripQuotes(listItem[1] ?? ''));
      raw[currentKey] = list;
      continue;
    }

    const pair = /^([^\s:][^:]*):\s*(.*)$/.exec(line);
    if (!pair) continue;

    const key = (pair[1] ?? '').trim();
    const value = stripQuotes(pair[2] ?? '');
    currentKey = key;
    // An empty value may open a list on the following lines, or just be empty.
    raw[key] = value === '' ? [] : value;
  }

  // An opened-but-never-filled list reads as absent, not as an empty list.
  for (const [key, value] of Object.entries(raw)) {
    if (Array.isArray(value) && value.length === 0) raw[key] = '';
  }

  const index: Record<string, string> = {};
  for (const key of Object.keys(raw)) index[key.toLowerCase()] = key;

  return { raw, index, body: source.slice(match[0].length) };
}

/** Case-insensitive scalar lookup. Returns '' for absent or empty. */
export function str(fm: Frontmatter, key: string): string {
  const original = fm.index[key.toLowerCase()];
  if (!original) return '';
  const value = fm.raw[original];
  if (Array.isArray(value)) return value.join(', ');
  return String(value ?? '').trim();
}

/** Case-insensitive list lookup. A lone scalar reads as a one-item list. */
export function list(fm: Frontmatter, key: string): string[] {
  const original = fm.index[key.toLowerCase()];
  if (!original) return [];
  const value = fm.raw[original];
  if (Array.isArray(value)) return value.filter((v) => v !== '');
  const single = String(value ?? '').trim();
  return single ? [single] : [];
}

/** Case-insensitive number lookup. Returns undefined rather than NaN or 0. */
export function num(fm: Frontmatter, key: string): number | undefined {
  const text = str(fm, key);
  if (text === '') return undefined;
  const parsed = Number(text.replace(/[^\d.,-]/g, '').replace(',', '.'));
  return Number.isFinite(parsed) ? parsed : undefined;
}

/** The keys this file carried, in original spelling — for the import report. */
export function keys(fm: Frontmatter): string[] {
  return Object.keys(fm.raw);
}
