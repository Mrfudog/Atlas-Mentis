/**
 * Das Formular der Massenänderung als Daten (W9) — und daraus der Auftrag,
 * den `POST /api/bulk` liest.
 *
 * Getrennt von der Seite, damit es ohne DOM prüfbar ist, und damit die
 * Seite nichts weiss, was der Server nicht auch weiss: Auswahl und
 * Operationen haben dieselben Namen wie in `bulk.ts`.
 */

import type { BulkOp, BulkRequest, ConditionOp } from '@nw/model';

export type OpArt = BulkOp['op'];

export interface Bedingung {
  field: string;
  op: ConditionOp;
  value: string;
}

export interface Formular {
  type: string;
  layer: string;
  tag: string;
  ids: string;
  where: Bedingung[];
  op: OpArt;
  field: string;
  value: string;
  opTag: string;
  relType: string;
  relTo: string;
  mode: 'variant' | 'delete';
  by: 'name' | 'content';
  keep: string;
}

export const OPS: { op: OpArt; label: string }[] = [
  { op: 'set', label: 'Set field' },
  { op: 'unset', label: 'Empty field' },
  { op: 'addTag', label: 'Add tag' },
  { op: 'removeTag', label: 'Remove tag' },
  { op: 'addRelation', label: 'Add edge' },
  { op: 'removeRelation', label: 'Remove edge' },
  { op: 'merge', label: 'Merge duplicates' },
];

export const BEDINGUNGEN: { op: ConditionOp; label: string; ohneWert?: boolean }[] = [
  { op: 'eq', label: 'is' },
  { op: 'ne', label: 'is not' },
  { op: 'contains', label: 'contains' },
  { op: 'startsWith', label: 'starts with' },
  { op: 'endsWith', label: 'ends with' },
  { op: 'in', label: 'is one of (a, b)' },
  { op: 'matches', label: 'matches (regex)' },
  { op: 'empty', label: 'is empty', ohneWert: true },
  { op: 'notEmpty', label: 'is not empty', ohneWert: true },
];

export function leeresFormular(): Formular {
  return {
    type: '',
    layer: '',
    tag: '',
    ids: '',
    where: [{ field: 'name', op: 'contains', value: '' }],
    op: 'set',
    field: '',
    value: '',
    opTag: '',
    relType: '',
    relTo: '',
    mode: 'delete',
    by: 'content',
    keep: '',
  };
}

/** Ids aus einem Textfeld: getrennt durch Leerraum, Komma oder Zeilen. */
export function idsAus(text: string): string[] {
  return [...new Set(text.split(/[\s,;]+/).map((x) => x.trim()).filter(Boolean))];
}

/** Der Auftrag, wie ihn der Server liest — ohne leere Teile. */
export function auftragAus(f: Formular): Pick<BulkRequest, 'select' | 'ops'> {
  const select: BulkRequest['select'] = {};
  if (f.type) select.types = [f.type];
  if (f.layer.trim()) select.layer = f.layer.trim();
  if (f.tag.trim()) select.tag = f.tag.trim();
  const ids = idsAus(f.ids);
  if (ids.length) select.ids = ids;
  const ohneWert = new Set(BEDINGUNGEN.filter((b) => b.ohneWert).map((b) => b.op));
  const where = f.where
    .filter((w) => w.field.trim() && (ohneWert.has(w.op) || w.value.trim() !== ''))
    .map((w) => (ohneWert.has(w.op) ? { field: w.field.trim(), op: w.op } : { field: w.field.trim(), op: w.op, value: w.value }));
  if (where.length) select.where = where;

  let op: BulkOp;
  switch (f.op) {
    case 'set':
      op = { op: 'set', field: f.field.trim(), value: f.value };
      break;
    case 'unset':
      op = { op: 'unset', field: f.field.trim() };
      break;
    case 'addTag':
    case 'removeTag':
      op = { op: f.op, tag: f.opTag.trim() };
      break;
    case 'addRelation':
      op = { op: 'addRelation', type: f.relType, to: f.relTo.trim() };
      break;
    case 'removeRelation':
      op = f.relTo.trim() ? { op: 'removeRelation', type: f.relType, to: f.relTo.trim() } : { op: 'removeRelation', type: f.relType };
      break;
    case 'merge':
      op = { op: 'merge', mode: f.mode, by: f.by, ...(f.keep.trim() ? { keep: f.keep.trim() } : {}) };
      break;
  }
  return { select, ops: [op] };
}

/** Was am Formular noch fehlt, bevor eine Vorschau Sinn ergibt — oder `null`. */
export function formularFehlt(f: Formular): string | null {
  const a = auftragAus(f);
  if (!a.select.types && !a.select.layer && !a.select.tag && !a.select.ids && !a.select.where) {
    return 'Choose which articles: a type, a layer, a tag, ids or a condition.';
  }
  const op = a.ops[0]!;
  if ((op.op === 'set' || op.op === 'unset') && !op.field) return 'Which field? name or Card.field.';
  if ((op.op === 'addTag' || op.op === 'removeTag') && !op.tag) return 'Which tag?';
  if ((op.op === 'addRelation' || op.op === 'removeRelation') && !op.type) return 'Which edge type?';
  if (op.op === 'addRelation' && !op.to) return 'Edge to which article?';
  return null;
}
