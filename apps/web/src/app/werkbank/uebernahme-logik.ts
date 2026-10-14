/**
 * Die Übernahme dev ↔ prod als Daten (T-130): aus dem Formular der
 * Auftrag, aus der Vorschau die Gruppen nach Ebene, Art und Artikel, und
 * was vor dem Lauf noch offen ist.
 *
 * Getrennt von der Seite, damit es ohne DOM prüfbar ist. Gerechnet wird am
 * Server (`uebernahme.ts` im Modell) — hier wird nur geordnet und gezählt.
 */

import type { TransferEintrag, TransferFeld } from '../kern/api';

export interface UebernahmeFormular {
  direction: 'push' | 'pull';
  type: string;
  layer: string;
  tag: string;
  ids: string;
  /** `interfaces:Spell` …, durch Komma oder Zeile getrennt. */
  registry: string;
  dependencies: boolean;
}

export function leeresUebernahmeFormular(): UebernahmeFormular {
  return { direction: 'push', type: '', layer: '', tag: '', ids: '', registry: '', dependencies: false };
}

const liste = (text: string) =>
  text
    .split(/[\n,]+/)
    .map((x) => x.trim())
    .filter(Boolean);

/** Der Auftrag, wie `POST /api/transfer/preview` ihn liest. */
export function uebernahmeAuftrag(f: UebernahmeFormular): {
  direction: 'push' | 'pull';
  select?: { ids?: string[]; types?: string[]; layer?: string; tag?: string };
  registry?: string[];
  dependencies?: boolean;
} {
  const select: { ids?: string[]; types?: string[]; layer?: string; tag?: string } = {};
  const ids = liste(f.ids);
  if (ids.length) select.ids = ids;
  if (f.type) select.types = [f.type];
  if (f.layer) select.layer = f.layer;
  if (f.tag.trim()) select.tag = f.tag.trim();
  const registry = liste(f.registry);
  return {
    direction: f.direction,
    ...(Object.keys(select).length ? { select } : {}),
    ...(registry.length ? { registry } : {}),
    ...(f.dependencies ? { dependencies: true } : {}),
  };
}

/** Sagt, warum der Auftrag nichts träfe — oder `null`. */
export function uebernahmeFehlt(f: UebernahmeFormular): string | null {
  const a = uebernahmeAuftrag(f);
  if (!a.select && !a.registry) return 'Choose articles (type, layer, tag or ids) or registry rows.';
  return null;
}

/** Wird ein Eintrag von sich aus übernommen? Was nichts ändert, nicht. */
export function vorgewaehlt(e: TransferEintrag): boolean {
  return e.status === 'new' || e.status === 'changed' || e.status === 'conflict';
}

export interface Gruppe {
  ebene: string;
  arten: { art: string; eintraege: TransferEintrag[] }[];
  zahl: number;
}

/**
 * **Nach Ebene, Art und Artikel** (die Vorgabe der Leitung). Ein Artikel in
 * zwei Ebenen steht unter der ersten; Registerzeilen unter „Registry".
 */
export function gruppieren(items: TransferEintrag[]): Gruppe[] {
  const ebenen = new Map<string, Map<string, TransferEintrag[]>>();
  for (const e of items) {
    const ebene = e.kind === 'registry' ? 'Registry' : (e.layers[0] ?? 'No layer');
    const arten = ebenen.get(ebene) ?? ebenen.set(ebene, new Map()).get(ebene)!;
    (arten.get(e.type) ?? arten.set(e.type, []).get(e.type)!).push(e);
  }
  const rang = (n: string) => (n === 'Registry' ? '2' : n === 'No layer' ? '1' : `0${n}`);
  return [...ebenen]
    .sort(([a], [b]) => rang(a).localeCompare(rang(b)))
    .map(([ebene, arten]) => ({
      ebene,
      arten: [...arten]
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([art, eintraege]) => ({ art, eintraege: [...eintraege].sort((x, y) => x.name.localeCompare(y.name)) })),
      zahl: [...arten.values()].reduce((n, l) => n + l.length, 0),
    }));
}

/** Eine Wahl je Konfliktfeld: Quelle, Ziel oder ein Wert von Hand (als Text). */
export type Wahl = { art: 'source' } | { art: 'target' } | { art: 'hand'; text: string };

/** Die Konflikte gewählter Einträge, die noch keine Wahl haben. */
export function offeneKonflikte(items: TransferEintrag[], gewaehlt: ReadonlySet<string>, wahl: ReadonlyMap<string, Wahl>): number {
  let n = 0;
  for (const e of items) {
    if (!gewaehlt.has(e.id)) continue;
    for (const f of e.fields) if (f.state === 'conflict' && !wahl.has(`${e.id}\u0000${f.key}`)) n += 1;
  }
  return n;
}

/** Ein Wert von Hand: JSON, wenn es eines ist, sonst der Text. */
export function vonHand(text: string): unknown {
  const t = text.trim();
  if (!t) return null;
  try {
    return JSON.parse(t);
  } catch {
    return text;
  }
}

/** Der Lauf: Auftrag, Auswahl, Lösungen, und der Stand der Vorschau. */
export function uebernahmeLauf(
  auftrag: ReturnType<typeof uebernahmeAuftrag>,
  items: TransferEintrag[],
  gewaehlt: ReadonlySet<string>,
  wahl: ReadonlyMap<string, Wahl>,
) {
  const choices: Record<string, Record<string, unknown>> = {};
  for (const [k, w] of wahl) {
    const [id, key] = k.split('\u0000') as [string, string];
    if (!gewaehlt.has(id)) continue;
    (choices[id] ??= {})[key] = w.art === 'hand' ? { value: vonHand(w.text) } : w.art;
  }
  const apply = items.filter((e) => gewaehlt.has(e.id));
  return {
    ...auftrag,
    apply: apply.map((e) => e.id),
    choices,
    expect: Object.fromEntries(apply.map((e) => [e.id, [e.sourceKey, e.targetKey]])),
  };
}

/** Ein Wert zum Lesen: Text wie er ist, eine Kante als `art → ziel`, sonst JSON. */
export function zeigeWert(f: Pick<TransferFeld, 'kind'>, v: unknown): string {
  if (v === undefined) return '—';
  if (typeof v === 'string') return v;
  if (f.kind === 'edge' && v && typeof v === 'object') {
    const k = v as { type?: string; to?: string; props?: object };
    return `${k.type} → ${k.to}${k.props && Object.keys(k.props).length ? ` ${JSON.stringify(k.props)}` : ''}`;
  }
  return JSON.stringify(v, null, 1);
}

/** Wie ein Feld heisst: `Description.description`, `edge:…` als „Edge …". */
export function feldName(f: Pick<TransferFeld, 'key' | 'kind'>): string {
  if (f.kind === 'types') return 'Types';
  if (f.kind === 'adhoc') return 'Extra fields';
  if (f.kind === 'edge') return `Edge ${f.key.slice(5)}`;
  if (f.key === 'row') return 'Row';
  return f.key;
}

export const STATUS_TEXT: Record<TransferEintrag['status'], string> = {
  new: 'new',
  changed: 'changed',
  unchanged: 'unchanged',
  conflict: 'conflict',
  'target-ahead': 'only the target changed',
};
