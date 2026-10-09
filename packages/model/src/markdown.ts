/**
 * Markdown in langen Textfeldern (M10, #61): Überschriften, Listen,
 * Tabellen, Einschübe, Trennlinien, Absätze.
 *
 * Gelesen wird in **Blöcke mit rohem Inline-Text**; was innerhalb einer
 * Zeile steht (`[[Verweise]]`, `{VAR}`, `{{1d6}}`, Hervorhebung), zerlegt
 * `parseInline` — dieselbe Funktion wie bisher, nur jetzt je Zelle, Punkt
 * und Absatz. Zwei Zerleger für Inline-Text wären zwei Stellen, an denen
 * `{VAR}` aufgelöst wird, und eine davon vergässe die Bindung an der Kante.
 *
 * **Kein HTML aus dem Text.** Ein Block ist ein Datum, kein Markup; der
 * Renderer baut Elemente und setzt Text als Text. `<b>` im Feld bleibt
 * `<b>` zu lesen — eine Registerzeile oder ein Import, der HTML einschleust,
 * schleust nichts ein.
 *
 * Bewusst klein: kein Code-Block, keine Bilder, keine Fussnoten, kein
 * verschachtelter Einschub in einer Tabelle. Was 5e.tools in `entries`
 * schreibt, sind Absätze, Listen, Tabellen und benannte Einschübe — das
 * deckt das hier ab, und jedes weitere Stück wäre Code, den kein Text
 * braucht.
 */

export type Align = 'left' | 'center' | 'right' | null;

export type Block =
  | { kind: 'heading'; level: number; text: string }
  /** `text` darf `\n` enthalten: ein harter Umbruch (zwei Leerzeichen oder `\` am Zeilenende). */
  | { kind: 'paragraph'; text: string }
  /** Ein Punkt ist selbst eine Folge von Blöcken — so schachtelt eine Liste in einer Liste. */
  | { kind: 'list'; ordered: boolean; start: number; items: Block[][] }
  | { kind: 'table'; head: string[]; align: Align[]; rows: string[][] }
  | { kind: 'quote'; blocks: Block[] }
  | { kind: 'rule' };

const HEADING = /^(#{1,6})\s+(.*?)\s*#*\s*$/;
const RULE = /^\s{0,3}([-*_])(\s*\1){2,}\s*$/;
const ITEM = /^(\s*)([-*+]|\d{1,9}[.)])\s+(.*)$/;
const QUOTE = /^\s{0,3}>\s?(.*)$/;
const TABLE_SEP = /^\s*\|?\s*:?-{1,}:?\s*(\|\s*:?-{1,}:?\s*)*\|?\s*$/;

function indentOf(line: string): number {
  let n = 0;
  for (const c of line) {
    if (c === ' ') n += 1;
    else if (c === '\t') n += 4;
    else break;
  }
  return n;
}

function blank(line: string | undefined): boolean {
  return line === undefined || line.trim() === '';
}

/** Die Zellen einer Tabellenzeile. `\|` ist ein Strich im Text, kein Zellrand. */
export function splitRow(line: string): string[] {
  let s = line.trim();
  if (s.startsWith('|')) s = s.slice(1);
  if (s.endsWith('|') && !s.endsWith('\\|')) s = s.slice(0, -1);
  const cells: string[] = [];
  let cur = '';
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (c === '\\' && s[i + 1] === '|') {
      cur += '|';
      i++;
    } else if (c === '|') {
      cells.push(cur.trim());
      cur = '';
    } else cur += c;
  }
  cells.push(cur.trim());
  return cells;
}

function alignOf(cell: string): Align {
  const c = cell.trim();
  const l = c.startsWith(':');
  const r = c.endsWith(':');
  if (l && r) return 'center';
  if (r) return 'right';
  if (l) return 'left';
  return null;
}

/** Beginnt hier etwas anderes als Fliesstext? Dann endet der Absatz davor. */
function startsBlock(line: string, next: string | undefined): boolean {
  return (
    HEADING.test(line.trim()) ||
    RULE.test(line) ||
    ITEM.test(line) ||
    QUOTE.test(line) ||
    (line.includes('|') && next !== undefined && TABLE_SEP.test(next) && next.includes('-'))
  );
}

function paragraphText(lines: string[]): string {
  /* Ein einfacher Zeilenwechsel ist ein Leerzeichen (Markdown); zwei
     Leerzeichen oder ein `\` am Ende sind ein harter Umbruch. */
  let out = '';
  lines.forEach((raw, i) => {
    const last = i === lines.length - 1;
    const hard = /( {2,}|\\)$/.test(raw);
    const line = raw.replace(/( {2,}|\\)$/, '').trim();
    out += line;
    if (!last) out += hard ? '\n' : ' ';
  });
  return out;
}

