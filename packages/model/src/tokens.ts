/**
 * **Design-Tokens** (T-425, REQ-437, E-170 a).
 *
 * Eine Farbe steht einmal, als Registerzeile mit Rolle und je einem Wert
 * hell und dunkel; ein Element nennt an seinen Stellen (Kopf, Fläche,
 * Rahmen, Text) ein Token, nie einen Farbcode. So bleibt der dunkle Modus
 * beim Gestalten nicht auf der Strecke, und der Kontrast lässt sich
 * prüfen, bevor jemand einen roten Kopf auf rotem Grund speichert.
 *
 * Gezeichnet wird über CSS-Variablen (`--tok-<name>`, `tokenVars`), die
 * die Oberfläche je Modus setzt.
 */

import type { ElementStyle, LayoutElement, Registry, TokenSlot, ViewDef } from './types.js';

/** Die Stellen eines Elements, an denen ein Token stehen darf. */
export const TOKEN_SLOTS: readonly TokenSlot[] = ['head', 'surface', 'frame', 'text'];

/**
 * Unter diesem Verhältnis ist etwas auf seiner Fläche schwer zu erkennen
 * (WCAG AA): Text 4.5, ein Akzent — Knopf, Marke, grosse Überschrift — 3.
 */
export const MIN_CONTRAST = { text: 4.5, accent: 3 } as const;

function kanal(c: number): number {
  const v = c / 255;
  return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
}

function hell(hex: string): number | null {
  const m = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return null;
  const h = m[1]!.length === 3 ? [...m[1]!].map((x) => x + x).join('') : m[1]!;
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16)) as [number, number, number];
  return 0.2126 * kanal(r) + 0.7152 * kanal(g) + 0.0722 * kanal(b);
}

/** Das Kontrastverhältnis zweier Farben (1 bis 21); `null`, wo eine kein Hex-Wert ist. */
export function contrastRatio(a: string, b: string): number | null {
  const la = hell(a);
  const lb = hell(b);
  if (la === null || lb === null) return null;
  const [hi, lo] = la > lb ? [la, lb] : [lb, la];
  return (hi + 0.05) / (lo + 0.05);
}

/** Ein Text oder Akzent, der auf seiner Fläche zu schwach steht. */
export interface TokenContrastIssue {
  token: string;
  on: string;
  mode: 'light' | 'dark';
  ratio: number;
}

/**
 * **Der Kontrast der Tokens** (E-170): jeder Text und jeder Akzent gegen die
 * Fläche, auf der er stehen soll (`on`, sonst `paper`), hell und dunkel.
 * Was sich nicht rechnen lässt (eine Farbe mit Transparenz), wird nicht
 * gemeldet — besser keine Meldung als eine falsche.
 */
export function tokenContrast(registry: Pick<Registry, 'tokens'>): TokenContrastIssue[] {
  const t = registry.tokens ?? {};
  const raus: TokenContrastIssue[] = [];
  for (const [name, def] of Object.entries(t)) {
    if (def.role !== 'text' && def.role !== 'accent') continue;
    const on = def.on ?? 'paper';
    const flaeche = t[on];
    if (!flaeche || on === name) continue;
    for (const mode of ['light', 'dark'] as const) {
      const ratio = contrastRatio(def[mode], flaeche[mode]);
      if (ratio !== null && ratio < MIN_CONTRAST[def.role]) raus.push({ token: name, on, mode, ratio: Math.round(ratio * 100) / 100 });
    }
  }
  return raus;
}

/** Je Token eine CSS-Variable `--tok-<name>` mit dem Wert des Modus. */
export function tokenVars(registry: Pick<Registry, 'tokens'>, mode: 'light' | 'dark'): Record<string, string> {
  return Object.fromEntries(Object.entries(registry.tokens ?? {}).map(([name, def]) => [`--tok-${name}`, def[mode]]));
}

/**
 * **Welche Tokens ein Element trägt**: die Vorgabe der Ansicht für seine
 * Elementart (`ViewDef.styles`), darüber je Stelle das Element selbst. Ein
 * Token, das es nicht (mehr) gibt, gilt nicht — die Stelle zeichnet dann
 * wie ohne Angabe, statt eine leere Variable zu setzen.
 */
export function elementStyle(registry: Pick<Registry, 'tokens'>, view: Pick<ViewDef, 'styles'> | undefined, el: Pick<LayoutElement, 'el' | 'style'>): ElementStyle {
  const t = registry.tokens ?? {};
  const raus: ElementStyle = {};
  for (const quelle of [view?.styles?.[el.el], el.style]) {
    for (const slot of TOKEN_SLOTS) {
      const name = quelle?.[slot];
      if (name && t[name]) raus[slot] = name;
    }
  }
  return raus;
}

/** Die Tokens, die eine Ansicht schon nutzt — die Auswahl im Designer zeigt sie zuerst (E-170). */
export function usedTokens(layout: readonly LayoutElement[], view?: Pick<ViewDef, 'styles'>): string[] {
  const raus = new Set<string>();
  for (const s of Object.values(view?.styles ?? {})) for (const v of Object.values(s)) if (v) raus.add(v);
  const geh = (l: readonly LayoutElement[]): void =>
    l.forEach((e) => {
      for (const v of Object.values(e.style ?? {})) if (v) raus.add(v);
      if (e.children) geh(e.children);
      for (const tab of e.tabs ?? []) geh(tab.layout);
    });
  geh(layout);
  return [...raus];
}

/**
 * **Die Vorgabe der Ansicht in die Elemente** (E-170): je Elementart, was
 * `ViewDef.styles` sagt, darunter, was das Element selbst sagt — auch in
 * Behältern und Reitern. Danach braucht ein Zeichner nur noch `el.style`.
 */
export function withViewStyles(layout: readonly LayoutElement[], view: Pick<ViewDef, 'styles'> | undefined): LayoutElement[] {
  const vorgabe = view?.styles;
  if (!vorgabe || !Object.keys(vorgabe).length) return layout as LayoutElement[];
  const geh = (l: readonly LayoutElement[]): LayoutElement[] =>
    l.map((el) => {
      const v = vorgabe[el.el];
      const neu: LayoutElement = v ? { ...el, style: { ...v, ...(el.style ?? {}) } } : { ...el };
      if (el.children) neu.children = geh(el.children);
      if (el.tabs) neu.tabs = el.tabs.map((t) => ({ ...t, layout: geh(t.layout) }));
      return neu;
    });
  return geh(layout);
}
