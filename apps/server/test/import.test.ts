/**
 * Der Ladebefehl (P5): eine Ausfuhrdatei in den Bestand, durch
 * `validateEntity`, über das Repository — und nicht, solange niemand den
 * Bestand verwalten kann.
 */
import { randomUUID } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { seedRegistry } from '@nw/registry';
import type { Entity } from '@nw/model';
import { InMemoryRepository } from '../src/repo.js';
import { runImport } from '../src/import.js';

const regel = (id: string, name: string): Entity => ({
  id,
  interfaces: ['Rule'],
  name,
  components: { Identity: { name, id: `rule-${id}` }, Status: { status: 'ready' } },
});
const ebene: Entity = {
  id: 'e5_layer',
  interfaces: ['Layer'],
  name: 'D&D 5e (2014)',
  components: { Identity: { name: 'D&D 5e (2014)', id: 'layer-0001' }, Status: { status: 'ready' }, Layer: { kind: 'system' } },
};
const inEbene = (e: Entity): Entity => ({ ...e, relations: [{ id: 'inLayer-1', type: 'inLayer', to: ebene.id }] });

async function mitKonto(entities: Entity[] = [], admin = true, actorIds: string[] = []) {
  const repo = new InMemoryRepository(seedRegistry, entities);
  await repo.putUser({ id: randomUUID(), name: 'Basil', passwordHash: 'x', isAdmin: admin, actorIds, roles: {} });
  return repo;
}

describe('pnpm --filter @nw/server run import', () => {
  it('verweigert, solange kein Verwaltungskonto existiert — auch mit einem Spielerkonto', async () => {
    for (const repo of [new InMemoryRepository(seedRegistry, []), await mitKonto([], false)]) {
      await expect(runImport(repo, { format: 'nebelwacht/1', entities: [ebene] })).rejects.toThrow(/Verwaltungskonto/);
      expect(await repo.countEntities()).toBe(0);
    }
  });

  it('schreibt die Artikel einer Datei zum Bestand dazu', async () => {
    const repo = await mitKonto([regel('alt', 'Alt')]);
    const r = await runImport(repo, { format: 'nebelwacht/1', registry: seedRegistry, entities: [ebene, inEbene(regel('neu', 'Neu'))] });
    expect(r.geschrieben).toBe(2);
    expect((await repo.listEntities()).map((e) => e.id).sort()).toEqual(['e5_layer', 'alt', 'neu'].sort());
    expect(r.text).toMatch(/Nicht gespeichert.*enums/);
  });

  it('ersetzt mit --replace den Bestand und sagt, welche Figur an einem Konto verwaist', async () => {
    const repo = await mitKonto([regel('alt', 'Alt')], true, ['pc_rook']);
    const r = await runImport(repo, { format: 'nebelwacht/1', entities: [ebene] }, { replace: true });
    expect(r.geloescht).toBe(1);
    expect((await repo.listEntities()).map((e) => e.id)).toEqual(['e5_layer']);
    expect(r.text).toMatch(/Basil: pc_rook/);
  });

  it('nimmt eine Datei ohne `entities` als Registerlieferung und lässt den Bestand stehen, auch mit --replace', async () => {
    const repo = await mitKonto([regel('alt', 'Alt')]);
    const r = await runImport(repo, { format: 'nebelwacht/1', registry: { interfaces: seedRegistry.interfaces } }, { replace: true });
    expect(r.text).toMatch(/Register übernommen/);
    expect(await repo.countEntities()).toBe(1);
    expect(Object.keys((await repo.getRegistry()).interfaces)).toContain('Spell');
  });

  it('schreibt nichts, wenn ein einziger Artikel die Prüfung nicht besteht', async () => {
    const repo = await mitKonto();
    const kaputt: Entity = { ...regel('x', 'X'), relations: [{ id: 'r', type: 'inLayer', to: 'gibt-es-nicht' }] };
    const ohneName: Entity = { id: 'y', interfaces: ['Rule'], name: 'Y', components: { Status: { status: 'ready' } } };
    await expect(runImport(repo, { entities: [ebene, kaputt, ohneName] })).rejects.toThrow(/3 Fehler, nichts geschrieben[\s\S]*gibt-es-nicht[\s\S]*Identity\.name is required/);
    expect(await repo.countEntities()).toBe(0);
  });

  it('lehnt ein fremdes Format und eine doppelte Id ab', async () => {
    const repo = await mitKonto();
    await expect(runImport(repo, { format: 'foundry/9', entities: [] })).rejects.toThrow(/Unbekanntes Format/);
    await expect(runImport(repo, { entities: [ebene, ebene] })).rejects.toThrow(/zweimal/);
  });
});
