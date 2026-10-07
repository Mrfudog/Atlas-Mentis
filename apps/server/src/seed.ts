/**
 * Install the seed registry. Idempotent: it writes the rows the code package
 * defines, so a fresh database and a redeployed one agree.
 */

import { seedRegistry } from '@nw/registry';
import type { Repository } from './repo.js';

export async function seedRegistryInto(repo: Repository): Promise<void> {
  const current = await repo.getRegistry();
  if (Object.keys(current.interfaces).length) return;

  await repo.putRegistryPart('interfaces', seedRegistry.interfaces);
  await repo.putRegistryPart('relations', seedRegistry.relations);
  await repo.putRegistryPart('views', seedRegistry.views);
  await repo.putRegistryPart('vars', seedRegistry.vars);
}
