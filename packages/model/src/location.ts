/**
 * **Wo ein Artikel steht** (T-330): der Ort, an dem er liegt, und die
 * grösseren Orte darüber — für „Group by Location“ in der Kartenliste und
 * im Kompendium.
 *
 * Heute steht eine **Karte** über `mapOf` an einem Ort; ein Ort liegt über
 * `partOf` in einem grösseren, bis zum obersten. Eine Unterkarte ohne
 * eigenen Ort liegt, wo ihre Karte liegt (`insideMap`) — wer in den Hafen
 * hineinzoomt, ist noch in der Stadt.
 *
 * **Ein allgemeines `locatedIn` kommt erst mit T-331** (E-120 offen). Damit
 * es ohne Umbau dazukommt, stehen die Kanten als Listen da
 * (`LOCATION_RELATIONS`, `PLACE_PARENT_RELATIONS`): die neue Kante ist ein
 * Eintrag, keine zweite Rechnung.
 *
 * Ein Ort ist, was `Place` in seiner `extends`-Kette trägt (ein Laden ist
 * einer). Eine Geschichte, die eine Karte darstellt (`mapOf` → Story), ist
 * kein Standort. Kein Framework; ungesiebt — wer fragt, siebt danach.
 */

import { primaryInterface, typeChain } from './entity.js';
import { INSIDE_MAP_RELATION, MAP_OF_RELATION } from './map.js';
import type { Entity, Registry } from './types.js';

/** Die Art, deren Artikel Orte sind. */
export const PLACE_TYPE = 'Place';

/** Kanten, über die ein Artikel an einem Ort steht — heute die Karte (`mapOf`); `locatedIn` (T-331) kommt hier dazu. */
export const LOCATION_RELATIONS: readonly string[] = [MAP_OF_RELATION];

/** Kanten, über die ein Ort in einem grösseren liegt. */
export const PLACE_PARENT_RELATIONS: readonly string[] = ['partOf'];

/** Ist der Artikel ein Ort (`Place` oder ein Untertyp)? */
export function isPlace(registry: Pick<Registry, 'interfaces'>, e: Entity | undefined): boolean {
  return !!e && typeChain(registry, primaryInterface(e)).includes(PLACE_TYPE);
}

/** Der erste Ort, auf den eine der Kanten zeigt. */
function ersterOrt(
  registry: Pick<Registry, 'interfaces'>,
  e: Entity,
  kanten: readonly string[],
  byId: ReadonlyMap<string, Entity>,
): Entity | undefined {
  for (const r of e.relations ?? []) {
    if (!kanten.includes(r.type) || !r.to || r.to === e.id) continue;
    const ziel = byId.get(r.to);
    if (isPlace(registry, ziel)) return ziel;
  }
  return undefined;
}

/**
 * **Der Standort als Weg**, der nächste Ort zuerst, dann die grösseren:
 * `['place-0007' (Docks), 'place-0003' (Waterdeep), 'place-0001' (Sword Coast)]`.
 * Leer, wenn der Artikel an keinem Ort steht. Ein Kreis oder ein Ort, den
 * `byId` nicht hat (nicht sichtbar), beendet den Weg.
 */
export function locationPath(
  registry: Pick<Registry, 'interfaces'>,
  e: Entity,
  byId: ReadonlyMap<string, Entity>,
): string[] {
  let ort = ersterOrt(registry, e, LOCATION_RELATIONS, byId);
  /* Eine Unterkarte ohne eigenen Ort liegt, wo ihre Karte liegt. */
  const karten = new Set([e.id]);
  let jetzt = e;
  while (!ort) {
    const oben = (jetzt.relations ?? []).find((r) => r.type === INSIDE_MAP_RELATION && r.to)?.to;
    const karte = oben ? byId.get(oben) : undefined;
    if (!karte || karten.has(karte.id)) break;
    karten.add(karte.id);
    jetzt = karte;
    ort = ersterOrt(registry, karte, LOCATION_RELATIONS, byId);
  }
  const weg: string[] = [];
  while (ort && !weg.includes(ort.id)) {
    weg.push(ort.id);
    ort = ersterOrt(registry, ort, PLACE_PARENT_RELATIONS, byId);
  }
  return weg;
}
