/**
 * Install the seed registry. Idempotent: it writes the rows the code package
 * defines, so a fresh database and a redeployed one agree.
 */

import { seedRegistry } from '@nw/registry';
import type { InterfaceDef, Registry } from '@nw/model';
import type { Repository } from './repo.js';
import { pruefeVerlust, registerVerlust, type VerlustOptionen } from './verlust.js';

/**
 * Einen Registerteil schreiben, aber nie still etwas wegnehmen, das der
 * Bestand trägt (T-076): fällt eine Art, ein Feld, ein Listenwert oder
 * eine Kantenart weg, die in Artikeln steht, bricht der Start ab — es sei
 * denn, `ATLAS_ALLOW_DATA_LOSS` nennt `seed`. Dann wird gezählt und
 * geschrieben.
 */
export async function schreibeRegisterteil<K extends keyof Registry>(
  repo: Repository,
  part: K,
  value: Registry[K],
  verlust: VerlustOptionen = {},
): Promise<void> {
  const betroffen = await registerVerlust(await repo.getRegistry(), part, value, () =>
    repo.listEntities(),
  );
  pruefeVerlust('seed', betroffen, verlust);
  await repo.putRegistryPart(part, value);
}

export async function seedRegistryInto(
  repo: Repository,
  verlust: VerlustOptionen = {},
  seed: Registry = seedRegistry,
): Promise<void> {
  const current = await repo.getRegistry();
  const schreibe = <K extends keyof Registry>(part: K, value: Registry[K]) =>
    schreibeRegisterteil(repo, part, value, verlust);
  /* Aufzählungen und Einstellungen kamen später an den Server (Migration
     019): eine Datenbank, die schon Arten hat, bekommt sie beim nächsten
     Start nachgefüllt — aber nur, solange der Teil leer ist. Was jemand
     am Server geändert hat, bleibt. */
  if (!Object.keys(current.enums ?? {}).length && seed.enums) {
    await schreibe('enums', seed.enums);
  }
  if (!Object.keys(current.settings ?? {}).length && seed.settings) {
    await schreibe('settings', seed.settings);
  }
  /* Einheiten schrieb der Seed nie (T-123): eine frische Datenbank hatte
     keine, und ein Mass rechnete nicht um. Gleiche Regel wie oben. */
  if (!Object.keys(current.units ?? {}).length && Object.keys(seed.units ?? {}).length) {
    await schreibe('units', seed.units);
  }
  if (Object.keys(current.interfaces).length) {
    await ordneFelder(repo, current.interfaces, seed);
    return;
  }

  /* Eine Datenbank ohne Arten bekommt die Startzeilen ganz — stehen dort
     aber schon Kanten einer Art, die der Seed nicht kennt, wäre das ein
     stiller Verlust. */
  await schreibe('interfaces', seed.interfaces);
  await schreibe('relations', seed.relations);
  await schreibe('views', seed.views);
  await schreibe('vars', seed.vars);
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
  seed: Registry = seedRegistry,
): Promise<boolean> {
  let verschoben = false;
  const neu: Record<string, InterfaceDef> = {};
  for (const [name, def] of Object.entries(interfaces)) {
    const props = def.schema?.properties;
    const vorbild = seed.interfaces[name]?.schema?.properties;
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
