/**
 * Install the seed registry. Idempotent: it writes the rows the code package
 * defines, so a fresh database and a redeployed one agree.
 */

import { seedRegistry } from '@nw/registry';
import type { InterfaceDef } from '@nw/model';
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
  if (Object.keys(current.interfaces).length) {
    await ordneFelder(repo, current.interfaces);
    return;
  }

  await repo.putRegistryPart('interfaces', seedRegistry.interfaces);
  await repo.putRegistryPart('relations', seedRegistry.relations);
  await repo.putRegistryPart('views', seedRegistry.views);
  await repo.putRegistryPart('vars', seedRegistry.vars);
}

/**
 * Die Felder einer Art in der Reihenfolge der Startzeilen — und **nur** die
 * Reihenfolge (Migration 020).
 *
 * Bis zur Migration lag `schema` als `jsonb`, und das sortiert die
 * Schlüssel. Hier wird umgestellt, nicht geändert: ein Feld, das es in den
 * Startzeilen gibt, rückt an seinen Platz; eines, das jemand am Server
 * dazugelegt hat, folgt danach in seiner bisherigen Reihenfolge; keines
 * fällt weg, keines kommt dazu. Geschrieben wird nur, wenn sich etwas
 * verschiebt — danach hält `json` die Reihenfolge selbst.
 */
export async function ordneFelder(
  repo: Repository,
  interfaces: Record<string, InterfaceDef>,
): Promise<boolean> {
  let verschoben = false;
  const neu: Record<string, InterfaceDef> = {};
  for (const [name, def] of Object.entries(interfaces)) {
    const props = def.schema?.properties;
    const vorbild = seedRegistry.interfaces[name]?.schema?.properties;
    if (!props || !vorbild) {
      neu[name] = def;
      continue;
    }
    const reihe = [
      ...Object.keys(vorbild).filter((k) => k in props),
      ...Object.keys(props).filter((k) => !(k in vorbild)),
    ];
    if (reihe.join() !== Object.keys(props).join()) verschoben = true;
    neu[name] = {
      ...def,
      schema: { ...def.schema!, properties: Object.fromEntries(reihe.map((k) => [k, props[k]!])) },
    };
  }
  if (verschoben) await repo.putRegistryPart('interfaces', neu);
  return verschoben;
}