function parseLines(lines: string[]): Block[] {
  const blocks: Block[] = [];
  let i = 0;
  while (i < lines.length) {
    const line = lines[i] ?? '';
    if (blank(line)) {
      i++;
      continue;
    }
    const trimmed = line.trim();

    const h = HEADING.exec(trimmed);
    if (h && indentOf(line) < 4) {
      blocks.push({ kind: 'heading', level: (h[1] ?? '#').length, text: h[2] ?? '' });
      i++;
      continue;
    }

    if (RULE.test(line)) {
      blocks.push({ kind: 'rule' });
      i++;
      continue;
    }

    if (QUOTE.test(line)) {
      const inner: string[] = [];
      while (i < lines.length && !blank(lines[i])) {
        const q = QUOTE.exec(lines[i] ?? '');
        inner.push(q ? (q[1] ?? '') : (lines[i] ?? ''));
        i++;
      }
      blocks.push({ kind: 'quote', blocks: parseLines(inner) });
      continue;
    }

    const next = lines[i + 1];
    if (line.includes('|') && next !== undefined && TABLE_SEP.test(next) && next.includes('-')) {
      const head = splitRow(line);
      const align = splitRow(next).map(alignOf);
      const rows: string[][] = [];
      i += 2;
      while (i < lines.length && !blank(lines[i]) && (lines[i] ?? '').includes('|')) {
        const cells = splitRow(lines[i] ?? '');
        /* Jede Zeile so breit wie der Kopf: eine kurze bekommt leere
           Zellen, eine lange verliert nichts — sie wird nur nicht breiter
           gezeichnet, als der Kopf sagt. */
        while (cells.length < head.length) cells.push('');
        rows.push(cells.slice(0, Math.max(head.length, 1)));
        i++;
      }
      while (align.length < head.length) align.push(null);
      blocks.push({ kind: 'table', head, align: align.slice(0, head.length), rows });
      continue;
    }

    const it = ITEM.exec(line);
    if (it) {
      const base = indentOf(line);
      const ordered = /\d/.test(it[2] ?? '');
      const start = ordered ? parseInt(it[2] ?? '1', 10) : 1;
      const items: Block[][] = [];
      while (i < lines.length) {
        const cur = lines[i] ?? '';
        const m = ITEM.exec(cur);
        if (!m || indentOf(cur) !== base || /\d/.test(m[2] ?? '') !== ordered) break;
        /* Was zum Punkt gehört: seine erste Zeile, dann alles, was tiefer
           eingerückt ist, und Fortsetzungszeilen ohne eigene Marke. */
        const body: string[] = [m[3] ?? ''];
        const inner = indentOf(cur) + (m[2] ?? '').length + 1;
        i++;
        while (i < lines.length) {
          const l = lines[i] ?? '';
          if (blank(l)) {
            /* Eine Leerzeile beendet den Punkt nur, wenn danach nichts
               Eingerücktes mehr kommt. */
            const after = lines[i + 1];
            if (after !== undefined && !blank(after) && indentOf(after) > base) {
              body.push('');
              i++;
              continue;
            }
            break;
          }
          if (indentOf(l) > base) {
            body.push(l.slice(Math.min(indentOf(l), inner)));
            i++;
            continue;
          }
          if (ITEM.test(l) || startsBlock(l, lines[i + 1])) break;
          body.push(l.trim());
          i++;
        }
        items.push(parseLines(body));
        if (blank(lines[i])) {
          /* Locker gesetzte Liste: eine Leerzeile zwischen zwei Punkten
             trennt sie nicht. */
          const after = lines[i + 1];
          const am = after !== undefined ? ITEM.exec(after) : null;
          if (am && indentOf(after ?? '') === base && /\d/.test(am[2] ?? '') === ordered) {
            i++;
            continue;
          }
        }
      }
      blocks.push({ kind: 'list', ordered, start, items });
      continue;
    }

    const para: string[] = [line];
    i++;
    while (i < lines.length && !blank(lines[i]) && !startsBlock(lines[i] ?? '', lines[i + 1])) {
      para.push(lines[i] ?? '');
      i++;
    }
    blocks.push({ kind: 'paragraph', text: paragraphText(para) });
  }
  return blocks;
}

/** Ein langes Textfeld als Blöcke. Leerer Text: keine Blöcke. */
export function parseMarkdown(text: string): Block[] {
  const source = String(text ?? '').replace(/\r\n?/g, '\n');
  return parseLines(source.split('\n'));
}

/** Der Inline-Text aller Blöcke, der Reihe nach — für Suche und Zusammenfassung. */
export function blockTexts(blocks: Block[]): string[] {
  const out: string[] = [];
  for (const b of blocks) {
    if (b.kind === 'heading' || b.kind === 'paragraph') out.push(b.text);
    else if (b.kind === 'list') for (const item of b.items) out.push(...blockTexts(item));
    else if (b.kind === 'quote') out.push(...blockTexts(b.blocks));
    else if (b.kind === 'table') out.push(...b.head, ...b.rows.flat());
  }
  return out;
}
