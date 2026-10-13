/**
 * Der Start füllt nach, was eine ältere Datenbank nicht hatte (Migration
 * 019): Aufzählungen und Einstellungen — aber nur, solange der Teil leer
 * ist, damit eine Änderung am Server nicht beim nächsten Start verschwindet.
 */
import { describe, expect, it } from 'vitest';
import { seedRegistry } from '@nw/registry';
import { InMemoryRepository } from '../src/repo.js';
import { ordneFelder, seedRegistryInto } from '../src/seed.js';
import type { InterfaceDef } from '@nw/model';

describe('seedRegistryInto', () => {
  it('füllt Aufzählungen und Einstellungen nach, wenn die Arten schon da sind', async () => {
    const { enums: _e, settings: _s, ...ohne } = seedRegistry;
    const repo = new InMemoryRepository(ohne);
    await seedRegistryInto(repo);
    const reg = await repo.getRegistry();
    expect(reg.enums?.['Ability']?.values.length).toBe(6);
    expect(reg.settings?.['carrySquares']).toBe(seedRegistry.settings?.['carrySquares']);
  });

  it('lässt geänderte Einstellungen stehen', async () => {
    const repo = new InMemoryRepository({ ...seedRegistry, settings: { slotDraw: 'belt:free action' } });
    await seedRegistryInto(repo);
    expect((await repo.getRegistry()).settings).toEqual({ slotDraw: 'belt:free action' });
  });

  /* Migration 020: `jsonb` hatte die Felder alphabetisch sortiert. */
  it('bringt die Feldreihenfolge der Startzeilen zurück, ohne etwas zu ändern', async () => {
    const spell = seedRegistry.interfaces['Spell']!;
    const props = spell.schema!.properties!;
    const sortiert = Object.fromEntries(
      [...Object.keys(props)].sort().map((k) => [k, props[k]!]),
    );
    const eigenes = { type: 'string' as const, title: 'House note' };
    const verdreht: InterfaceDef = {
      ...spell,
      schema: { ...spell.schema!, properties: { ...sortiert, hausnotiz: eigenes } },
    };
    const repo = new InMemoryRepository({
      ...seedRegistry,
      interfaces: { ...seedRegistry.interfaces, Spell: verdreht },
    });
    await seedRegistryInto(repo);
    const danach = (await repo.getRegistry()).interfaces['Spell']!.schema!.properties!;
    expect(Object.keys(danach)).toEqual([...Object.keys(props), 'hausnotiz']);
    expect(danach['hausnotiz']).toEqual(eigenes);
  });

  it('schreibt nichts, wenn alles schon in der Reihenfolge steht', async () => {
    const repo = new InMemoryRepository(seedRegistry);
    expect(await ordneFelder(repo, (await repo.getRegistry()).interfaces)).toBe(false);
  });
});
