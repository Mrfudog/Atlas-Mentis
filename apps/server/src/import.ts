/**
 * **Eine Ausfuhrdatei einlesen** — von der Kommandozeile, nicht über das
 * Netz (Arbeitsplan §4, P5; M13 schlanker).
 *
 *   pnpm --filter @nw/server run import <datei> [--replace]
 *   docker compose exec app node apps/server/dist/import.js <datei> [--replace]
 *
 * Dieselbe Semantik wie die Einfuhr des Prototyps: eine Datei mit
 * `registry` und **ohne** `entities` bringt nur die Zeilen; mit `entities`
 * kommen die Artikel dazu, und `--replace` löscht, was nicht in der Datei
 * steht. Jeder Artikel geht durch `validateEntity` mit `knownTypes`, **bevor**
 * irgendetwas geschrieben wird: eine halb eingelesene Datei wäre ein
 * Bestand, den niemand mehr erklären kann.
 *
 * **Verweigert, solange kein Verwaltungskonto existiert.** Ein Server ohne
 * Konto lässt Lesen ohne Anmeldung zu, damit man an einen frisch
 * aufgesetzten herankommt; mit zehntausend geladenen Artikeln wäre das
 * eine offene Bibliothek. Erst das Konto, dann der Bestand.
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  EntitySchema,
  RegistrySchema,
  isInstance,
  resolveInstance,
  stageBases,
  thinInstance,
  validateEntity,
} from '@nw/model';
import type { Entity, Registry } from '@nw/model';
import type { Repository } from './repo.js';

/** Die Registerteile, die die Ablage speichert. */
const TEILE = ['interfaces', 'relations', 'views', 'units', 'vars'] as const;

export interface ImportErgebnis {
  text: string;
  geschrieben: number;
  geloescht: number;
}

export class ImportFehler extends Error {}

export async function runImport(
  repo: Repository,
  daten: unknown,
  optionen: { replace?: boolean } = {},
): Promise<ImportErgebnis> {
  const verwaltung = (await repo.listUsers()).filter((u) => u.isAdmin && !u.disabledAt);
  if (!verwaltung.length) {
    throw new ImportFehler(
      'Kein Verwaltungskonto. Zuerst eines anlegen: `pnpm --filter @nw/server user add <name> --admin` — '
      + 'solange keins existiert, liest der Server ohne Anmeldung, und ein geladener Bestand wäre offen.',
    );
  }

  if (!daten || typeof daten !== 'object' || Array.isArray(daten)) throw new ImportFehler('Die Datei ist kein Objekt.');
  const d = daten as { format?: unknown; registry?: unknown; entities?: unknown };
  if (d.format !== undefined && !String(d.format).startsWith('nebelwacht/')) {
    throw new ImportFehler(`Unbekanntes Format: ${String(d.format)}`);
  }
  if (d.entities !== undefined && !Array.isArray(d.entities)) throw new ImportFehler('`entities` ist keine Liste.');

  /* Das Register der Datei gilt für die Prüfung, so wie es danach gilt.
     `components` ist der zweite Name für `interfaces` aus der Ausfuhr des
     Prototyps und wird hier nicht gebraucht. */
  const aktuell = await repo.getRegistry();
  let registry: Registry = aktuell;
  if (d.registry !== undefined) {
    const { components: _alt, ...roh } = d.registry as Record<string, unknown>;
    const geprueft = RegistrySchema.safeParse({ ...aktuell, ...roh });
    if (!geprueft.success) {
      throw new ImportFehler(`Register ungültig: ${geprueft.error.issues.slice(0, 5).map((i) => `${i.path.join('.')}: ${i.message}`).join('; ')}`);
    }
    registry = geprueft.data as Registry;
  }

  /* Nur Zeilen: der Bestand bleibt, wie er ist — auch mit `--replace`. Eine
     leere Liste `entities: []` ist etwas anderes: eine Sicherung ohne
     Artikel, also „alles weg". */
  if (d.entities === undefined) {
    const liegen = await schreibeRegister(repo, d.registry, registry);
    await repo.appendEvent('import.registry', undefined, {});
    return { text: `Register übernommen. Die Artikel bleiben, wie sie sind.${liegenText(liegen)}`, geschrieben: 0, geloescht: 0 };
  }

  const neu: Entity[] = [];
  const fehler: string[] = [];
  for (const [i, roh] of (d.entities as unknown[]).entries()) {
    const p = EntitySchema.safeParse(roh);
    if (!p.success) fehler.push(`#${i}: ${p.error.issues[0]?.message ?? 'ungültig'}`);
    else neu.push(p.data as Entity);
  }
  const ids = new Set<string>();
  for (const e of neu) {
    if (ids.has(e.id)) fehler.push(`${e.id}: steht zweimal in der Datei`);
    ids.add(e.id);
  }

  /* Was es danach gibt: mit `--replace` nur die Datei, sonst der Bestand
     und die Datei darüber. */
  const bestand = await repo.listEntities();
  const danach = new Map<string, Entity>();
  if (!optionen.replace) for (const e of bestand) danach.set(e.id, e);
  for (const e of neu) danach.set(e.id, e);
  const arten = new Map([...danach.values()].map((e) => [e.id, e.interfaces?.[0] ?? ''] as const));
  /* Die Ids einmal: ohne sie baut die Prüfung je Artikel ein Set aus
     allen Schlüsseln, und bei zehntausend Artikeln sind das Minuten. */
  const bekannt = new Set(arten.keys());
  const stufen = stageBases(danach.values());

  const zuSchreiben: Entity[] = [];
  for (const e of neu) {
    let pruefling = e;
    let schreib = e;
    if (isInstance(e)) {
      pruefling = resolveInstance(danach, e);
      schreib = thinInstance(danach, e);
    }
    for (const issue of validateEntity(registry, pruefling, { knownTypes: arten, knownIds: bekannt, stageOf: stufen })) {
      fehler.push(`${e.interfaces?.[0] ?? '?'} „${e.name}" (${e.id}): ${issue.message}`);
    }
    zuSchreiben.push(schreib);
  }
  if (fehler.length) {
    throw new ImportFehler(`${fehler.length} Fehler, nichts geschrieben:\n${fehler.slice(0, 30).join('\n')}${fehler.length > 30 ? `\n… ${fehler.length - 30} weitere` : ''}`);
  }

  const liegen = await schreibeRegister(repo, d.registry, registry);
  for (const e of zuSchreiben) await repo.putEntity(e);
  let geloescht = 0;
  if (optionen.replace) {
    for (const alt of bestand) {
      if (ids.has(alt.id)) continue;
      if (await repo.deleteEntity(alt.id)) geloescht += 1;
    }
  }
  await repo.appendEvent('import', undefined, { written: zuSchreiben.length, removed: geloescht, replace: Boolean(optionen.replace) });

  /* **Die eine Stelle, an der das Ersetzen etwas zurücklässt** (Abgleich
     §4.4, 5): Konten führen Figuren, und die Figur-Ids stehen am Konto,
     nicht im Bestand. Zeigen sie danach ins Leere, wird es gesagt. */
  const verwaist: string[] = [];
  for (const u of await repo.listUsers()) {
    const weg = (u.actorIds ?? []).filter((a) => !danach.has(a));
    if (weg.length) verwaist.push(`${u.name}: ${weg.join(', ')}`);
  }
  const zeilen = [`${zuSchreiben.length} Artikel geschrieben${geloescht ? `, ${geloescht} gelöscht` : ''}.`];
  if (verwaist.length) zeilen.push(`Figuren, die es nicht mehr gibt, an Konten:\n  ${verwaist.join('\n  ')}`);
  return { text: zeilen.join('\n') + liegenText(liegen), geschrieben: zuSchreiben.length, geloescht };
}

