/**
 * Inline text: wikilinks, variable placeholders, dice and emphasis, parsed
 * into segments so a renderer never has to touch a regex or inject HTML.
 * Was zwischen den Zeilen steht — Listen, Tabellen, Überschriften — liest
 * `parseMarkdown` (markdown.ts) und gibt jede Zeile hierher (M10).
 *
 * Ein Verweis nennt die **Id** (`[[npc-0042|Volo]]`, M11): ein Name ist bei
 * zwei Ausgaben desselben Monsters mehrdeutig, eine ausgegebene Nummer nie.
 * `[[Volo]]` bleibt als Eingabe erlaubt; `idLinks` schreibt es beim
 * Speichern um, wenn genau ein Artikel so heisst.
 *
 * `{{1d6+2}}` ist ein Würfelausdruck (M12, REQ-070), `{{+4}}` ein Wurf auf
 * den W20. Im Ausdruck darf ein `{VAR}` stehen (`{{1d8+{STR}}}`) — er wird
 * zuerst aufgelöst. Was kein Ausdruck ist, bleibt stehen, wie es dasteht.
 *
 * `{VAR}` resolution order, highest first (REQ-174):
 *   1. the bindings on the reference that pulled this text in
 *   2. the entity's own `Vars` component
 *   3. the campaign register
 * An unresolved placeholder is returned intact, so it is visible rather than
 * silently blank — and, unlike the old app, never baked into the stored text.
 */

import { isDice } from './dice.js';
import { articleId, linkCandidates } from './entity.js';
import type { Entity } from './types.js';

/**
 * Emphasis is a flag rather than a segment kind, because markup nests:
 * `**{NAME}.**` is a bold *variable*, and a segment kind for bold would
 * swallow the placeholder and leave it unresolved.
 */
export interface Emphasis {
  bold?: boolean;
  italic?: boolean;
}

export type Segment =
  | ({ kind: 'text'; text: string } & Emphasis)
  | ({ kind: 'var'; name: string; text: string; resolved: boolean } & Emphasis)
  | ({ kind: 'link'; target: string; text: string } & Emphasis)
  /** `expr` ist der Ausdruck mit aufgelösten Platzhaltern — das, was gewürfelt wird. */
  | ({ kind: 'dice'; expr: string; text: string } & Emphasis);

const VAR = /\{([A-Z0-9_ÄÖÜ]+)\}/g;

/* Die Reihenfolge der Alternativen zählt: `{{…}}` vor `{VAR}`, sonst
   fände der Platzhalter das innere Paar, und `**` vor `*`. Kursiv beginnt
   und endet nicht mit einem Leerzeichen — „2 * 3 * 4" ist Rechnung. */
const PATTERN =
  /\[\[([^\]|]+)(?:\|([^\]]+))?\]\]|\{\{((?:[^{}]|\{[A-Z0-9_ÄÖÜ]+\})+)\}\}|\{([A-Z0-9_ÄÖÜ]+)\}|\*\*((?:[^*]|\*(?!\*))+?)\*\*|\*([^*\s](?:[^*]*[^*\s])?)\*/g;

export interface VarScopes {
  /** Bindings from the referencing edge. */
  reference?: Record<string, string> | undefined;
  /** The target entity's own defaults. */
  entity?: Record<string, string> | undefined;
  /** Campaign-wide register. */
  campaign?: Record<string, string> | undefined;
}

export function resolveVar(name: string, scopes: VarScopes): string | undefined {
  return scopes.reference?.[name] ?? scopes.entity?.[name] ?? scopes.campaign?.[name];
}

/** Every placeholder appearing in a piece of text, in order, without duplicates. */
export function varNames(text: string): string[] {
  const names = new Set<string>();
  for (const m of String(text ?? '').matchAll(VAR)) {
    if (m[1]) names.add(m[1]);
  }
  return [...names];
}

export function parseInline(
  text: string,
  scopes: VarScopes = {},
  emphasis: Emphasis | boolean = {},
): Segment[] {
  const source = String(text ?? '');
  const segments: Segment[] = [];
  /* `true` statt eines Objekts: die alte Unterschrift (`bold`). */
  const em: Emphasis = emphasis === true ? { bold: true } : emphasis === false ? {} : emphasis;
  const mark = <T extends Segment>(segment: T): T => ({ ...segment, ...em });
  let last = 0;

  for (const m of source.matchAll(PATTERN)) {
    const at = m.index ?? 0;
    if (at > last) segments.push(mark({ kind: 'text', text: source.slice(last, at) }));

    if (m[1] !== undefined) {
      segments.push(mark({ kind: 'link', target: m[1].trim(), text: (m[2] ?? m[1]).trim() }));
    } else if (m[3] !== undefined) {
      let offen = false;
      const expr = m[3]
        .replace(VAR, (roh, name: string) => {
          const v = resolveVar(name, scopes);
          if (v === undefined) offen = true;
          return v ?? roh;
        })
        .trim();
      /* Ein Ausdruck mit offenem Platzhalter oder einer, der keiner ist,
         wird nicht klickbar — er stünde sonst da und würfelte Unsinn. */
      if (!offen && isDice(expr)) segments.push(mark({ kind: 'dice', expr, text: expr }));
      else segments.push(mark({ kind: 'text', text: m[0] }));
    } else if (m[4] !== undefined) {
      const name = m[4];
      const value = resolveVar(name, scopes);
      segments.push(
        mark({ kind: 'var', name, text: value ?? `{${name}}`, resolved: value !== undefined }),
      );
    } else if (m[5] !== undefined) {
      // Recurse, so a placeholder or link inside emphasis still resolves.
      segments.push(...parseInline(m[5], scopes, { ...em, bold: true }));
    } else if (m[6] !== undefined) {
      segments.push(...parseInline(m[6], scopes, { ...em, italic: true }));
    }
    last = at + m[0].length;
  }
  if (last < source.length) segments.push(mark({ kind: 'text', text: source.slice(last) }));
  return segments;
}

/**
 * `[[Name]]` → `[[npc-0042|Name]]`, wo genau ein Artikel so heisst (M11).
 *
 * Läuft beim **Speichern**, nicht beim Lesen: die Id steht danach im Text
 * und überlebt das Umbenennen des Ziels. Ein Verweis, der schon eine Id
 * nennt, bleibt unberührt; einer, der nichts oder mehreres trifft, auch —
 * er wird in `open` zurückgegeben, damit die Maske es sagen kann. Ein
 * stiller Griff zum ersten Treffer wäre bei zwei Goblins der falsche.
 */
export function idLinks(
  text: string,
  entities: Iterable<Entity>,
): { text: string; open: string[] } {
  const source = String(text ?? '');
  const alle = [...entities];
  const open: string[] = [];
  const out = source.replace(
    /\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g,
    (roh, ziel: string, zeige: string | undefined) => {
      const target = ziel.trim();
      const treffer = linkCandidates(alle, target);
      if (treffer.length !== 1) {
        open.push(target);
        return roh;
      }
      const e = treffer[0] as Entity;
      const id = articleId(e) || e.id;
      if (id === target) return roh;
      return `[[${id}|${(zeige ?? ziel).trim()}]]`;
    },
  );
  return { text: out, open: [...new Set(open)] };
}

/** Flatten to plain text — for search indexes, list summaries and exports. */
export function plainText(text: string, scopes: VarScopes = {}): string {
  return parseInline(text, scopes)
    .map((s) => s.text)
    .join('');
}
