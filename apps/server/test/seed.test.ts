/**
 * Der Start füllt nach, was eine ältere Datenbank nicht hatte (Migration
 * 019): Aufzählungen und Einstellungen — aber nur, solange der Teil leer
 * ist, damit eine Änderung am Server nicht beim nächsten Start verschwindet.
 */
import { describe, expect, it } from 'vitest';
import { seedRegistry } from '@nw/registry';
import { InMemoryRepository } from '../src/repo.js';
import { seedRegistryInto } from '../src/seed.js';

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
});
