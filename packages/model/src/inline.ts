/**
 * Inline text: wikilinks, variable placeholders and bold, parsed into segments
 * so a renderer never has to touch a regex or inject HTML.
 *
 * `{VAR}` resolution order, highest first (REQ-174):
 *   1. the bindings on the reference that pulled this text in
 *   2. the entity's own `Vars` component
 *   3. the campaign register
 * An unresolved placeholder is returned intact, so it is visible rather than
 * silently blank — and, unlike the old app, never baked into the stored text.
 */

/**
 * Emphasis is a flag rather than a segment kind, because markup nests:
 * `**{NAME}.**` is a bold *variable*, and a segment kind for bold would
 * swallow the placeholder and leave it unresolved.
 */
export type Segment =
  | { kind: 'text'; text: string; bold?: boolean }
  | { kind: 'var'; name: string; text: string; resolved: boolean; bold?: boolean }
  | { kind: 'link'; target: string; text: string; bold?: boolean };

const PATTERN = /\[\[([^\]|]+)(?:\|([^\]]+))?\]\]|\{([A-Z0-9_ÄÖÜ]+)\}|\*\*([^*]+)\*\*/g;

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
  for (const m of String(text ?? '').matchAll(/\{([A-Z0-9_ÄÖÜ]+)\}/g)) {
    if (m[1]) names.add(m[1]);
  }
  return [...names];
}

export function parseInline(text: string, scopes: VarScopes = {}, bold = false): Segment[] {
  const source = String(text ?? '');
  const segments: Segment[] = [];
  const mark = <T extends Segment>(segment: T): T => (bold ? { ...segment, bold: true } : segment);
  let last = 0;

  for (const m of source.matchAll(PATTERN)) {
    const at = m.index ?? 0;
    if (at > last) segments.push(mark({ kind: 'text', text: source.slice(last, at) }));

    if (m[1] !== undefined) {
      segments.push(mark({ kind: 'link', target: m[1].trim(), text: (m[2] ?? m[1]).trim() }));
    } else if (m[3] !== undefined) {
      const name = m[3];
      const value = resolveVar(name, scopes);
      segments.push(
        mark({ kind: 'var', name, text: value ?? `{${name}}`, resolved: value !== undefined }),
      );
    } else if (m[4] !== undefined) {
      // Recurse, so a placeholder or link inside emphasis still resolves.
      segments.push(...parseInline(m[4], scopes, true));
    }
    last = at + m[0].length;
  }
  if (last < source.length) segments.push(mark({ kind: 'text', text: source.slice(last) }));
  return segments;
}

/** Flatten to plain text — for search indexes, list summaries and exports. */
export function plainText(text: string, scopes: VarScopes = {}): string {
  return parseInline(text, scopes)
    .map((s) => s.text)
    .join('');
}
