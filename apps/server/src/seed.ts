/**
 * Install the seed registry. Idempotent: it writes the rows the code package
 * defines, so a fresh database and a redeployed one agree.
 */

import { seedRegistry } from '@nw/registry';
import type { Repository } from './repo.js';

export async function seedRegistryInto(repo: Repository): Promise<void> {
  const current = await repo.getRegistry();
  const empty =
    !Object.keys(current.interfaces).length && !Object.keys(current.components).length;
  if (!empty) return;

  await repo.putRegistryPart('components', seedRegistry.components);
  await repo.putRegistryPart('interfaces', seedRegistry.interfaces);
  await repo.putRegistryPart('relations', seedRegistry.relations);
  await repo.putRegistryPart('views', seedRegistry.views);
  await repo.putRegistryPart('vars', seedRegistry.vars);
}
