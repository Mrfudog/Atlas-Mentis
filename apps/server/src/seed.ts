/**
 * Install the seed registry. Idempotent: it writes the rows the code package
 * defines, so a fresh database and a redeployed one agree.
 */

import { seedRegistry } from '@nw/registry';
import type { Repository } from './repo.js';

export async function seedRegistryInto(repo: Repository): Promise<void> {
  const current = await repo.getRegistry();
  /* Aufzählungen und Einstellungen kamen später an den Server (Migration
     019): eine Datenbank, die schon Arten hat, bekommt sie beim nächsten
     Start nachgefüllt — aber nur, solange der Teil leer ist. Was jemand
     am Server geändert hat, bleibt. */
  if (!Object.keys(current.enums ?? {}).length && seedRegistry.enums) {
    await repo.putRegistryPart('enums', seedRegistry.enums);
  }
  if (!Object.keys(current.settings ?? {}).length && seedRegistry.settings) {
    await repo.putRegistryPart('settings', seedRegistry.settings);
  }
  if (Object.keys(current.interfaces).length) return;

  await repo.putRegistryPart('interfaces', seedRegistry.interfaces);
  await repo.putRegistryPart('relations', seedRegistry.relations);
  await repo.putRegistryPart('views', seedRegistry.views);
  await repo.putRegistryPart('vars', seedRegistry.vars);
}
