/**
 * **Bilder verwalten** (T-119): Klasse, Verwendung, Ersetzen.
 *
 * Ein Bild ist ein Asset-Artikel (T-114). Wer es zeigt, hält seine Id —
 * in einem Feld mit `format: 'asset'` (`Image.image`, `Statblock.token`,
 * `Board.background`), in einem Kartenblatt (`Map.sheets[].image`) oder
 * über eine Kante. **Wo ein Bild verwendet wird, ist eine Rückfrage**, wie
 * jede Gegenrichtung (K): gespeichert wird nur der Verweis beim Verwender.
 */

import { typeChain } from './entity.js';
import type { Entity, LinkTarget, Registry } from './types.js';

export const ASSET_TYPE = 'Asset';

/** Die Klassen eines Bildes, wie sie in der Zeile stehen (`Asset.kind`); `image` ohne Angabe. */
export function assetKind(e: Entity): string {
  const k = (e.components?.[ASSET_TYPE] as { kind?: unknown } | undefined)?.kind;
  return typeof k === 'string' && k ? k : 'image';
}

/** Ist dieser Artikel ein Bild (Art `Asset` oder ein Untertyp)? */
export function isAsset(registry: Pick<Registry, 'interfaces'>, e: Entity): boolean {
  return typeChain(registry, e.interfaces?.[0] ?? '').includes(ASSET_TYPE);
}

/**
 * **Welche Klasse ein Feld anbietet** (T-119): aus `target.where`, wenn es
 * nach `Asset.kind` fragt. Ein Vorschlag — die Maske zeigt diese Klasse
 * zuerst und die übrigen auf Wunsch.
 */
export function offeredAssetKind(target: LinkTarget | undefined): string | null {
  const w = target?.where;
  if (!w || w.component !== ASSET_TYPE || w.property !== 'kind') return null;
  return typeof w.value === 'string' && w.value ? w.value : null;
}

export interface AssetUse {
  /** Der Artikel, der das Bild zeigt. */
  id: string;
  /** Wo: `Karte.feld` (auch `Map.sheets`) oder die Kantenart. */
  via: string;
}

/**
 * **Wo jedes Bild verwendet wird** — einmal über den Bestand: je Asset die
 * Artikel, die seine Id in einer Karte halten (in jeder Tiefe, so zählen
 * die Kartenblätter mit) oder mit einer Kante auf es zeigen. Gesucht wird
 * nach dem **ganzen Wert**: eine Id in einem Satz ist ein Verweis
 * (`[[…]]`) und kein Bild. Ein Asset, das auf sich selbst zeigt, und
 * `variantOf` zwischen Fassungen eines Bildes zählen nicht — eine Fassung
 * zeigt das Bild nicht, sie stammt davon ab.
 *
 * Ungesiebt: wer fragt, siebt die Verwender danach selbst. Sonst verriete
 * „wird verwendet" einen Artikel, den man nicht sehen darf.
 */
export function assetUses(entities: Iterable<Entity>, assetIds: ReadonlySet<string>): Map<string, AssetUse[]> {
  const raus = new Map<string, AssetUse[]>();
  const merke = (asset: string, use: AssetUse): void => {
    const liste = raus.get(asset) ?? raus.set(asset, []).get(asset)!;
    if (!liste.some((u) => u.id === use.id && u.via === use.via)) liste.push(use);
  };
  const suche = (wert: unknown, e: Entity, via: string, tiefe: number): void => {
    if (typeof wert === 'string') {
      if (wert !== e.id && assetIds.has(wert)) merke(wert, { id: e.id, via });
    } else if (Array.isArray(wert)) {
      for (const w of wert) suche(w, e, via, tiefe + 1);
    } else if (wert && typeof wert === 'object' && tiefe < 6) {
      for (const w of Object.values(wert)) suche(w, e, via, tiefe + 1);
    }
  };
  for (const e of entities) {
    for (const [karte, felder] of Object.entries(e.components ?? {})) {
      if (!felder || typeof felder !== 'object') continue;
      for (const [k, w] of Object.entries(felder)) suche(w, e, `${karte}.${k}`, 0);
    }
    for (const r of e.relations ?? []) {
      if (r.type === 'variantOf' || r.type === 'inLayer' || r.to === e.id || !assetIds.has(r.to)) continue;
      merke(r.to, { id: e.id, via: r.type });
    }
  }
  return raus;
}
