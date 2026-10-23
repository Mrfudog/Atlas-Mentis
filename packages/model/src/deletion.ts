/**
 * **Was aus einer Auswahl gelöscht wird** (T-381).
 *
 * Gelöscht wird nur, was in der Ebene liegt, in der das Konto gerade
 * arbeitet — seiner **Schreibebene** (T-161), also dort, wo es auch
 * anlegen würde — und was es schreiben darf. Alles andere aus der
 * Auswahl wird **abgewählt**, nicht verweigert: wer zwanzig Bilder
 * markiert, von denen drei aus dem Regelwerk kommen, will die siebzehn
 * eigenen los sein und nicht über die drei streiten.
 *
 * Die Verwaltung legt ohne gewählte Schreibebene ausserhalb jeder Ebene
 * an; dann löscht sie auch dort (`unlayered`). Ebenen und Kampagnen gehen
 * hier nie — sie haben ihre eigenen Wege (Ebene leeren, Kampagnenseite),
 * weil an ihnen mehr hängt als ein Artikel.
 *
 * Rein: wer was darf (`mayWrite`) und was sichtbar ist (`visible`),
 * rechnet der Aufrufer — am Server mit derselben Siebung wie jede Route.
 */

import { entityName, primaryInterface } from './entity.js';
import { LAYER_TYPES } from './stack.js';
import type { Entity, EntityId } from './types.js';
import { layersOf } from './versions.js';
import { CAMPAIGN_TYPE } from './visibility.js';

/** Warum ein Artikel abgewählt wurde. */
export type DeselectReason = 'other-layer' | 'not-writable' | 'not-found' | 'protected';

export interface DeselectedArticle {
  id: EntityId;
  name: string;
  reason: DeselectReason;
  /** Die Ebenen, in denen er liegt — damit die Meldung sagen kann, wohin man wechseln müsste. */
  layers?: EntityId[];
}

export interface DeletePick {
  /** Was gelöscht wird, in der Reihenfolge der Auswahl. */
  ids: EntityId[];
  deselected: DeselectedArticle[];
}

export interface DeletePickOptions {
  /** Die Ebene, in der gerade gearbeitet wird; `null`: keine (nur mit `unlayered`). */
  layer: EntityId | null;
  /** Auch Artikel ohne Ebene — die Verwaltung ohne gewählte Schreibebene. */
  unlayered?: boolean;
  /** Ob das Konto diesen Artikel schreiben darf (`mayWrite`). */
  mayWrite: (id: EntityId) => boolean;
  /** Ob das Konto ihn überhaupt sieht; ein unsichtbarer heisst „not-found", nie „other-layer". */
  visible?: (id: EntityId) => boolean;
}

/** Arten, die über diese Auswahl nie gelöscht werden. */
const GESCHUETZT = new Set([...LAYER_TYPES, CAMPAIGN_TYPE]);

/**
 * Teilt die Auswahl in „wird gelöscht" und „wird abgewählt". Doppelte Ids
 * zählen einmal. Die Ebene ist die erste Frage, das Schreibrecht die
 * zweite: wer in seiner Ebene etwas nicht schreiben darf (ein Artikel, der
 * zugleich im geteilten Regelwerk liegt), bekommt `not-writable`.
 */
export function pickDeletable(entities: Map<EntityId, Entity>, ids: readonly EntityId[], opts: DeletePickOptions): DeletePick {
  const raus: EntityId[] = [];
  const deselected: DeselectedArticle[] = [];
  const gesehen = new Set<EntityId>();
  for (const id of ids) {
    if (gesehen.has(id)) continue;
    gesehen.add(id);
    const e = entities.get(id);
    if (!e || (opts.visible && !opts.visible(id))) {
      deselected.push({ id, name: id, reason: 'not-found' });
      continue;
    }
    const name = entityName(e) || id;
    if (GESCHUETZT.has(primaryInterface(e))) {
      deselected.push({ id, name, reason: 'protected' });
      continue;
    }
    const layers = layersOf(e);
    const hier = layers.length ? opts.layer !== null && layers.includes(opts.layer) : !!opts.unlayered;
    if (!hier) {
      deselected.push({ id, name, reason: 'other-layer', layers });
      continue;
    }
    if (!opts.mayWrite(id)) {
      deselected.push({ id, name, reason: 'not-writable', layers });
      continue;
    }
    raus.push(id);
  }
  return { ids: raus, deselected };
}

/** Die Meldung nach dem Löschen: „3 deleted, 2 from other layers deselected". */
export function deleteSummary(deleted: number, deselected: readonly DeselectedArticle[]): string {
  const teile = [`${deleted} deleted`];
  const zaehle = (r: DeselectReason) => deselected.filter((d) => d.reason === r).length;
  const fremd = zaehle('other-layer');
  const nicht = zaehle('not-writable') + zaehle('protected');
  const weg = zaehle('not-found');
  if (fremd) teile.push(`${fremd} from other layers deselected`);
  if (nicht) teile.push(`${nicht} you cannot delete deselected`);
  if (weg) teile.push(`${weg} no longer there`);
  return teile.join(', ');
}
