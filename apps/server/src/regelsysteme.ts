/**
 * **Die Startebenen nachziehen** (E-166, T-394, T-425): legt beim Start
 * die Ebenen aus `START_LAYERS` an, die es noch nicht gibt — die
 * Regelsysteme und die Parkplatz-Ebene „Unassigned“ (E-182) —, mit Nummer
 * und durch `validateEntity`. Was schon steht, bleibt, wie es ist: die
 * Leitung darf daran ändern, und ein Start überschreibt nichts. Gelöscht
 * wird nichts (T-076).
 */

import { START_LAYERS } from '@nw/registry';
import { nextId, validateEntity, type Entity } from '@nw/model';
import type { Repository } from './repo.js';

export async function regelsystemeNachziehen(repo: Repository, log: (m: string) => void = () => {}): Promise<string[]> {
  const registry = await repo.getRegistry();
  const alle = await repo.listEntities();
  const da = new Set(alle.map((e) => e.id));
  const neu: string[] = [];
  const nummern: string[] = [];
  for (const vorlage of START_LAYERS) {
    if (da.has(vorlage.id)) continue;
    /* Ohne die Art (ältere Datenbank vor Migration 140) nichts anlegen. */
    if (!registry.interfaces[vorlage.interfaces?.[0] ?? '']) continue;
    /* Die Nummer nach der Art, wie beim Anlegen in der Maske (`rulesystem-0001`). */
    const id = nextId(alle, vorlage.interfaces?.[0] ?? 'Layer', nummern);
    nummern.push(id);
    const ident = vorlage.components?.['Identity'] as Record<string, unknown>;
    const e: Entity = { ...vorlage, components: { ...vorlage.components, Identity: { ...ident, id } } };
    const probleme = validateEntity(registry, e);
    if (probleme.length) {
      log(`Startebene ${vorlage.id} nicht angelegt: ${probleme.map((p) => p.message).join('; ')}`);
      continue;
    }
    await repo.putEntity(e);
    da.add(e.id);
    neu.push(e.id);
  }
  if (neu.length) log(`Startebenen angelegt: ${neu.join(', ')}`);
  return neu;
}
