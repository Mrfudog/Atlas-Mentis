/**
 * **Karten finden und anlegen** (T-202): eine Karte aus einem Bild, die
 * Kartenliste als Baum und wo eine Karte vorkommt.
 *
 * Eine Karte ist ein Artikel der Art `Map`, ihr Bild ein Asset-Artikel mit
 * der Klasse `map` (T-119). Wer ein Kartenbild hochgeladen hat, hat damit
 * noch keine Karte — „Map on the table“ an der Sitzung nimmt nur Karten.
 * Damit das Bild trotzdem dort wählbar ist, ohne dass jemand erst einen
 * Artikel anlegen muss, sagt dieses Modul, **welche Bildklasse zu welcher
 * Art wird** — gelesen aus `targets['Image.image']` am Typ und nicht aus
 * einer Liste im Code — und wie der Artikel dazu aussieht.
 *
 * Kein Framework: die Auswahl im Web, die Kartenliste und „Use as map“ am
 * Bild (T-201) rechnen gleich.
 */

import { offeredAssetKind, assetUses } from './assets.js';
import { entityName, fieldTarget } from './entity.js';
import { INSIDE_MAP_RELATION, isMap, MAP_OF_RELATION, MAP_TYPE, parentMapRelation } from './map.js';
import type { Entity, Registry } from './types.js';

/**
 * **Welche Bildklasse zu welcher Art wird** (T-202): je genannter Art, deren
 * Bild (`Image.image`) eine Klasse anbietet (`targets` am Typ, die
 * `extends`-Kette hoch), diese Klasse. Heute ist das die Karte mit `map`;
 * bekommt eine andere Art ein Bild mit Klasse, kommt sie ohne Codeänderung
 * dazu.
 */
export function imageBecomes(
  registry: Pick<Registry, 'interfaces'>,
  types: readonly string[],
): { type: string; kind: string }[] {
  const raus: { type: string; kind: string }[] = [];
  for (const type of types) {
    if (!registry.interfaces[type]) continue;
    const kind = offeredAssetKind(fieldTarget(registry, type, { type: 'Image', key: 'image', prop: { type: 'string' } }));
    if (kind) raus.push({ type, kind });
  }
  return raus;
}

/** Der Name eines Bildes ohne Dateiendung — „Harbour.webp“ heisst als Karte „Harbour“. */
export function imageTitle(asset: Entity): string {
  const roh = asset.name || asset.components?.['Identity']?.['name'];
  const name = typeof roh === 'string' ? roh.trim() : '';
  const ohne = name.replace(/\.(png|jpe?g|webp|gif|svg|avif|bmp|tiff?)$/i, '').trim();
  return ohne || name || asset.id;
}

/** Was `POST /api/entities` braucht, um einen Artikel dieser Art aus einem Bild anzulegen. */
export interface FromImage {
  type: string;
  name: string;
  fields: Record<string, unknown>;
}

/**
 * **Ein Artikel aus einem Bild** (T-202): Name aus dem Bild, das Bild als
 * `Image.image`. Die Ebene nennt der Aufruf nicht — angelegt wird in der
 * Schreibebene, wie bei jedem Anlegen (T-161).
 */
export function fromImage(type: string, asset: Entity): FromImage {
  return { type, name: imageTitle(asset), fields: { 'Image.image': asset.id } };
}

/**
 * **Eine Karte aus einem Bild** (T-202, T-201: „Use as map“). Raster und
 * Massstab bleiben bei den Vorgaben des Registers; eingestellt wird an der
 * Karte.
 */
export function mapFromImage(asset: Entity): FromImage {
  return fromImage(MAP_TYPE, asset);
}

/** Eine Zeile der Kartenliste: die Karte, ihre Tiefe und die Karte darüber. */
export interface MapRow {
  map: Entity;
  depth: number;
  parent: string | null;
}

/**
 * **Die Kartenliste als Baum** (T-202): jede Karte unter der, in der sie
 * liegt (`insideMap`), eingerückt; je Stufe nach Namen. Eine Karte, deren
 * Obere nicht in der Liste steht (nicht sichtbar, nicht im Stapel), steht
 * oben — sonst fände man sie gar nicht. Ein Kreis bricht ab und lässt den
 * Rest oben stehen.
 */
export function mapTree(maps: readonly Entity[]): MapRow[] {
  const byId = new Map(maps.filter(isMap).map((m) => [m.id, m]));
  const kinder = new Map<string | null, Entity[]>();
  for (const m of byId.values()) {
    const oben = parentMapRelation(m)?.to;
    const key = oben && oben !== m.id && byId.has(oben) ? oben : null;
    (kinder.get(key) ?? kinder.set(key, []).get(key)!).push(m);
  }
  const nachName = (a: Entity, b: Entity) => entityName(a).localeCompare(entityName(b), 'de') || a.id.localeCompare(b.id);
  const raus: MapRow[] = [];
  const gesehen = new Set<string>();
  const gehe = (oben: string | null, depth: number): void => {
    for (const m of [...(kinder.get(oben) ?? [])].sort(nachName)) {
      if (gesehen.has(m.id)) continue;
      gesehen.add(m.id);
      raus.push({ map: m, depth, parent: oben });
      gehe(m.id, depth + 1);
    }
  };
  gehe(null, 0);
  /* Was in einem Kreis hängt, hat keine Wurzel — es steht oben. */
  for (const m of [...byId.values()].sort(nachName)) {
    if (gesehen.has(m.id)) continue;
    gesehen.add(m.id);
    raus.push({ map: m, depth: 0, parent: null });
    gehe(m.id, 1);
  }
  return raus;
}

/**
 * **Der Sitzungszustand eines Artikels** (`activeMap`, `activeEncounter`
 * …): gespeichert wird eine Karte je Art, die die Felder erklärt — an der
 * Sitzung also `Session`; ältere Bestände tragen `SessionState`. Beide
 * gelten, die eigene zuletzt (wie `tableMovedOn`). Wer nur `SessionState`
 * las, sah die Karte nie, die die Maske gesetzt hatte (T-202).
 */
export function sessionState(e: Pick<Entity, 'components'>): Record<string, unknown> {
  return {
    ...((e.components?.['SessionState'] ?? {}) as Record<string, unknown>),
    ...((e.components?.['Session'] ?? {}) as Record<string, unknown>),
  };
}

/** Wo eine Karte vorkommt: der Artikel und wie (`Session.activeMap`, `onMap`, `mapOf`). */
export interface MapUse {
  id: string;
  via: string;
}

/**
 * **Wo eine Karte vorkommt** (T-202): Sitzungen und andere Artikel, die sie
 * in einem Feld halten (`Session.activeMap`), Szenen und Kämpfe mit
 * `onMap` auf sie, und was sie selbst darstellt (`mapOf`). Die Gegenrichtung
 * ist eine Abfrage wie jede (K). Marken und Unterkarten zählen nicht —
 * die zeigt die Karte selbst.
 *
 * Ungesiebt: wer fragt, siebt danach.
 */
export function mapUses(entities: Iterable<Entity>, map: Entity): MapUse[] {
  const alle = [...entities];
  const raus = (assetUses(alle, new Set([map.id])).get(map.id) ?? []).filter(
    (u) => u.via !== 'marker' && u.via !== INSIDE_MAP_RELATION && u.via !== MAP_OF_RELATION,
  );
  for (const r of map.relations ?? []) {
    if (r.type === MAP_OF_RELATION && r.to && !raus.some((u) => u.id === r.to && u.via === MAP_OF_RELATION)) {
      raus.push({ id: r.to, via: MAP_OF_RELATION });
    }
  }
  return raus;
}