/**
 * Die Registerteile der Datei, die die Ablage kennt. Was sie nicht kennt
 * (heute `enums`, `settings`), kommt als Name zurück und steht in der
 * Meldung — still weggelassen sähe es aus wie übernommen.
 */
async function schreibeRegister(repo: Repository, roh: unknown, registry: Registry): Promise<string[]> {
  if (roh === undefined) return [];
  const teile = roh as Record<string, unknown>;
  const liegen = Object.keys(teile).filter((t) => t !== 'components' && !(TEILE as readonly string[]).includes(t));
  for (const teil of TEILE) {
    if (teile[teil] === undefined) continue;
    switch (teil) {
      case 'interfaces': await repo.putRegistryPart('interfaces', registry.interfaces); break;
      case 'relations': await repo.putRegistryPart('relations', registry.relations); break;
      case 'views': await repo.putRegistryPart('views', registry.views); break;
      case 'units': await repo.putRegistryPart('units', registry.units); break;
      case 'vars': await repo.putRegistryPart('vars', registry.vars); break;
    }
  }
  return liegen;
}

function liegenText(liegen: string[]): string {
  return liegen.length ? `\nNicht gespeichert, die Ablage kennt sie nicht: ${liegen.join(', ')}.` : '';
}

const direkt = process.argv[1]?.endsWith('import.ts') || process.argv[1]?.endsWith('import.js');
if (direkt) {
  const args = process.argv.slice(2);
  const datei = args.find((a) => !a.startsWith('--'));
  if (!datei) {
    console.error('import <datei> [--replace]');
    process.exit(2);
  }
  /* pnpm startet im Paketverzeichnis; ein relativer Pfad meint das, von wo
     aus jemand den Befehl getippt hat. */
  const pfad = resolve(process.env['INIT_CWD'] ?? process.cwd(), datei);
  const { closePool, getPool } = await import('./db.js');
  const { PgRepository } = await import('./repo.pg.js');
  const repo = new PgRepository(getPool());
  try {
    const daten = JSON.parse(readFileSync(pfad, 'utf8')) as unknown;
    const r = await runImport(repo, daten, { replace: args.includes('--replace') });
    console.log(r.text);
  } catch (x) {
    console.error((x as Error).message);
    process.exitCode = 1;
  } finally {
    await closePool();
  }
}
